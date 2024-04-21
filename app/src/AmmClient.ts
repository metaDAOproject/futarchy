import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AddressLookupTableAccount, Keypair, PublicKey } from "@solana/web3.js";

import { Amm as AmmIDLType, IDL as AmmIDL } from "./types/amm";

import * as ixs from "./instructions/amm";
import BN from "bn.js";
import { AMM_PROGRAM_ID } from "./constants";
import { Amm, AmmWrapper } from "./types";
import { getATA, getAmmLpMintAddr } from "./utils/pda";

export type CreateAmmClientParams = {
  provider: AnchorProvider;
  ammProgramId?: PublicKey;
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

  // both twap values need to be scaled beforehand
  createAmm(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    twapInitialObservation: BN,
    twapMaxObservationChangePerUpdate: BN,
    proposal: PublicKey
  ) {
    return ixs.createAmmHandler(
      this,
      baseMint,
      quoteMint,
      twapInitialObservation,
      twapMaxObservationChangePerUpdate,
      proposal
    );
  }

  async addLiquidity(
    amm: PublicKey,
    maxBaseAmount: BN | number,
    maxQuoteAmount: BN | number,
    minBaseAmount: BN | number,
    minQuoteAmount: BN | number,
    user?: Keypair
  ) {
    let storedAmm = await this.getAmm(amm);

    let ix = this.addLiquidityIx(
      amm,
      storedAmm.baseMint,
      storedAmm.quoteMint,
      maxBaseAmount instanceof BN ? maxBaseAmount : new BN(maxBaseAmount),
      maxQuoteAmount instanceof BN ? maxQuoteAmount : new BN(maxQuoteAmount),
      minBaseAmount instanceof BN ? minBaseAmount : new BN(minBaseAmount),
      minQuoteAmount instanceof BN ? minQuoteAmount : new BN(minQuoteAmount),
      user ? user.publicKey : undefined
    );

    if (user) {
      ix = ix.signers([user]);
    }

    return ix.rpc();
  }

  addLiquidityIx(
    amm: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    maxBaseAmount: BN,
    maxQuoteAmount: BN,
    minBaseAmount: BN,
    minQuoteAmount: BN,
    user: PublicKey = this.provider.publicKey
  ) {
    const [lpMint] = getAmmLpMintAddr(this.program.programId, amm);

    return this.program.methods
      .addLiquidity(
        maxBaseAmount,
        maxQuoteAmount,
        minBaseAmount,
        minQuoteAmount
      )
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
    minQuoteAmount: BN,
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

  swap(
    ammAddr: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    isQuoteToBase: boolean,
    inputAmount: BN,
    minOutputAmount: BN
  ) {
    return ixs.swapHandler(
      this,
      ammAddr,
      baseMint,
      quoteMint,
      isQuoteToBase,
      inputAmount,
      minOutputAmount
    );
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
