import { createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { AutocratClient } from "../../AutocratClient";
import { InstructionHandler } from "../../InstructionHandler";
import { getATA, getAmmAuthAddr, getDaoAddr, getDaoTreasuryAddr, getProposalAddr, getProposalInstructionsAddr, getProposalVaultAddr } from '../../utils';
import { Keypair, PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";

export const submitProposalHandler = async (
    client: AutocratClient,
    proposalNumber: number,
    ammProgram: PublicKey,
): Promise<InstructionHandler<typeof client.program, AutocratClient>> => {
    let daoAddr = getDaoAddr(client.program.programId)[0]
    let daoTreasuryAddr = getDaoTreasuryAddr(client.program.programId)[0]

    let proposalAddr = getProposalAddr(client.program.programId, proposalNumber)[0]
    let proposal = await client.program.account.proposal.fetch(proposalAddr)

    let proposalInstructionsAddr = getProposalInstructionsAddr(client.program.programId, proposalAddr)[0]

    let proposalVaultAddr = getProposalVaultAddr(client.program.programId, proposalAddr)[0]

    let ammAuthAddr = getAmmAuthAddr(client.program.programId)[0]

    let ix = await client.program.methods
        .submitProposal()
        .accounts({
            proposer: client.provider.publicKey,
            dao: daoAddr,
            daoTreasury: daoTreasuryAddr,
            proposal: proposalAddr,
            proposalVault: proposalVaultAddr,
            proposalInstructions: proposalInstructionsAddr,
            usdcMint: proposal.usdcMint,
            usdcProposerAta: getATA(proposal.usdcMint, client.provider.publicKey)[0],
            usdcTreasuryVaultAta: getATA(proposal.usdcMint, daoTreasuryAddr)[0],
            passMarketAmm: proposal.passMarketAmm,
            failMarketAmm: proposal.failMarketAmm,
            ammAuthPda: ammAuthAddr,
            ammProgram,
        })
        .instruction()

    return new InstructionHandler([ix], [], client)
};
