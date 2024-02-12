import { initializeProposal, daoTreasury, META } from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import * as token from "@solana/spl-token";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

const BEN_PUBKEY = new PublicKey("GxHamnPVxsBaWdbUSjR4C5izhMv2snriGyYtjCkAVzze");

async function main() {
  const senderAcc = await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    META,
    daoTreasury,
    true
  );

  const receiverAcc = await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    META,
    BEN_PUBKEY
  );

  const transferIx = token.createTransferInstruction(
    senderAcc.address,
    receiverAcc.address,
    daoTreasury,
    1_500 * 1_000_000_000, // 1,500 META
  );

  const ix = {
    programId: transferIx.programId,
    accounts: transferIx.keys,
    data: transferIx.data,
  };

  await initializeProposal(
    ix,
    "https://gist.github.com/Benhawkins18/927177850e27a6254678059c99d98209"
  );
}

main();
