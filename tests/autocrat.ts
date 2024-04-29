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
  AUTOCRAT_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  AmmClient,
  getATA,
  getAmmAddr,
  getAmmLpMintAddr,
  getVaultAddr,
} from "../futarchy-ts/src";
import { PriceMath } from "../futarchy-ts/src/utils/priceMath";
// import { AutocratClient } from "../futarchy-ts/src/AutocratClient";
import {AutocratClient} from "@metadaoproject/futarchy-ts";
import {
  ComputeBudgetInstruction,
  ComputeBudgetProgram,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { ConditionalVaultClient } from "../futarchy-ts/src/ConditionalVaultClient";

const AutocratIDL: Autocrat = require("../target/idl/autocrat.json");
const ConditionalVaultIDL: ConditionalVault = require("../target/idl/conditional_vault.json");
const AutocratMigratorIDL: AutocratMigrator = require("../target/idl/autocrat_migrator.json");

export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

type ProposalInstruction = anchor.IdlTypes<Autocrat>["ProposalInstruction"];

// this test file isn't 'clean' or DRY or whatever; sorry!

const AUTOCRAT_MIGRATOR_PROGRAM_ID = new PublicKey(
  "MigRDW6uxyNMDBD8fX2njCRyJC4YZk2Rx9pDUZiAESt"
);

const ONE_META = new BN(1_000_000_000);
const ONE_USDC = new BN(1_000_000);

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

    await createAssociatedTokenAccount(
      banksClient,
      payer,
      META,
      payer.publicKey
    );
    await createAssociatedTokenAccount(
      banksClient,
      payer,
      USDC,
      payer.publicKey
    );

    // 1000 META
    await mintToOverride(
      context,
      getATA(META, payer.publicKey)[0],
      1_000n * 1_000_000_000n
    );
    // 200,000 USDC
    await mintToOverride(
      context,
      getATA(USDC, payer.publicKey)[0],
      200_000n * 1_000_000n
    );
  });

  describe("#initialize_dao", async function () {
    it("initializes the DAO", async function () {
      dao = await autocratClient.initializeDao(META, 400, 5, 5000, USDC);

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
      mertdDao = await autocratClient.initializeDao(
        MERTD,
        0.001,
        1_000_000,
        5_000,
        USDC
      );

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

      const preMetaBalance = (
        await getAccount(banksClient, getATA(META, payer.publicKey)[0])
      ).amount;
      const preUsdcBalance = (
        await getAccount(banksClient, getATA(USDC, payer.publicKey)[0])
      ).amount;

      await autocratClient.initializeProposal(
        dao,
        "",
        instruction,
        ONE_META.muln(5),
        ONE_USDC.muln(5000)
      );

      const postMetaBalance = (
        await getAccount(banksClient, getATA(META, payer.publicKey)[0])
      ).amount;
      const postUsdcBalance = (
        await getAccount(banksClient, getATA(USDC, payer.publicKey)[0])
      ).amount;

      assert.equal(postMetaBalance, preMetaBalance - BigInt(5 * 10 ** 9));
      assert.equal(postUsdcBalance, preUsdcBalance - BigInt(5000 * 10 ** 6));
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

      proposal = await autocratClient.initializeProposal(
        dao,
        "",
        instruction,
        ONE_META.muln(10),
        ONE_USDC.muln(5000)
      );

      let { baseVault, quoteVault } = autocratClient.getProposalPdas(
        proposal,
        META,
        USDC,
        dao
      );
      await vaultClient.mintConditionalTokens(baseVault, 10);
      await vaultClient.mintConditionalTokens(quoteVault, 10_000);
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
      let {
        passAmm,
        failAmm,
        passBaseMint,
        passQuoteMint,
        failBaseMint,
        failQuoteMint,
        baseVault,
        quoteVault,
        passLp,
        failLp,
      } = autocratClient.getProposalPdas(proposal, META, USDC, dao);

      // swap $500 in the pass market, make it pass
      await ammClient
        .swapIx(
          passAmm,
          passBaseMint,
          passQuoteMint,
          { buy: {} },
          new BN(500).muln(1_000_000),
          new BN(0)
        )
        .rpc();

      for (let i = 0; i < 100; i++) {
        await advanceBySlots(context, 10_000n);

        await ammClient
          .crankThatTwapIx(passAmm)
          .preInstructions([
            // this is to get around bankrun thinking we've processed the same transaction multiple times
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: i,
            }),
            await ammClient.crankThatTwapIx(failAmm).instruction(),
          ])
          .rpc();
      }

      const prePassLpBalance = (
        await getAccount(banksClient, getATA(passLp, payer.publicKey)[0])
      ).amount;
      const preFailLpBalance = (
        await getAccount(banksClient, getATA(failLp, payer.publicKey)[0])
      ).amount;

      await autocratClient.finalizeProposal(proposal);

      const postPassLpBalance = (
        await getAccount(banksClient, getATA(passLp, payer.publicKey)[0])
      ).amount;
      const postFailLpBalance = (
        await getAccount(banksClient, getATA(failLp, payer.publicKey)[0])
      ).amount;

      assert(postPassLpBalance > prePassLpBalance);
      assert(postFailLpBalance > preFailLpBalance);

      let storedPassAmm = await ammClient.getAmm(passAmm);
      let storedFailAmm = await ammClient.getAmm(failAmm);

      console.log(
        PriceMath.getHumanPrice(storedPassAmm.oracle.lastObservation, 9, 6)
      );
      console.log(
        PriceMath.getHumanPrice(storedFailAmm.oracle.lastObservation, 9, 6)
      );

      let passTwap = ammClient.getTwap(storedPassAmm);

      let failTwap = ammClient.getTwap(storedFailAmm);

      console.log(PriceMath.getHumanPrice(passTwap, 9, 6));
      console.log(PriceMath.getHumanPrice(failTwap, 9, 6));

      let storedBaseVault = await vaultClient.getVault(baseVault);
      let storedQuoteVault = await vaultClient.getVault(quoteVault);

      assert.exists(storedBaseVault.status.finalized);
      assert.exists(storedQuoteVault.status.finalized);
    });

    it("rejects proposals when pass price TWAP < fail price TWAP", async function () {
      let {
        passAmm,
        failAmm,
        failBaseMint,
        failQuoteMint,
        baseVault,
        quoteVault,
      } = autocratClient.getProposalPdas(proposal, META, USDC, dao);

      // swap $500 in the fail market, make it fail
      await ammClient
        .swapIx(
          failAmm,
          failBaseMint,
          failQuoteMint,
          { buy: {} },
          new BN(500).muln(1_000_000),
          new BN(0)
        )
        .rpc();

      for (let i = 0; i < 100; i++) {
        await advanceBySlots(context, 10_000n);

        await ammClient
          .crankThatTwapIx(passAmm)
          .preInstructions([
            // this is to get around bankrun thinking we've processed the same transaction multiple times
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: i,
            }),
            await ammClient.crankThatTwapIx(failAmm).instruction(),
          ])
          .rpc();
      }

      await autocratClient.finalizeProposal(proposal);

      let storedPassAmm = await ammClient.getAmm(passAmm);
      let storedFailAmm = await ammClient.getAmm(failAmm);

      console.log(
        PriceMath.getHumanPrice(storedPassAmm.oracle.lastObservation, 9, 6)
      );
      console.log(
        PriceMath.getHumanPrice(storedFailAmm.oracle.lastObservation, 9, 6)
      );

      let passTwap = ammClient.getTwap(storedPassAmm);

      let failTwap = ammClient.getTwap(storedFailAmm);

      console.log(PriceMath.getHumanPrice(passTwap, 9, 6));
      console.log(PriceMath.getHumanPrice(failTwap, 9, 6));

      let storedBaseVault = await vaultClient.getVault(baseVault);
      let storedQuoteVault = await vaultClient.getVault(quoteVault);

      assert.exists(storedBaseVault.status.reverted);
      assert.exists(storedQuoteVault.status.reverted);
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

      proposal = await autocratClient.initializeProposal(
        dao,
        "",
        instruction,
        ONE_META.muln(10),
        ONE_USDC.muln(6_000)
      );
      ({ baseVault, quoteVault, passAmm, failAmm } =
        await autocrat.account.proposal.fetch(proposal));

      await vaultClient.mintConditionalTokens(baseVault, 10);
      await vaultClient.mintConditionalTokens(quoteVault, 10_000);
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

      await ammClient
        .crankThatTwapIx(passAmm)
        .preInstructions([
          await ammClient.crankThatTwapIx(failAmm).instruction(),
        ])
        .rpc();

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
      let {
        passAmm,
        failAmm,
        passBaseMint,
        passQuoteMint,
        failBaseMint,
        failQuoteMint,
        baseVault,
        quoteVault,
      } = autocratClient.getProposalPdas(proposal, META, USDC, dao);

      // swap $500 in the pass market, make it pass
      await ammClient
        .swapIx(
          passAmm,
          passBaseMint,
          passQuoteMint,
          { buy: {} },
          new BN(1000).muln(1_000_000),
          new BN(0)
        )
        .rpc();

      for (let i = 0; i < 50; i++) {
        await advanceBySlots(context, 20_000n);

        await ammClient
          .crankThatTwapIx(passAmm)
          .preInstructions([
            // this is to get around bankrun thinking we've processed the same transaction multiple times
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: i,
            }),
            await ammClient.crankThatTwapIx(failAmm).instruction(),
          ])
          .rpc();
      }

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
});
