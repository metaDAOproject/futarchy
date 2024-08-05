import { AutocratClient, ConditionalVaultClient } from "@metadaoproject/futarchy";
import * as anchor from "@coral-xyz/anchor";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import { DRIFT, USDC } from "./consts";
import { ShadowProvider } from "./helpers/shadowProvider";
import * as fs from "fs"

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

let vaultClient: ConditionalVaultClient = autocratClient.vaultClient;
/**
 *
 * @param proposal
 * @param proposalNumber
 * @param baseToken
 * @param quoteToken
 * @param assetFolderPath
 */
async function main(
    proposal: string,
    proposalNumber: number,
    baseToken: string,
    assetFolderPath: string,
    shdwAccount: string
) {
    const shdwAccountPubkey = new PublicKey(shdwAccount)
    const storedProposal = await autocratClient.getProposal(new PublicKey(proposal));

    const { baseVault, quoteVault } = storedProposal;

    const wallet = autocratClient.provider.wallet as anchor.Wallet
    const shdwProvider = new ShadowProvider(autocratClient.provider.connection, wallet)
    console.log("shdw", shdwProvider)

    const pUSDCstring = "pUSDC"
    const fUSDCstring = "fUSDC"
    const pUSDCuri=  await shdwProvider.upsertFile({
        name: pUSDCstring,
        buffer: fs.readFileSync(`${assetFolderPath}/${pUSDCstring}`),
        account: shdwAccountPubkey
    })

    const fUSDCuri=  await shdwProvider.upsertFile({
        name: pUSDCstring,
        buffer: fs.readFileSync(`${assetFolderPath}/${fUSDCstring}`),
        account: shdwAccountPubkey
    })

    const pBaseString = `p${baseToken}`
    const fBaseString = `f${baseToken}`
    const pBaseUri=  await shdwProvider.upsertFile({
        name: pBaseString,
        buffer: fs.readFileSync(`${assetFolderPath}/${pBaseString}`),
        account: shdwAccountPubkey
    })

    const fBaseUri=  await shdwProvider.upsertFile({
        name: fBaseString,
        buffer: fs.readFileSync(`${assetFolderPath}/${fBaseString}`),
        account: shdwAccountPubkey
    })

    vaultClient.addMetadataToConditionalTokensIx(quoteVault, USDC, proposalNumber, pUSDCuri, fUSDCuri)
        .preInstructions([
            await vaultClient.addMetadataToConditionalTokensIx(baseVault, DRIFT, 1, pBaseUri, fBaseUri).instruction(),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
        ])
        .rpc()
}

main(
    // Proposal pubkey
    process.argv[2],
    // Proposal number
    parseInt(process.argv[3]),
    // Base token DRIFT
    process.argv[4],
    // AssetFolderPath
    process.env[5],
    // Shdw account key,
    process.argv[6]
  );