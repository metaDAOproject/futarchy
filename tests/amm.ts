import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
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

import { Amm } from "../target/types/amm";

const AmmIDL: Amm = require("../target/idl/amm.json");

const AMM_PROGRAM_ID = new PublicKey(
  "4kjgd1q5qAQfujsXPCwc4zw277h9ToF6h6EYYa2RjThe"
);

describe("amm", async function () {
  let amm, context, banksClient, provider, payer;

  before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    payer = provider.wallet.payer;

    amm = new Program<Amm>(AmmIDL, AMM_PROGRAM_ID, provider);
  });

  it("works", async function () {
    await amm.methods.initialize().rpc();
  });
});
