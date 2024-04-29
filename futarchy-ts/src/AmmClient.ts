import { AnchorProvider, IdlTypes, Program } from "@coral-xyz/anchor";
import { AddressLookupTableAccount, Keypair, PublicKey } from "@solana/web3.js";

import { Amm as AmmIDLType, IDL as AmmIDL } from "./types/amm";

import BN from "bn.js";
import { AMM_PROGRAM_ID } from "./constants";
import { Amm } from "./types";
import { getATA, getAmmLpMintAddr, getAmmAddr } from "./utils/pda";
import { MethodsBuilder } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import { MintLayout, unpackMint } from "@solana/spl-token";
import { PriceMath } from "./utils/priceMath";

export type SwapType = IdlTypes<AmmIDLType>["SwapType"];

export type CreateAmmClientParams = {
  provider: AnchorProvider;
  ammProgramId?: PublicKey;
};

export type AddLiquiditySimulation = {
  baseAmount: BN;
  quoteAmount: BN;
  expectedLpTokens: BN;
};

export type SwapSimulation = {
  expectedOut: BN;
  newBaseReserves: BN;
  newQuoteReserves: BN;
};

export class AmmClient {
  public readonly provider: AnchorProvider;
  public readonly program: Program<AmmIDLType>;
  public readonly luts: AddressLookupTableAccount[];

  constructor(
    provider: AnchorProvider,
    ammProgramId: PublicKey,
    luts: AddressLookupTableAccount[]
  ) {
    this.provider = provider;
    this.program = new Program<AmmIDLType>(AmmIDL, ammProgramId, provider);
    this.luts = luts;
  }

  public static createClient(
    createAutocratClientParams: CreateAmmClientParams
  ): AmmClient {
    let { provider, ammProgramId: programId } = createAutocratClientParams;

    const luts: AddressLookupTableAccount[] = [];

    return new AmmClient(provider, programId || AMM_PROGRAM_ID, luts);
  }

  getProgramId(): PublicKey {
    return this.program.programId;
  }

  async createAmm(
    proposal: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    twapInitialObservation: number,
    twapMaxObservationChangePerUpdate?: number
  ): Promise<PublicKey> {
    if (!twapMaxObservationChangePerUpdate) {
      twapMaxObservationChangePerUpdate = twapInitialObservation * 0.02;
    }
    let [amm] = getAmmAddr(this.getProgramId(), baseMint, quoteMint, proposal);

    let baseDecimals = unpackMint(
      baseMint,
      await this.provider.connection.getAccountInfo(baseMint)
    ).decimals;
    let quoteDecimals = unpackMint(
      quoteMint,
      await this.provider.connection.getAccountInfo(quoteMint)
    ).decimals;

    let [twapFirstObservationScaled, twapMaxObservationChangePerUpdateScaled] =
      PriceMath.getAmmPrices(
        baseDecimals,
        quoteDecimals,
        twapInitialObservation,
        twapMaxObservationChangePerUpdate
      );

    await this.createAmmIx(
      baseMint,
      quoteMint,
      twapFirstObservationScaled,
      twapMaxObservationChangePerUpdateScaled,
      proposal
    ).rpc();

    return amm;
  }

  // both twap values need to be scaled beforehand
  createAmmIx(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    twapInitialObservation: BN,
    twapMaxObservationChangePerUpdate: BN,
    proposal: PublicKey
  ): MethodsBuilder<AmmIDLType, any> {
    let [amm] = getAmmAddr(this.getProgramId(), baseMint, quoteMint, proposal);
    let [lpMint] = getAmmLpMintAddr(this.getProgramId(), amm);

    let [vaultAtaBase] = getATA(baseMint, amm);
    let [vaultAtaQuote] = getATA(quoteMint, amm);

    return this.program.methods
      .createAmm({
        twapInitialObservation,
        twapMaxObservationChangePerUpdate,
        proposal,
      })
      .accounts({
        user: this.provider.publicKey,
        amm,
        lpMint,
        baseMint,
        quoteMint,
        vaultAtaBase,
        vaultAtaQuote,
      });
  }

  // async addLiquidity(
  //   amm: PublicKey,
  // ) {
  //   let storedAmm = await this.getAmm(amm);

  //   let ix = this.addLiquidityIx(
  //     amm,
  //     storedAmm.baseMint,
  //     storedAmm.quoteMint,
  //     maxBaseAmount instanceof BN ? maxBaseAmount : new BN(maxBaseAmount),
  //     maxQuoteAmount instanceof BN ? maxQuoteAmount : new BN(maxQuoteAmount),
  //     minBaseAmount instanceof BN ? minBaseAmount : new BN(minBaseAmount),
  //     minQuoteAmount instanceof BN ? minQuoteAmount : new BN(minQuoteAmount),
  //     user ? user.publicKey : undefined
  //   );

