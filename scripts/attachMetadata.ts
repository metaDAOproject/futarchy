import * as anchor from "@coral-xyz/anchor";
import {
    AutocratClient,
    ConditionalVaultClient,
} from "@metadaoproject/futarchy";
import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import { FileUploader } from "./uploadOffchainMetadata";

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

let vaultClient: ConditionalVaultClient = autocratClient.vaultClient;

type Token = {
  name: string;
  pubkey?: string;
};

type Config = {
  dao: string;
  proposal: string;
  baseToken: Token;
  quoteToken: Token;
};

type TokenMetadata = {
  name: string;
  image: string;
  symbol: string;
  description: string;
};

type ImageData = {
  failImage: string;
  passImage: string;
};

// Should prolly be put into the fileUploader class
async function tryGetTokenImageUrls(fileUploader: FileUploader, token: string) {
  const basePath = `${__dirname}/assets/${token}`;

  let images: ImageData;
  try {
    images = JSON.parse(
      fs.readFileSync(`${basePath}/data.json`, "utf8")
    ) as ImageData;
  } catch (e) {
    images = {
      failImage: await fileUploader.uploadImageFromFile(
        `f${token}.png`,
        basePath
      )[0],
      passImage: await fileUploader.uploadImageFromFile(
        `p${token}.png`,
        basePath
      )[0],
    };

    // Save the file
    fs.writeFileSync(
      `${basePath}/data.json`,
      JSON.stringify(images, null, "\t")
    );
  }

  return images;
}

async function main(config: string) {
  const {
    proposal,
    quoteToken: { name: quoteName },
    baseToken: { name: baseName },
  } = JSON.parse(
    fs.readFileSync(`${__dirname}/.config/${config}`, "utf8")
  ) as Config;

  const { quoteVault, baseVault, number } = await autocratClient.getProposal(
    new PublicKey(proposal)
  );
  const { underlyingTokenMint: quotePubkey } = await vaultClient.getVault(
    quoteVault
  );
  const { underlyingTokenMint: basePubkey } = await vaultClient.getVault(
    baseVault
  );

  // 1. Read and check image
  const fileUploader = new FileUploader(autocratClient.provider);
  fileUploader.init();
  const quoteTokenImages = await tryGetTokenImageUrls(fileUploader, quoteName);
  const baseTokenImages = await tryGetTokenImageUrls(fileUploader, baseName);
  const imageMap = {
    [`p${quoteName}`]: quoteTokenImages.passImage,
    [`f${quoteName}`]: quoteTokenImages.failImage,
    [`p${baseName}`]: baseTokenImages.passImage,
    [`f${baseName}`]: baseTokenImages.failImage,
  };

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

      return fileUploader.uploadImageJson(conditionalTokenMetadata);
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

// Usage: anchor run attach -- metadata.json
main(process.argv[2]);