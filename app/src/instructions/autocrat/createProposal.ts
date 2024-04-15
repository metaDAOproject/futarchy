import { createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { AutocratClient } from "../../AutocratClient";
import { InstructionHandler } from "../../InstructionHandler";
import { getATA, getDaoAddr, getProposalAddr, getProposalVaultAddr } from '../../utils';
import { Keypair, PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import BN from "bn.js";

export const createProposalHandler = async (
    client: AutocratClient,
    proposalNumber: number,
    descriptionUrl: string,
    condMetaToMint: BN,
    condUsdcToMint: BN,
): Promise<InstructionHandler<typeof client.program, AutocratClient>> => {
    let daoAddr = getDaoAddr(client.program.programId)[0]
    let dao = await client.program.account.dao.fetch(daoAddr)

    let proposalAddr = getProposalAddr(client.program.programId, proposalNumber)[0]
    let proposalVaultAddr = getProposalVaultAddr(client.program.programId, proposalAddr)[0]

    let ix = await client.program.methods
        .createProposal(descriptionUrl, condMetaToMint, condUsdcToMint)
        .accounts({
            proposer: client.provider.publicKey,
            dao: daoAddr,
            proposal: proposalAddr,
            proposalVault: proposalVaultAddr,
            metaMint: dao.metaMint,
            usdcMint: dao.usdcMint,
            metaProposerAta: getATA(dao.metaMint, client.provider.publicKey)[0],
            usdcProposerAta: getATA(dao.usdcMint, client.provider.publicKey)[0],
            metaVaultAta: getATA(dao.metaMint, proposalVaultAddr)[0],
            usdcVaultAta: getATA(dao.usdcMint, proposalVaultAddr)[0],
        })
        .instruction()

    return new InstructionHandler([ix], [], client)
};
