import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { BankrunProvider } from "anchor-bankrun";
import { assert } from "chai";
import {
  startAnchor,
  Clock,
  BanksClient,
  ProgramTestContext,
} from "solana-bankrun";
import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintToOverride,
  getMint,
  getAccount,
} from "spl-token-bankrun";
import { expectError } from "./utils/utils";
import { AutocratV0 } from "../target/types/autocrat_v0";
import { Metadata } from "../target/types/metadata";
import { program } from "@coral-xyz/anchor/dist/cjs/native/system";

const AutocratIDL: AutocratV0 = require("../target/idl/autocrat_v0.json");
const MetadataIDL: Metadata = require("../target/idl/metadata.json");

const { PublicKey, Keypair } = anchor.web3;

export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

// this test file isn't 'clean' or DRY or whatever; sorry!
const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "FuTPR6ScKMPHtZFwacq9qrtf9VjscawNEFTb2wSYr1gY"
);

const METADATA_PROGRAM_ID = new PublicKey(
  "AfRdKx58cmVzSHFKM7AjiEbxeidMrFs1KWghtwGJSSsE"
);

async function skipToNextSlot(context: ProgramTestContext): Promise<void> {
  const currentClock = await context.banksClient.getClock();
  const nextSlot = currentClock.slot + 1n; // Advance to the next slot

  // Set the test context's clock to the new slot, preserving other currentClock values
  context.setClock(
    new Clock(
      nextSlot,
      currentClock.epochStartTimestamp,
      currentClock.epoch,
      currentClock.leaderScheduleEpoch,
      currentClock.unixTimestamp
    )
  );
}

