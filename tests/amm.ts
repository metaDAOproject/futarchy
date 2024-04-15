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
  let ammProgram, context, banksClient, provider, payer, META, USDC;

  before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);
    payer = provider.wallet.payer;

    ammProgram = new Program<Amm>(AmmIDL, AMM_PROGRAM_ID, provider);

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

  it("works", async function () {
    const amm = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("amm__"),
        META.toBuffer(),
        USDC.toBuffer(),
        new BN(1).toBuffer('le', 8)
      ],
      ammProgram.programId
    )[0];

    console.log(amm);

    await ammProgram.methods
      .createAmm({
        swapFeeBps: new BN(1),
        ltwapDecimals: 9,
      })
      .accounts({
        amm,
        baseMint: META,
        quoteMint: USDC,
        vaultAtaBase: token.getAssociatedTokenAddressSync(META, amm, true),
        vaultAtaQuote: token.getAssociatedTokenAddressSync(USDC, amm, true),
      })
      .rpc();
  });
});
