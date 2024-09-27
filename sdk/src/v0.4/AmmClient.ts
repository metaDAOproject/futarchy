import { AnchorProvider, IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountInfo,
  AddressLookupTableAccount,
  Keypair,
  PublicKey,
} from "@solana/web3.js";

import { Amm as AmmIDLType, IDL as AmmIDL } from "./types/amm.js";

import BN from "bn.js";
import { AMM_PROGRAM_ID } from "./constants.js";
import { Amm, LowercaseKeys } from "./types/index.js";
import { getAmmLpMintAddr, getAmmAddr } from "./utils/pda.js";
// import { MethodsBuilder } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import {
  MintLayout,
  unpackMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { PriceMath } from "./utils/priceMath.js";

export type SwapType = LowercaseKeys<IdlTypes<AmmIDLType>["SwapType"]>;

export type CreateAmmClientParams = {
  provider: AnchorProvider;
  ammProgramId?: PublicKey;
};

export type AddLiquiditySimulation = {
  baseAmount: BN;
  quoteAmount: BN;
  expectedLpTokens: BN;
  minLpTokens?: BN;
  maxBaseAmount?: BN;
};

export type SwapSimulation = {
  expectedOut: BN;
  newBaseReserves: BN;
  newQuoteReserves: BN;
  minExpectedOut?: BN;
};

export type RemoveLiquiditySimulation = {
  expectedBaseOut: BN;
  expectedQuoteOut: BN;
  minBaseOut?: BN;
  minQuoteOut?: BN;
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

  async getAmm(amm: PublicKey): Promise<Amm> {
    return await this.program.account.amm.fetch(amm);
  }

  async fetchAmm(amm: PublicKey): Promise<Amm | null> {
    return await this.program.account.amm.fetchNullable(amm);
  }

  async deserializeAmm(accountInfo: AccountInfo<Buffer>): Promise<Amm> {
    return this.program.coder.accounts.decode("amm", accountInfo.data);
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
    let [amm] = getAmmAddr(this.getProgramId(), baseMint, quoteMint);

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

    await this.initializeAmmIx(
      baseMint,
      quoteMint,
      twapFirstObservationScaled,
      twapMaxObservationChangePerUpdateScaled
    ).rpc();

    return amm;
  }

  // both twap values need to be scaled beforehand
  initializeAmmIx(
    baseMint: PublicKey,
    quoteMint: PublicKey,
    twapInitialObservation: BN,
    twapMaxObservationChangePerUpdate: BN
  ) {
    let [amm] = getAmmAddr(this.getProgramId(), baseMint, quoteMint);
    let [lpMint] = getAmmLpMintAddr(this.getProgramId(), amm);

    let vaultAtaBase = getAssociatedTokenAddressSync(baseMint, amm, true);
    let vaultAtaQuote = getAssociatedTokenAddressSync(quoteMint, amm, true);

    return this.program.methods
      .createAmm({
        twapInitialObservation,
        twapMaxObservationChangePerUpdate,
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

    const userLpAccount = getAssociatedTokenAddressSync(lpMint, user);

    return this.program.methods
      .addLiquidity({
        quoteAmount,
        maxBaseAmount,
        minLpTokens,
      })
      .accounts({
        user,
        amm,
        lpMint,
        userLpAccount,
        userBaseAccount: getAssociatedTokenAddressSync(baseMint, user),
        userQuoteAccount: getAssociatedTokenAddressSync(quoteMint, user),
        vaultAtaBase: getAssociatedTokenAddressSync(baseMint, amm, true),
        vaultAtaQuote: getAssociatedTokenAddressSync(quoteMint, amm, true),
      })
      .preInstructions([
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          userLpAccount,
          this.provider.publicKey,
          lpMint
        ),
      ]);
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
        userLpAccount: getAssociatedTokenAddressSync(
          lpMint,
          this.provider.publicKey
        ),
        userBaseAccount: getAssociatedTokenAddressSync(
          baseMint,
          this.provider.publicKey
        ),
        userQuoteAccount: getAssociatedTokenAddressSync(
          quoteMint,
          this.provider.publicKey
        ),
        vaultAtaBase: getAssociatedTokenAddressSync(baseMint, ammAddr, true),
        vaultAtaQuote: getAssociatedTokenAddressSync(quoteMint, ammAddr, true),
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
    outputAmountMin: BN,
    user: PublicKey = this.provider.publicKey
  ) {
    const receivingToken = swapType.buy ? baseMint : quoteMint;

    return this.program.methods
      .swap({
        swapType,
        inputAmount,
        outputAmountMin,
      })
      .accounts({
        user,
        amm,
        userBaseAccount: getAssociatedTokenAddressSync(baseMint, user, true),
        userQuoteAccount: getAssociatedTokenAddressSync(quoteMint, user, true),
        vaultAtaBase: getAssociatedTokenAddressSync(baseMint, amm, true),
        vaultAtaQuote: getAssociatedTokenAddressSync(quoteMint, amm, true),
      })
      .preInstructions([
        // create the receiving token account if it doesn't exist
        createAssociatedTokenAccountIdempotentInstruction(
          this.provider.publicKey,
          getAssociatedTokenAddressSync(receivingToken, user),
          user,
          receivingToken
        ),
      ]);
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
    quoteAmount?: BN,
    slippageBps?: BN
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

    let minLpTokens, maxBaseAmount;
    if (slippageBps) {
      minLpTokens = PriceMath.subtractSlippage(expectedLpTokens, slippageBps);
      maxBaseAmount = PriceMath.addSlippage(baseAmount as BN, slippageBps);
    }

    return {
      quoteAmount: quoteAmount as BN,
      baseAmount: baseAmount as BN,
      expectedLpTokens,
      minLpTokens,
      maxBaseAmount,
    };
  }

  simulateSwap(
    inputAmount: BN,
    swapType: SwapType,
    baseReserves: BN,
    quoteReserves: BN,
    slippageBps?: BN
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
    let minExpectedOut;
    if (slippageBps) {
      minExpectedOut = PriceMath.subtractSlippage(expectedOut, slippageBps);
    }

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
      minExpectedOut,
    };
  }

  simulateRemoveLiquidity(
    lpTokensToBurn: BN,
    baseReserves: BN,
    quoteReserves: BN,
    lpTotalSupply: BN,
    slippageBps?: BN
  ): RemoveLiquiditySimulation {
    const expectedBaseOut = lpTokensToBurn.mul(baseReserves).div(lpTotalSupply);
    const expectedQuoteOut = lpTokensToBurn
      .mul(quoteReserves)
      .div(lpTotalSupply);

    let minBaseOut, minQuoteOut;
    if (slippageBps) {
      minBaseOut = PriceMath.subtractSlippage(expectedBaseOut, slippageBps);
      minQuoteOut = PriceMath.subtractSlippage(expectedQuoteOut, slippageBps);
    }

    return {
      expectedBaseOut,
      expectedQuoteOut,
      minBaseOut,
      minQuoteOut,
    };
  }

  async getDecimals(mint: PublicKey): Promise<number> {
    return unpackMint(mint, await this.provider.connection.getAccountInfo(mint))
      .decimals;
  }

  /**
   * Calculates the optimal swap amount and mergeable tokens without using square roots.
   * @param userTokens BN – User's base tokens (pass or fail tokens), in smallest units.
   * @param baseAmount BN – Amount of base tokens in the AMM, in smallest units.
   * @param quoteAmount BN – Amount of quote tokens in the AMM, in smallest units.
   * @param decimals number – Number of decimals for the tokens (e.g., 6 for USDC).
   * @returns An object containing the optimal swap amount, expected quote received, and expected mergeable tokens.
   */
  calculateOptimalSwapAndMerge(
    userTokens: BN,
    baseAmount: BN,
    quoteAmount: BN,
    decimals: number = 6 // Number of decimals, e.g., 6 for USDC
  ): {
    optimalSwapAmount: BN;
    expectedQuoteReceived: BN;
    expectedMergeableTokens: BN;
  } {
    // Input validation
    if (
      userTokens.lte(new BN(0)) ||
      baseAmount.lte(new BN(0)) ||
      quoteAmount.lte(new BN(0))
    ) {
      throw new Error("All input amounts must be positive BN numbers.");
    }

    const x = baseAmount;
    const y = quoteAmount;
    const Y0 = userTokens;

    // Perform ternary search to find the optimal 's'
    const optimalSwapAmount = ternarySearch(x, y, Y0);

    // Calculate expected quote tokens received
    const newBaseAmount = x.add(optimalSwapAmount);
    const expectedQuoteReceived = y.mul(optimalSwapAmount).div(newBaseAmount);

    // Remaining base tokens after swap
    const remainingBaseTokens = Y0.sub(optimalSwapAmount);

    // Number of tokens that can be merged into USD
    const expectedMergeableTokens = BN.min(
      remainingBaseTokens,
      expectedQuoteReceived
    );

    return {
      optimalSwapAmount: optimalSwapAmount,
      expectedQuoteReceived: expectedQuoteReceived,
      expectedMergeableTokens: expectedMergeableTokens,
    };
  }
}

