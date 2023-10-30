import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";
import {
  mintConditionalTokens,
  redeemConditionalTokens,
} from "./conditionalVault";
import {
  OpenBookV2Client,
  IDL,
  BooksideSpace,
  EventHeapSpace,
  PlaceOrderArgs,
  Side,
  OrderType,
  SelfTradeBehavior
} from "@openbook-dex/openbook-v2";

const { PublicKey, Keypair } = anchor.web3;

import { assert } from "chai";

import { startAnchor, Clock, BanksClient, ProgramTestContext } from "solana-bankrun";

import { expectError } from "./utils/utils";

import { AutocratV0 } from "../target/types/autocrat_v0";
import { ConditionalVault } from "../target/types/conditional_vault";
import { Clob } from "../target/types/clob";
import { OpenbookTwap } from "./fixtures/openbook_twap";

const OpenbookTwapIDL: OpenbookTwap = require("./fixtures/openbook_twap.json");

const AutocratIDL: AutocratV0 = require("../target/idl/autocrat_v0.json");
const ConditionalVaultIDL: ConditionalVault = require("../target/idl/conditional_vault.json");
const ClobIDL: Clob = require("../target/idl/clob.json");
//const OpenBookTWAP

export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

type ProposalInstruction = anchor.IdlTypes<AutocratV0>["ProposalInstruction"]

import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintToOverride,
  getMint,
  getAccount,
} from "spl-token-bankrun";


// this test file isn't 'clean' or DRY or whatever; sorry!
const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "GLmTsw5A8DLCThjNgtMBKVDAG8EZYDVMic1pcjhGLiM1"
);

const CONDITIONAL_VAULT_PROGRAM_ID = new PublicKey(
  "4nCk4qKJSJf8pzJadMnr9LubA6Y7Zw3EacsVqH1TwVXH"
);

const CLOB_PROGRAM_ID = new PublicKey(
  "8BnUecJAvKB7zCcwqhMiVWoqKWcw5S6PDCxWWEM2oxWA"
);

const OPENBOOK_TWAP_PROGRAM_ID = new PublicKey(
  "2qjEsiMtWxAdqUSdaGM28pJRMtodnnkHZEoadc6JcFCb"
);

const OPENBOOK_PROGRAM_ID = new PublicKey(
  "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb"
);

