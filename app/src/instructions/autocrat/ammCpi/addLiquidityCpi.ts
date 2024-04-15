import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import { AutocratClient } from "../../../AutocratClient";
import { InstructionHandler } from "../../../InstructionHandler";
import { getATA, getAmmAuthAddr, getAmmPositionAddr, getProposalVaultAddr } from '../../../utils';
import BN from "bn.js";

export const addLiquidityCpiHandler = async (
    client: AutocratClient,
    proposalAddr: PublicKey,
    ammAddr: PublicKey,
    maxBaseAmount: BN,
    maxQuoteAmount: BN,
    minBaseAmount: BN,
    minQuoteAmount: BN,
    ammProgram: PublicKey,
): Promise<InstructionHandler<typeof client.program, AutocratClient>> => {

    const proposal = await client.program.account.proposal.fetch(proposalAddr);
    let proposalVaultAddr = getProposalVaultAddr(client.program.programId, proposalAddr)[0]

    if (proposal.passMarketAmm.toBase58() !== ammAddr.toBase58() && proposal.failMarketAmm.toBase58() !== ammAddr.toBase58()) {
        throw new Error("the amm address passed in addLiquidityCpiHandler does not correspond to either the pass or fail market");
    }

    let conditionalMetaMint: PublicKey;
    let conditionalUsdcMint: PublicKey;

    if (proposal.passMarketAmm.toBase58() === ammAddr.toBase58()) {
        conditionalMetaMint = proposal.conditionalOnPassMetaMint
        conditionalUsdcMint = proposal.conditionalOnPassUsdcMint
    } else {
        conditionalMetaMint = proposal.conditionalOnFailMetaMint
        conditionalUsdcMint = proposal.conditionalOnFailUsdcMint
    }

    let ammPositionAddr = getAmmPositionAddr(ammProgram, ammAddr, client.provider.publicKey)[0]
    let ammAuthAddr = getAmmAuthAddr(client.program.programId)[0]

    let ix = await client.program.methods
        .addLiquidity(
            maxBaseAmount,
            maxQuoteAmount,
            minBaseAmount,
            minQuoteAmount
        )
        .accounts({
            user: client.provider.publicKey,
            proposal: proposalAddr,
            proposalVault: proposalVaultAddr,
            amm: ammAddr,
            ammPosition: ammPositionAddr,
            ammAuthPda: ammAuthAddr,
            metaMint: proposal.metaMint,
            usdcMint: proposal.usdcMint,
            conditionalMetaMint,
            conditionalUsdcMint,
            conditionalMetaUserAta: getATA(conditionalMetaMint, client.provider.publicKey)[0],
            conditionalUsdcUserAta: getATA(conditionalUsdcMint, client.provider.publicKey)[0],
            conditionalMetaVaultAta: getATA(conditionalMetaMint, ammAddr)[0],
            conditionalUsdcVaultAta: getATA(conditionalUsdcMint, ammAddr)[0],
            ammProgram,
        })
        .instruction()

    return new InstructionHandler([ix], [], client)
};
