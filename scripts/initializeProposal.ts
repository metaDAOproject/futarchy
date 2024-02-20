import { initializeProposal, daoTreasury, META } from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import * as token from "@solana/spl-token";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

const PROPOSAL_9_SQUADS = new PublicKey("CEMVjWZxUXzZCg5ZpEbY5cHyxpcSiynpvBWn5SbycCTb");

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
    PROPOSAL_9_SQUADS,
    true
  );

  const transferIx = token.createTransferInstruction(
    senderAcc.address,
    receiverAcc.address,
    daoTreasury,
    200 * 1_000_000_000, // 200 META
  );

  const ix = {
    programId: transferIx.programId,
    accounts: transferIx.keys,
    data: transferIx.data,
  };

  await initializeProposal(
    ix,
    "https://hackmd.io/@FkZ3fWbzQD2E5PPpDMNzOQ/S18ZGHZn6"
  );
}

main();
