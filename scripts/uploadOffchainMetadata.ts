import * as anchor from "@coral-xyz/anchor";
import {
  Metadata,
  deserializeMetadata,
  findMetadataPda,
} from "@metaplex-foundation/mpl-token-metadata";
import {
  GenericFile,
  createGenericFile,
  keypairIdentity,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { bundlrUploader } from "@metaplex-foundation/umi-uploader-bundlr";
import { PublicKey } from "@solana/web3.js";

import fs from "fs";

const uploadedAssetMap: Record<string, string> = {
  fMETA: "https://arweave.net/tGxvOjMZw7B0qHsdCcIMO57oH5g5OaItOZdXo3BXKz8",
  fUSDC: "https://arweave.net/DpvxeAyVbaoivhIVCLjdf566k2SwVn0YVBL0sTOezWk",
  pMETA: "https://arweave.net/iuqi7PRRESdDxj1oRyk2WzR90_zdFcmZsuWicv3XGfs",
  pUSDC: "https://arweave.net/e4IO7F59F_RKCiuB--_ABPot7Qh1yFsGkWzVhcXuKDU",
};

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

const umi = createUmi(provider.connection);
umi.use(keypairIdentity(payer));

type AcceptedVaultTokens = "META" | "USDC";
type ConditionalToken = "pMETA" | "fMETA" | "pUSDC" | "fUSDC";

const isConditionalToken = (value: string): value is ConditionalToken =>
  ["pMETA", "fMETA", "pUSDC", "fUSDC"].includes(value as ConditionalToken);

const isAcceptedVaultToken = (value: string): value is AcceptedVaultTokens =>
  ["META", "USDC"].includes(value as AcceptedVaultTokens);

/**
 * Usage options
 *
 * 1: just upload images
 * uploadImageData()
 *    .then((res) => console.log(res))
 *    .catch((err) => console.error(err));
 *
 * 2: Use pre-existing images in assets/ dir and upload new JSON
 *
 * const proposalNumber = new BN(0);
 * Promise.all(
 *   uploadedAssetMap.map((asset) =>
 *    uploadImageJson(proposalNumber, asset.name as ConditionalToken, asset.uri)
 *   )
 * ).then((res) => console.log(res))
 *  .catch((err) => console.error(err));
 *
 * 3: upload new images, then upload json. new images aren't needed everytime, but
 * leaving in for reference.
 *
 * const proposalNumber = new BN(0);
 * uploadImageData()
 *     .then((results) => {
 *       results.map((result) => {
 *         uploadImageJson(proposalNumber, result.name as ConditionalToken, result.uri);
 *       });
 *     })
 *     .catch((err) => console.error(err));
 */

const uploadImageData = async () => {
  // use bundlr, targeting arweave
  umi.use(bundlrUploader());

  const sourceDirContent = fs.readdirSync(`${__dirname}/assets`);
  console.log(sourceDirContent);

  if (
    !sourceDirContent
      .map((x) => isConditionalToken(x.split(".")[0]))
      .every((x) => x)
  ) {
    throw new Error(
      `Found unexpected filename in assets directory. Only setup to handle "ConditionalToken"`
    );
  }

  const filesToUpload: Array<GenericFile> = [];
  for (const filename of sourceDirContent) {
    const data = fs.readFileSync(`${__dirname}/assets/${filename}`);
    filesToUpload.push(
      createGenericFile(new Uint8Array(data), filename, {
        contentType: "image/png",
      })
    );
  }

  const uris = await umi.uploader.upload(filesToUpload);

  return uris.map((uri, idx) => {
    return {
      uri,
      name: filesToUpload[idx].fileName.split(".")[0],
    };
  });
};

export const uploadImageJson = async (
  proposal: anchor.BN,
  conditionalToken: ConditionalToken,
  image: string
) => {
  // use bundlr, targeting arweave
  umi.use(bundlrUploader());

  const market = conditionalToken.toLowerCase().startsWith("p")
    ? "pass"
    : "fail";
  return umi.uploader.uploadJson({
    name: `Proposal ${proposal.toNumber()}: ${conditionalToken}`,
    image,
    symbol: conditionalToken,
    description: `Native token in the MetaDAO's conditional ${market} market for proposal ${proposal.toNumber()}`,
  });
};

export const uploadOffchainMetadata = async (
  proposal: anchor.BN,
  symbol: string
) => {
  // use bundlr, targeting arweave
  umi.use(bundlrUploader());

  if (!isAcceptedVaultToken(symbol)) {
    throw new Error(`Unrecognized symbol provided: ${symbol}`);
  }

  console.log(`uploading metadata for token ${symbol}...`);
  const [passUri, failUri] = await Promise.all(
    [`p${symbol}`, `f${symbol}`].map((symbol) => {
      return uploadImageJson(
        proposal,
        symbol as ConditionalToken,
        uploadedAssetMap[symbol]
      );
    })
  );

  return {
    symbol,
    passTokenMetadataUri: passUri,
    faileTokenMetadataUri: failUri,
  };
};

export const fetchOnchainMetadataForMint = async (
  address: PublicKey
):
  | Promise<{
      key: PublicKey;
      metadata: Metadata;
    }>
  | undefined => {
  const pda = findMetadataPda(umi, {
    mint: fromWeb3JsPublicKey(address),
  });

  const acct = await umi.rpc.getAccount(pda[0]);
  if (!acct.exists) {
    throw new Error(`Unable to find metaplex metdata for mint = ${address}`)
  }

  return {
    key: toWeb3JsPublicKey(pda[0]),
    metadata: deserializeMetadata(acct),
  };
};

// fetchOnchainMetadataForMint();