describe("autocrat_v0", async function () {
  let provider,
    connection,
    autocrat,
    payer,
    context,
    banksClient,
    dao,
    daoTreasury,
    META,
    USDC,
    vaultProgram,
    clobProgram,
    clobAdmin,
    clobGlobalState,
    openbook,
    openbookTwap;

  before(async function () {
    context = await startAnchor("./", [
      {
        name: "openbook_v2",
        programId: OPENBOOK_PROGRAM_ID,
      },
      {
        name: "openbook_twap",
        programId: OPENBOOK_TWAP_PROGRAM_ID,
      }], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    autocrat = new anchor.Program<AutocratV0>(
      AutocratIDL,
      AUTOCRAT_PROGRAM_ID,
      provider
    );
    openbook = new OpenBookV2Client(provider);
    openbookTwap = new Program<OpenbookTwap>(
      OpenbookTwapIDL,
      OPENBOOK_TWAP_PROGRAM_ID,
      provider
    );
    //console.log(openbookTwap);

    vaultProgram = new Program<ConditionalVault>(
      ConditionalVaultIDL,
      CONDITIONAL_VAULT_PROGRAM_ID,
      provider
    );


    clobProgram = new Program<Clob>(ClobIDL, CLOB_PROGRAM_ID, provider);

    payer = autocrat.provider.wallet.payer;

    [clobGlobalState] = anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
      clobProgram.programId
    );
    clobAdmin = anchor.web3.Keypair.generate();

    await clobProgram.methods
      .initializeGlobalState(clobAdmin.publicKey)
      .accounts({
        globalState: clobGlobalState,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    USDC = await createMint(banksClient, payer, payer.publicKey, payer.publicKey, 6);
  });

  describe.only("#initialize_dao", async function () {
    it("initializes the DAO", async function () {
      [dao] = PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
        autocrat.programId
      );
      [daoTreasury] = PublicKey.findProgramAddressSync(
        [dao.toBuffer()],
        autocrat.programId
      );

      META = await createMint(banksClient, payer, dao, dao, 9);

      await autocrat.methods
        .initializeDao()
        .accounts({
          dao,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          metaMint: META,
          usdcMint: USDC
        })
        .rpc()
        .then(
          () => {},
          (err) => console.error(err)
        );

      const daoAcc = await autocrat.account.dao.fetch(dao);
      assert(daoAcc.metaMint.equals(META));
      assert(daoAcc.usdcMint.equals(USDC));
      assert.equal(daoAcc.proposalCount, 0);
      assert.equal(daoAcc.passThresholdBps, 500);
      assert.ok(daoAcc.baseBurnLamports.eq(new BN(1_000_000_000).muln(50)));
      assert.ok(daoAcc.burnDecayPerSlotLamports.eq(new BN(46_300)));
    });
  });

  describe.only("#initialize_proposal", async function () {
    it.only("initializes proposals", async function () {
      const accounts = [
        {
          pubkey: dao,
          isSigner: true,
          isWritable: true,
        },
      ];
      const data = autocrat.coder.instruction.encode("set_pass_threshold_bps", {
        passThresholdBps: 1000,
      });
      const instruction = {
        programId: autocrat.programId,
        accounts,
        data,
      };

      let currentClock = await context.banksClient.getClock();
      let newSlot = currentClock.slot + 432_000n; // 2 days
      context.setClock(
        new Clock(
          newSlot,
          currentClock.epochStartTimestamp,
          currentClock.epoch,
          currentClock.leaderScheduleEpoch,
          currentClock.unixTimestamp
        )
      );

      let balanceBefore = await banksClient.getBalance(payer.publicKey);

      await initializeProposal(
        autocrat,
        instruction,
        vaultProgram,
        dao,
        clobProgram,
        context,
        payer,
        openbook,
        openbookTwap
      );

      let balanceAfter = await banksClient.getBalance(payer.publicKey);

      // two days, so proposer should burn 30 SOL
      assert(balanceAfter < balanceBefore - 1_000_000_000n * 30n);
      console.log(balanceAfter);

      assert(balanceAfter > balanceBefore - 1_000_000_000n * 35n);
    });
  });

  describe("#finalize_proposal", async function () {
    let proposal,
      openbookPassMarket,
      openbookFailMarket,
      openbookTwapPassMarket,
      openbookTwapFailMarket,
      baseVault,
      quoteVault,
      basePassVaultUnderlyingTokenAccount,
      basePassConditionalTokenMint,
      mm0,
      mm1,
      alice,
      aliceQuotePassDepositSlip,
      aliceUnderlyingQuoteTokenAccount,
      aliceUnderlyingBaseTokenAccount,
      aliceBasePassConditionalTokenAccount,
      newPassThresholdBps;

    beforeEach(async function () {
      const accounts = [
        {
          pubkey: dao,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: daoTreasury,
          isSigner: true,
          isWritable: false,
        },
      ];
      newPassThresholdBps = Math.floor(Math.random() * 1000);
      const data = autocrat.coder.instruction.encode("set_pass_threshold_bps", {
        passThresholdBps: newPassThresholdBps,
      });
      const instruction = {
        programId: autocrat.programId,
        accounts,
        data,
      };

      proposal = await initializeProposal(
        autocrat,
        instruction,
        vaultProgram,
        dao,
        clobProgram,
        context,
        payer,
        openbook,
        openbookTwap
      );

      ({
        openbookPassMarket,
        openbookFailMarket,
        openbookTwapPassMarket,
        openbookTwapFailMarket,
        baseVault,
        quoteVault,
      } = await autocrat.account.proposal.fetch(proposal));

      [mm0] = await generateMarketMaker(
        openbook,
        openbookTwap,
        banksClient,
        payer,
        openbookPassMarket,
        openbookFailMarket,
        vaultProgram,
        context
      );

      [mm1] = await generateMarketMaker(
        openbook,
        openbookTwap,
        banksClient,
        payer,
        openbookPassMarket,
        openbookFailMarket,
        vaultProgram,
        context
      );

      // alice wants to buy META if the proposal passes, so she locks up USDC
      // and swaps her pUSDC for pMETA
      alice = Keypair.generate();

      const storedQuoteVault =
        await vaultProgram.account.conditionalVault.fetch(quoteVault);
      const quoteVaultUnderlyingTokenAccount =
        storedQuoteVault.underlyingTokenAccount;
      const quotePassConditionalTokenMint =
        storedQuoteVault.conditionalOnFinalizeTokenMint;
      const quoteFailConditionalTokenMint =
        storedQuoteVault.conditionalOnRevertTokenMint;

      const storedBaseVault =
        await vaultProgram.account.conditionalVault.fetch(baseVault);
      basePassConditionalTokenMint = storedBaseVault.conditionalOnFinalizeTokenMint;

      aliceUnderlyingQuoteTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        USDC,
        alice.publicKey
      );
      aliceUnderlyingBaseTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        META,
        alice.publicKey
      );

      await mintToOverride(context, aliceUnderlyingQuoteTokenAccount, 10_000n * 1_000_000n);

        await createAssociatedTokenAccount(
          banksClient,
          payer,
          quotePassConditionalTokenMint,
          alice.publicKey
        );
        await createAssociatedTokenAccount(
          banksClient,
          payer,
          quoteFailConditionalTokenMint,
          alice.publicKey
        );

      await mintConditionalTokens(
        vaultProgram,
        10_000 * 1_000_000,
        alice,
        quoteVault,
        banksClient,
      );

      aliceBasePassConditionalTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        basePassConditionalTokenMint,
        alice.publicKey
      );
    });

    it.only("doesn't finalize proposals that are too young", async function () {
      const callbacks = expectError(
        autocrat,
        "ProposalTooYoung",
        "finalize succeeded despite proposal being too young"
      );

      await autocrat.methods
        .finalizeProposal()
        .accounts({
          proposal,
          openbookTwapPassMarket,
          openbookTwapFailMarket,
          dao,
          baseVault,
          quoteVault,
          vaultProgram: vaultProgram.programId,
          daoTreasury,
        })
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });

    it("finalizes proposals when pass price TWAP > (fail price TWAP + threshold)", async function () {
      let storedProposal = await autocrat.account.proposal.fetch(proposal);

      // pass market should be higher
      await clobProgram.methods
        .submitLimitOrder(
          { buy: {} },
          new anchor.BN(100_001), // amount
          new anchor.BN(2.1e9 - 100), // price
          13, // ref id
          0 // mm index
        )
        .accounts({
          authority: passMM.publicKey,
          orderBook: passMarket,
        })
        .signers([passMM])
        .rpc();

      await clobProgram.methods
        .submitLimitOrder(
          { sell: {} },
          new anchor.BN(100_001), // amount
          new anchor.BN(2.1e9 - 300), // price
          14, // ref id
          0 // mm index
        )
        .accounts({
          authority: passMM.publicKey,
          orderBook: passMarket,
        })
        .signers([passMM])
        .rpc();

      let { baseVault, quoteVault } = await clobProgram.account.orderBook.fetch(
        passMarket
      );
      await clobProgram.methods
        .submitTakeOrder({ buy: {} }, new anchor.BN(10_00), new anchor.BN(0))
        .accounts({
          globalState: clobGlobalState,
          userBaseAccount: aliceBasePassConditionalTokenAccount,
          userQuoteAccount: aliceQuotePassConditionalTokenAccount,
          baseVault,
          quoteVault,
          authority: alice.publicKey,
          orderBook: passMarket,
          tokenProgram: token.TOKEN_PROGRAM_ID,
        })
        .signers([alice])
        .rpc();

      await clobProgram.methods
        .submitLimitOrder(
          { buy: {} },
          new anchor.BN(10_001), // amount
          new anchor.BN(2e9 - 500), // price
          13, // ref id
          0 // mm index
        )
        .accounts({
          authority: failMM.publicKey,
          orderBook: failMarket,
        })
        .signers([failMM])
        .rpc();

      await clobProgram.methods
        .submitLimitOrder(
          { sell: {} },
          new anchor.BN(10_001), // amount
          new anchor.BN(2e9 - 700), // price
          14, // ref id
          0 // mm index
        )
        .accounts({
          authority: failMM.publicKey,
          orderBook: failMarket,
        })
        .signers([failMM])
        .rpc();

      const currentClock = await context.banksClient.getClock();
      const newSlot = currentClock.slot + 10_000_000n;
      context.setClock(
        new Clock(
          newSlot,
          currentClock.epochStartTimestamp,
          currentClock.epoch,
          currentClock.leaderScheduleEpoch,
          currentClock.unixTimestamp
        )
      );

      await clobProgram.methods
        .submitLimitOrder(
          { buy: {} },
          new anchor.BN(10_001), // amount
          new anchor.BN(2e9 - 100), // price
          13, // ref id
          0 // mm index
        )
        .accounts({
          authority: passMM.publicKey,
          orderBook: passMarket,
        })
        .signers([passMM])
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

      await clobProgram.methods
        .submitLimitOrder(
          { buy: {} },
          new anchor.BN(10_001), // amount
          new anchor.BN(2e9 - 100), // price
          13, // ref id
          0 // mm index
        )
        .accounts({
          authority: passMM.publicKey,
          orderBook: passMarket,
        })
        .signers([passMM])
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

      await clobProgram.methods
        .submitLimitOrder(
          { sell: {} },
          new anchor.BN(10_001), // amount
          new anchor.BN(2e9 - 300), // price
          14, // ref id
          0 // mm index
        )
        .accounts({
          authority: passMM.publicKey,
          orderBook: passMarket,
        })
        .signers([passMM])
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

      await clobProgram.methods
        .submitLimitOrder(
          { buy: {} },
          new anchor.BN(10_001), // amount
          new anchor.BN(2e9 - 500), // price
          13, // ref id
          0 // mm index
        )
        .accounts({
          authority: failMM.publicKey,
          orderBook: failMarket,
        })
        .signers([failMM])
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

      await clobProgram.methods
        .submitLimitOrder(
          { sell: {} },
          new anchor.BN(10_001), // amount
          new anchor.BN(2e9 - 700), // price
          302, // ref id
          0 // mm index
        )
        .accounts({
          authority: failMM.publicKey,
          orderBook: failMarket,
        })
        .signers([failMM])
        .rpc()
        .then(
          () => {},
          (err) => console.log("ERROR", err)
        );

      await autocrat.methods
        .finalizeProposal()
        .accounts({
          proposal,
          passMarket,
          failMarket,
          openbookTwapPassMarket,
          openbookTwapFailMarket,
          basePassVault,
          quotePassVault,
          baseFailVault,
          quoteFailVault,
          vaultProgram: vaultProgram.programId,
          dao,
          daoTreasury,
        })
        .remainingAccounts(
          autocrat.instruction.setPassThresholdBps
            .accounts({
              dao,
              daoTreasury,
            })
            .concat({
              pubkey: autocrat.programId,
              isWritable: false,
              isSigner: false,
            })
            .map((meta) =>
              meta.pubkey.equals(daoTreasury)
                ? { ...meta, isSigner: false }
                : meta
            )
        )
        .rpc();

      // TODO: factor these out
      let storedBasePassVault =
        await vaultProgram.account.conditionalVault.fetch(basePassVault);
      assert.exists(storedBasePassVault.status.finalized);

      let storedQuotePassVault =
        await vaultProgram.account.conditionalVault.fetch(quotePassVault);
      assert.exists(storedQuotePassVault.status.finalized);

      let storedBaseFailVault =
        await vaultProgram.account.conditionalVault.fetch(baseFailVault);
      assert.exists(storedBaseFailVault.status.reverted);

      let storedQuoteFailVault =
        await vaultProgram.account.conditionalVault.fetch(quoteFailVault);
      assert.exists(storedQuoteFailVault.status.reverted);

      storedProposal = await autocrat.account.proposal.fetch(proposal);
      assert.exists(storedProposal.state.passed);

      const storedDao = await autocrat.account.dao.fetch(dao);
      assert.equal(storedDao.passThresholdBps, newPassThresholdBps);

      await redeemConditionalTokens(
        vaultProgram,
        alice,
        aliceBasePassConditionalTokenAccount,
        aliceUnderlyingBaseTokenAccount,
        basePassVaultUnderlyingTokenAccount,
        basePassVault,
        basePassConditionalTokenMint,
        banksClient
      );

      //console.log(await banksClient.getBalance(payer.publicKey));

      //assert(
      //  (await banksClient.getBalance(payer.publicKey)) >
      //    proposerBalanceBefore + 1_000_000_000n * 19n
      //);
    });

    it("rejects proposals when pass price TWAP < fail price TWAP", async function () {
      let storedProposal = await autocrat.account.proposal.fetch(proposal);

      // pass market should be higher
      await clobProgram.methods
        .submitLimitOrder(
          { buy: {} },
          new anchor.BN(100_001), // amount
          new anchor.BN(2e9 - 100), // price
          13, // ref id
          0 // mm index
        )
        .accounts({
          authority: passMM.publicKey,
          orderBook: passMarket,
        })
        .signers([passMM])
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

      await clobProgram.methods
        .submitLimitOrder(
          { sell: {} },
          new anchor.BN(100_001), // amount
          new anchor.BN(2e9 - 300), // price
          14, // ref id
          0 // mm index
        )
        .accounts({
          authority: passMM.publicKey,
          orderBook: passMarket,
        })
        .signers([passMM])
        .rpc();

      let { baseVault, quoteVault } = await clobProgram.account.orderBook.fetch(
        passMarket
      );
      await clobProgram.methods
        .submitTakeOrder({ buy: {} }, new anchor.BN(10_00), new anchor.BN(0))
        .accounts({
          globalState: clobGlobalState,
          userBaseAccount: aliceBasePassConditionalTokenAccount,
          userQuoteAccount: aliceQuotePassConditionalTokenAccount,
          baseVault,
          quoteVault,
          authority: alice.publicKey,
          orderBook: passMarket,
          tokenProgram: token.TOKEN_PROGRAM_ID,
        })
        .signers([alice])
        .rpc();

      await clobProgram.methods
        .submitLimitOrder(
          { buy: {} },
          new anchor.BN(101), // amount
          new anchor.BN(2e9 + 500), // price
          13, // ref id
          0 // mm index
        )
        .accounts({
          authority: failMM.publicKey,
          orderBook: failMarket,
        })
        .signers([failMM])
        .rpc();

      await clobProgram.methods
        .submitLimitOrder(
          { sell: {} },
          new anchor.BN(101), // amount
          new anchor.BN(2e9 + 700), // price
          14, // ref id
          0 // mm index
        )
        .accounts({
          authority: failMM.publicKey,
          orderBook: failMarket,
        })
        .signers([failMM])
        .rpc();

      const currentClock = await context.banksClient.getClock();
      const newSlot = currentClock.slot + 10_000_000n;
      context.setClock(
        new Clock(
          newSlot,
          currentClock.epochStartTimestamp,
          currentClock.epoch,
          currentClock.leaderScheduleEpoch,
          currentClock.unixTimestamp
        )
      );

      await clobProgram.methods
        .submitLimitOrder(
          { buy: {} },
          new anchor.BN(101), // amount
          new anchor.BN(2e9 - 100), // price
          13, // ref id
          0 // mm index
        )
        .accounts({
          authority: passMM.publicKey,
          orderBook: passMarket,
        })
        .signers([passMM])
        .rpc();

      await clobProgram.methods
        .submitLimitOrder(
          { sell: {} },
          new anchor.BN(101), // amount
          new anchor.BN(2e9 - 300), // price
          14, // ref id
          0 // mm index
        )
        .accounts({
          authority: passMM.publicKey,
          orderBook: passMarket,
        })
        .signers([passMM])
        .rpc();

      await clobProgram.methods
        .submitLimitOrder(
          { buy: {} },
          new anchor.BN(101), // amount
          new anchor.BN(2e9 + 500), // price
          13, // ref id
          0 // mm index
        )
        .accounts({
          authority: failMM.publicKey,
          orderBook: failMarket,
        })
        .signers([failMM])
        .rpc();

      await clobProgram.methods
        .submitLimitOrder(
          { sell: {} },
          new anchor.BN(101), // amount
          new anchor.BN(2e9 + 700), // price
          14, // ref id
          0 // mm index
        )
        .accounts({
          authority: failMM.publicKey,
          orderBook: failMarket,
        })
        .signers([failMM])
        .rpc();

      let storedDao = await autocrat.account.dao.fetch(dao);
      const passThresholdBpsBefore = storedDao.passThresholdBps;

      let proposerBalanceBefore = await banksClient.getBalance(payer.publicKey);

      await autocrat.methods
        .finalizeProposal()
        .accounts({
          proposal,
          passMarket,
          failMarket,
          basePassVault,
          quotePassVault,
          baseFailVault,
          quoteFailVault,
          vaultProgram: vaultProgram.programId,
          dao,
          daoTreasury,
        })
        .remainingAccounts(
          autocrat.instruction.setPassThresholdBps
            .accounts({
              dao,
              daoTreasury,
            })
            .concat({
              pubkey: autocrat.programId,
              isWritable: false,
              isSigner: false,
            })
            .map((meta) =>
              meta.pubkey.equals(daoTreasury)
                ? { ...meta, isSigner: false }
                : meta
            )
        )
        .rpc();

      storedProposal = await autocrat.account.proposal.fetch(proposal);
      assert.exists(storedProposal.state.failed);

      storedDao = await autocrat.account.dao.fetch(dao);
      assert.equal(storedDao.passThresholdBps, passThresholdBpsBefore);

      let storedBasePassVault =
        await vaultProgram.account.conditionalVault.fetch(basePassVault);
      assert.exists(storedBasePassVault.status.reverted);

      let storedQuotePassVault =
        await vaultProgram.account.conditionalVault.fetch(quotePassVault);
      assert.exists(storedQuotePassVault.status.reverted);

      let storedBaseFailVault =
        await vaultProgram.account.conditionalVault.fetch(baseFailVault);
      assert.exists(storedBaseFailVault.status.finalized);

      let storedQuoteFailVault =
        await vaultProgram.account.conditionalVault.fetch(quoteFailVault);
      assert.exists(storedQuoteFailVault.status.finalized);

      const callbacks = expectError(
        autocrat,
        "CantRedeemConditionalTokens",
        "alice was able to redeem her conditional tokens despite the proposal failing"
      );

      await redeemConditionalTokens(
        vaultProgram,
        alice,
        aliceBasePassConditionalTokenAccount,
        aliceUnderlyingBaseTokenAccount,
        basePassVaultUnderlyingTokenAccount,
        basePassVault,
        basePassConditionalTokenMint,
        banksClient
      ).then(callbacks[0], callbacks[1]);

      //console.log(await banksClient.getAccount(payer.publicKey));

      //console.log(proposerBalanceBefore - await banksClient.getBalance(payer.publicKey))

      //assert(
      //  (await banksClient.getBalance(payer.publicKey)) >
      //    proposerBalanceBefore + 1_000_000_000n * 19n
      //);
    });
  });
});

