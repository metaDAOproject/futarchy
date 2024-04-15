import { AutocratClient } from "../../AutocratClient";
import { InstructionHandler } from "../../InstructionHandler";
import { ProposalInstruction } from '../../types';
import { Keypair } from "@solana/web3.js";
import { getProposalAddr, getProposalInstructionsAddr } from "../../utils";

export const createProposalInstructionsHandler = async (
    client: AutocratClient,
    proposalNumber: number,
    instructions: ProposalInstruction[],
): Promise<InstructionHandler<typeof client.program, AutocratClient>> => {

    let proposalAddr = getProposalAddr(client.program.programId, proposalNumber)[0]

    let proposalInstructionsAddr = getProposalInstructionsAddr(client.program.programId, proposalAddr)[0]

    let ix = await client.program.methods
        .createProposalInstructions(instructions)
        .accounts({
            proposer: client.provider.publicKey,
            proposal: proposalAddr,
            proposalInstructions: proposalInstructionsAddr,
        })
        .instruction()

    return new InstructionHandler([ix], [], client)
};
