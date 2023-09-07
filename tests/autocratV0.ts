import * as anchor from "@project-serum/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "../../anchor-bankrun";

const { PublicKey, Signer, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

import { expect, assert } from "chai";

import { startAnchor, Clock } from "solana-bankrun";

import { expectError } from "./utils";

import { AutocratV0 } from "../target/types/autocrat_v0";
import { ConditionalVault } from "../target/types/conditional_vault";
import { Clob } from "../target/types/clob";

import * as AutocratIDL from "../target/idl/autocrat_v0.json";
import * as ConditionalVaultIDL from "../target/idl/conditional_vault.json";
import * as ClobIDL from "../target/idl/clob.json";

import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "./bankrunUtils";

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

describe("autocrat_v0", async function () {
  let provider,
    connection,
    autocrat,
    payer,
    context,
    banksClient,
    dao,
    mint,
    vaultProgram,
    clobProgram,
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
    const admin = anchor.web3.Keypair.generate();

    await clobProgram.methods
      .initializeGlobalState(admin.publicKey)
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
    });
  });

  describe("#initialize_proposal", async function () {
    it("works for single-ix proposals", async function () {
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
      const instructions = [
        {
          programId: autocrat.programId,
          accounts: Buffer.from([0]),
          data: data,
        },
      ];

      await initializeProposal(
        autocrat,
        instructions,
        accounts,
        vaultProgram,
        dao,
        clobProgram
      );
    });

    it("works for multi-ix proposals", async function () {
      const accounts = [
        {
          pubkey: dao,
          isSigner: true,
          isWritable: true,
        },
      ];
      const data0 = autocrat.coder.instruction.encode(
        "set_pass_threshold_bps",
        {
          passThresholdBps: 1000,
        }
      );
      const data1 = autocrat.coder.instruction.encode(
        "set_pass_threshold_bps",
        {
          passThresholdBps: 500,
        }
      );
      const instructions = [
        {
          programId: autocrat.programId,
          accounts: Buffer.from([0]),
          data: data0,
        },
        {
          programId: autocrat.programId,
          accounts: Buffer.from([0]),
          data: data1,
        },
      ];

      await initializeProposal(
        autocrat,
        instructions,
        accounts,
        vaultProgram,
        dao,
        clobProgram
      );
    });
  });
});

async function initializeProposal(
  autocrat: AutocratProgram,
  instructions: [],
  accounts: [],
  vaultProgram: ConditionalVaultProgram,
  dao: PublicKey,
  clobProgram: ClobProgram
): PublicKey {
  const context = autocrat.provider.context;
  const payer = autocrat.provider.wallet.payer;
  const proposalKeypair = Keypair.generate();

  const currentClock = await context.banksClient.getClock();
  const slot = currentClock.slot + 1n;
  context.setClock(new Clock(
    slot,
    currentClock.epochStartTimestamp,
    currentClock.epoch,
    currentClock.leaderScheduleEpoch,
    currentClock.unixTimestamp,
  ));


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

  const wsol = new PublicKey("So11111111111111111111111111111111111111112");

  const basePassVault = await initializeVault(
    vaultProgram,
    basePassVaultSettlementAuthority,
    wsol
  );

  const baseFailVault = await initializeVault(
    vaultProgram,
    baseFailVaultSettlementAuthority,
    wsol
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

  await clobProgram.methods
    .initializeOrderBook()
    .accounts({
      orderBook: passMarket,
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
      payer: payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      base: failBaseMint,
      quote: failQuoteMint,
      baseVault: failBaseVault,
      quoteVault: failQuoteVault,
    })
    .rpc();

  await autocrat.methods
    .initializeProposal(instructions, accounts)
    .preInstructions([
      await autocrat.account.proposal.createInstruction(proposalKeypair, 1000),
    ])
    .accounts({
      proposal: proposalKeypair.publicKey,
      dao,
      quotePassVault,
      quoteFailVault,
      basePassVault,
      baseFailVault,
      quotePassVaultSettlementAuthority,
      quoteFailVaultSettlementAuthority,
      basePassVaultSettlementAuthority,
      baseFailVaultSettlementAuthority,
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

  assert.equal(storedProposal.slotEnqueued, slot);
  assert.equal(storedProposal.didExecute, false);
  assert.equal(storedProposal.instructions.length, instructions.length);

  for (let i = 0; i < instructions.length; i++) {
    const ix = instructions[i];
    const storedIx = storedProposal.instructions[i];

    assert.ok(storedIx.programId.equals(ix.programId));
    assert.deepEqual(storedIx.accounts, ix.accounts);
    assert.deepEqual(storedIx.data, ix.data);
  }

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
