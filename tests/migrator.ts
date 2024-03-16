import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;

import { assert } from "chai";

import { startAnchor } from "solana-bankrun";

const AUTOCRAT_MIGRATOR_PROGRAM_ID = new PublicKey(
  "migkwAXrXFN34voCYQUhFQBXZJjHrWnpEXbSGTqZdB3"
);

import { AutocratMigrator } from "../target/types/autocrat_migrator";
const AutocratMigratorIDL: AutocratMigrator = require("../target/idl/autocrat_migrator.json");

export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

import {
  createMint,
  createAccount,
  getAccount,
  mintTo,
} from "spl-token-bankrun";

describe("autocrat_migrator", async function () {
  let provider, connection, migrator, payer, context, banksClient, META, USDC;

  before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    migrator = new anchor.Program<AutocratMigrator>(
      AutocratMigratorIDL,
      AUTOCRAT_MIGRATOR_PROGRAM_ID,
      provider
    );

    payer = migrator.provider.wallet.payer;

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
  });

  describe("#multi_transfer2", async function () {
    it("does transfer", async function () {
      let sender = Keypair.generate();
      let receiver = Keypair.generate();

      let from0 = await createAccount(
        banksClient,
        payer,
        META,
        sender.publicKey
      );
      let to0 = await createAccount(
        banksClient,
        payer,
        META,
        receiver.publicKey
      );

      let from1 = await createAccount(
        banksClient,
        payer,
        USDC,
        sender.publicKey
      );
      let to1 = await createAccount(
        banksClient,
        payer,
        USDC,
        receiver.publicKey
      );

      await mintTo(banksClient, payer, META, from0, payer, 1_000_000);
      await mintTo(banksClient, payer, USDC, from1, payer, 10_000);

      await migrator.methods
        .multiTransfer2()
        .accounts({
          authority: sender.publicKey,
          from0,
          to0,
          from1,
          to1,
          lamportReceiver: receiver.publicKey,
        })
        .preInstructions([
          SystemProgram.transfer({
            fromPubkey: payer.publicKey,
            toPubkey: sender.publicKey,
            lamports: 1_000_000_000n,
          }),
        ])
        .signers([sender])
        .rpc();

      assert((await getAccount(banksClient, from0)).amount == 0n);
      assert((await getAccount(banksClient, from1)).amount == 0n);

      assert((await getAccount(banksClient, to0)).amount == 1_000_000n);
      assert((await getAccount(banksClient, to1)).amount == 10_000n);

      assert(
        (await banksClient.getAccount(receiver.publicKey)).lamports >
          1_000_000_000 * 0.999
      );
    });
  });
});
