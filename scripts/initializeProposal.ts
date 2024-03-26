import { initializeProposal, daoTreasury, META } from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import * as token from "@solana/spl-token";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

async function main() {
  const memoText = "I, glorious autocrat of divine MetaDAO, " +
    "delegate some of the power vested in me to Proph3t and Nallok " +
    "and allow them to make additional use grants of MetaDAO LLC's codebase";

  console.log(memoText.length);
  console.log(MEMO_PROGRAM_ID);

  const ix = {
    programId: new PublicKey(MEMO_PROGRAM_ID),
    accounts: [],
    data: Buffer.from(memoText),
  };

  await initializeProposal(ix, "https://hackmd.io/amOmo2ZSTBqpOmCGX-SXOw?view");
}

main();
