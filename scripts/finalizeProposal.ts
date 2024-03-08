import { autocratProgram, finalizeBurnProposal } from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const PROPOSAL_NUMBER = 11;

async function main() {
    const proposals = await autocratProgram.account.proposal.all();
    const proposal = proposals.find((proposal) => proposal.account.number == PROPOSAL_NUMBER);

    await finalizeBurnProposal(proposal.publicKey);
}

main();
