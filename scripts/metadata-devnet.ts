// import { initializeProposal, daoTreasury, META } from "./main";
import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

import { AutocratV0 } from "../target/types/autocrat_v0";
import { Metadata } from "../target/types/metadata";
const MetadataIDL: Metadata = require("../target/idl/metadata.json");
const AutocratIDL: AutocratV0 = require("../target/idl/autocrat_v0.json");
const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "FuTPR6ScKMPHtZFwacq9qrtf9VjscawNEFTb2wSYr1gY"
);
const METADATA_PROGRAM_ID = new PublicKey(
  "DATAwTH3mTx43ekTTYoNXL2Z8EAMTGwENkJab7tKXHok"
);
const autocratProgram = new Program<AutocratV0>(
  AutocratIDL,
  AUTOCRAT_PROGRAM_ID,
  provider
);
const metadataProgram = new anchor.Program<Metadata>(
  MetadataIDL,
  METADATA_PROGRAM_ID,
  provider
);

// This is the only DAO on the FuTPR program right now
const dao = new PublicKey("8tanoHEyJEQgaasEkv1DxN6umYNWDotbaEpuzstcEufb");

const [daoTreasury] = PublicKey.findProgramAddressSync(
  [dao.toBuffer()],
  autocratProgram.programId
);

const [metadataAccount] = PublicKey.findProgramAddressSync(
  [dao.toBuffer()],
  metadataProgram.programId
);

const payer = provider.wallet["payer"];

// Adds a metadata item if it does not already exist
async function addMetadataItem(key: string, value: string) {
  let metadataDaoAcc;
  try {
    metadataDaoAcc = await metadataProgram.account.metadata.fetch(
      metadataAccount
    );
    const itemExists = metadataDaoAcc.items.find((item) => item.key === key);
    if (!itemExists) {
      await metadataProgram.methods
        .initializeMetadataItem(key, Buffer.from(value))
        .accounts({
          metadata: metadataAccount,
          delegate: payer.publicKey, // Ensure the delegate is correct
        })
        .signers([payer])
        .rpc();
      console.log(`Added metadata item: ${key}`);
    }
  } catch (error) {
    console.error(`Error adding metadata item (${key}):`, error);
  }
}

// Optional: Deletes a metadata item
async function deleteMetadataItem(key: string) {
  try {
    await metadataProgram.methods
      .deleteMetadataItem(key)
      .accounts({
        metadata: metadataAccount,
        delegate: payer.publicKey, // Ensure the delegate is correct
      })
      .signers([payer])
      .rpc();
    console.log(`Deleted metadata item: ${key}`);
  } catch (error) {
    console.error(`Error deleting metadata item (${key}):`, error);
  }
}

async function printMetadataAccountDetails() {
  try {
    // Fetch the metadata account
    const metadataDaoAcc = await metadataProgram.account.metadata.fetch(
      metadataAccount
    );

    // Print DAO, Treasury, and Delegate account public keys
    console.log("Metadata Account Details:");
    console.log(`DAO Public Key: ${metadataDaoAcc.dao.toString()}`);
    console.log(`Treasury Public Key: ${metadataDaoAcc.treasury.toString()}`);
    console.log(`Delegate Public Key: ${metadataDaoAcc.delegate.toString()}`);

    // Check and print Metadata Items
    console.log("\nMetadata Items:");
    if (metadataDaoAcc.items.length === 0) {
      console.log("No metadata items found.");
    } else {
      metadataDaoAcc.items.forEach((item, index) => {
        // Assuming 'value' is a Uint8Array; convert it to a string for printing
        const valueStr = Buffer.from(item.value).toString();
        console.log(`${index + 1}. "${item.key}": "${valueStr}"`);
      });
    }
  } catch (error) {
    console.error("Error fetching metadata account:", error);
  }
}

async function main() {
  // Attempt to fetch the metadata account
  try {
    const metadataDaoAcc = await metadataProgram.account.metadata.fetch(
      metadataAccount
    );
    console.log("Metadata account exists.");
    await printMetadataAccountDetails();
  } catch (error) {
    console.error("Error fetching metadata account:", error);
    await metadataProgram.methods
      .initializeMetadata()
      .accounts({
        metadata: metadataAccount,
        treasury: daoTreasury,
        dao,
        delegate: payer.publicKey,
        payer: payer.publicKey,
      })
      .rpc();
    console.log("What's the payer's public key?", payer.publicKey);
  }

  console.log("Ensuring metadata items are present...");

  const metadataItems = [
    { key: "description", value: "An example DAO on Solana" },
    { key: "name", value: "Example DAO" },
    { key: "twitter", value: "@exampledao" },
    { key: "discord", value: "https://discord.gg/exampledao" },
  ];

  for (const item of metadataItems) {
    await addMetadataItem(item.key, item.value);
  }
}
main();
