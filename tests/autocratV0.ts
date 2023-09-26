import * as anchor from "@project-serum/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";

const { PublicKey, Signer, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

import { expect, assert } from "chai";

import { startAnchor, Clock } from "solana-bankrun";

import { expectError } from "./utils";

import { AutocratV0 } from "../target/types/autocrat_v0";
import { ConditionalVault } from "../target/types/conditional_vault";
import { Clob } from "../target/types/clob";

/* import { generateMarketMaker } from "./clob"; */

import * as AutocratIDL from "../target/idl/autocrat_v0.json";
import * as ConditionalVaultIDL from "../target/idl/conditional_vault.json";
import * as ClobIDL from "../target/idl/clob.json";

import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  mintToOverride,
} from "spl-token-bankrun";

export type AutocratProgram = Program<AutocratV0>;
export type ConditionalVaultProgram = Program<ConditionalVault>;
export type ClobProgram = Program<Clob>;

// this test file isn't 'clean' or DRY or whatever; sorry!
const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "5QBbGKFSoL1hS4s5dsCBdNRVnJcMuHXFwhooKk2ar25S"
);

const CONDITIONAL_VAULT_PROGRAM_ID = new PublicKey(
  "4SrgFQyrvEYB3GupUaEjoULXCmzHCcAcTffHbpppycip"
);

const CLOB_PROGRAM_ID = new PublicKey(
  "Ap4Y89Jo1Xx7jtimjoWMGCPAKEgrarasU9iQ6Dc6Pxor"
);

const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

