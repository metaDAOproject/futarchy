import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import { AutocratClient } from "../../../AutocratClient";
import { InstructionHandler } from "../../../InstructionHandler";
import { getATA, getAmmAuthAddr, getProposalVaultAddr } from '../../../utils';
import BN from "bn.js";

export const swapCpiHandler = async (
    client: AutocratClient,
    proposalAddr: PublicKey,
    ammAddr: PublicKey,
    isQuoteToBase: boolean,
    inputAmount: BN,
    minOutputAmount: BN,
    ammProgram: PublicKey,
): Promise<InstructionHandler<typeof client.program, AutocratClient>> => {
    const proposal = await client.program.account.proposal.fetch(proposalAddr);
    let proposalVaultAddr = getProposalVaultAddr(client.program.programId, proposalAddr)[0]

    if (proposal.passMarketAmm.toBase58() !== ammAddr.toBase58() && proposal.failMarketAmm.toBase58() !== ammAddr.toBase58()) {
        throw new Error("the amm address passed in swapCpiHandler does not correspond to either the pass or fail market");
    }

    let baseMint: PublicKey;
    let quoteMint: PublicKey;

    if (proposal.passMarketAmm.toBase58() === ammAddr.toBase58()) {
        baseMint = proposal.conditionalOnPassMetaMint
        quoteMint = proposal.conditionalOnPassUsdcMint
    } else {
        baseMint = proposal.conditionalOnFailMetaMint
        quoteMint = proposal.conditionalOnFailUsdcMint
    }

    let userAtaBase = getATA(baseMint, client.provider.publicKey)[0]
    let userAtaQuote = getATA(quoteMint, client.provider.publicKey)[0]

    let vaultAtaBase = getATA(baseMint, ammAddr)[0]
    let vaultAtaQuote = getATA(quoteMint, ammAddr)[0]

    let ammAuthAddr = getAmmAuthAddr(client.program.programId)[0]

    let ix = await client.program.methods
        .swap(
            isQuoteToBase,
            inputAmount,
            minOutputAmount,
        )
        .accounts({
            user: client.provider.publicKey,
            proposal: proposalAddr,
            proposalVault: proposalVaultAddr,
            amm: ammAddr,
            ammAuthPda: ammAuthAddr,
            metaMint: proposal.metaMint,
            usdcMint: proposal.usdcMint,
            conditionalMetaMint: baseMint,
            conditionalUsdcMint: quoteMint,
            conditionalMetaUserAta: userAtaBase,
            conditionalUsdcUserAta: userAtaQuote,
            conditionalMetaVaultAta: vaultAtaBase,
            conditionalUsdcVaultAta: vaultAtaQuote,
            ammProgram,
        })
        .instruction()

    return new InstructionHandler([ix], [], client)
};
