import { AutocratClient, ConditionalVaultClient } from "@metadaoproject/futarchy";
import * as anchor from "@coral-xyz/anchor";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import { DRIFT, USDC } from "./consts";
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metadaoproject/futarchy";

const pDRIFT = "https://imagedelivery.net/HYEnlujCFMCgj6yA728xIw/7f095bfc-9f48-49b6-ca22-a5f2799c9a00/public";
const fDRIFT = "https://imagedelivery.net/HYEnlujCFMCgj6yA728xIw/cb191bce-1f8b-4faf-fdc1-f80e73b84500/public";

const pFUTURE = "https://imagedelivery.net/HYEnlujCFMCgj6yA728xIw/235d74f1-3750-4944-d97a-fc6d61955700/public";
const fFUTURE = "https://imagedelivery.net/HYEnlujCFMCgj6yA728xIw/e69d51c5-fcfa-405e-657e-253185b4d800/public";

const pUSDC = "https://imagedelivery.net/HYEnlujCFMCgj6yA728xIw/f38677ab-8ec6-4706-6606-7d4e0a3cfc00/public";
const fUSDC = "https://imagedelivery.net/HYEnlujCFMCgj6yA728xIw/d9bfd8de-2937-419a-96f6-8d6a3a76d200/public";

const proposal: PublicKey = new PublicKey("9jAnAupCdPQCFvuAMr5ZkmxDdEKqsneurgvUnx7Az9zS");

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

let vaultClient: ConditionalVaultClient = autocratClient.vaultClient;

async function main() {
    const storedProposal = await autocratClient.getProposal(proposal);

    const { baseVault, quoteVault } = storedProposal;
    console.log(baseVault);

    vaultClient.addMetadataToConditionalTokensIx(quoteVault, USDC, 1, pUSDC, fUSDC)
        .preInstructions([
            await vaultClient.addMetadataToConditionalTokensIx(baseVault, DRIFT, 1, pDRIFT, fDRIFT).instruction(),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
        ])
        .rpc()
}

main();