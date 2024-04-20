import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { BankrunProvider } from "anchor-bankrun";
import { assert } from "chai";
import {
  startAnchor,
  Clock,
  BanksClient,
  ProgramTestContext,
} from "solana-bankrun";
import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintToOverride,
  getMint,
  getAccount,
} from "spl-token-bankrun";

import {
  mintConditionalTokens,
  redeemConditionalTokens,
} from "./conditionalVault";

import { advanceBySlots, expectError } from "./utils/utils";
import { Autocrat } from "../target/types/autocrat";
import { ConditionalVault } from "../target/types/conditional_vault";
import { AutocratMigrator } from "../target/types/autocrat_migrator";

const { PublicKey, Keypair } = anchor.web3;

import {
  AmmClient,
  getATA,
  getAmmAddr,
  getAmmLpMintAddr,
  getVaultAddr,
} from "../app/src";
import { PriceMath } from "../app/src/utils/priceMath";
import { AutocratClient } from "../app/src/AutocratClient";
import {
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { ConditionalVaultClient } from "../app/src/ConditionalVaultClient";

const AutocratIDL: Autocrat = require("../target/idl/autocrat.json");
const ConditionalVaultIDL: ConditionalVault = require("../target/idl/conditional_vault.json");
const AutocratMigratorIDL: AutocratMigrator = require("../target/idl/autocrat_migrator.json");

export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

type ProposalInstruction = anchor.IdlTypes<Autocrat>["ProposalInstruction"];

// this test file isn't 'clean' or DRY or whatever; sorry!
const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "FuTPR6ScKMPHtZFwacq9qrtf9VjscawNEFTb2wSYr1gY"
);

const CONDITIONAL_VAULT_PROGRAM_ID = new PublicKey(
  "vAuLTQjV5AZx5f3UgE75wcnkxnQowWxThn1hGjfCVwP"
);

const AUTOCRAT_MIGRATOR_PROGRAM_ID = new PublicKey(
  "MigRDW6uxyNMDBD8fX2njCRyJC4YZk2Rx9pDUZiAESt"
);

