import "./main";
import { autocratProgram } from "./main";

// Put your own proposal number here
const PROPOSAL_NUMBER = 1;

async function placeOrder() {
    let proposals = await autocratProgram.account.proposal.all();

    let proposal = proposals.filter((proposal) => proposal.account.number == PROPOSAL_NUMBER)[0].account;
    console.log(proposal);
}

placeOrder();