async function generateMarketMaker(
  openbook: OpenBookV2Client,
  openbookTwap: Program<OpenbookTwap>,
  banksClient: BanksClient,
  payer: anchor.web3.Keypair,
  passMarket: anchor.web3.PublicKey,
  failMarket: anchor.web3.PublicKey,
  vaultProgram: Program<ConditionalVault>,
  context: ProgramTestContext
): Promise<[Keypair]> {
  const mm = anchor.web3.Keypair.generate();

  const storedPassMarket = await openbook.getMarket(passMarket);
  const storedFailMarket = await openbook.getMarket(failMarket);

  const metaPassAcc = await createAccount(
    banksClient,
    payer,
    storedPassMarket.baseMint,
    mm.publicKey
  );

  const usdcPassAcc = await createAccount(
    banksClient,
    payer,
    storedPassMarket.quoteMint,
    mm.publicKey
  );

  const metaFailAcc = await createAccount(
    banksClient,
    payer,
    storedFailMarket.baseMint,
    mm.publicKey
  );

  const usdcFailAcc = await createAccount(
    banksClient,
    payer,
    storedFailMarket.quoteMint,
    mm.publicKey
  );

  // we can use either to get the base/quote vault
  const baseMint = await getMint(banksClient, storedPassMarket.baseMint);
  const quoteMint = await getMint(banksClient, storedPassMarket.quoteMint);

  const baseVault = baseMint.mintAuthority;
  const quoteVault = quoteMint.mintAuthority;

  assert(baseVault.equals((await getMint(banksClient, storedFailMarket.baseMint)).mintAuthority));
  assert(quoteVault.equals((await getMint(banksClient, storedFailMarket.quoteMint)).mintAuthority));


  const storedBaseVault = await vaultProgram.account.conditionalVault.fetch(
    baseVault
  );
  const storedQuoteVault = await vaultProgram.account.conditionalVault.fetch(
    quoteVault
  );


  const mmBaseUnderlying = await createAccount(
    banksClient,
    payer,
    storedBaseVault.underlyingTokenMint,
    mm.publicKey
  );
  const mmQuoteUnderlying = await createAccount(
    banksClient,
    payer,
    storedQuoteVault.underlyingTokenMint,
    mm.publicKey
  );

  const MM_BASE_AMOUNT = 10_000n * 1_000_000_000n;
  const MM_QUOTE_AMOUNT = 100_000n * 1_000_000n;
  await mintToOverride(context, mmBaseUnderlying, MM_BASE_AMOUNT);
  await mintToOverride(context, mmQuoteUnderlying, MM_QUOTE_AMOUNT);

  await mintConditionalTokens(
    vaultProgram,
    MM_BASE_AMOUNT,
    mm,
    baseVault,
    banksClient
  );
  
  await mintConditionalTokens(
    vaultProgram,
    MM_QUOTE_AMOUNT,
    mm,
    quoteVault,
    banksClient
  );

  let openOrders = await openbook.createOpenOrders(
    payer,
    passMarket,
    new BN(1),
    'oo',
    mm
  );

  return [mm];
}