/**
 * Calculates the USD obtained after merging for a given swap amount 's'.
 * @param s BN – Swap amount of base tokens.
 * @param x BN – Base tokens in the AMM.
 * @param y BN – Quote tokens in the AMM.
 * @param Y0 BN – User's base tokens.
 * @returns BN – USD obtained after merging.
 */
function calculateUSDObtained(s: BN, x: BN, y: BN, Y0: BN): BN {
  // Ensure s <= Y0
  if (s.gt(Y0)) {
    return new BN(0);
  }

  // Calculate N(s) = (y * s) / (x + s)
  const numerator = y.mul(s);
  const denominator = x.add(s);
  const Ns = numerator.div(denominator);

  // Remaining base tokens after swap: Y0 - s
  const remainingBaseTokens = Y0.sub(s);

  // USD obtained is the minimum of remaining base tokens and Ns
  return BN.min(remainingBaseTokens, Ns);
}

/**
 * Performs ternary search to find the optimal swap amount 's' that maximizes USD obtained.
 * @param x BN – Base tokens in the AMM.
 * @param y BN – Quote tokens in the AMM.
 * @param Y0 BN – User's base tokens.
 * @param maxIterations number – Maximum number of iterations for the search.
 * @returns BN – Optimal swap amount 's'.
 */
function ternarySearch(x: BN, y: BN, Y0: BN, maxIterations: number = 100): BN {
  let left = new BN(0);
  let right = Y0;
  const two = new BN(2);
  const three = new BN(3);

  while (left.lt(right) && maxIterations-- > 0) {
    const leftThird = right.sub(left).div(three).add(left);
    const rightThird = right.sub(left).mul(two).div(three).add(left);

    const fLeftThird = calculateUSDObtained(leftThird, x, y, Y0);
    const fRightThird = calculateUSDObtained(rightThird, x, y, Y0);

    if (fLeftThird.lt(fRightThird)) {
      left = leftThird.add(new BN(1));
    } else {
      right = rightThird.sub(new BN(1));
    }
  }

  // After the loop, 'left' is approximately the optimal 's'
  return left;
}
