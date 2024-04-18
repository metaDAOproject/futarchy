import { autocratProgram, finalizeProposal } from "./main";

const PROPOSAL_NUMBER = 2;

async function main() {
  const proposals = await autocratProgram.account.proposal.all();
  const proposal = proposals.find(
    (proposal) => proposal.account.number == PROPOSAL_NUMBER
  );

  await finalizeProposal(proposal.publicKey);
}

main();