describe("metadata", async function () {
  let provider: BankrunProvider,
    autocrat: anchor.Program<AutocratV0>,
    metadata: anchor.Program<Metadata>,
    daoMetadata: anchor.web3.PublicKey,
    payer,
    context: ProgramTestContext,
    banksClient: BanksClient,
    dao,
    daoTreasury,
    META,
    USDC;

  before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    autocrat = new anchor.Program<AutocratV0>(
      AutocratIDL,
      AUTOCRAT_PROGRAM_ID,
      provider
    );

    metadata = new anchor.Program<Metadata>(
      MetadataIDL,
      METADATA_PROGRAM_ID,
      provider
    );

    payer = provider.wallet.payer;
    USDC = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );

    META = await createMint(banksClient, payer, dao, dao, 9);
  });

  describe("initialize dao and metadata", async function () {
    it("initializes the DAO and metadata accounts", async function () {
      const daoKP = Keypair.generate();
      dao = daoKP.publicKey;

      [daoTreasury] = PublicKey.findProgramAddressSync(
        [dao.toBuffer()],
        autocrat.programId
      );

      [daoMetadata] = PublicKey.findProgramAddressSync(
        [dao.toBuffer()],
        metadata.programId
      );

      let initDaoInstrs = await autocrat.methods
        .initializeDao(new BN(100_000_000), new BN(100_000))
        .accounts({
          dao,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenMint: META,
          usdcMint: USDC,
        })
        .instruction();
      // To initialize the metadata we first need to initialize a DAO and set a delegate
      await metadata.methods
        .initializeMetadata()
        .accounts({
          metadata: daoMetadata,
          treasury: daoTreasury,
          dao,
          delegate: payer.publicKey,
          payer: payer.publicKey,
        })
        .preInstructions([initDaoInstrs])
        .signers([daoKP])
        .rpc();

      let metadataDaoAcc = await metadata.account.metadata.fetch(daoMetadata);
      //   console.log(metadataDaoAcc);

      // Assertions to check if the dao, treasury, and delegate accounts are set correctly
      assert.strictEqual(
        metadataDaoAcc.dao.toString(),
        dao.toString(),
        "DAO account does not match"
      );
      assert.strictEqual(
        metadataDaoAcc.treasury.toString(),
        daoTreasury.toString(),
        "Treasury account does not match"
      );
      assert.strictEqual(
        metadataDaoAcc.delegate.toString(),
        payer.publicKey.toString(),
        "Delegate account does not match"
      );

      // Assertion to check if the items array is empty
      assert.isEmpty(metadataDaoAcc.items, "Items array should be empty");
    });

    it("Successfully adds a new MetadataItem", async function () {
      const key = "testKey";
      const value = Buffer.from("testValue");

      // Assuming dao, daoTreasury, and daoMetadata have been initialized in a previous step
      await metadata.methods
        .initializeMetadataItem(key, value)
        .accounts({
          metadata: daoMetadata,
          delegate: payer.publicKey, // Make sure this matches the delegate used in initialization
        })
        .rpc();

      // Fetch the updated Metadata account
      let metadataAccount = await metadata.account.metadata.fetch(daoMetadata);

      // Assertions to verify the new item has been added correctly
      assert.isNotEmpty(
        metadataAccount.items,
        "Metadata items should not be empty after adding an item"
      );
      let newItem = metadataAccount.items.find((item) => item.key === key);
      assert.isDefined(
        newItem,
        "Newly added item should exist in the metadata items array"
      );
      assert.strictEqual(
        newItem.value.toString(),
        value.toString(),
        "The value of the new item does not match the expected value"
      );
    });

    it("Fails to add a MetadataItem with a duplicate key", async function () {
      const key = "testKey"; // Same key as the previous test
      const value = Buffer.from("newValue");

      try {
        // Attempt to add another MetadataItem with the same key
        await metadata.methods
          .initializeMetadataItem(key, value)
          .accounts({
            metadata: daoMetadata,
            delegate: payer.publicKey,
          })
          .rpc();
        assert.fail(
          "The instruction should have failed due to a duplicate key"
        );
      } catch (err) {
        // Check for a specific error code if your program returns one for this scenario
        const errorCode = "DuplicateKey";
        assert.include(
          err.toString(),
          errorCode,
          `Error should be '${errorCode}'`
        );
      }
    });

    it("Successfully writes to an existing MetadataItem", async function () {
      const key = "testKey";
      const originalValue = Buffer.from("testValue");
      const newValue = Buffer.from("newValue");

      await skipToNextSlot(context);
      // Now, write a new value to the existing item
      await metadata.methods
        .writeMetadataItem(key, newValue)
        .accounts({
          metadata: daoMetadata,
          delegate: payer.publicKey,
        })
        .rpc();

      // Fetch the updated Metadata account and verify the change
      let metadataAccount = await metadata.account.metadata.fetch(daoMetadata);
      let updatedItem = metadataAccount.items.find((item) => item.key === key);
      assert.isDefined(
        updatedItem,
        "The item should exist after writing to it"
      );
      assert.strictEqual(
        updatedItem.value.toString(),
        newValue.toString(),
        "The value of the item should be updated to the new value"
      );
    });

    it("Successfully appends to an existing MetadataItem", async function () {
      const key = "testKey"; // Ensure this key exists
      const appendValue = Buffer.from("appendedValue");

      await skipToNextSlot(context);
      // Append a new value to the existing item
      await metadata.methods
        .appendMetadataItem(key, appendValue)
        .accounts({
          metadata: daoMetadata,
          delegate: payer.publicKey,
        })
        .rpc();

      // Fetch the updated Metadata account and verify the appended data
      let metadataAccount = await metadata.account.metadata.fetch(daoMetadata);
      let updatedItem = metadataAccount.items.find((item) => item.key === key);
      assert.isDefined(
        updatedItem,
        "The item should exist after appending to it"
      );
      assert.strictEqual(
        updatedItem.value.toString(),
        Buffer.concat([Buffer.from("newValue"), appendValue]).toString(),
        "The value of the item should have the appended data"
      );
    });

    it("Fails to write to a non-existent MetadataItem", async function () {
      const nonExistentKey = "nonExistentKey";
      const newValue = Buffer.from("newValue");

      try {
        await metadata.methods
          .writeMetadataItem(nonExistentKey, newValue)
          .accounts({
            metadata: daoMetadata,
            delegate: payer.publicKey,
          })
          .rpc();
        assert.fail(
          "The instruction should have failed due to the key not existing"
        );
      } catch (err) {
        const errorCode = "KeyNotFound";
        assert.include(
          err.toString(),
          errorCode,
          `Error should indicate the key was not found`
        );
      }
    });

    it("Fails to append to a non-existent MetadataItem", async function () {
      const nonExistentKey = "nonExistentKeyAppend";
      const appendValue = Buffer.from("appendedValue");

      try {
        await metadata.methods
          .appendMetadataItem(nonExistentKey, appendValue)
          .accounts({
            metadata: daoMetadata,
            delegate: payer.publicKey,
          })
          .rpc();
        assert.fail(
          "The instruction should have failed due to the key not existing"
        );
      } catch (err) {
        const errorCode = "KeyNotFound";
        assert.include(
          err.toString(),
          errorCode,
          `Error should indicate the key was not found`
        );
      }
    });

    it("Fails when trying to perform an operation on an item updated in the current slot", async function () {
      const key = "testKeyForSlotError";
      const firstValue = Buffer.from("firstValue");
      const secondValue = Buffer.from("secondValue");

      await metadata.methods
        .initializeMetadataItem(key, firstValue)
        .accounts({
          metadata: daoMetadata,
          delegate: payer.publicKey,
        })
        .rpc();

      // Try to update the item again in the same slot to trigger the error
      try {
        await metadata.methods
          .writeMetadataItem(key, secondValue)
          .accounts({
            metadata: daoMetadata,
            delegate: payer.publicKey,
          })
          .rpc();

        assert.fail(
          "Expected an error for performing operation in the same slot, but operation succeeded."
        );
      } catch (err) {
        // Check that the error is the expected one
        const expectedErrorCode = 6001;
        const errorMessage =
          "Operation cannot be performed on an item updated in the current slot";

        assert.include(
          err.toString(),
          expectedErrorCode.toString(),
          "Error code does not match expected"
        );
        assert.include(
          err.toString(),
          errorMessage,
          "Error message does not match expected"
        );
      }

      // Attempt to delete without advancing to the next slot
      try {
        await metadata.methods
          .deleteMetadataItem(key)
          .accounts({
            metadata: daoMetadata,
            delegate: provider.publicKey,
          })
          .rpc();
        assert.fail(
          "Expected an error for deleting an item updated in the same slot, but operation succeeded."
        );
      } catch (err) {
        // Check for the specific error related to operations in the same slot
        const errorCode = "InvalidOperationInCurrentSlot";
        assert.include(
          err.toString(),
          errorCode,
          `Error should indicate operation was invalid in the current slot`
        );
      }
    });

    it("Successfully deletes an existing MetadataItem", async function () {
      const key = "testKeyForSlotError";

      await skipToNextSlot(context);
      await metadata.methods
        .deleteMetadataItem(key)
        .accounts({
          metadata: daoMetadata,
          delegate: payer.publicKey,
        })
        .rpc();

      // Fetch the updated Metadata account and verify the item is deleted
      let metadataAccount = await metadata.account.metadata.fetch(daoMetadata);
      let deletedItem = metadataAccount.items.find((item) => item.key === key);
      assert.isUndefined(
        deletedItem,
        "The item should not exist after deletion"
      );
    });

    it("Fails to delete a non-existent MetadataItem", async function () {
      const nonExistentKey = "testKeyForSlotError";

      try {
        await metadata.methods
          .deleteMetadataItem(nonExistentKey)
          .accounts({
            metadata: daoMetadata,
            delegate: payer.publicKey,
          })
          .rpc();
        assert.fail(
          "The instruction should have failed due to the key not existing"
        );
      } catch (err) {
        // Assuming your program uses a specific error code for this scenario
        const errorCode = "KeyNotFound";
        assert.include(
          err.toString(),
          errorCode,
          `Error should be '${errorCode}'`
        );
      }
    });
  });
});
