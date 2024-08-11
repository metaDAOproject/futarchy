import * as anchor from "@coral-xyz/anchor";
import {
  AutocratClient,
  ConditionalVaultClient,
} from "@metadaoproject/futarchy";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import { MetadataHelper } from "./uploadOffchainMetadata";

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

let vaultClient: ConditionalVaultClient = autocratClient.vaultClient;

type TokenMetadata = {
  name: string;
  image: string;
  symbol: string;
  description: string;
};

async function main(proposal: string) {
  const { quoteVault, baseVault, number } = await autocratClient.getProposal(
    new PublicKey(proposal)
  );
  const { underlyingTokenMint: quotePubkey } = await vaultClient.getVault(
    quoteVault
  );
  const { underlyingTokenMint: basePubkey } = await vaultClient.getVault(
    baseVault
  );

  // 0. Get token symbols
  const metadataHelper = new MetadataHelper(autocratClient.provider);
  const quoteTokenSymbol = (
    await metadataHelper.fetchTokenMetadataSymbol(quotePubkey)
  )
    .toUpperCase()
    .trim();
  const baseTokenSymbol = (
    await metadataHelper.fetchTokenMetadataSymbol(basePubkey)
  )
    .toUpperCase()
    .trim();

  // 1. Read and check image
  const quoteTokenImages = await metadataHelper.tryGetTokenImageUrls(
    `${__dirname}/assets/`,
    quoteTokenSymbol
  );
  const baseTokenImages = await metadataHelper.tryGetTokenImageUrls(
    `${__dirname}/assets/`,
    baseTokenSymbol
  );
  const imageMap = {
    [`p${quoteTokenSymbol}`]: quoteTokenImages.passImage,
    [`f${quoteTokenSymbol}`]: quoteTokenImages.failImage,
    [`p${baseTokenSymbol}`]: baseTokenImages.passImage,
    [`f${baseTokenSymbol}`]: baseTokenImages.failImage,
  };

  console.log(imageMap)

  if (!Object.values(imageMap).every((x) => x)) {
    throw Error("Image files do not exist");
  }

  // 2. Create metadata URI and upload it
  // Should probably try read locally and if not exists then upload and save it
  const uris = await Promise.all(
    Object.keys(imageMap).map((cToken) => {
      const market = cToken.toLowerCase().startsWith("p") ? "pass" : "fail";

      const conditionalTokenMetadata: TokenMetadata = {
        name: `Proposal ${number}: ${cToken}`,
        image: imageMap[cToken],
        symbol: cToken,
        description: `Native token in the MetaDAO's conditional ${market} market for proposal ${number}`,
      };

      return metadataHelper.uploadImageJson(conditionalTokenMetadata);
    })
  );

  if (uris.some((uri) => !uri)) {
    throw new Error(
      "An error occurred while uploading one or more JSON metadata files"
    );
  }

  const [pQuoteUri, fQuoteUri, pBaseUri, fBaseUri] = uris;

  try {
    const txId = await vaultClient
      .addMetadataToConditionalTokensIx(
        quoteVault,
        new PublicKey(quotePubkey),
        number,
        pQuoteUri,
        fQuoteUri
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
        await vaultClient
          .addMetadataToConditionalTokensIx(
            baseVault,
            new PublicKey(basePubkey),
            number,
            pBaseUri,
            fBaseUri
          )
          .instruction(),
      ])
      .rpc({ skipPreflight: true });

    console.log("Signature", txId);
  } catch (e) {
    console.log("error", e);
  }
}

// Usage: anchor run attach -- <proposal>
main(process.argv[2]);