describe("autocrat_v0", async function () {
  let provider,
    connection,
    autocrat,
    payer,
    context,
    banksClient,
    dao,
    daoTreasury,
    mint,
    vaultProgram,
    clobProgram,
    clobAdmin,
    clobGlobalState;

  before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    autocrat = new anchor.Program<AutocratProgram>(
      AutocratIDL,
      AUTOCRAT_PROGRAM_ID,
      provider
    );

    vaultProgram = new Program<ConditionalVaultProgram>(
      ConditionalVaultIDL,
      CONDITIONAL_VAULT_PROGRAM_ID,
      provider
    );

    clobProgram = new Program<ClobProgram>(ClobIDL, CLOB_PROGRAM_ID, provider);

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
  });

  describe("#initialize_dao", async function () {
    it("initializes the DAO", async function () {
      [dao] = PublicKey.findProgramAddressSync(
        [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
        autocrat.programId
      );
      [daoTreasury] = PublicKey.findProgramAddressSync(
        [dao.toBuffer()],
        autocrat.programId
      );

      mint = await createMint(banksClient, payer, dao, dao, 9);

      await autocrat.methods
        .initializeDao()
        .accounts({
          dao,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          token: mint,
        })
        .rpc()
        .then(
          () => {},
          (err) => console.error(err)
        );

      const daoAcc = await autocrat.account.dao.fetch(dao);
      assert(daoAcc.token.equals(mint));
      assert.equal(daoAcc.proposalCount, 0);
      assert.equal(daoAcc.passThresholdBps, 500);
      assert.ok(
        daoAcc.proposalLamportLockup.eq(new BN(1_000_000_000).muln(20))
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
      const data = autocrat.coder.instruction.encode("set_pass_threshold_bps", {
        passThresholdBps: 1000,
      });
      const instruction = {
        programId: autocrat.programId,
        accounts,
        data,
      };

      await initializeProposal(
        autocrat,
        instruction,
        vaultProgram,
        dao,
        clobProgram
      );
    });
  });

  describe("#finalize_proposal", async function () {
    it("doesn't finalize proposals that are too young", async function () {
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

      let proposerBalanceBefore = await banksClient.getBalance(payer.publicKey);

      const proposal = await initializeProposal(
        autocrat,
        instruction,
        vaultProgram,
        dao,
        clobProgram
      );

      assert(
        (await banksClient.getBalance(payer.publicKey)) <
          proposerBalanceBefore - 1_000_000_000n * 20n
      );

      const storedProposal = await autocrat.account.proposal.fetch(proposal);
      const { passMarket } = storedProposal;
      const { failMarket } = storedProposal;

      const callbacks = expectError(
        autocrat,
        "ProposalTooYoung",
        "finalize succeeded despite proposal being too young"
      );

      await autocrat.methods
        .finalizeProposal()
        .accounts({
          proposal,
          passMarket,
          failMarket,
          dao,
          daoTreasury,
        })
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });

    it("finalizes proposals when pass price TWAP > (fail price TWAP + threshold)", async function () {
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
      const data = autocrat.coder.instruction.encode("set_pass_threshold_bps", {
        passThresholdBps: 1000,
      });
      const instruction = {
        programId: autocrat.programId,
        accounts,
        data,
      };

      const proposal = await initializeProposal(
        autocrat,
        instruction,
        vaultProgram,
        dao,
        clobProgram
      );

      let storedProposal = await autocrat.account.proposal.fetch(proposal);
      const { passMarket } = storedProposal;
      const { failMarket } = storedProposal;

      const [passMM] = await generateMarketMaker(
        0,
        clobProgram,
        banksClient,
        payer,
        clobGlobalState,
        passMarket,
        clobAdmin
      );

      const [failMM] = await generateMarketMaker(
        0,
        clobProgram,
        banksClient,
        payer,
        clobGlobalState,
        failMarket,
        clobAdmin
      );

      // pass market should be higher
      await clobProgram.methods
        .submitLimitOrder(
          { buy: {} },
          new anchor.BN(101), // amount
          new anchor.BN(2.1e9 - 100), // price
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
          new anchor.BN(101), // amount
          new anchor.BN(2.1e9 - 300), // price
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
          new anchor.BN(101), // amount
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
          new anchor.BN(101), // amount
          new anchor.BN(2e9 - 700), // price
          14, // ref id
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
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

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
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

      await clobProgram.methods
        .submitLimitOrder(
          { buy: {} },
          new anchor.BN(101), // amount
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
          new anchor.BN(101), // amount
          new anchor.BN(2e9 - 700), // price
          14, // ref id
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

      let proposerBalanceBefore = await banksClient.getBalance(payer.publicKey);

      await autocrat.methods
        .finalizeProposal()
        .accounts({
          proposal,
          passMarket,
          failMarket,
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
      assert.exists(storedProposal.state.passed);

      const storedDao = await autocrat.account.dao.fetch(dao);
      assert.equal(storedDao.passThresholdBps, 1000);

      assert(
        (await banksClient.getBalance(payer.publicKey)) >
          proposerBalanceBefore + 1_000_000_000n * 19n
      );
    });

    it("rejects proposals when pass price TWAP < fail price TWAP", async function () {
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

      const data = autocrat.coder.instruction.encode("set_pass_threshold_bps", {
        passThresholdBps: 750,
      });
      const instruction = {
        programId: autocrat.programId,
        accounts,
        data,
      };

      const proposal = await initializeProposal(
        autocrat,
        instruction,
        vaultProgram,
        dao,
        clobProgram
      );

      let storedProposal = await autocrat.account.proposal.fetch(proposal);
      const { passMarket } = storedProposal;
      const { failMarket } = storedProposal;

      const [passMM] = await generateMarketMaker(
        0,
        clobProgram,
        banksClient,
        payer,
        clobGlobalState,
        passMarket,
        clobAdmin
      );

      const [failMM] = await generateMarketMaker(
        0,
        clobProgram,
        banksClient,
        payer,
        clobGlobalState,
        failMarket,
        clobAdmin
      );

      // pass market should be higher
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
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

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
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

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
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

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
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

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
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

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
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

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
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

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
        .rpc()
        .then(
          () => {},
          (err) => console.log(err)
        );

      let storedDao = await autocrat.account.dao.fetch(dao);
      const passThresholdBpsBefore = storedDao.passThresholdBps;

      let proposerBalanceBefore = await banksClient.getBalance(payer.publicKey);

      await autocrat.methods
        .finalizeProposal()
        .accounts({
          proposal,
          passMarket,
          failMarket,
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

      assert(
        (await banksClient.getBalance(payer.publicKey)) >
          proposerBalanceBefore + 1_000_000_000n * 19n
      );
    });
  });
});

async function generateMarketMaker(
  index: number,
  program: ClobProgram,
  banksClient: BanksClient,
  payer: anchor.web3.Keypair,
  globalState: anchor.web3.PublicKey,
  orderBook: anchor.web3.PublicKey,
  admin: anchor.web3.Keypair
): [Keypair] {
  const context = program.provider.context;

  const mm = anchor.web3.Keypair.generate();

  const storedOrderBook = await program.account.orderBook.fetch(orderBook);

  /* console.log(storedOrderBook); */

  const mmBase = await createAccount(
    banksClient,
    payer,
    storedOrderBook.base,
    mm.publicKey
  );

  const mmQuote = await createAccount(
    banksClient,
    payer,
    storedOrderBook.quote,
    mm.publicKey
  );

  await mintToOverride(context, mmBase, 1_000_000_000n);

  await mintToOverride(context, mmQuote, 1_000_000_000n);

  await program.methods
    .addMarketMaker(mm.publicKey, index)
    .accounts({
      orderBook,
      payer: payer.publicKey,
      globalState,
      admin: admin.publicKey,
    })
    .rpc();

  await program.methods
    .topUpBalance(
      index,
      new anchor.BN(1_000_000_000),
      new anchor.BN(1_000_000_000)
    )
    .accounts({
      orderBook,
      authority: mm.publicKey,
      baseFrom: mmBase,
      quoteFrom: mmQuote,
      baseVault: storedOrderBook.baseVault,
      quoteVault: storedOrderBook.quoteVault,
      tokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .signers([mm])
    .rpc();

  return [mm];
}

async function initializeProposal(
  autocrat: AutocratProgram,
  ix: {},
  vaultProgram: ConditionalVaultProgram,
  dao: PublicKey,
  clobProgram: ClobProgram
): PublicKey {
  const context = autocrat.provider.context;
  const payer = autocrat.provider.wallet.payer;
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

  const [quotePassVaultSettlementAuthority] = PublicKey.findProgramAddressSync(
    [
      proposalKeypair.publicKey.toBuffer(),
      anchor.utils.bytes.utf8.encode("quote_pass"),
    ],
    autocrat.programId
  );

  const [quoteFailVaultSettlementAuthority] = PublicKey.findProgramAddressSync(
    [
      proposalKeypair.publicKey.toBuffer(),
      anchor.utils.bytes.utf8.encode("quote_fail"),
    ],
    autocrat.programId
  );

  const [basePassVaultSettlementAuthority] = PublicKey.findProgramAddressSync(
    [
      proposalKeypair.publicKey.toBuffer(),
      anchor.utils.bytes.utf8.encode("base_pass"),
    ],
    autocrat.programId
  );

  const [baseFailVaultSettlementAuthority] = PublicKey.findProgramAddressSync(
    [
      proposalKeypair.publicKey.toBuffer(),
      anchor.utils.bytes.utf8.encode("base_fail"),
    ],
    autocrat.programId
  );

  const storedDAO = await autocrat.account.dao.fetch(dao);

  const quotePassVault = await initializeVault(
    vaultProgram,
    quotePassVaultSettlementAuthority,
    storedDAO.token
  );

  const quoteFailVault = await initializeVault(
    vaultProgram,
    quoteFailVaultSettlementAuthority,
    storedDAO.token
  );

  const basePassVault = await initializeVault(
    vaultProgram,
    basePassVaultSettlementAuthority,
    WSOL
  );

  const baseFailVault = await initializeVault(
    vaultProgram,
    baseFailVaultSettlementAuthority,
    WSOL
  );

  const passBaseMint = (
    await vaultProgram.account.conditionalVault.fetch(basePassVault)
  ).conditionalTokenMint;
  const passQuoteMint = (
    await vaultProgram.account.conditionalVault.fetch(quotePassVault)
  ).conditionalTokenMint;
  const failBaseMint = (
    await vaultProgram.account.conditionalVault.fetch(baseFailVault)
  ).conditionalTokenMint;
  const failQuoteMint = (
    await vaultProgram.account.conditionalVault.fetch(quoteFailVault)
  ).conditionalTokenMint;

  const [passMarket] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("order_book"),
      passBaseMint.toBuffer(),
      passQuoteMint.toBuffer(),
    ],
    clobProgram.programId
  );

  const [failMarket] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("order_book"),
      failBaseMint.toBuffer(),
      failQuoteMint.toBuffer(),
    ],
    clobProgram.programId
  );

  const passBaseVault = await token.getAssociatedTokenAddress(
    passBaseMint,
    passMarket,
    true
  );

  const passQuoteVault = await token.getAssociatedTokenAddress(
    passQuoteMint,
    passMarket,
    true
  );

  const failBaseVault = await token.getAssociatedTokenAddress(
    failBaseMint,
    failMarket,
    true
  );

  const failQuoteVault = await token.getAssociatedTokenAddress(
    failQuoteMint,
    failMarket,
    true
  );

  const [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
    clobProgram.programId
  );

  await clobProgram.methods
    .initializeOrderBook()
    .accounts({
      orderBook: passMarket,
      globalState,
      payer: payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      base: passBaseMint,
      quote: passQuoteMint,
      baseVault: passBaseVault,
      quoteVault: passQuoteVault,
    })
    .rpc();

  await clobProgram.methods
    .initializeOrderBook()
    .accounts({
      orderBook: failMarket,
      globalState,
      payer: payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      base: failBaseMint,
      quote: failQuoteMint,
      baseVault: failBaseVault,
      quoteVault: failQuoteVault,
    })
    .rpc();

  const [daoTreasury] = PublicKey.findProgramAddressSync(
    [dao.toBuffer()],
    autocrat.programId
  );

  const daoBefore = await autocrat.account.dao.fetch(dao);

  const dummyURL = "https://www.eff.org/cyberspace-independence";

  await autocrat.methods
    .initializeProposal(dummyURL, ix)
    .preInstructions([
      await autocrat.account.proposal.createInstruction(proposalKeypair, 1500),
    ])
    .accounts({
      proposal: proposalKeypair.publicKey,
      dao,
      daoTreasury,
      quotePassVault,
      quoteFailVault,
      basePassVault,
      baseFailVault,
      passMarket,
      failMarket,
      initializer: payer.publicKey,
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
  assert.ok(storedProposal.passMarket.equals(passMarket));
  assert.ok(storedProposal.failMarket.equals(failMarket));
  assert.equal(storedProposal.slotEnqueued, slot);
  assert.deepEqual(storedProposal.state, { pending: {} });

  const storedIx = storedProposal.instruction;
  assert.ok(storedIx.programId.equals(ix.programId));
  assert.deepEqual(storedIx.accounts, ix.accounts);
  assert.deepEqual(storedIx.data, ix.data);

  return proposalKeypair.publicKey;
}

async function initializeVault(
  vaultProgram: VaultProgram,
  settlementAuthority: PublicKey,
  underlyingTokenMint: PublicKey
): PublicKey {
  const payer = vaultProgram.provider.wallet.payer;

  const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("conditional_vault"),
      settlementAuthority.toBuffer(),
      underlyingTokenMint.toBuffer(),
    ],
    vaultProgram.programId
  );
  const conditionalTokenMintKeypair = Keypair.generate();

  const vaultUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
    underlyingTokenMint,
    vault,
    true
  );

  await vaultProgram.methods
    .initializeConditionalVault(settlementAuthority)
    .accounts({
      vault,
      underlyingTokenMint,
      vaultUnderlyingTokenAccount,
      conditionalTokenMint: conditionalTokenMintKeypair.publicKey,
      payer: payer.publicKey,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([conditionalTokenMintKeypair])
    .rpc();

  return vault;
}
