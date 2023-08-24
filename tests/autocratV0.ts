import * as anchor from "@project-serum/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "../../anchor-bankrun";

const { PublicKey, Signer, Keypair, SystemProgram } = anchor.web3;

import { expect, assert } from "chai";

import { startAnchor } from "solana-bankrun";

import { expectError } from "./utils";

import { AutocratV0 } from "../target/types/autocrat_v0";
import * as AutocratIDL from "../target/idl/autocrat_v0.json";

import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "./bankrunUtils";

export type AutocratProgram = anchor.Program<AutocratV0>;

// this test file isn't 'clean' or DRY or whatever; sorry!
const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "5QBbGKFSoL1hS4s5dsCBdNRVnJcMuHXFwhooKk2ar25S"
);

describe("autocrat_v0", async function () {
  let provider,
    connection,
    autocrat,
    payer,
    context,
    banksClient,
    dao,
    mint;

   before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    autocrat = new anchor.Program<AutocratProgram>(
      AutocratIDL,
      AUTOCRAT_PROGRAM_ID,
      provider,
    );

    payer = autocrat.provider.wallet.payer;
  });

  describe("#initialize_dao", async function () {
    it("initializes the DAO", async function () {
      [dao] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB"),
        ],
        autocrat.programId
      );

      mint = await createMint(
        banksClient,
        payer,
        dao,
        dao,
        9
      );

      await autocrat.methods.initializeDao()
        .accounts({
          dao,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          token: mint,
        })
        .rpc().then(() => {}, (err) => console.error(err));

      const daoAcc = await autocrat.account.dao.fetch(dao);
      assert(daoAcc.token.equals(mint));
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
      const data = autocrat.coder.instruction.encode(
        "set_pass_threshold_bps",
        1000
      );
      const instructions = [
        {
          programId: autocrat.programId,
          accounts: Buffer.from([0]),
          data: data,
        },
      ];

      await initializeProposal(autocrat, instructions, accounts);
    });
  });
});

async function initializeProposal(autocrat: AutocratProgram, instructions: [], accounts: []): PublicKey {
  const payer = autocrat.provider.wallet.payer;
  const proposalKeypair = Keypair.generate();

  await autocrat.methods.initializeProposal(instructions, accounts)
  .preInstructions([
    await autocrat.account.proposal.createInstruction(
      proposalKeypair,
      1000
    ),
  ])
  .accounts({
    proposal: proposalKeypair.publicKey,
    initializer: payer.publicKey,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .signers([proposalKeypair])
  .rpc();

  const storedProposal = await autocrat.account.proposal.fetch(
    proposalKeypair.publicKey
  );

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