  //   if (user) {
  //     ix = ix.signers([user]);
  //   }

  //   return ix.rpc();
  // }

  async addLiquidity(
    amm: PublicKey,
    quoteAmount?: number,
    baseAmount?: number
  ) {
    let storedAmm = await this.getAmm(amm);

    let lpMintSupply = unpackMint(
      storedAmm.lpMint,
      await this.provider.connection.getAccountInfo(storedAmm.lpMint)
    ).supply;

    let quoteAmountCasted: BN | undefined;
    let baseAmountCasted: BN | undefined;

    if (quoteAmount != undefined) {
      let quoteDecimals = unpackMint(
        storedAmm.quoteMint,
        await this.provider.connection.getAccountInfo(storedAmm.quoteMint)
      ).decimals;
      quoteAmountCasted = new BN(quoteAmount).mul(
        new BN(10).pow(new BN(quoteDecimals))
      );
    }

    if (baseAmount != undefined) {
      let baseDecimals = unpackMint(
        storedAmm.baseMint,
        await this.provider.connection.getAccountInfo(storedAmm.baseMint)
      ).decimals;
      baseAmountCasted = new BN(baseAmount).mul(
        new BN(10).pow(new BN(baseDecimals))
      );
    }

    if (lpMintSupply == 0n) {
      if (quoteAmount == undefined || baseAmount == undefined) {
        throw new Error(
          "No pool created yet, you need to specify both base and quote"
        );
      }

      // console.log(quoteAmountCasted?.toString());
      // console.log(baseAmountCasted?.toString())

      return await this.addLiquidityIx(
        amm,
        storedAmm.baseMint,
        storedAmm.quoteMint,
        quoteAmountCasted as BN,
        baseAmountCasted as BN,
        new BN(0)
      ).rpc();
    }

    //   quoteAmount == undefined ? undefined : new BN(quoteAmount);
    // let baseAmountCasted: BN | undefined =
    //   baseAmount == undefined ? undefined : new BN(baseAmount);

    let sim = this.simulateAddLiquidity(
      storedAmm.baseAmount,
      storedAmm.quoteAmount,
      Number(lpMintSupply),
      baseAmountCasted,
      quoteAmountCasted
    );

    await this.addLiquidityIx(
      amm,
      storedAmm.baseMint,
      storedAmm.quoteMint,
      sim.quoteAmount,
      sim.baseAmount,
      sim.expectedLpTokens
    ).rpc();
  }

  addLiquidityIx(
    amm: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    quoteAmount: BN,
    maxBaseAmount: BN,
    minLpTokens: BN,
    user: PublicKey = this.provider.publicKey
  ) {
    const [lpMint] = getAmmLpMintAddr(this.program.programId, amm);

    return this.program.methods
      .addLiquidity({
        quoteAmount,
        maxBaseAmount,
        minLpTokens,
      })
      .accounts({
        user,
        amm,
        baseMint,
        quoteMint,
        lpMint,
        userAtaLp: getATA(lpMint, user)[0],
        userAtaBase: getATA(baseMint, user)[0],
        userAtaQuote: getATA(quoteMint, user)[0],
        vaultAtaBase: getATA(baseMint, amm)[0],
        vaultAtaQuote: getATA(quoteMint, amm)[0],
      });
  }

  removeLiquidityIx(
    ammAddr: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    lpTokensToBurn: BN,
    minBaseAmount: BN,
    minQuoteAmount: BN
  ) {
    const [lpMint] = getAmmLpMintAddr(this.program.programId, ammAddr);

    return this.program.methods
      .removeLiquidity({
        lpTokensToBurn,
        minBaseAmount,
        minQuoteAmount,
      })
      .accounts({
        user: this.provider.publicKey,
        amm: ammAddr,
        lpMint,
        baseMint,
        quoteMint,
        userAtaLp: getATA(lpMint, this.provider.publicKey)[0],
        userAtaBase: getATA(baseMint, this.provider.publicKey)[0],
        userAtaQuote: getATA(quoteMint, this.provider.publicKey)[0],
        vaultAtaBase: getATA(baseMint, ammAddr)[0],
        vaultAtaQuote: getATA(quoteMint, ammAddr)[0],
      });
  }

