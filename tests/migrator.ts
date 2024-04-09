import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;

import { assert } from "chai";

import { startAnchor } from "solana-bankrun";

const AUTOCRAT_MIGRATOR_PROGRAM_ID = new PublicKey(
  "MigRDW6uxyNMDBD8fX2njCRyJC4YZk2Rx9pDUZiAESt"
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
  let provider,
    connection,
    migrator,
    payer,
    context,
    banksClient,
    META,
    USDC,
    MNDE,
    BOL;

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

    MNDE = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      payer.publicKey,
      9
    );

    BOL = await createMint(
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

  describe("#multi_transfer4", async function () {
    it("does transfer", async function () {
      let sender = Keypair.generate();
      let receiver = Keypair.generate();

      const tokens = [META, USDC, BOL, MNDE];
      const accounts = [];

      for (const token of tokens) {
        let from = await createAccount(
          banksClient,
          payer,
          token,
          sender.publicKey
        );
        let to = await createAccount(
          banksClient,
          payer,
          token,
          receiver.publicKey
        );

        accounts.push([from, to]);
      }

      await mintTo(banksClient, payer, META, accounts[0][0], payer, 1_000_000);
      await mintTo(banksClient, payer, USDC, accounts[1][0], payer, 10_000);
      await mintTo(
        banksClient,
        payer,
        BOL,
        accounts[2][0],
        payer,
        5_000_000_000_000
      );
      await mintTo(
        banksClient,
        payer,
        MNDE,
        accounts[3][0],
        payer,
        10_000_000_000_000
      );

      await migrator.methods
        .multiTransfer4()
        .accounts({
          authority: sender.publicKey,
          from0: accounts[0][0],
          to0: accounts[0][1],
          from1: accounts[1][0],
          to1: accounts[1][1],
          from2: accounts[2][0],
          to2: accounts[2][1],
          from3: accounts[3][0],
          to3: accounts[3][1],
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

      for (const tokenAccounts of accounts) {
        assert((await getAccount(banksClient, tokenAccounts[0])).amount == 0n);
      }

      assert(
        (await getAccount(banksClient, accounts[0][1])).amount == 1_000_000n
      );
      assert((await getAccount(banksClient, accounts[1][1])).amount == 10_000n);
      assert(
        (await getAccount(banksClient, accounts[2][1])).amount ==
          5_000_000_000_000n
      );
      assert(
        (await getAccount(banksClient, accounts[3][1])).amount ==
          10_000_000_000_000n
      );

      assert(
        (await banksClient.getAccount(receiver.publicKey)).lamports >
          1_000_000_000 * 0.999
      );
    });
  });
});
