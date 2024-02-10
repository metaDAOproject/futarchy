import { autocratProgram, finalizeProposal } from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const PROPOSAL_NUMBER = 3;

async function main() {
    const proposals = await autocratProgram.account.proposal.all();
    const proposal = proposals.find((proposal) => proposal.account.number == PROPOSAL_NUMBER);

    await finalizeProposal(proposal.publicKey);
}

main();
