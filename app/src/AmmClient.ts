import { AnchorProvider, IdlTypes, Program } from "@coral-xyz/anchor";
import { AddressLookupTableAccount, Keypair, PublicKey } from "@solana/web3.js";

import { Amm as AmmIDLType, IDL as AmmIDL } from "./types/amm";

import BN from "bn.js";
import { AMM_PROGRAM_ID } from "./constants";
import { Amm, AmmWrapper } from "./types";
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
  minLpTokens: BN;
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
      PriceMath.scalePrices(
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
      sim.minLpTokens
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

  swapIx(
    ammAddr: PublicKey,
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
        amm: ammAddr,
        baseMint,
        quoteMint,
        userAtaBase: getATA(baseMint, this.provider.publicKey)[0],
        userAtaQuote: getATA(quoteMint, this.provider.publicKey)[0],
        vaultAtaBase: getATA(baseMint, ammAddr)[0],
        vaultAtaQuote: getATA(quoteMint, ammAddr)[0],
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

  async getAllAmms(): Promise<AmmWrapper[]> {
    return await this.program.account.amm.all();
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
    console.log(baseAmount?.toString());

    return {
      quoteAmount: quoteAmount as BN,
      baseAmount: baseAmount as BN,
      expectedLpTokens,
      minLpTokens: expectedLpTokens.muln(99).divn(100),
    };
  }

  getSwapPreview(amm: Amm, inputAmount: BN, isBuyBase: boolean): SwapPreview {
    let quoteAmount = amm.quoteAmount;
    let baseAmount = amm.baseAmount;

    let startPrice =
      quoteAmount.toNumber() /
      10 ** amm.quoteMintDecimals /
      (baseAmount.toNumber() / 10 ** amm.baseMintDecimals);

    let k = quoteAmount.mul(baseAmount);

    let inputMinusFee = inputAmount
      .mul(new BN(10_000).subn(100))
      .div(new BN(10_000));

    if (isBuyBase) {
      let tempQuoteAmount = quoteAmount.add(inputMinusFee);
      let tempBaseAmount = k.div(tempQuoteAmount);

      let finalPrice =
        tempQuoteAmount.toNumber() /
        10 ** amm.quoteMintDecimals /
        (tempBaseAmount.toNumber() / 10 ** amm.baseMintDecimals);

      let outputAmountBase = baseAmount.sub(tempBaseAmount);

      let inputUnits = inputAmount.toNumber() / 10 ** amm.quoteMintDecimals;
      let outputUnits =
        outputAmountBase.toNumber() / 10 ** amm.baseMintDecimals;

      let priceImpact = Math.abs(finalPrice - startPrice) / startPrice;

      return {
        isBuyBase,
        inputAmount,
        outputAmount: outputAmountBase,
        inputUnits,
        outputUnits,
        startPrice,
        finalPrice,
        avgSwapPrice: inputUnits / outputUnits,
        priceImpact,
      };
    } else {
      let tempBaseAmount = baseAmount.add(inputMinusFee);
      let tempQuoteAmount = k.div(tempBaseAmount);

      let finalPrice =
        tempQuoteAmount.toNumber() /
        10 ** amm.quoteMintDecimals /
        (tempBaseAmount.toNumber() / 10 ** amm.baseMintDecimals);

      let outputAmountQuote = quoteAmount.sub(tempQuoteAmount);

      let inputUnits = inputAmount.toNumber() / 10 ** amm.baseMintDecimals;
      let outputUnits =
        outputAmountQuote.toNumber() / 10 ** amm.quoteMintDecimals;

      let priceImpact = Math.abs(finalPrice - startPrice) / startPrice;

      return {
        isBuyBase,
        inputAmount,
        outputAmount: outputAmountQuote,
        inputUnits,
        outputUnits,
        startPrice,
        finalPrice,
        avgSwapPrice: outputUnits / inputUnits,
        priceImpact,
      };
    }
  }
}

export type SwapPreview = {
  isBuyBase: boolean;
  inputAmount: BN;
  outputAmount: BN;
  inputUnits: number;
  outputUnits: number;
  startPrice: number;
  finalPrice: number;
  avgSwapPrice: number;
  priceImpact: number;
};
