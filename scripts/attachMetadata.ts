import { AutocratClient, ConditionalVaultClient } from "@metadaoproject/futarchy";
import * as anchor from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Connection, PublicKey } from "@solana/web3.js";
import { DRIFT, USDC, DEVNET_MUSDC, DEVNET_DRIFT } from "./consts";
import { ShadowProvider } from "./helpers/shadowProvider";
import * as fs from "fs"

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

let vaultClient: ConditionalVaultClient = autocratClient.vaultClient;

type BaseToken = {
    baseName: string,
    basePubkey: string
}

type Config = {
    proposal: string,
    baseToken: BaseToken,
    mainnetRpc: string,
    shdwAccount: string,
}

async function main(
    configPath: string,
    assetFolderPath: string,
) {
    const config: Config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    const {proposal, baseToken: {baseName, basePubkey}, mainnetRpc, shdwAccount } = config


    const storedProposal = await autocratClient.getProposal(new PublicKey(proposal));
    const { baseVault, quoteVault, number } = storedProposal;

    // shdw uses mainnet
    const shdwProvider = new ShadowProvider(
        new Connection(mainnetRpc),
        autocratClient.provider.wallet as anchor.Wallet
    )
    await shdwProvider.init()

    let shdwAccountPubkey: PublicKey;
    if (shdwAccount) {
        shdwAccountPubkey = new PublicKey(shdwAccount)
    } else {
        const shdw = await shdwProvider.shadowAccountCreation(proposal, "10MB")
        shdwAccountPubkey = new PublicKey(shdw)
    }

    const pUSDCstring = "pUSDC.json"
    const fUSDCstring = "fUSDC.json"
    const pUSDCuri=  await shdwProvider.upsertFile({
        name: pUSDCstring,
        buffer: fs.readFileSync(`${assetFolderPath}/${pUSDCstring}`),
        account: shdwAccountPubkey
    })

    const fUSDCuri=  await shdwProvider.upsertFile({
        name: fUSDCstring,
        buffer: fs.readFileSync(`${assetFolderPath}/${fUSDCstring}`),
        account: shdwAccountPubkey
    })

    const pBaseString = `p${baseName}.json`
    const fBaseString = `f${baseName}.json`
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
    console.log("p usd", pUSDCuri)
    console.log("f usd", fUSDCuri)
    console.log("p usd", pBaseUri)
    console.log("f usd", fBaseUri)

    // console.log(quoteVault,
    //     DEVNET_MUSDC,
    //     number,
    //     pUSDCuri,
    //     fUSDCuri)

    try {
        // const res = await vaultClient.addMetadataToConditionalTokensIx(
        //     quoteVault,
        //     DEVNET_MUSDC,
        //     number,
        //     pUSDCuri,
        //     fUSDCuri
        // )
        // .preInstructions([
        //     // await vaultClient.addMetadataToConditionalTokensIx(baseVault, new PublicKey(basePubkey), 1, pBaseUri, fBaseUri).instruction(),
        //     ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
        //     ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
        // ])
        // .rpc({skipPreflight: true})

        const res = await vaultClient.addMetadataToConditionalTokensIx(
            baseVault,
            new PublicKey(basePubkey),
            1,
            pBaseUri,
            fBaseUri
        )
        .preInstructions([
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
        ])
        .rpc({skipPreflight: true})

        console.log("res", res)
    } catch (e) {
        console.log("e", e);
    }

}

// todo return error if not 2 passed
// need to join paths

main(
    // config path
    process.argv[2],
    // asset folder
    process.argv[3],
  );



// main(
//     // Proposal pubkey
//     process.argv[2],
//     // Proposal number
//     parseInt(process.argv[3]),
//     // Base token DRIFT
//     process.argv[4],
//     // AssetFolderPath
//     process.env[5],
//     // Shdw account key,
//     // process.argv[6]
//   );