async function initializeProposal(
  autocrat: Program<AutocratV0>,
  ix: ProposalInstruction,
  vaultProgram: Program<ConditionalVault>,
  dao: PublicKey,
  clobProgram: Program<Clob>,
  context: ProgramTestContext,
  payer: Keypair,
  openbook: OpenBookV2Client,
  openbookTwap: Program<OpenbookTwap>,
): Promise<PublicKey> {
  const proposalKeypair = Keypair.generate();

  const currentClock = await context.banksClient.getClock();
  const slot = currentClock.slot + 1n;
  context.setClock(
    new Clock(
      slot,
      currentClock.epochStartTimestamp,
      currentClock.epoch,
      currentClock.leaderScheduleEpoch,
      currentClock.unixTimestamp
    )
  );

  const storedDAO = await autocrat.account.dao.fetch(dao);

  // least signficant 32 bits of nonce are proposal number
  // most significant bit of nonce is 0 for pass and 1 for fail
  // second most significant bit of nonce is 0 for base and 1 for quote

  let baseNonce = new BN(storedDAO.proposalCount);

  const baseVault = await initializeVault(
    vaultProgram,
    storedDAO.treasury,
    storedDAO.metaMint,
    baseNonce,
    payer
  );

  const quoteVault = await initializeVault(
    vaultProgram,
    storedDAO.treasury,
    storedDAO.usdcMint,
    baseNonce.or(new BN(1).shln(63)),
    payer
  );

  const passBaseMint = (
    await vaultProgram.account.conditionalVault.fetch(baseVault)
  ).conditionalOnFinalizeTokenMint;
  const passQuoteMint = (
   await vaultProgram.account.conditionalVault.fetch(quoteVault)
  ).conditionalOnFinalizeTokenMint;
  const failBaseMint = (
   await vaultProgram.account.conditionalVault.fetch(baseVault)
  ).conditionalOnRevertTokenMint;
  const failQuoteMint = (
   await vaultProgram.account.conditionalVault.fetch(quoteVault)
  ).conditionalOnRevertTokenMint;

  const [daoTreasury] = PublicKey.findProgramAddressSync(
    [dao.toBuffer()],
    autocrat.programId
  );

  const daoBefore = await autocrat.account.dao.fetch(dao);

  const dummyURL = "https://www.eff.org/cyberspace-independence";

    let openbookPassMarketKP = Keypair.generate();

    let [openbookTwapPassMarket] = PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("twap_market"), openbookPassMarketKP.publicKey.toBuffer()],
      openbookTwap.programId
    );

    let openbookPassMarket = await openbook.createMarket(
      payer,
      "pMETA/pUSDC",
      passQuoteMint,
      passBaseMint,
      new BN(100),
      new BN(1e9),
      new BN(0),
      new BN(0),
      new BN(0),
      null,
      null,
      openbookTwapPassMarket,
      null,
      openbookTwapPassMarket,
      { confFilter: 0.1, maxStalenessSlots: 100 },
      openbookPassMarketKP
    );

    await openbookTwap.methods.createTwapMarket(new BN(1000))
      .accounts({
        market: openbookPassMarket,
        twapMarket: openbookTwapPassMarket,
      })
      .rpc();

    let openbookFailMarketKP = Keypair.generate();

    let [openbookTwapFailMarket] = PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("twap_market"), openbookFailMarketKP.publicKey.toBuffer()],
      openbookTwap.programId
    );

    let openbookFailMarket = await openbook.createMarket(
      payer,
      "fMETA/fUSDC",
      failQuoteMint,
      failBaseMint,
      new BN(100),
      new BN(1e9),
      new BN(0),
      new BN(0),
      new BN(0),
      null,
      null,
      openbookTwapFailMarket,
      null,
      openbookTwapFailMarket,
      { confFilter: 0.1, maxStalenessSlots: 100 },
      openbookFailMarketKP
    );
    await openbookTwap.methods.createTwapMarket(new BN(1000))
      .accounts({
        market: openbookFailMarket,
        twapMarket: openbookTwapFailMarket,
      })
      .rpc();

  await autocrat.methods
    .initializeProposal(dummyURL, ix)
    .preInstructions([
      await autocrat.account.proposal.createInstruction(proposalKeypair, 1500),
    ])
    .accounts({
      proposal: proposalKeypair.publicKey,
      dao,
      daoTreasury,
      baseVault,
      quoteVault,
      openbookTwapPassMarket,
      openbookTwapFailMarket,
      openbookPassMarket,
      openbookFailMarket,
      proposer: payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([proposalKeypair])
    .rpc()
    .then(
      () => {},
      (err) => console.error(err)
    );

  const storedProposal = await autocrat.account.proposal.fetch(
    proposalKeypair.publicKey
  );

  const daoAfter = await autocrat.account.dao.fetch(dao);

  assert.equal(daoAfter.proposalCount, daoBefore.proposalCount + 1);

  assert.equal(storedProposal.number, daoBefore.proposalCount);
  assert.ok(storedProposal.proposer.equals(payer.publicKey));
  assert.equal(storedProposal.descriptionUrl, dummyURL);
  assert.ok(storedProposal.openbookTwapFailMarket.equals(openbookTwapFailMarket));
  assert.ok(storedProposal.openbookTwapPassMarket.equals(openbookTwapPassMarket));
  assert.equal(storedProposal.slotEnqueued.toString(), new BN(slot.toString()).toString());
  assert.deepEqual(storedProposal.state, { pending: {} });

  const storedIx = storedProposal.instruction;
  assert.ok(storedIx.programId.equals(ix.programId));
  assert.deepEqual(storedIx.accounts, ix.accounts);
  assert.deepEqual(storedIx.data, ix.data);

  return proposalKeypair.publicKey;
}

async function initializeVault(
  vaultProgram: Program<ConditionalVault>,
  settlementAuthority: PublicKey,
  underlyingTokenMint: PublicKey,
  nonce: BN,
  payer: Keypair
): Promise<PublicKey> {
  const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("conditional_vault"),
      settlementAuthority.toBuffer(),
      underlyingTokenMint.toBuffer(),
      nonce.toBuffer("le", 8),
    ],
    vaultProgram.programId
  );
  const conditionalOnFinalizeTokenMintKeypair = Keypair.generate();
  const conditionalOnRevertTokenMintKeypair = Keypair.generate();

  const vaultUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
    underlyingTokenMint,
    vault,
    true
  );
    await vaultProgram.methods
      .initializeConditionalVault(settlementAuthority, nonce)
      .accounts({
        vault,
        underlyingTokenMint,
        vaultUnderlyingTokenAccount,
        conditionalOnFinalizeTokenMint: conditionalOnFinalizeTokenMintKeypair.publicKey,
        conditionalOnRevertTokenMint: conditionalOnRevertTokenMintKeypair.publicKey,
        payer: payer.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([conditionalOnFinalizeTokenMintKeypair, conditionalOnRevertTokenMintKeypair])
      .rpc();

  return vault;
}