  async swap(
    amm: PublicKey,
    swapType: SwapType,
    inputAmount: number,
    outputAmountMin: number
  ) {
    const storedAmm = await this.getAmm(amm);

    let quoteDecimals = await this.getDecimals(storedAmm.quoteMint);
    let baseDecimals = await this.getDecimals(storedAmm.baseMint);

    let inputAmountScaled: BN;
    let outputAmountMinScaled: BN;
    if (swapType.buy) {
      inputAmountScaled = PriceMath.scale(inputAmount, quoteDecimals);
      outputAmountMinScaled = PriceMath.scale(outputAmountMin, baseDecimals);
    } else {
      inputAmountScaled = PriceMath.scale(inputAmount, baseDecimals);
      outputAmountMinScaled = PriceMath.scale(outputAmountMin, quoteDecimals);
    }

    return await this.swapIx(
      amm,
      storedAmm.baseMint,
      storedAmm.quoteMint,
      swapType,
      inputAmountScaled,
      outputAmountMinScaled
    ).rpc();
  }

  swapIx(
    amm: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    swapType: SwapType,
    inputAmount: BN,
    outputAmountMin: BN
  ) {
    return this.program.methods
      .swap({
        swapType,
        inputAmount,
        outputAmountMin,
      })
      .accounts({
        user: this.provider.publicKey,
        amm: amm,
        baseMint,
        quoteMint,
        userAtaBase: getATA(baseMint, this.provider.publicKey)[0],
        userAtaQuote: getATA(quoteMint, this.provider.publicKey)[0],
        vaultAtaBase: getATA(baseMint, amm)[0],
        vaultAtaQuote: getATA(quoteMint, amm)[0],
      });
  }

  async crankThatTwap(amm: PublicKey) {
    return this.crankThatTwapIx(amm).rpc();
  }

  crankThatTwapIx(amm: PublicKey) {
    return this.program.methods.crankThatTwap().accounts({
      amm,
    });
  }

  // getter functions

  // async getLTWAP(ammAddr: PublicKey): Promise<number> {
  //   const amm = await this.program.account.amm.fetch(ammAddr);
  //   return amm.twapLastObservationUq64X32
  //     .div(new BN(2).pow(new BN(32)))
  //     .toNumber();
  // }

  async getAmm(ammAddr: PublicKey): Promise<Amm> {
    return await this.program.account.amm.fetch(ammAddr);
  }

  getTwap(amm: Amm): BN {
    return amm.oracle.aggregator.div(
      amm.oracle.lastUpdatedSlot.sub(amm.createdAtSlot)
    );
  }

  simulateAddLiquidity(
    baseReserves: BN,
    quoteReserves: BN,
    lpMintSupply: number,
    baseAmount?: BN,
    quoteAmount?: BN
  ): AddLiquiditySimulation {
    if (lpMintSupply == 0) {
      throw new Error(
        "This AMM doesn't have existing liquidity so we can't fill in the blanks"
      );
    }

    if (baseAmount == undefined && quoteAmount == undefined) {
      throw new Error("Must specify either a base amount or a quote amount");
    }

    let expectedLpTokens: BN;

    if (quoteAmount == undefined) {
      quoteAmount = baseAmount?.mul(quoteReserves).div(baseReserves);
    }
    baseAmount = quoteAmount?.mul(baseReserves).div(quoteReserves).addn(1);

    expectedLpTokens = quoteAmount
      ?.mul(new BN(lpMintSupply))
      .div(quoteReserves) as BN;

    return {
      quoteAmount: quoteAmount as BN,
      baseAmount: baseAmount as BN,
      expectedLpTokens,
    };
  }

  simulateSwap(
    inputAmount: BN,
    swapType: SwapType,
    baseReserves: BN,
    quoteReserves: BN
  ): SwapSimulation {
    if (baseReserves.eqn(0) || quoteReserves.eqn(0)) {
      throw new Error("reserves must be non-zero");
    }

    let inputReserves, outputReserves: BN;
    if (swapType.buy) {
      inputReserves = quoteReserves;
      outputReserves = baseReserves;
    } else {
      inputReserves = baseReserves;
      outputReserves = quoteReserves;
    }

    let inputAmountWithFee: BN = inputAmount.muln(990);

    let numerator: BN = inputAmountWithFee.mul(outputReserves);
    let denominator: BN = inputReserves.muln(1000).add(inputAmountWithFee);

    let expectedOut = numerator.div(denominator);

    let newBaseReserves, newQuoteReserves: BN;
    if (swapType.buy) {
      newBaseReserves = baseReserves.sub(expectedOut);
      newQuoteReserves = quoteReserves.add(inputAmount);
    } else {
      newBaseReserves = baseReserves.add(inputAmount);
      newQuoteReserves = quoteReserves.sub(expectedOut);
    }

    return {
      expectedOut,
      newBaseReserves,
      newQuoteReserves,
    };
  }

  async getDecimals(mint: PublicKey): Promise<number> {
    return unpackMint(mint, await this.provider.connection.getAccountInfo(mint))
      .decimals;
  }
}
