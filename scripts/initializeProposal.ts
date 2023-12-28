import { initializeProposal } from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

async function main() {
  const memoText =
    "I, glorious autocrat of the divine Meta-DAO, " +
    "sanction the creation of this Saber vote market platform.\n\n" +
    "That I shall bestow lavish rewards upon those who contribute to its creation is guaranteed. " +
    "Remember that my word is not the word of a man but the word of a market.\n\n" +
    "Godspeed, futards!";

  const memoInstruction = {
    programId: new PublicKey(MEMO_PROGRAM_ID),
    data: Buffer.from(memoText),
    accounts: [],
  };

  // accounts should be an array of objects that look like
  // {
  //   pubkey: new PublicKey(MEMO_PROGRAM_ID),
  //   isWritable: false,
  //   isSigner: false,
  // }

  await initializeProposal(
    memoInstruction,
    "https://hackmd.io/@jlPYU3_dTOuQkU5duRNUlg/rkhWWXjLp"
  );
}

main();