describe("autocrat", async function () {
  let provider,
    autocrat,
    payer,
    context: ProgramTestContext,
    banksClient: BanksClient,
    dao,
    mertdDao,
    daoTreasury,
    mertdDaoTreasury,
    META,
    USDC,
    MERTD,
    vaultProgram,
    ammClient: AmmClient,
    autocratClient: AutocratClient,
    vaultClient: ConditionalVaultClient,
    migrator,
    treasuryMetaAccount,
    treasuryUsdcAccount,
    mertdTreasuryMertdAccount,
    mertdTreasuryUsdcAccount;

  before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    ammClient = AmmClient.createClient({ provider });
    vaultClient = ConditionalVaultClient.createClient({ provider });
    autocratClient = await AutocratClient.createClient({ provider });

    autocrat = new anchor.Program<Autocrat>(
      AutocratIDL,
      AUTOCRAT_PROGRAM_ID,
      provider
    );

    vaultProgram = new Program<ConditionalVault>(
      ConditionalVaultIDL,
      CONDITIONAL_VAULT_PROGRAM_ID,
      provider
    );

    migrator = new anchor.Program<AutocratMigrator>(
      AutocratMigratorIDL,
      AUTOCRAT_MIGRATOR_PROGRAM_ID,
      provider
    );

    payer = provider.wallet.payer;

    USDC = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );

    META = await createMint(banksClient, payer, dao, dao, 9);

    MERTD = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );

    await createAssociatedTokenAccount(banksClient, payer, META, payer.publicKey);
    await createAssociatedTokenAccount(banksClient, payer, USDC, payer.publicKey);

    // 10 META
    await mintToOverride(context, getATA(META, payer.publicKey)[0], 10n * 1_000_000_000n);
    // 20,000 USDC
    await mintToOverride(context, getATA(USDC, payer.publicKey)[0], 20_000n * 1_000_000n);
  });

  describe("#initialize_dao", async function () {
    it.only("initializes the DAO", async function () {
      dao = await autocratClient
        .initializeDao(
          META,
          400,
          9,
          USDC
        );

      let treasuryPdaBump;
      [daoTreasury, treasuryPdaBump] = PublicKey.findProgramAddressSync(
        [dao.toBuffer()],
        autocrat.programId
      );

      const storedDao = await autocratClient.getDao(dao);
      assert(storedDao.treasury.equals(daoTreasury));
      assert.equal(storedDao.treasuryPdaBump, treasuryPdaBump);
      assert(storedDao.tokenMint.equals(META));
      assert(storedDao.usdcMint.equals(USDC));
      assert.equal(storedDao.proposalCount, 0);
      assert.equal(storedDao.passThresholdBps, 300);

      treasuryMetaAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        META,
        daoTreasury
      );
      treasuryUsdcAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        USDC,
        daoTreasury
      );
    });

    it("initializes a second DAO", async function () {
      mertdDao = await autocratClient.initializeDao(MERTD, new BN(1_000_000), new BN(1_000), USDC);

      [mertdDaoTreasury] = PublicKey.findProgramAddressSync(
        [mertdDao.toBuffer()],
        autocrat.programId
      );

      mertdTreasuryMertdAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        MERTD,
        mertdDaoTreasury
      );
      mertdTreasuryUsdcAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        USDC,
        mertdDaoTreasury
      );
    });
  });

  describe("#initialize_proposal", async function () {
    it("initializes proposals", async function () {
      const accounts = [
        {
          pubkey: dao,
          isSigner: true,
          isWritable: true,
        },
      ];
      const data = autocrat.coder.instruction.encode("update_dao", {
        daoParams: {
          passThresholdBps: 500,
          baseBurnLamports: null,
          burnDecayPerSlotLamports: null,
          slotsPerProposal: null,
          marketTakerFee: null,
        },
      });
      const instruction = {
        programId: autocrat.programId,
        accounts,
        data,
      };

      let currentClock = await context.banksClient.getClock();
      let newSlot = currentClock.slot + 216_000n; // 1 day
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

      await autocratClient.initializeProposal(dao, "", instruction);

      let balanceAfter = await banksClient.getBalance(payer.publicKey);

      // two days, so proposer should burn 5 SOL
      assert(balanceAfter < balanceBefore - 1_000_000_000n * 5n);

      assert(balanceAfter > balanceBefore - 1_000_000_000n * 10n);
    });
  });

  describe("#finalize_proposal", async function () {
    let proposal: PublicKey;

    beforeEach(async function () {
      await mintToOverride(context, treasuryMetaAccount, 1_000_000_000n);
      await mintToOverride(context, treasuryUsdcAccount, 1_000_000n);

      let receiver = Keypair.generate();
      let to0 = await createAccount(
        banksClient,
        payer,
        META,
        receiver.publicKey
      );
      let to1 = await createAccount(
        banksClient,
        payer,
        USDC,
        receiver.publicKey
      );

      const ix = await migrator.methods
        .multiTransfer2()
        .accounts({
          authority: daoTreasury,
          from0: treasuryMetaAccount,
          to0,
          from1: treasuryUsdcAccount,
          to1,
          lamportReceiver: receiver.publicKey,
        })
        .instruction();

      let instruction = {
        programId: ix.programId,
        accounts: ix.keys,
        data: ix.data,
      };

      proposal = await autocratClient.initializeProposal(dao, "", instruction);

      let {
        passAmm,
        failAmm,
        passBaseMint,
        passQuoteMint,
        failBaseMint,
        failQuoteMint,
        baseVault,
        quoteVault
      } = autocratClient.getProposalPdas(proposal, META, USDC, dao);

      await ammClient.addLiquidityIx(
        passAmm,
        passBaseMint,
        passQuoteMint,
        new BN(1500),
        new BN(100),
        new BN(1500),
        new BN(100),
      )
      .postInstructions([
        await ammClient.addLiquidityIx(
          failAmm,
          failBaseMint,
          failQuoteMint,
          new BN(1000),
          new BN(100),
          new BN(1000),
          new BN(100),
        ).instruction()
      ])
      .rpc();
    });

    it("doesn't finalize proposals that are too young", async function () {
      const callbacks = expectError(
        "ProposalTooYoung",
        "finalize succeeded despite proposal being too young"
      );

      await autocratClient
        .finalizeProposal(proposal)
        .then(callbacks[0], callbacks[1]);
    });

    it.only("finalizes proposals when pass price TWAP > (fail price TWAP + threshold)", async function () {
      let {
        passAmm,
        failAmm,
        passBaseMint,
        passQuoteMint,
        failBaseMint,
        failQuoteMint,
        baseVault,
        quoteVault
      } = autocratClient.getProposalPdas(proposal, META, USDC, dao);

      
      // await ammClient.addLiquidityIx(
      //   failAmm,
      //   failBaseMint,
      //   failQuoteMint,
      //   new BN(1000),
      //   new BN(100),
      //   new BN(1000),
      //   new BN(100),
      // ).rpc();

      for (let i = 0; i < 100; i++) {
        await advanceBySlots(context, 10_000n);

        await ammClient
          .crankThatTwapIx(passAmm)
          .preInstructions([
            // this is to get around bankrun thinking we've processed the same transaction multiple times
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: i,
            }),
            await ammClient.crankThatTwapIx(failAmm).instruction()
          ])
          .rpc();
      }

      await autocratClient.finalizeProposal(proposal);

      let storedBaseVault = await vaultClient.getVault(
        baseVault
      );
      let storedQuoteVault = await vaultClient.getVault(
        quoteVault
      );

      assert.exists(storedBaseVault.status.finalized);
      assert.exists(storedQuoteVault.status.finalized);

      // storedProposal = await autocrat.account.proposal.fetch(proposal);
      // assert.exists(storedProposal.state.passed);

      // assert.equal(
      //   (await getAccount(banksClient, treasuryMetaAccount)).amount,
      //   1_000_000_000n
      // );
      // assert.equal(
      //   (await getAccount(banksClient, treasuryUsdcAccount)).amount,
      //   1_000_000n
      // );

      // await autocratClient.executeProposal(proposal);

      // storedProposal = await autocrat.account.proposal.fetch(proposal);

      // assert.exists(storedProposal.state.executed);

      // assert.equal(
      //   (await getAccount(banksClient, treasuryMetaAccount)).amount,
      //   0n
      // );
      // assert.equal(
      //   (await getAccount(banksClient, treasuryUsdcAccount)).amount,
      //   0n
      // );

      // await redeemConditionalTokens(
      //   vaultProgram,
      //   alice,
      //   aliceBasePassConditionalTokenAccount,
      //   aliceBaseFailConditionalTokenAccount,
      //   storedBaseVault.conditionalOnFinalizeTokenMint,
      //   storedBaseVault.conditionalOnRevertTokenMint,
      //   aliceUnderlyingBaseTokenAccount,
      //   storedBaseVault.underlyingTokenAccount,
      //   baseVault,
      //   banksClient
      // );
      // await redeemConditionalTokens(
      //   vaultProgram,
      //   alice,
      //   aliceQuotePassConditionalTokenAccount,
      //   aliceQuoteFailConditionalTokenAccount,
      //   storedQuoteVault.conditionalOnFinalizeTokenMint,
      //   storedQuoteVault.conditionalOnRevertTokenMint,
      //   aliceUnderlyingQuoteTokenAccount,
      //   storedQuoteVault.underlyingTokenAccount,
      //   quoteVault,
      //   banksClient
      // );

      // // alice should have gained 1 META & lost $145 USDC
      // assert.equal(
      //   (await getAccount(banksClient, aliceUnderlyingBaseTokenAccount)).amount,
      //   1_000_000_000n
      // );
      // assert.equal(
      //   (await getAccount(banksClient, aliceUnderlyingQuoteTokenAccount))
      //     .amount,
      //   10_000n * 1_000_000n - 147_000_000n
      // );
      // And the TWAP on pass market should be $140 per meta / $14 per 0.1 meta
    });

    it.only("rejects proposals when pass price TWAP < fail price TWAP", async function () {
      // let storedProposal = await autocrat.account.proposal.fetch(proposal);

      // let storedDao = await autocrat.account.dao.fetch(dao);
      // const passThresholdBpsBefore = storedDao.passThresholdBps;

      // await autocratClient.finalizeProposal(proposal);

      // storedProposal = await autocrat.account.proposal.fetch(proposal);
      // assert.exists(storedProposal.state.failed);

      // let storedBaseVault = await vaultProgram.account.conditionalVault.fetch(
      //   baseVault
      // );
      // let storedQuoteVault = await vaultProgram.account.conditionalVault.fetch(
      //   quoteVault
      // );

      // assert.exists(storedBaseVault.status.reverted);
      // assert.exists(storedQuoteVault.status.reverted);

      // storedDao = await autocrat.account.dao.fetch(dao);
      // assert.equal(storedDao.passThresholdBps, passThresholdBpsBefore);

      // await redeemConditionalTokens(
      //   vaultProgram,
      //   alice,
      //   aliceBasePassConditionalTokenAccount,
      //   aliceBaseFailConditionalTokenAccount,
      //   storedBaseVault.conditionalOnFinalizeTokenMint,
      //   storedBaseVault.conditionalOnRevertTokenMint,
      //   aliceUnderlyingBaseTokenAccount,
      //   storedBaseVault.underlyingTokenAccount,
      //   baseVault,
      //   banksClient
      // );
      // await redeemConditionalTokens(
      //   vaultProgram,
      //   alice,
      //   aliceQuotePassConditionalTokenAccount,
      //   aliceQuoteFailConditionalTokenAccount,
      //   storedQuoteVault.conditionalOnFinalizeTokenMint,
      //   storedQuoteVault.conditionalOnRevertTokenMint,
      //   aliceUnderlyingQuoteTokenAccount,
      //   storedQuoteVault.underlyingTokenAccount,
      //   quoteVault,
      //   banksClient
      // );

      // // alice should have the same balance as she started with
      // assert.equal(
      //   (await getAccount(banksClient, aliceUnderlyingBaseTokenAccount)).amount,
      //   0n
      // );
      // assert.equal(
      //   (await getAccount(banksClient, aliceUnderlyingQuoteTokenAccount))
      //     .amount,
      //   10_000n * 1_000_000n
      // );
    });
  });

  describe("#execute_proposal", async function () {
    let proposal, passAmm, failAmm, baseVault, quoteVault, instruction;

    beforeEach(async function () {
      await mintToOverride(context, treasuryMetaAccount, 1_000_000_000n);
      await mintToOverride(context, treasuryUsdcAccount, 1_000_000n);

      instruction = {
        programId: MEMO_PROGRAM_ID,
        accounts: [],
        data: Buffer.from("hello, world"),
      };

      proposal = await autocratClient.initializeProposal(dao, "", instruction);

      ({ baseVault, quoteVault, passAmm, failAmm } =
        await autocrat.account.proposal.fetch(proposal));
    });

    it("doesn't allow pending proposals to be executed", async function () {
      const callbacks = expectError(
        "ProposalNotPassed",
        "executed despite proposal still pending"
      );

      await autocratClient
        .executeProposal(proposal)
        .then(callbacks[0], callbacks[1]);
    });

    it("doesn't allow failed proposals to be executed", async function () {
      let currentClock = await context.banksClient.getClock();
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

      await autocratClient.finalizeProposal(proposal);

      assert.exists(
        (await autocrat.account.proposal.fetch(proposal)).state.failed
      );

      const callbacks = expectError(
        "ProposalNotPassed",
        "executed despite proposal proposal failed"
      );

      await autocratClient
        .executeProposal(proposal)
        .then(callbacks[0], callbacks[1]);
    });

    it("doesn't allow proposals to be executed twice", async function () {
      let currentClock = await context.banksClient.getClock();
      for (let i = 0; i < 10; i++) {
        context.setClock(
          new Clock(
            currentClock.slot + 1_000n * BigInt(i),
            currentClock.epochStartTimestamp,
            currentClock.epoch,
            currentClock.leaderScheduleEpoch,
            currentClock.unixTimestamp
          )
        );
      }

      context.setClock(
        new Clock(
          currentClock.slot + 10_000_000n,
          currentClock.epochStartTimestamp,
          currentClock.epoch,
          currentClock.leaderScheduleEpoch,
          currentClock.unixTimestamp
        )
      );

      await autocratClient.finalizeProposal(proposal);

      const storedProposal = await autocrat.account.proposal.fetch(proposal);
      assert.exists(storedProposal.state.passed);

      await autocratClient.executeProposal(proposal);

      const callbacks = expectError(
        "ProposalNotPassed",
        "executed despite already being executed"
      );

      await autocratClient
        .executeProposalIx(proposal, dao, storedProposal.instruction)
        .preInstructions([
          // add a pre-instruction so it doesn't think it's already processed it
          anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: 100_000,
          }),
        ])
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });
  });

  // this is a terrible, ugly, hack
  // we should abstract away the tests somehow so this
  // isn't an issue
  describe("mertd integration tests", async function () {
    let proposal,
      baseVault,
      quoteVault,
      passAmm,
      failAmm,
      basePassVaultUnderlyingTokenAccount,
      basePassConditionalTokenMint,
      baseFailConditionalTokenMint,
      mm0,
      alice,
      aliceUnderlyingQuoteTokenAccount,
      aliceUnderlyingBaseTokenAccount,
      aliceBasePassConditionalTokenAccount,
      aliceBaseFailConditionalTokenAccount,
      aliceQuotePassConditionalTokenAccount,
      aliceQuoteFailConditionalTokenAccount,
      newPassThresholdBps,
      instruction;

    beforeEach(async function () {
      const accounts = [
        {
          pubkey: mertdDao,
          isSigner: false,
          isWritable: true,
        },
        {
          pubkey: mertdDaoTreasury,
          isSigner: true,
          isWritable: false,
        },
      ];
      const data = autocrat.coder.instruction.encode("update_dao", {
        daoParams: {
          passThresholdBps: 500,
          baseBurnLamports: null,
          burnDecayPerSlotLamports: null,
          slotsPerProposal: null,
          marketTakerFee: null,
          twapExpectedValue: null,
          maxObservationChangePerUpdateLots: null,
          baseLotSize: null,
        },
      });
      instruction = {
        programId: autocrat.programId,
        accounts,
        data,
      };

      proposal = await autocratClient.initializeProposal(dao, "", instruction);

      ({ baseVault, quoteVault, passAmm, failAmm } =
        await autocrat.account.proposal.fetch(proposal));

      // alice wants to buy MERTD if the proposal passes, so she locks up USDC
      // and swaps her pUSDC for pMETA
      alice = Keypair.generate();

      // needed because of penalty fee on take
      let ixs = [
        anchor.web3.SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          lamports: 1_000_000_000n,
          toPubkey: alice.publicKey,
        }),
        anchor.web3.SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          lamports: 1_000_000_000n,
          toPubkey: mertdDaoTreasury,
        }),
      ];
      let tx = new anchor.web3.Transaction().add(...ixs);
      [tx.recentBlockhash] = await banksClient.getLatestBlockhash();
      tx.feePayer = payer.publicKey;
      tx.sign(payer);
      await banksClient.processTransaction(tx);

      const storedQuoteVault =
        await vaultProgram.account.conditionalVault.fetch(quoteVault);
      const quoteVaultUnderlyingTokenAccount =
        storedQuoteVault.underlyingTokenAccount;
      const quotePassConditionalTokenMint =
        storedQuoteVault.conditionalOnFinalizeTokenMint;
      const quoteFailConditionalTokenMint =
        storedQuoteVault.conditionalOnRevertTokenMint;

      const storedBaseVault = await vaultProgram.account.conditionalVault.fetch(
        baseVault
      );
      basePassConditionalTokenMint =
        storedBaseVault.conditionalOnFinalizeTokenMint;
      baseFailConditionalTokenMint =
        storedBaseVault.conditionalOnRevertTokenMint;

      aliceUnderlyingQuoteTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        USDC,
        alice.publicKey
      );
      aliceUnderlyingBaseTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        MERTD,
        alice.publicKey
      );

      await mintToOverride(
        context,
        aliceUnderlyingQuoteTokenAccount,
        10_000n * 1_000_000n
      );

      aliceQuotePassConditionalTokenAccount =
        await createAssociatedTokenAccount(
          banksClient,
          payer,
          quotePassConditionalTokenMint,
          alice.publicKey
        );
      aliceQuoteFailConditionalTokenAccount =
        await createAssociatedTokenAccount(
          banksClient,
          payer,
          quoteFailConditionalTokenMint,
          alice.publicKey
        );

      await mintConditionalTokens(
        vaultProgram,
        10_000n * 1_000_000n,
        alice,
        quoteVault,
        banksClient
      );

      aliceBasePassConditionalTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        basePassConditionalTokenMint,
        alice.publicKey
      );

      aliceBaseFailConditionalTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        baseFailConditionalTokenMint,
        alice.publicKey
      );
    });

    it("doesn't finalize proposals that are too young", async function () {
      const callbacks = expectError(
        "ProposalTooYoung",
        "finalize succeeded despite proposal being too young"
      );

      await autocratClient
        .finalizeProposal(proposal)
        .then(callbacks[0], callbacks[1]);
    });

    it("finalizes proposals when pass price TWAP > (fail price TWAP + threshold)", async function () {
      let storedProposal = await autocrat.account.proposal.fetch(proposal);

      let currentClock;
      for (let i = 0; i < 10; i++) {
        currentClock = await context.banksClient.getClock();
        context.setClock(
          new Clock(
            currentClock.slot + 10_000n,
            currentClock.epochStartTimestamp,
            currentClock.epoch,
            currentClock.leaderScheduleEpoch,
            currentClock.unixTimestamp
          )
        );
      }

      // set the current clock slot to +10_000
      currentClock = await context.banksClient.getClock();
      context.setClock(
        new Clock(
          currentClock.slot + 10_000n,
          currentClock.epochStartTimestamp,
          currentClock.epoch,
          currentClock.leaderScheduleEpoch,
          currentClock.unixTimestamp
        )
      );

      currentClock = await context.banksClient.getClock();
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

      await autocratClient.finalizeProposal(proposal);

      let storedBaseVault = await vaultProgram.account.conditionalVault.fetch(
        baseVault
      );
      let storedQuoteVault = await vaultProgram.account.conditionalVault.fetch(
        quoteVault
      );

      assert.exists(storedBaseVault.status.finalized);
      assert.exists(storedQuoteVault.status.finalized);

      storedProposal = await autocrat.account.proposal.fetch(proposal);
      assert.exists(storedProposal.state.passed);

      // pass threshold hasn't changed yet
      assert.equal(
        (await autocrat.account.dao.fetch(mertdDao)).passThresholdBps,
        300
      );

      await autocratClient.executeProposal(proposal);

      storedProposal = await autocrat.account.proposal.fetch(proposal);

      assert.exists(storedProposal.state.executed);

      // pass threshold should have now changed
      assert.equal(
        (await autocrat.account.dao.fetch(mertdDao)).passThresholdBps,
        500
      );

      await redeemConditionalTokens(
        vaultProgram,
        alice,
        aliceBasePassConditionalTokenAccount,
        aliceBaseFailConditionalTokenAccount,
        storedBaseVault.conditionalOnFinalizeTokenMint,
        storedBaseVault.conditionalOnRevertTokenMint,
        aliceUnderlyingBaseTokenAccount,
        storedBaseVault.underlyingTokenAccount,
        baseVault,
        banksClient
      );
      await redeemConditionalTokens(
        vaultProgram,
        alice,
        aliceQuotePassConditionalTokenAccount,
        aliceQuoteFailConditionalTokenAccount,
        storedQuoteVault.conditionalOnFinalizeTokenMint,
        storedQuoteVault.conditionalOnRevertTokenMint,
        aliceUnderlyingQuoteTokenAccount,
        storedQuoteVault.underlyingTokenAccount,
        quoteVault,
        banksClient
      );

      assert.equal(
        (await getAccount(banksClient, aliceUnderlyingBaseTokenAccount)).amount,
        10_000_000n
      );
      assert.equal(
        (await getAccount(banksClient, aliceUnderlyingQuoteTokenAccount))
          .amount,
        10_000n * 1_000_000n - 25_200_000n
      );
      // And the TWAP on pass market should be $140 per meta / $14 per 0.1 meta
    });

    it("rejects proposals when pass price TWAP < fail price TWAP", async function () {
      let storedProposal = await autocrat.account.proposal.fetch(proposal);

      let currentClock;
      for (let i = 0; i < 10; i++) {
        currentClock = await context.banksClient.getClock();
        context.setClock(
          new Clock(
            currentClock.slot + 10_000n,
            currentClock.epochStartTimestamp,
            currentClock.epoch,
            currentClock.leaderScheduleEpoch,
            currentClock.unixTimestamp
          )
        );
      }

      // set the current clock slot to +10_000
      currentClock = await context.banksClient.getClock();
      context.setClock(
        new Clock(
          currentClock.slot + 10_000n,
          currentClock.epochStartTimestamp,
          currentClock.epoch,
          currentClock.leaderScheduleEpoch,
          currentClock.unixTimestamp
        )
      );

      currentClock = await context.banksClient.getClock();
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

      let storedDao = await autocrat.account.dao.fetch(mertdDao);
      const passThresholdBpsBefore = storedDao.passThresholdBps;

      await autocratClient.finalizeProposal(proposal);

      storedProposal = await autocrat.account.proposal.fetch(proposal);
      assert.exists(storedProposal.state.failed);

      let storedBaseVault = await vaultProgram.account.conditionalVault.fetch(
        baseVault
      );
      let storedQuoteVault = await vaultProgram.account.conditionalVault.fetch(
        quoteVault
      );

      assert.exists(storedBaseVault.status.reverted);
      assert.exists(storedQuoteVault.status.reverted);

      storedDao = await autocrat.account.dao.fetch(mertdDao);
      assert.equal(storedDao.passThresholdBps, passThresholdBpsBefore);

      await redeemConditionalTokens(
        vaultProgram,
        alice,
        aliceBasePassConditionalTokenAccount,
        aliceBaseFailConditionalTokenAccount,
        storedBaseVault.conditionalOnFinalizeTokenMint,
        storedBaseVault.conditionalOnRevertTokenMint,
        aliceUnderlyingBaseTokenAccount,
        storedBaseVault.underlyingTokenAccount,
        baseVault,
        banksClient
      );
      await redeemConditionalTokens(
        vaultProgram,
        alice,
        aliceQuotePassConditionalTokenAccount,
        aliceQuoteFailConditionalTokenAccount,
        storedQuoteVault.conditionalOnFinalizeTokenMint,
        storedQuoteVault.conditionalOnRevertTokenMint,
        aliceUnderlyingQuoteTokenAccount,
        storedQuoteVault.underlyingTokenAccount,
        quoteVault,
        banksClient
      );

      // alice should have the same balance as she started with
      assert.equal(
        (await getAccount(banksClient, aliceUnderlyingBaseTokenAccount)).amount,
        0n
      );
      assert.equal(
        (await getAccount(banksClient, aliceUnderlyingQuoteTokenAccount))
          .amount,
        10_000n * 1_000_000n
      );
    });
  });
});
