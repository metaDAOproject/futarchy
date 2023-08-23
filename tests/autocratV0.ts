import * as anchor from "@project-serum/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";

import { expect, assert } from "chai";

import { startAnchor } from "solana-bankrun";

import { expectError } from "./utils";

import { AutocratV0 } from "../target/types/autocrat_v0";

import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "./bankrunUtils";

export type AutocratProgram = anchor.Program<AutocratV0>;
export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;

export enum VaultStatus {
  Active,
  Finalized,
  Reverted,
}

// this test file isn't 'clean' or DRY or whatever; sorry!

describe("autocrat_v0", async function () {
  let provider,
    connection,
    autocrat,
    payer,
    context,
    banksClient;

   before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    autocrat = anchor.workspace.AutocratV0 as AutocratProgram;
    payer = autocrat.provider.wallet.payer;
  });

  describe("#initialize", async function () {
    it("initializes", async function () {
      await autocrat.methods.initialize(new anchor.BN(400)).rpc();
    });
  });
});

