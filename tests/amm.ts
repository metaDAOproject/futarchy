import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";

import {
  startAnchor,
  Clock,
  ProgramTestContext,
  BanksClient,
} from "solana-bankrun";

import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
} from "spl-token-bankrun";

import { getAmmAddr, sleep } from "../app/src/utils";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { AmmClient } from "../app/src/AmmClient";
import { expectError, fastForward } from "./utils/utils";
import { PriceMath } from "../app/src/utils/priceMath";
import { getATA, getAmmLpMintAddr } from "../app/src/utils/pda";

const META_DECIMALS = 9;
const USDC_DECIMALS = 6;

describe("amm", async function () {
  let provider: BankrunProvider,
    ammClient: AmmClient,
    payer: Keypair,
    context: ProgramTestContext,
    banksClient: BanksClient,
    META: PublicKey,
    USDC: PublicKey,
    proposal: PublicKey,
    amm: PublicKey,
    lpMint: PublicKey;

  before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    ammClient = await AmmClient.createClient({ provider });
    payer = provider.wallet.payer;
  });

  beforeEach(async function () {
    await fastForward(context, 1n);
    META = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      payer.publicKey,
      META_DECIMALS
    );
    USDC = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      payer.publicKey,
      USDC_DECIMALS
    );

    let userMetaAccount = await createAssociatedTokenAccount(
      banksClient,
      payer,
      META,
      payer.publicKey
    );
    let userUsdcAccount = await createAssociatedTokenAccount(
      banksClient,
      payer,
      USDC,
      payer.publicKey
    );

    mintTo(
      banksClient,
      payer,
      META,
      userMetaAccount,
      payer.publicKey,
      1000 * 10 ** 9
    );
    mintTo(
      banksClient,
      payer,
      USDC,
      userUsdcAccount,
      payer.publicKey,
      10000 * 10 ** 6
    );

    proposal = Keypair.generate().publicKey;
    amm = await ammClient.createAmm(proposal, META, USDC, 500);
    [lpMint] = getAmmLpMintAddr(ammClient.program.programId, amm);
  });

  describe("#create_amm", async function () {
    it("creates an amm", async function () {
      let expectedInitialObservation = new BN(500_000_000_000);
      let expectedMaxObservationChangePerUpdate = new BN(10_000_000_000);

      let bump: number;
      [amm, bump] = getAmmAddr(
        ammClient.program.programId,
        META,
        USDC,
        proposal
      );

      const ammAcc = await ammClient.getAmm(amm);

      assert.equal(ammAcc.bump, bump);
      assert.isTrue(ammAcc.createdAtSlot.eq(ammAcc.oracle.lastUpdatedSlot));
      assert.equal(ammAcc.lpMint.toBase58(), lpMint.toBase58());
      assert.equal(ammAcc.baseMint.toBase58(), META.toBase58());
      assert.equal(ammAcc.quoteMint.toBase58(), USDC.toBase58());
      assert.equal(ammAcc.baseMintDecimals, 9);
      assert.equal(ammAcc.quoteMintDecimals, 6);
      assert.isTrue(ammAcc.baseAmount.eqn(0));
      assert.isTrue(ammAcc.quoteAmount.eqn(0));
      assert.isTrue(
        ammAcc.oracle.lastObservation.eq(expectedInitialObservation)
      );
      assert.isTrue(ammAcc.oracle.aggregator.eqn(0));
      assert.isTrue(
        ammAcc.oracle.maxObservationChangePerUpdate.eq(
          expectedMaxObservationChangePerUpdate
        )
      );
      assert.isTrue(
        ammAcc.oracle.initialObservation.eq(expectedInitialObservation)
      );
    });

    it("fails to create an amm with two identical mints", async function () {
      let [
        twapFirstObservationScaled,
        twapMaxObservationChangePerUpdateScaled,
      ] = PriceMath.scalePrices(META_DECIMALS, USDC_DECIMALS, 100, 1);

      const callbacks = expectError(
        "SameTokenMints",
        "create AMM succeeded despite same token mints"
      );

      let proposal = Keypair.generate().publicKey;

      await ammClient
        .createAmmIx(
          META,
          META,
          twapFirstObservationScaled,
          twapMaxObservationChangePerUpdateScaled,
          proposal
        )
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });
  });

  describe("#add_liquidity", async function () {
    it("adds liquidity to an amm position", async function () {
      const ammStart = await ammClient.getAmm(amm);

      let userLpAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        lpMint,
        payer.publicKey
      );

      const userLpAccountStart = await getAccount(banksClient, userLpAccount);
      const lpMintStart = await getMint(banksClient, lpMint);

      await ammClient
        .addLiquidityIx(
          amm,
          META,
          USDC,
          new BN(100 * 10 ** 6),
          new BN(10 * 10 ** 9),
          new BN(0)
        )
        .rpc();

      const ammEnd = await ammClient.getAmm(amm);
      const userLpAccountEnd = await getAccount(banksClient, userLpAccount);
      const lpMintEnd = await getMint(banksClient, lpMint);

      assert.isAbove(Number(lpMintEnd.supply), Number(lpMintStart.supply));
      assert.isAbove(
        Number(userLpAccountEnd.amount),
        Number(userLpAccountStart.amount)
      );

      assert.isAbove(
        ammEnd.baseAmount.toNumber(),
        ammStart.baseAmount.toNumber()
      );
      assert.isAbove(
        ammEnd.quoteAmount.toNumber(),
        ammStart.quoteAmount.toNumber()
      );
    });

    it("add liquidity after it's already been added", async function () {
      const ammStart = await ammClient.getAmm(amm);

      let userLpAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        lpMint,
        payer.publicKey
      );

      await ammClient
        .addLiquidityIx(
          amm,
          META,
          USDC,
          new BN(100 * 10 ** 6),
          new BN(10 * 10 ** 9),
          new BN(0)
        )
        .rpc();

      const userLpAccountStart = await getAccount(banksClient, userLpAccount);
      const lpMintStart = await getMint(banksClient, lpMint);

      await ammClient
        .addLiquidityIx(
          amm,
          META,
          USDC,
          new BN(100 * 10 ** 6),
          new BN(10 * 10 ** 9 + 10),
          new BN(1)
        )
        .rpc();

      const ammEnd = await ammClient.getAmm(amm);
      const userLpAccountEnd = await getAccount(banksClient, userLpAccount);
      const lpMintEnd = await getMint(banksClient, lpMint);

      assert.isAbove(Number(lpMintEnd.supply), Number(lpMintStart.supply));
      assert.isAbove(
        Number(userLpAccountEnd.amount),
        Number(userLpAccountStart.amount)
      );

      assert.isAbove(
        ammEnd.baseAmount.toNumber(),
        ammStart.baseAmount.toNumber()
      );
      assert.isAbove(
        ammEnd.quoteAmount.toNumber(),
        ammStart.quoteAmount.toNumber()
      );
    });
  });

  describe("#swap", async function () {
    beforeEach(async function () {
      await ammClient
        .addLiquidityIx(
          amm,
          META,
          USDC,
          new BN(100 * 10 ** 6),
          new BN(10 * 10 ** 9),
          new BN(0)
        )
        .rpc();
    });

    it("swap quote to base", async function () {
      const ammStart = await ammClient.getAmm(amm);

      await ammClient
        .swap(
          amm,
          META,
          USDC,
          { buy: {} },
          new BN(10 * 10 ** 6),
          new BN(0.8 * 10 ** 9)
        )
        .rpc();

      const ammEnd = await ammClient.getAmm(amm);

      assert.isBelow(
        ammEnd.baseAmount.toNumber(),
        ammStart.baseAmount.toNumber()
      );
      assert.isAbove(
        ammEnd.quoteAmount.toNumber(),
        ammStart.quoteAmount.toNumber()
      );
    });

    it("swap base to quote", async function () {
      const ammStart = await ammClient.getAmm(amm);

      await ammClient
        .swap(
          amm,
          META,
          USDC,
          { sell: {} },
          new BN(1 * 10 ** 9),
          new BN(8 * 10 ** 6)
        )
        .rpc();

      const ammEnd = await ammClient.getAmm(amm);

      assert.isAbove(
        ammEnd.baseAmount.toNumber(),
        ammStart.baseAmount.toNumber()
      );
      assert.isBelow(
        ammEnd.quoteAmount.toNumber(),
        ammStart.quoteAmount.toNumber()
      );
    });

    it("swap base to quote and back, should not be profitable", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        amm
      );
      const ammEnd = await ammClient.getAmm(amm);

      let startingBaseSwapAmount = 1 * 10 ** 9;

      await ammClient
        .swap(
          amm,
          META,
          USDC,
          { sell: {} },
          new BN(startingBaseSwapAmount),
          new BN(1)
        )
        .rpc();

      await fastForward(context, 1n);

      const ammMiddle = await ammClient.getAmm(amm);
      let quoteReceived =
        permissionlessAmmStart.quoteAmount.toNumber() -
        ammMiddle.quoteAmount.toNumber();

      await ammClient
        .swap(amm, META, USDC, { buy: {} }, new BN(quoteReceived), new BN(1))
        .rpc();

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        amm
      );
      let baseReceived =
        ammMiddle.baseAmount.toNumber() -
        permissionlessAmmEnd.baseAmount.toNumber();

      assert.isBelow(baseReceived, startingBaseSwapAmount);
      assert.isAbove(baseReceived, startingBaseSwapAmount * 0.98); // 1% swap fee both ways
    });

    it("swap quote to base and back, should not be profitable", async function () {
      const ammStart = await ammClient.getAmm(amm);

      let startingQuoteSwapAmount = 1 * 10 ** 6;

      await ammClient
        .swap(
          amm,
          META,
          USDC,
          { buy: {} },
          new BN(startingQuoteSwapAmount),
          new BN(1)
        )
        .rpc();

      await fastForward(context, 1n);

      const ammMiddle = await ammClient.getAmm(amm);
      let baseReceived =
        ammStart.baseAmount.toNumber() - ammMiddle.baseAmount.toNumber();

      await ammClient
        .swap(amm, META, USDC, { sell: {} }, new BN(baseReceived), new BN(1))
        .rpc();

      const ammEnd = await ammClient.getAmm(amm);
      let quoteReceived =
        ammMiddle.quoteAmount.toNumber() - ammEnd.quoteAmount.toNumber();

      assert.isBelow(quoteReceived, startingQuoteSwapAmount);
      assert.isAbove(quoteReceived, startingQuoteSwapAmount * 0.98);
    });
  });

  describe("#remove_liquidity", async function () {
    beforeEach(async function () {
      await ammClient.addLiquidity(amm, 1000, 2);
    });

    it("can't remove 0 liquidity", async function () {
      const callbacks = expectError(
        "ZeroLiquidityRemove",
        "was able to remove 0 liquidity"
      );

      await ammClient
        .removeLiquidityIx(amm, META, USDC, new BN(0), new BN(0), new BN(0))
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });

    it("remove some liquidity from an amm position", async function () {
      const ammStart = await ammClient.getAmm(amm);

      let userLpAccount = getATA(lpMint, payer.publicKey)[0];

      const userLpAccountStart = await getAccount(banksClient, userLpAccount);
      const lpMintStart = await getMint(banksClient, lpMint);

      await ammClient
        .removeLiquidityIx(
          amm,
          META,
          USDC,
          new BN(userLpAccountStart.amount.toString()).divn(2),
          new BN(0),
          new BN(0)
        )
        .rpc();

      const userLpAccountEnd = await getAccount(banksClient, userLpAccount);
      const lpMintEnd = await getMint(banksClient, lpMint);

      const ammEnd = await ammClient.getAmm(amm);

      assert.isBelow(Number(lpMintEnd.supply), Number(lpMintStart.supply));
      assert.isBelow(
        Number(userLpAccountEnd.amount),
        Number(userLpAccountStart.amount)
      );

      assert.isBelow(
        ammEnd.baseAmount.toNumber(),
        ammStart.baseAmount.toNumber()
      );
      assert.isBelow(
        ammEnd.quoteAmount.toNumber(),
        ammStart.quoteAmount.toNumber()
      );
    });

    it("remove all liquidity from an amm position", async function () {
      const ammStart = await ammClient.getAmm(amm);

      let userLpAccount = getATA(lpMint, payer.publicKey)[0];

      const userLpAccountStart = await getAccount(banksClient, userLpAccount);
      const lpMintStart = await getMint(banksClient, lpMint);

      await ammClient
        .removeLiquidityIx(
          amm,
          META,
          USDC,
          new BN(userLpAccountStart.amount.toString()),
          new BN(1 * 10 ** 9),
          new BN(10 * 10 ** 6)
        )
        .rpc();

      const userLpAccountEnd = await getAccount(banksClient, userLpAccount);
      const lpMintEnd = await getMint(banksClient, lpMint);

      assert.isBelow(Number(lpMintEnd.supply), Number(lpMintStart.supply));
      assert.isBelow(
        Number(userLpAccountEnd.amount),
        Number(userLpAccountStart.amount)
      );

      const ammEnd = await ammClient.getAmm(amm);

      assert.isBelow(
        ammEnd.baseAmount.toNumber(),
        ammStart.baseAmount.toNumber()
      );
      assert.isBelow(
        ammEnd.quoteAmount.toNumber(),
        ammStart.quoteAmount.toNumber()
      );
    });
  });
});
