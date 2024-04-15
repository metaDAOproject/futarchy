import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { BankrunProvider } from "anchor-bankrun";

import { startAnchor, Clock, ProgramTestContext } from "solana-bankrun";

import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
} from "spl-token-bankrun";

import { getAmmAddr, getAmmPositionAddr, sleep } from "../app/src/utils";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { AmmClient } from "../app/src/AmmClient";
import { expectError, fastForward } from "./utils/utils";

describe("amm", async function () {
  let provider: BankrunProvider,
    ammClient: AmmClient,
    payer,
    context,
    banksClient,
    permissionlessAmmAddr,
    permissionedAccessibleAmmAddr,
    permissionedInaccessibleAmmAddr,
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
      9
    );
    USDC = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
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
      await ammClient.createAmm(META, USDC).rpc();

      [permissionlessAmmAddr] = getAmmAddr(
        ammClient.program.programId,
        META,
        USDC
      );

      const permissionlessAmmAcc = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
      );

      assert.equal(permissionlessAmmAcc.baseMint.toBase58(), META.toBase58());
      assert.equal(permissionlessAmmAcc.quoteMint.toBase58(), USDC.toBase58());
      assert.equal(permissionlessAmmAcc.baseMintDecimals, 9);
      assert.equal(permissionlessAmmAcc.quoteMintDecimals, 6);
    });

    it("fails to create an amm with two identical mints", async function () {
      const callbacks = expectError(
        "SameTokenMints",
        "create AMM succeeded despite same token mints"
      );

      await ammClient.createAmm(META, META).rpc().then(callbacks[0], callbacks[1]);
    });
  });

  describe("#create_position", async function () {
    it("create new permissionless amm position", async function () {
      let ixh = await ammClient.createAmmPosition(permissionlessAmmAddr);
      await ixh.bankrun(banksClient);

      let permissionlessMarketPositionAddr = getAmmPositionAddr(
        ammClient.program.programId,
        permissionlessAmmAddr,
        payer.publicKey
      )[0];
      const permissionlessMarketPosition =
        await ammClient.program.account.ammPosition.fetch(
          permissionlessMarketPositionAddr
        );

      assert.equal(
        permissionlessMarketPosition.amm.toBase58(),
        permissionlessAmmAddr.toBase58()
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
        permissionlessAmmAddr
      );

      let ammPositionAddr = getAmmPositionAddr(
        ammClient.program.programId,
        permissionlessAmmAddr,
        payer.publicKey
      )[0];
      const ammPositionStart =
        await ammClient.program.account.ammPosition.fetch(ammPositionAddr);

      let ixh = await ammClient.addLiquidity(
        permissionlessAmmAddr,
        ammPositionAddr,
        new BN(10 * 10 ** 9),
        new BN(100 * 10 ** 6),
        new BN(10 * 0.95 * 10 ** 9),
        new BN(100 * 0.95 * 10 ** 6)
      );
      await ixh.bankrun(banksClient);

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
      );
      const ammPositionEnd = await ammClient.program.account.ammPosition.fetch(
        ammPositionAddr
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
        permissionlessAmmAddr
      );

      let ixh = await ammClient.swap(
        permissionlessAmmAddr,
        true,
        new BN(10 * 10 ** 6),
        new BN(0.8 * 10 ** 9)
      );
      await ixh.bankrun(banksClient);

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
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
        permissionlessAmmAddr
      );

      let ixh = await ammClient.swap(
        permissionlessAmmAddr,
        false,
        new BN(1 * 10 ** 9),
        new BN(8 * 10 ** 6)
      );
      await ixh.bankrun(banksClient);

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
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
        permissionlessAmmAddr
      );

      let startingBaseSwapAmount = 1 * 10 ** 9;

      let ixh1 = await ammClient.swap(
        permissionlessAmmAddr,
        false,
        new BN(startingBaseSwapAmount),
        new BN(1)
      );
      await ixh1.bankrun(banksClient);

      await fastForward(context, 1n);

      const permissionlessAmmMiddle = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
      );
      let quoteReceived =
        permissionlessAmmStart.quoteAmount.toNumber() -
        permissionlessAmmMiddle.quoteAmount.toNumber();

      let ixh2 = await ammClient.swap(
        permissionlessAmmAddr,
        true,
        new BN(quoteReceived),
        new BN(1)
      );
      await ixh2.bankrun(banksClient);

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
      );
      let baseReceived =
        permissionlessAmmMiddle.baseAmount.toNumber() -
        permissionlessAmmEnd.baseAmount.toNumber();

      assert.isBelow(baseReceived, startingBaseSwapAmount);
      assert.isAbove(baseReceived, startingBaseSwapAmount * 0.98); // 1% swap fee both ways
    });

    it("swap quote to base and back, should not be profitable", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
      );

      let startingQuoteSwapAmount = 1 * 10 ** 6;

      let ixh1 = await ammClient.swap(
        permissionlessAmmAddr,
        true,
        new BN(startingQuoteSwapAmount),
        new BN(1)
      );
      await ixh1.bankrun(banksClient);

      await fastForward(context, 1n);

      const permissionlessAmmMiddle = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
      );
      let baseReceived =
        permissionlessAmmStart.baseAmount.toNumber() -
        permissionlessAmmMiddle.baseAmount.toNumber();

      let ixh2 = await ammClient.swap(
        permissionlessAmmAddr,
        false,
        new BN(baseReceived),
        new BN(1)
      );
      await ixh2.bankrun(banksClient);

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
      );
      let quoteReceived =
        permissionlessAmmMiddle.quoteAmount.toNumber() -
        permissionlessAmmEnd.quoteAmount.toNumber();

      assert.isBelow(quoteReceived, startingQuoteSwapAmount);
      assert.isAbove(quoteReceived, startingQuoteSwapAmount * 0.98);
    });

    it.skip("ltwap should go up after buying base, down after selling base", async function () {
      let ixh1 = await ammClient.updateLTWAP(permissionlessAmmAddr);
      await ixh1.bankrun(banksClient);

      console.log(await ammClient.getAmm(permissionlessAmmAddr));

      const ltwapStart = await ammClient.getLTWAP(permissionlessAmmAddr);

      let ixh2 = await ammClient.swap(
        permissionlessAmmAddr,
        true,
        new BN(2 * 10 ** 9)
      );
      await ixh2.bankrun(banksClient);

      await fastForward(context, 100n);

      let ixh3 = await ammClient.updateLTWAP(permissionlessAmmAddr);
      await ixh3.bankrun(banksClient);

      const ltwapMiddle = await ammClient.getLTWAP(permissionlessAmmAddr);

      assert.isAbove(ltwapMiddle, ltwapStart);

      let ixh4 = await ammClient.swap(
        permissionlessAmmAddr,
        false,
        new BN(20 * 10 ** 6)
      );
      await ixh4.bankrun(banksClient);

      await fastForward(context, 100n);

      let ixh5 = await ammClient.updateLTWAP(permissionlessAmmAddr);
      await ixh5.bankrun(banksClient);

      const ltwapEnd = await ammClient.getLTWAP(permissionlessAmmAddr);

      assert.isAbove(ltwapMiddle, ltwapEnd);
    });
  });

  describe("#remove_liquidity", async function () {
    it("remove some liquidity from an amm position", async function () {
      const permissionlessAmmStart = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
      );

      let ammPositionAddr = getAmmPositionAddr(
        ammClient.program.programId,
        permissionlessAmmAddr,
        payer.publicKey
      )[0];
      const ammPositionStart =
        await ammClient.program.account.ammPosition.fetch(ammPositionAddr);

      let ixh = await ammClient.removeLiquidity(
        permissionlessAmmAddr,
        ammPositionAddr,
        new BN(5_000)
      );
      await ixh.bankrun(banksClient);

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
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
        permissionlessAmmAddr
      );

      let ammPositionAddr = getAmmPositionAddr(
        ammClient.program.programId,
        permissionlessAmmAddr,
        payer.publicKey
      )[0];
      const ammPositionStart =
        await ammClient.program.account.ammPosition.fetch(ammPositionAddr);

      let ixh = await ammClient.removeLiquidity(
        permissionlessAmmAddr,
        ammPositionAddr,
        new BN(10_000)
      );
      await ixh.bankrun(banksClient);

      const permissionlessAmmEnd = await ammClient.program.account.amm.fetch(
        permissionlessAmmAddr
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
