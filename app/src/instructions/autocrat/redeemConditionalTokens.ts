import { PublicKey } from '@solana/web3.js';
import { AutocratClient } from "../../AutocratClient";
import { InstructionHandler } from "../../InstructionHandler";
import { getATA, getProposalVaultAddr } from '../../utils';

export const redeemConditionalTokensHandler = async (
    client: AutocratClient,
    proposalAddr: PublicKey,
): Promise<InstructionHandler<typeof client.program, AutocratClient>> => {
    const proposal = await client.program.account.proposal.fetch(proposalAddr);

    let proposalVaultAddr = getProposalVaultAddr(client.program.programId, proposalAddr)[0]

    let ix = await client.program.methods
        .redeemConditionalTokens()
        .accounts({
            user: client.provider.publicKey,
            proposal: proposalAddr,
            proposalVault: proposalVaultAddr,
            metaMint: proposal.metaMint,
            usdcMint: proposal.usdcMint,
            conditionalOnPassMetaMint: proposal.conditionalOnPassMetaMint,
            conditionalOnPassUsdcMint: proposal.conditionalOnPassUsdcMint,
            conditionalOnFailMetaMint: proposal.conditionalOnFailMetaMint,
            conditionalOnFailUsdcMint: proposal.conditionalOnFailUsdcMint,
            metaUserAta: getATA(proposal.metaMint, client.provider.publicKey)[0],
            usdcUserAta: getATA(proposal.usdcMint, client.provider.publicKey)[0],
            conditionalOnPassMetaUserAta: getATA(proposal.conditionalOnPassMetaMint, client.provider.publicKey)[0],
            conditionalOnPassUsdcUserAta: getATA(proposal.conditionalOnPassUsdcMint, client.provider.publicKey)[0],
            conditionalOnFailMetaUserAta: getATA(proposal.conditionalOnFailMetaMint, client.provider.publicKey)[0],
            conditionalOnFailUsdcUserAta: getATA(proposal.conditionalOnFailUsdcMint, client.provider.publicKey)[0],
            metaVaultAta: getATA(proposal.metaMint, proposalVaultAddr)[0],
            usdcVaultAta: getATA(proposal.usdcMint, proposalVaultAddr)[0],
        })
        .instruction()

    return new InstructionHandler([ix], [], client)
};
