import { AccountMeta, PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import { AutocratClient } from "../../AutocratClient";
import { InstructionHandler } from "../../InstructionHandler";
import { getDaoAddr, getDaoTreasuryAddr, getProposalAddr } from '../../utils';

export const finalizeProposalHandler = async (
    client: AutocratClient,
    proposalNumber: number,
    accounts: AccountMeta[],
): Promise<InstructionHandler<typeof client.program, AutocratClient>> => {

    let proposalAddr = getProposalAddr(client.program.programId, proposalNumber)[0]
    const proposalAcc = await client.program.account.proposal.fetch(proposalAddr);

    let ix = await client.program.methods
        .finalizeProposal()
        .accounts({
            proposal: proposalAddr,
            proposalInstructions: proposalAcc.instructions,
            dao: getDaoAddr(client.program.programId)[0],
            daoTreasury: getDaoTreasuryAddr(client.program.programId)[0],
            passMarketAmm: proposalAcc.passMarketAmm,
            failMarketAmm: proposalAcc.failMarketAmm,
        })
        .remainingAccounts(accounts)
        .instruction()

    return new InstructionHandler([ix], [], client)
};
