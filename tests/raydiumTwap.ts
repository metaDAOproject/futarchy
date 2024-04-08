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

import { RaydiumTwap } from "../target/types/raydium_twap";

const { PublicKey, Keypair } = anchor.web3;

const RaydiumTwapIDL: RaydiumTwap = require("../target/idl/raydium_twap.json");

export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

const RAYDIUM_TWAP_PROGRAM_ID = new PublicKey(
  "8D57r6T9RaBTeDFezQzzoHRxywk1bMqYmbprsmx6Y8XV"
);

const RAYDIUM_PROGRAM_ID = new PublicKey(
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"
);

describe("raydium_twap", async function () {
  let provider,
    raydiumTwap,
    payer,
    context: ProgramTestContext,
    banksClient: BanksClient,
    USDC,
    META;

  before(async function () {
    context = await startAnchor(
      "./",
      [
        {
          name: "raydium_amm_v3",
          programId: RAYDIUM_PROGRAM_ID,
        },
      ],
      []
    );
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    raydiumTwap = new anchor.Program<RaydiumTwap>(
      RaydiumTwapIDL,
      RAYDIUM_TWAP_PROGRAM_ID,
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

    META = await createMint(banksClient, payer, payer.publicKey, payer.publicKey, 9);
  });

  describe("#initialize_pool_twap", async function () {
    it("initializes pool TWAPs");
  });

  describe("#crank", async function () {
    it("cranks - test #1");

    it("cranks - test #2");

    it("cranks - test #3");
  });
});
 