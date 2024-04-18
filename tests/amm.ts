import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";

import { startAnchor, Clock, ProgramTestContext } from "solana-bankrun";

import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getMint,
} from "spl-token-bankrun";

import { getAmmAddr, getAmmPositionAddr, sleep } from "../app/src/utils";
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
    payer,
    context,
    banksClient,
    amm,
    lpMint,
    userLpAccount,
    META,
    USDC,
    userMetaAccount,
    userUsdcAccount;

  before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    ammClient = await AmmClient.createClient({ provider });
    payer = provider.wallet.payer;

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

    userMetaAccount = await createAssociatedTokenAccount(
      banksClient,
      payer,
      META,
      payer.publicKey
    );
    userUsdcAccount = await createAssociatedTokenAccount(
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
  });

  beforeEach(async function () {
    await fastForward(context, 1n);
  });

  describe("#create_amm", async function () {
    it("create a permissionless amm", async function () {
      let [
        twapFirstObservationScaled,
        twapMaxObservationChangePerUpdateScaled,
      ] = PriceMath.scalePrices(META_DECIMALS, USDC_DECIMALS, 100, 1);

      await ammClient
        .createAmm(
          META,
          USDC,
          twapFirstObservationScaled,
          twapMaxObservationChangePerUpdateScaled,
        ).rpc();

      let bump;
      [amm, bump] = getAmmAddr(
        ammClient.program.programId,
        META,
        USDC
      );

      const permissionlessAmmAcc = await ammClient.program.account.amm.fetch(
        amm
      );

      assert.equal(permissionlessAmmAcc.bump, bump);
      assert.isTrue(
        permissionlessAmmAcc.createdAtSlot.eq(
          permissionlessAmmAcc.oracle.lastUpdatedSlot
        )
      );
      [lpMint] = getAmmLpMintAddr(ammClient.program.programId, amm);
      assert.equal(
        permissionlessAmmAcc.lpMint.toBase58(),
        lpMint.toBase58()
      );
      assert.equal(permissionlessAmmAcc.baseMint.toBase58(), META.toBase58());
      assert.equal(permissionlessAmmAcc.quoteMint.toBase58(), USDC.toBase58());
      assert.equal(permissionlessAmmAcc.baseMintDecimals, 9);
      assert.equal(permissionlessAmmAcc.quoteMintDecimals, 6);
      assert.isTrue(permissionlessAmmAcc.baseAmount.eqn(0));
      assert.isTrue(permissionlessAmmAcc.quoteAmount.eqn(0));
      assert.isTrue(permissionlessAmmAcc.totalOwnership.eqn(0));
      assert.isTrue(
        permissionlessAmmAcc.oracle.lastObservation.eq(
          twapFirstObservationScaled
        )
      );
      assert.isTrue(permissionlessAmmAcc.oracle.aggregator.eqn(0));
      assert.isTrue(
        permissionlessAmmAcc.oracle.maxObservationChangePerUpdate.eq(
          twapMaxObservationChangePerUpdateScaled
        )
      );
      assert.isTrue(
        permissionlessAmmAcc.oracle.initialObservation.eq(
          twapFirstObservationScaled
        )
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

      await ammClient
        .createAmm(
          META,
          META,
          twapFirstObservationScaled,
          twapMaxObservationChangePerUpdateScaled
        )
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });
  });

  describe("#create_position", async function () {
    it("create new permissionless amm position", async function () {
      let ixh = await ammClient.createAmmPosition(amm);
      await ixh.bankrun(banksClient);

      let permissionlessMarketPositionAddr = getAmmPositionAddr(
        ammClient.program.programId,
        amm,
        payer.publicKey
      )[0];
      const permissionlessMarketPosition =
        await ammClient.program.account.ammPosition.fetch(
          permissionlessMarketPositionAddr
        );

      assert.equal(
        permissionlessMarketPosition.amm.toBase58(),
        amm.toBase58()
      );
      assert.equal(
        permissionlessMarketPosition.user.toBase58(),
        payer.publicKey.toBase58()
      );
    });
  });

  describe("#add_liquidity", async function () {
    it("add liquidity to an amm position", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        amm
      );

      let ammPositionAddr = getAmmPositionAddr(
        ammClient.program.programId,
        amm,
        payer.publicKey
      )[0];
      const ammPositionStart =
        await ammClient.program.account.ammPosition.fetch(ammPositionAddr);

      userLpAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        lpMint,
        payer.publicKey
      );

      const userLpAccountStart = await getAccount(banksClient, userLpAccount);
      const lpMintStart = await getMint(banksClient, lpMint);

      await ammClient.addLiquidity(
        amm,
        META,
        USDC,
        ammPositionAddr,
        new BN(10 * 10 ** 9),
        new BN(100 * 10 ** 6),
        new BN(10 * 0.95 * 10 ** 9),
        new BN(100 * 0.95 * 10 ** 6)
      ).rpc();

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        amm
      );
      const ammPositionEnd = await ammClient.program.account.ammPosition.fetch(
        ammPositionAddr
      );
      const userLpAccountEnd = await getAccount(banksClient, userLpAccount);
      const lpMintEnd = await getMint(banksClient, lpMint);

      assert.isAbove(
        Number(lpMintEnd.supply),
        Number(lpMintStart.supply)
      );
      assert.isAbove(
        Number(userLpAccountEnd.amount),
        Number(userLpAccountStart.amount)
      );

      assert.isAbove(
        permissionlessAmmEnd.totalOwnership.toNumber(),
        permissionlessAmmStart.totalOwnership.toNumber()
      );
      assert.isAbove(
        ammPositionEnd.ownership.toNumber(),
        ammPositionStart.ownership.toNumber()
      );

      assert.isAbove(
        permissionlessAmmEnd.baseAmount.toNumber(),
        permissionlessAmmStart.baseAmount.toNumber()
      );
      assert.isAbove(
        permissionlessAmmEnd.quoteAmount.toNumber(),
        permissionlessAmmStart.quoteAmount.toNumber()
      );
    });

    it("add liquidity after it's already been added", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        amm
      );

      let ammPositionAddr = getAmmPositionAddr(
        ammClient.program.programId,
        amm,
        payer.publicKey
      )[0];
      const ammPositionStart =
        await ammClient.program.account.ammPosition.fetch(ammPositionAddr);

      const userLpAccountStart = await getAccount(banksClient, userLpAccount);
      const lpMintStart = await getMint(banksClient, lpMint);

      await ammClient.addLiquidity(
        amm,
        META,
        USDC,
        ammPositionAddr,
        new BN(10 * 10 ** 9),
        new BN(100 * 10 ** 6),
        new BN(10 * 0.95 * 10 ** 9),
        new BN(100 * 0.95 * 10 ** 6)
      ).rpc();

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        amm
      );
      const ammPositionEnd = await ammClient.program.account.ammPosition.fetch(
        ammPositionAddr
      );
      const userLpAccountEnd = await getAccount(banksClient, userLpAccount);
      const lpMintEnd = await getMint(banksClient, lpMint);

      assert.isAbove(
        Number(lpMintEnd.supply),
        Number(lpMintStart.supply)
      );
      assert.isAbove(
        Number(userLpAccountEnd.amount),
        Number(userLpAccountStart.amount)
      );

      assert.isAbove(
        permissionlessAmmEnd.totalOwnership.toNumber(),
        permissionlessAmmStart.totalOwnership.toNumber()
      );
      assert.isAbove(
        ammPositionEnd.ownership.toNumber(),
        ammPositionStart.ownership.toNumber()
      );

      assert.isAbove(
        permissionlessAmmEnd.baseAmount.toNumber(),
        permissionlessAmmStart.baseAmount.toNumber()
      );
      assert.isAbove(
        permissionlessAmmEnd.quoteAmount.toNumber(),
        permissionlessAmmStart.quoteAmount.toNumber()
      );
    });
  });

  describe("#swap", async function () {
    it("swap quote to base", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        amm
      );

      await ammClient.swap(
        amm,
        META,
        USDC,
        true,
        new BN(10 * 10 ** 6),
        new BN(0.8 * 10 ** 9)
      ).rpc();

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        amm
      );

      assert.isBelow(
        permissionlessAmmEnd.baseAmount.toNumber(),
        permissionlessAmmStart.baseAmount.toNumber()
      );
      assert.isAbove(
        permissionlessAmmEnd.quoteAmount.toNumber(),
        permissionlessAmmStart.quoteAmount.toNumber()
      );
    });

    it("swap base to quote", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        amm
      );

      await ammClient.swap(
        amm,
        META,
        USDC,
        false,
        new BN(1 * 10 ** 9),
        new BN(8 * 10 ** 6)
      ).rpc();

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        amm
      );

      assert.isAbove(
        permissionlessAmmEnd.baseAmount.toNumber(),
        permissionlessAmmStart.baseAmount.toNumber()
      );
      assert.isBelow(
        permissionlessAmmEnd.quoteAmount.toNumber(),
        permissionlessAmmStart.quoteAmount.toNumber()
      );
    });

    it("swap base to quote and back, should not be profitable", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        amm
      );

      let startingBaseSwapAmount = 1 * 10 ** 9;

      await ammClient.swap(
        amm,
        META,
        USDC,
        false,
        new BN(startingBaseSwapAmount),
        new BN(1)
      ).rpc();

      await fastForward(context, 1n);

      const permissionlessAmmMiddle = await ammClient.program.account.amm.fetch(
        amm
      );
      let quoteReceived =
        permissionlessAmmStart.quoteAmount.toNumber() -
        permissionlessAmmMiddle.quoteAmount.toNumber();

      await ammClient.swap(
        amm,
        META,
        USDC,
        true,
        new BN(quoteReceived),
        new BN(1)
      ).rpc();

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        amm
      );
      let baseReceived =
        permissionlessAmmMiddle.baseAmount.toNumber() -
        permissionlessAmmEnd.baseAmount.toNumber();

      assert.isBelow(baseReceived, startingBaseSwapAmount);
      assert.isAbove(baseReceived, startingBaseSwapAmount * 0.98); // 1% swap fee both ways
    });

    it("swap quote to base and back, should not be profitable", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        amm
      );

      let startingQuoteSwapAmount = 1 * 10 ** 6;

      await ammClient.swap(
        amm,
        META,
        USDC,
        true,
        new BN(startingQuoteSwapAmount),
        new BN(1)
      ).rpc();

      await fastForward(context, 1n);

      const permissionlessAmmMiddle = await ammClient.program.account.amm.fetch(
        amm
      );
      let baseReceived =
        permissionlessAmmStart.baseAmount.toNumber() -
        permissionlessAmmMiddle.baseAmount.toNumber();

      await ammClient.swap(
        amm,
        META,
        USDC,
        false,
        new BN(baseReceived),
        new BN(1)
      ).rpc();

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        amm
      );
      let quoteReceived =
        permissionlessAmmMiddle.quoteAmount.toNumber() -
        permissionlessAmmEnd.quoteAmount.toNumber();

      assert.isBelow(quoteReceived, startingQuoteSwapAmount);
      assert.isAbove(quoteReceived, startingQuoteSwapAmount * 0.98);
    });

    it.skip("ltwap should go up after buying base, down after selling base", async function () {
      let ixh1 = await ammClient.updateLTWAP(amm);
      await ixh1.bankrun(banksClient);

      console.log(await ammClient.getAmm(amm));

      const ltwapStart = await ammClient.getLTWAP(amm);

      let ixh2 = await ammClient.swap(
        amm,
        true,
        new BN(2 * 10 ** 9)
      );
      await ixh2.bankrun(banksClient);

      await fastForward(context, 100n);

      let ixh3 = await ammClient.updateLTWAP(amm);
      await ixh3.bankrun(banksClient);

      const ltwapMiddle = await ammClient.getLTWAP(amm);

      assert.isAbove(ltwapMiddle, ltwapStart);

      let ixh4 = await ammClient.swap(
        amm,
        false,
        new BN(20 * 10 ** 6)
      );
      await ixh4.bankrun(banksClient);

      await fastForward(context, 100n);

      let ixh5 = await ammClient.updateLTWAP(amm);
      await ixh5.bankrun(banksClient);

      const ltwapEnd = await ammClient.getLTWAP(amm);

      assert.isAbove(ltwapMiddle, ltwapEnd);
    });
  });

  describe("#remove_liquidity", async function () {
    it("remove some liquidity from an amm position", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        amm
      );

      let ammPositionAddr = getAmmPositionAddr(
        ammClient.program.programId,
        amm,
        payer.publicKey
      )[0];
      const ammPositionStart =
        await ammClient.program.account.ammPosition.fetch(ammPositionAddr);

      const userLpAccountStart = await getAccount(banksClient, userLpAccount);
      const lpMintStart = await getMint(banksClient, lpMint);

      await ammClient.removeLiquidity(
        amm,
        META,
        USDC,
        ammPositionAddr,
        new BN(5_000)
      ).rpc();

      const userLpAccountEnd = await getAccount(banksClient, userLpAccount);
      const lpMintEnd = await getMint(banksClient, lpMint);

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        amm
      );
      const ammPositionEnd = await ammClient.program.account.ammPosition.fetch(
        ammPositionAddr
      );

      assert.isBelow(
        Number(lpMintEnd.supply),
        Number(lpMintStart.supply)
      );
      assert.isBelow(
        Number(userLpAccountEnd.amount),
        Number(userLpAccountStart.amount)
      );

      assert.isBelow(
        permissionlessAmmEnd.totalOwnership.toNumber(),
        permissionlessAmmStart.totalOwnership.toNumber()
      );
      assert.isBelow(
        ammPositionEnd.ownership.toNumber(),
        ammPositionStart.ownership.toNumber()
      );

      assert.isBelow(
        permissionlessAmmEnd.baseAmount.toNumber(),
        permissionlessAmmStart.baseAmount.toNumber()
      );
      assert.isBelow(
        permissionlessAmmEnd.quoteAmount.toNumber(),
        permissionlessAmmStart.quoteAmount.toNumber()
      );
    });

    it("remove all liquidity from an amm position", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        amm
      );

      let ammPositionAddr = getAmmPositionAddr(
        ammClient.program.programId,
        amm,
        payer.publicKey
      )[0];
      const ammPositionStart =
        await ammClient.program.account.ammPosition.fetch(ammPositionAddr);

      const userLpAccountStart = await getAccount(banksClient, userLpAccount);
      const lpMintStart = await getMint(banksClient, lpMint);

      await ammClient.removeLiquidity(
        amm,
        META,
        USDC,
        ammPositionAddr,
        new BN(10_000)
      ).rpc();

      const userLpAccountEnd = await getAccount(banksClient, userLpAccount);
      const lpMintEnd = await getMint(banksClient, lpMint);

      assert.isBelow(
        Number(lpMintEnd.supply),
        Number(lpMintStart.supply)
      );
      assert.isBelow(
        Number(userLpAccountEnd.amount),
        Number(userLpAccountStart.amount)
      );

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        amm
      );
      const ammPositionEnd = await ammClient.program.account.ammPosition.fetch(
        ammPositionAddr
      );

      assert.isBelow(
        permissionlessAmmEnd.totalOwnership.toNumber(),
        permissionlessAmmStart.totalOwnership.toNumber()
      );
      assert.isBelow(
        ammPositionEnd.ownership.toNumber(),
        ammPositionStart.ownership.toNumber()
      );
      assert.equal(ammPositionEnd.ownership.toNumber(), 0);

      assert.isBelow(
        permissionlessAmmEnd.baseAmount.toNumber(),
        permissionlessAmmStart.baseAmount.toNumber()
      );
      assert.isBelow(
        permissionlessAmmEnd.quoteAmount.toNumber(),
        permissionlessAmmStart.quoteAmount.toNumber()
      );
    });
  });
});
