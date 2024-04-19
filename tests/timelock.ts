import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;

import { assert } from "chai";

import { startAnchor } from "solana-bankrun";

const TIMELOCK_PROGRAM_ID = new PublicKey(
  "tiME1hz9F5C5ZecbvE5z6Msjy8PKfTqo1UuRYXfndKF"
);

import { Timelock } from "../target/types/timelock";
import { Connection } from "@solana/web3.js";
const TimelockIDL: Timelock = require("../target/idl/timelock.json");

export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

// import {
//   createMint,
//   createAccount,
//   getAccount,
//   mintTo,
// } from "spl-token-bankrun";

describe("autocrat_migrator", async function () {
  let provider: BankrunProvider,
    connection: anchor.web3.Connection,
    timelock: Program<Timelock>,
    // migrator,
    payer,
    context,
    banksClient,
    timelockKp: anchor.web3.Keypair,
    timelockSignerPubkey: anchor.web3.PublicKey,
    timelockAuthority: anchor.web3.Keypair;
  // META,
  // USDC,
  // MNDE,
  // BOL;
  before(async () => {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    connection = provider.connection;
    payer = provider.wallet;
    timelock = new Program<Timelock>(
      TimelockIDL,
      TIMELOCK_PROGRAM_ID,
      provider
    );
  });

  it("Creates a new timelock", async () => {
    timelockKp = anchor.web3.Keypair.generate();
    let nonce: number;
    [timelockSignerPubkey, nonce] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [timelockKp.publicKey.toBuffer()],
        timelock.programId
      );
    const timelockSize = 200; // Big enough.

    const delayInSlots = new anchor.BN(1);
    timelockAuthority = anchor.web3.Keypair.generate();

    await timelock.methods
      .createTimelock(timelockAuthority.publicKey, delayInSlots)
      .accounts({
        timelock: timelockKp.publicKey,
        timelockSigner: timelockSignerPubkey,
      })
      .preInstructions([
        await timelock.account.timelock.createInstruction(
          timelockKp,
          timelockSize
        ),
      ])
      .signers([timelockKp])
      .rpc();

    let timelockAccount = await timelock.account.timelock.fetch(
      timelockKp.publicKey
    );
    assert.strictEqual(timelockAccount.signerBump, nonce);
    assert.ok(timelockAccount.delayInSlots.eq(delayInSlots));
  });
});
