import { initializeProposal } from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

async function main() {
  const memoText =
    "I, glorious autocrat of the divine Meta-DAO, " +
    "hereby endorse this endeavor to elevate the futarchy domain. " +
    "Recognize that my utterance echoes not the voice of a mortal but resonates as the proclamation of an omniscient market." +
    "Onward, futards, with the swiftness of the divine!";

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
    "https://bafybeicfx3w6om4sk6ly7lgfnoy7wj3qpfzv6iet6qvyjzu6yvubmgeu5i.ipfs.nftstorage.link/"
  );
}

main();
