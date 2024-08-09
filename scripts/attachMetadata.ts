import { AutocratClient, ConditionalVaultClient } from "@metadaoproject/futarchy";
import * as anchor from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Connection, PublicKey, Transaction } from "@solana/web3.js";
import * as fs from "fs"

import { MetadataUploader } from "./uploadOffchainMetadata2";

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

let vaultClient: ConditionalVaultClient = autocratClient.vaultClient;

type Token = {
    name: string,
    pubkey?: string
}

type Config = {
    dao: string,
    proposal: string,
    baseToken: Token,
    quoteToken: Token
}

type TokenMetadata = {
    name: string,
    image: string,
    symbol: string,
    description: string
}

type ImageData = {
    failImage: string,
    passImage: string,
}

async function main(
    config: string,
) {
    const {
        proposal,
        quoteToken: {name: quoteName},
        baseToken: {name: baseName}
    } = JSON.parse(
        fs.readFileSync(`${__dirname}/.config/${config}`, 'utf8')
    ) as Config

    const { quoteVault, baseVault, number} = await autocratClient.getProposal(
        new PublicKey(proposal)
    );
    const {underlyingTokenMint: quotePubkey} = await vaultClient.getVault(quoteVault)
    const {underlyingTokenMint: basePubkey} = await vaultClient.getVault(baseVault)

    const metadata = new MetadataUploader(autocratClient.provider);
    metadata.init()

    // 1. Read and check image
    const quoteToken = JSON.parse(
        fs.readFileSync(`${__dirname}/assets/${quoteName.toLowerCase()}/data.json`, 'utf8')
    ) as ImageData
    const baseToken = JSON.parse(
        fs.readFileSync(`${__dirname}/assets/${baseName.toLowerCase()}/data.json`, 'utf8')
    ) as ImageData
    const imageMap = {
        [`p${quoteName}`]: quoteToken.passImage,
        [`f${quoteName}`]: quoteToken.failImage,
        [`p${baseName}`]: baseToken.passImage,
        [`f${baseName}`]: baseToken.failImage,
    }

    // TODO If not exists then upload and save
    // uploadImageData
    if (!Object.values(imageMap).every(x => x)) {
        // TODO upload images
        throw Error("Image files do not exist")
    }

    // 2. Upload jsons
    const [pQuoteUri, fQuoteUri, pBaseUri, fBaseUri] = await Promise.all(
        Object.keys(imageMap)
        .map(cToken => {
            const market = cToken.toLowerCase().startsWith("p")
            ? "pass"
            : "fail";

            const conditionalTokenMetadata: TokenMetadata = {
                name: `Proposal ${number}: ${cToken}`,
                image: imageMap[cToken],
                symbol: cToken,
                description: `Native token in the MetaDAO's conditional ${market} market for proposal ${number}`,
            }

            return metadata.uploadImageJson(conditionalTokenMetadata)
        })
    )
    // TODO save these outputs
    // TODO these uris cannot be null
    console.log("sad", pQuoteUri, fQuoteUri, pBaseUri, fBaseUri)
    console.log("pubkey", quoteVault.toString(), baseVault.toString())
    console.log("proposal", proposal, number)

    try {
        // const txId = await vaultClient.addMetadataToConditionalTokensIx(
        //     quoteVault,
        //     new PublicKey(quotePubkey),
        //     number,
        //     pQuoteUri,
        //     fQuoteUri,
        // )
        // .preInstructions([
        //     ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
        //     ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
        //     await vaultClient.addMetadataToConditionalTokensIx(
        //         baseVault,
        //         new PublicKey(basePubkey),
        //         number,
        //         pBaseUri,
        //         fBaseUri,
        //     ).instruction(),
        // ])
        // .rpc({skipPreflight: true})
        const ixs = [
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }),
            await vaultClient.addMetadataToConditionalTokensIx(
                baseVault,
                new PublicKey(basePubkey),
                number,
                pBaseUri,
                fBaseUri,
            ).instruction(),
            await vaultClient.addMetadataToConditionalTokensIx(
                quoteVault,
                new PublicKey(quotePubkey),
                number,
                pQuoteUri,
                fQuoteUri,
            ).instruction()
        ]
        let tx = new Transaction().add(...ixs)

        const { blockhash, lastValidBlockHeight } = await autocratClient
            .provider.connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.lastValidBlockHeight = lastValidBlockHeight;
        tx.feePayer = autocratClient.provider.wallet.publicKey;
        tx = await autocratClient.provider.wallet.signTransaction(tx)

        const hash = await autocratClient.provider.connection.sendRawTransaction(
            tx.serialize(),
            {skipPreflight: true}
        );
        console.log("Wait for confirmation", hash);

        const result = await autocratClient.provider.connection.confirmTransaction(
            {
            signature: hash,
            blockhash: blockhash,
            lastValidBlockHeight: lastValidBlockHeight,
            },
            "confirmed",
        );

        if (result.value.err) {
            throw new Error(`Transaction failed: ${result.value.err}`);
        }


        // console.log("Signature", txId)
    } catch (e) {
        console.log("error", e);
    }

}

main(
    // config path
    process.argv[2],
);
