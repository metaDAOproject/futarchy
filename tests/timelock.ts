import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;

import { assert } from "chai";

import { BanksClient, Clock, startAnchor } from "solana-bankrun";

const TIMELOCK_PROGRAM_ID = new PublicKey(
  "tiME1hz9F5C5ZecbvE5z6Msjy8PKfTqo1UuRYXfndKF"
);

import { OptimisticTimelock } from "../target/types/optimistic_timelock";
import { ComputeBudgetProgram, Connection } from "@solana/web3.js";
import { printArgs } from "@metaplex-foundation/mpl-token-metadata";
const OptimisticTimelockIDL: OptimisticTimelock = require("../target/idl/optimistic_timelock.json");

export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

// import {
//   createMint,
//   createAccount,
//   getAccount,
//   mintTo,
// } from "spl-token-bankrun";

async function fakeRequestAirdrop(
  banksClient: BanksClient,
  payer,
  toPubkey,
  lamports
) {
  const transferInstruction = anchor.web3.SystemProgram.transfer({
    fromPubkey: payer.publicKey,
    toPubkey: toPubkey,
    lamports: lamports,
  });

  let tx = new anchor.web3.Transaction().add(transferInstruction);
  [tx.recentBlockhash] = await banksClient.getLatestBlockhash();
  tx.feePayer = payer.publicKey;
  tx.sign(payer);
  await banksClient.processTransaction(tx);
}

describe("timelock", async function () {
  let provider: BankrunProvider,
    connection,
    timelockProgram: Program<OptimisticTimelock>,
    // migrator,
    payer,
    context,
    banksClient: BanksClient,
    recipient,
    timelockKp: anchor.web3.Keypair,
    timelockSignerPubkey: anchor.web3.PublicKey,
    timelockAuthority: anchor.web3.Keypair,
    transactionBatchAuthority: anchor.web3.Keypair,
    transactionBatch: anchor.web3.Keypair,
    enqueuer1: anchor.web3.Keypair = anchor.web3.Keypair.generate(),
    enqueuer2: anchor.web3.Keypair = anchor.web3.Keypair.generate(),
    // only exists at the start, gets removed
    enqueuer3: anchor.web3.Keypair = anchor.web3.Keypair.generate(),
    // only exists after being added
    enqueuer4: anchor.web3.Keypair = anchor.web3.Keypair.generate();
  // META,
  // USDC,
  // MNDE,
  // BOL;
  before(async () => {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    connection = provider.connection;
    payer = provider.wallet.payer;
    timelockProgram = new Program<OptimisticTimelock>(
      OptimisticTimelockIDL,
      TIMELOCK_PROGRAM_ID,
      provider
    );
  });

  it("Creates a new timelock", async () => {
    timelockKp = anchor.web3.Keypair.generate();
    let nonce: number;
    [timelockSignerPubkey, nonce] =
      anchor.web3.PublicKey.findProgramAddressSync(
        [timelockKp.publicKey.toBuffer()],
        timelockProgram.programId
      );
    const timelockSize = 200; // Big enough.
    const enqueuerCooldownSlots = new anchor.BN(1);

    const delayInSlots = new anchor.BN(1);
    timelockAuthority = anchor.web3.Keypair.generate();

    await timelockProgram.methods
      .createTimelock(
        timelockAuthority.publicKey,
        delayInSlots,
        [enqueuer1.publicKey, enqueuer2.publicKey],
        enqueuerCooldownSlots
      )
      .accounts({
        timelock: timelockKp.publicKey,
        timelockSigner: timelockSignerPubkey,
      })
      .preInstructions([
        await timelockProgram.account.timelock.createInstruction(
          timelockKp,
          timelockSize
        ),
      ])
      .signers([timelockKp])
      .rpc();

    let timelockAccount = await timelockProgram.account.timelock.fetch(
      timelockKp.publicKey
    );
    assert.strictEqual(timelockAccount.signerBump, nonce);
    assert.ok(timelockAccount.delayInSlots.eq(delayInSlots));
  });

  it("Creates a transaction batch", async () => {
    transactionBatchAuthority = anchor.web3.Keypair.generate();
    transactionBatch = anchor.web3.Keypair.generate();
    const transactionBatchSize = 30000; // Adjust size as needed

    await timelockProgram.methods
      .createTransactionBatch()
      .accounts({
        transactionBatchAuthority: transactionBatchAuthority.publicKey,
        timelock: timelockKp.publicKey,
        transactionBatch: transactionBatch.publicKey,
      })
      .preInstructions([
        await timelockProgram.account.transactionBatch.createInstruction(
          transactionBatch,
          transactionBatchSize
        ),
      ])
      .signers([transactionBatchAuthority, transactionBatch])
      .rpc();

    const transactionBatchAccount =
      await timelockProgram.account.transactionBatch.fetch(transactionBatch.publicKey);
    // Assertions to check the transaction batch creation
    assert.strictEqual(
      transactionBatchAccount.transactionBatchAuthority.toString(),
      transactionBatchAuthority.publicKey.toString(),
      "The batch authority should match."
    );
    assert.ok(
      "created" in transactionBatchAccount.status,
      "The batch status should still be 'Created' after creating transaction batch."
    );
  });

  // Example additional test: "Adds three transactions to the transaction batch"
  it("Adds three transactions to the transaction batch", async () => {
    recipient = anchor.web3.Keypair.generate();

    await fakeRequestAirdrop(
      banksClient,
      payer,
      timelockSignerPubkey,
      200_000_000
    );

    // Transaction 1: Transfer SOL
    let transferInstruction = anchor.web3.SystemProgram.transfer({
      fromPubkey: timelockSignerPubkey,
      toPubkey: recipient.publicKey,
      lamports: 100_000_000,
    });
    await timelockProgram.methods
      .addTransaction(
        transferInstruction.programId,
        transferInstruction.keys.map((key) => ({
          pubkey: key.pubkey,
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
        transferInstruction.data
      )
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        transactionBatchAuthority: transactionBatchAuthority.publicKey,
      })
      .signers([transactionBatchAuthority])
      .rpc();

    // Transaction 2: Set Delay in Slots
    const newDelayInSlots = new BN(2);
    let setDelayInSlotsInstruction = timelockProgram.instruction.setDelayInSlots(
      newDelayInSlots,
      {
        accounts: {
          timelock: timelockKp.publicKey,
          timelockSigner: timelockSignerPubkey,
        },
      }
    );

    await timelockProgram.methods
      .addTransaction(
        setDelayInSlotsInstruction.programId,
        setDelayInSlotsInstruction.keys.map((key) => ({
          pubkey: key.pubkey,
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
        setDelayInSlotsInstruction.data
      )
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        transactionBatchAuthority: transactionBatchAuthority.publicKey,
      })
      .signers([transactionBatchAuthority])
      .rpc();

    // Transaction 3: Change Authority
    let setAuthorityInstruction = timelockProgram.instruction.setAuthority(
      recipient.publicKey,
      {
        accounts: {
          timelock: timelockKp.publicKey,
          timelockSigner: timelockSignerPubkey,
        },
      }
    );

    await timelockProgram.methods
      .addTransaction(
        setAuthorityInstruction.programId,
        setAuthorityInstruction.keys.map((key) => ({
          pubkey: key.pubkey,
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
        setAuthorityInstruction.data
      )
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        transactionBatchAuthority: transactionBatchAuthority.publicKey,
      })
      .signers([transactionBatchAuthority])
      .rpc();

    // Transaction 4: Add enqueuer
    let addEnqueuerInstruction = timelockProgram.instruction.addOptimisticProposer(
      enqueuer4.publicKey,
      {
        accounts: {
          timelock: timelockKp.publicKey,
          timelockSigner: timelockSignerPubkey,
        },
      }
    );

    await timelockProgram.methods
      .addTransaction(
        addEnqueuerInstruction.programId,
        addEnqueuerInstruction.keys.map((key) => ({
          pubkey: key.pubkey,
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
        addEnqueuerInstruction.data
      )
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        transactionBatchAuthority: transactionBatchAuthority.publicKey,
      })
      .signers([transactionBatchAuthority])
      .rpc();

    // Transaction 5: Remove enqueuer
    let removeOptimisticProposerInstruction = timelockProgram.instruction.removeOptimisticProposer(
      enqueuer3.publicKey,
      {
        accounts: {
          timelock: timelockKp.publicKey,
          timelockSigner: timelockSignerPubkey,
        },
      }
    );

    await timelockProgram.methods
      .addTransaction(
        removeOptimisticProposerInstruction.programId,
        removeOptimisticProposerInstruction.keys.map((key) => ({
          pubkey: key.pubkey,
          isSigner: key.isSigner,
          isWritable: key.isWritable,
        })),
        removeOptimisticProposerInstruction.data
      )
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        transactionBatchAuthority: transactionBatchAuthority.publicKey,
      })
      .signers([transactionBatchAuthority])
      .rpc();

    // Verify the transactions
    const transactionBatchAccount =
      await timelockProgram.account.transactionBatch.fetch(transactionBatch.publicKey);
    assert.strictEqual(
      transactionBatchAccount.transactions.length,
      5,
      "There should be three transactions in the batch."
    );
  });

  it("Fails to enqueue a non-Sealed batch", async () => {
    // Assume the batch is new and not yet sealed
    try {
      await timelockProgram.methods
        .enqueueTransactionBatch()
        .accounts({
          transactionBatch: transactionBatch.publicKey,
          authority:timelockAuthority.publicKey,
          timelock: timelockKp.publicKey,
        })
        .signers([timelockAuthority])
        .rpc();
      assert.fail(
        "Should have thrown an error when enqueuing a non-Sealed batch."
      );
    } catch (error) {
      assert.include(error.message, "CannotEnqueueTransactionBatch");
    }
  });

  it("Seals the transaction batch", async () => {
    await timelockProgram.methods
      .sealTransactionBatch()
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        transactionBatchAuthority: transactionBatchAuthority.publicKey,
      })
      .signers([transactionBatchAuthority])
      .rpc();

    const sealedTransactionBatch =
      await timelockProgram.account.transactionBatch.fetch(transactionBatch.publicKey);

    // Assert the transaction batch is now sealed
    assert.ok(
      "sealed" in sealedTransactionBatch.status,
      "The batch status should be 'Sealed' after sealing."
    );
  });

  it("Fails to cancel a batch that is not Enqueued", async () => {
    // Assume the batch is new or sealed but not enqueued
    try {
      await timelockProgram.methods
        .cancelTransactionBatch()
        .accounts({
          transactionBatch: transactionBatch.publicKey,
          authority:timelockAuthority.publicKey,
          timelock: timelockKp.publicKey,
        })
        .signers([timelockAuthority])
        .rpc();
      assert.fail(
        "Should have thrown an error when canceling a batch that is not Enqueued."
      );
    } catch (error) {
      assert.include(error.message, "CannotCancelTimelock");
    }
  });

  it("Fails to execute transactions in a batch not in Enqueued state", async () => {
    // Assume the batch is new or sealed but not enqueued
    try {
      await timelockProgram.methods
        .executeTransactionBatch()
        .accounts({
          timelock: timelockKp.publicKey,
          timelockSigner: timelockSignerPubkey,
          transactionBatch: transactionBatch.publicKey,
        })
        .rpc();
      assert.fail(
        "Should have thrown an error when trying to execute transactions in a non-Enqueued batch."
      );
    } catch (error) {
      assert.include(error.message, "CannotExecuteTransactions");
    }
  });

  it("Fails to add transactions to a sealed batch", async () => {
    // Try adding a transaction to the sealed batch
    let transferInstruction = anchor.web3.SystemProgram.transfer({
      fromPubkey: timelockSignerPubkey,
      toPubkey: recipient.publicKey,
      lamports: 100_000_000,
    });

    try {
      await timelockProgram.methods
        .addTransaction(
          transferInstruction.programId,
          transferInstruction.keys.map((key) => ({
            pubkey: key.pubkey,
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          })),
          transferInstruction.data
        )
        .accounts({
          transactionBatch: transactionBatch.publicKey,
          transactionBatchAuthority: transactionBatchAuthority.publicKey,
        })
        .signers([transactionBatchAuthority])
        .rpc();
      assert.fail(
        "Should have thrown an error when adding a transaction to a sealed batch."
      );
    } catch (error) {
      assert.include(error.message, "CannotAddTransactions");
    }
  });

  it("Fails to seal a non-Created batch", async () => {
    try {
      await timelockProgram.methods
        .sealTransactionBatch()
        .accounts({
          transactionBatch: transactionBatch.publicKey,
          transactionBatchAuthority: transactionBatchAuthority.publicKey,
        })
        .signers([transactionBatchAuthority])
        .rpc();
      assert.fail(
        "Should have thrown an error when sealing a non-Created batch."
      );
    } catch (error) {
      assert.include(error.message, "CannotSealTransactionBatch");
    }
  });

  it("Fails to enqueue the transaction batch with an incorrect authority", async () => {
    // Assume the batch is sealed
    try {
      const fakeAuthority = Keypair.generate();

      await timelockProgram.methods
        .enqueueTransactionBatch()
        .accounts({
          transactionBatch: transactionBatch.publicKey,
          authority:fakeAuthority.publicKey,
          timelock: timelockKp.publicKey,
        })
        .signers([fakeAuthority])
        .rpc();
      assert.fail(
        "Should have thrown an error when enqueuing a batch with an incorrect authority."
      );
    } catch (error) {
      assert.include(error.message, "NoAuthority");
    }
  });

  it("Enqueues the transaction batch", async () => {
    await timelockProgram.methods
      .enqueueTransactionBatch()
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        authority:timelockAuthority.publicKey,
        timelock: timelockKp.publicKey,
      })
      .signers([timelockAuthority])
      .rpc();

    const enqueuedTransactionBatch =
      await timelockProgram.account.transactionBatch.fetch(transactionBatch.publicKey);

    // Assert the transaction batch is now in TimelockStarted status
    assert.ok(
      "enqueued" in enqueuedTransactionBatch.status,
      "The batch status should be 'Enqueued' after enqueueing."
    );

    assert.ok(
      "timelockAuthority" in enqueuedTransactionBatch.enqueuerType,
      "The batch should be shown as enqueued by the timelock authority."
    );

    // Assert the enqueued slot is set
    assert.ok(
      enqueuedTransactionBatch.enqueuedSlot.toNumber() > 0,
      "The enqueued slot should be set and greater than 0."
    );
  });

  it("Enqueuers cannot cancel transactions with a hard commitment level", async () => {
    try {
      await timelockProgram.methods
        .cancelTransactionBatch()
        .accounts({
          transactionBatch: transactionBatch.publicKey,
          authority:enqueuer1.publicKey,
          timelock: timelockKp.publicKey,
        })
        .signers([enqueuer1])
        .rpc();
      assert.fail(
        "Should have thrown an error when enqueuer tries to cancel transactions with a hard commitment level."
      );
    } catch (error) {
      assert.include(error.message, "InsufficientPermissions");
    }
  });

  it("Fails to execute transactions before the required delay period", async () => {
    // Attempt to execute before delay
    try {
      await timelockProgram.methods
        .executeTransactionBatch()
        .accounts({
          timelock: timelockKp.publicKey,
          timelockSigner: timelockSignerPubkey,
          transactionBatch: transactionBatch.publicKey,
        })
        .rpc();
      assert.fail("Should not execute before the delay period.");
    } catch (error) {
      assert.include(error.message, "NotReady");
    }
  });

  it("Executes the transfer sol transaction in the batch", async () => {
    let currentClock = await banksClient.getClock();
    let newSlot = currentClock.slot + 3n;
    context.setClock(
      new Clock(
        newSlot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        currentClock.unixTimestamp
      )
    );

    await timelockProgram.methods
      .executeTransactionBatch()
      .accounts({
        timelock: timelockKp.publicKey,
        timelockSigner: timelockSignerPubkey,
        transactionBatch: transactionBatch.publicKey,
      })
      .remainingAccounts([
        { pubkey: timelockSignerPubkey, isWritable: true, isSigner: false },
        { pubkey: recipient.publicKey, isWritable: true, isSigner: false },
        {
          pubkey: anchor.web3.SystemProgram.programId,
          isWritable: false,
          isSigner: false,
        },
      ])
      .rpc();

    // Verification step
    const transactionBatchAccount =
      await timelockProgram.account.transactionBatch.fetch(transactionBatch.publicKey);

    // Check if the first transaction did execute
    assert.strictEqual(
      transactionBatchAccount.transactions[0].didExecute,
      true,
      "The transfer SOL transaction should have been executed."
    );
    // Verify recipient's balance
    const recipientBalance = await banksClient.getBalance(recipient.publicKey);
    assert.strictEqual(
      recipientBalance,
      100_000_000n, // This should match the lamports sent in the transaction
      "The recipient's balance should be increased by the amount of lamports sent."
    );
  });

  it("Executes the set delay in slots transaction in the batch", async () => {
    await timelockProgram.methods
      .executeTransactionBatch()
      .accounts({
        timelock: timelockKp.publicKey,
        timelockSigner: timelockSignerPubkey,
        transactionBatch: transactionBatch.publicKey,
      })
      .remainingAccounts([
        { pubkey: timelockSignerPubkey, isWritable: false, isSigner: false },
        { pubkey: timelockKp.publicKey, isWritable: true, isSigner: false },
        { pubkey: timelockProgram.programId, isWritable: false, isSigner: false },
      ])
      .rpc();

    // Verification step
    const transactionBatchAccount =
      await timelockProgram.account.transactionBatch.fetch(transactionBatch.publicKey);

    // Check if the second transaction did execute
    assert.strictEqual(
      transactionBatchAccount.transactions[1].didExecute,
      true,
      "The set delay in slots transaction should have been executed."
    );

    // Fetch the updated timelock account to verify the delay has been modified
    const updatedTimelockAccount = await timelockProgram.account.timelock.fetch(
      timelockKp.publicKey
    );

    // The new delay in slots set by the transaction
    const newDelayInSlots = new BN(2); // Ensure this matches the value set in the transaction

    // Verify the timelock delay was updated correctly
    assert.ok(
      updatedTimelockAccount.delayInSlots.eq(newDelayInSlots),
      `The delay in slots should be updated to ${newDelayInSlots.toString()}`
    );
  });

  it("Executes the change authority transaction and verifies the update", async () => {
    await timelockProgram.methods
      .executeTransactionBatch()
      .accounts({
        timelock: timelockKp.publicKey,
        timelockSigner: timelockSignerPubkey,
        transactionBatch: transactionBatch.publicKey,
      })
      .remainingAccounts([
        { pubkey: timelockSignerPubkey, isWritable: false, isSigner: false },
        { pubkey: timelockKp.publicKey, isWritable: true, isSigner: false },
        { pubkey: timelockProgram.programId, isWritable: false, isSigner: false },
      ])
      .preInstructions([
        // this is to get around bankrun thinking we've processed the same transaction multiple times
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1,
        }),
      ])
      .rpc();

    // Fetch the updated TransactionBatch and timelock account to verify changes
    const updatedTransactionBatch =
      await timelockProgram.account.transactionBatch.fetch(transactionBatch.publicKey);
    const updatedTimelockAccount = await timelockProgram.account.timelock.fetch(
      timelockKp.publicKey
    );

    // Check if the third transaction did execute
    assert.strictEqual(
      updatedTransactionBatch.transactions[2].didExecute,
      true,
      "The change authority transaction should have been executed."
    );

    // Verify the timelock authority was updated correctly
    assert.ok(
      updatedTimelockAccount.authority.equals(recipient.publicKey),
      "The recipient should now be the authority of the timelock."
    );
  });

  it("Executes the add enqueuer transaction and verifies the update", async () => {
    await timelockProgram.methods
      .executeTransactionBatch()
      .accounts({
        timelock: timelockKp.publicKey,
        timelockSigner: timelockSignerPubkey,
        transactionBatch: transactionBatch.publicKey,
      })
      .remainingAccounts([
        { pubkey: timelockSignerPubkey, isWritable: false, isSigner: false },
        { pubkey: timelockKp.publicKey, isWritable: true, isSigner: false },
        { pubkey: timelockProgram.programId, isWritable: false, isSigner: false },
      ])
      .rpc();

    // Fetch the updated TransactionBatch and timelock account to verify changes
    const updatedTransactionBatch =
      await timelockProgram.account.transactionBatch.fetch(transactionBatch.publicKey);
    const updatedTimelockAccount = await timelockProgram.account.timelock.fetch(
      timelockKp.publicKey
    );

    // Check if the fourth transaction did execute
    assert.strictEqual(
      updatedTransactionBatch.transactions[3].didExecute,
      true,
      "The add enqueuer transaction should have been executed."
    );

    // Verify the enqueuer was added correctly
    assert.ok(
      updatedTimelockAccount.optimisticProposers
        .map((enqueuer) => enqueuer.pubkey.toString())
        .includes(enqueuer4.publicKey.toString()),
      "The enqueuer should have been added to the timelock."
    );
  });

  it("Executes the remove enqueuer transaction and verifies the update", async () => {
    await timelockProgram.methods
      .executeTransactionBatch()
      .accounts({
        timelock: timelockKp.publicKey,
        timelockSigner: timelockSignerPubkey,
        transactionBatch: transactionBatch.publicKey,
      })
      .remainingAccounts([
        { pubkey: timelockSignerPubkey, isWritable: false, isSigner: false },
        { pubkey: timelockKp.publicKey, isWritable: true, isSigner: false },
        { pubkey: timelockProgram.programId, isWritable: false, isSigner: false },
      ])
      .preInstructions([
        // this is to get around bankrun thinking we've processed the same transaction multiple times
        ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 3,
        }),
      ])
      .rpc();

    // Fetch the updated TransactionBatch and timelock account to verify changes
    const updatedTransactionBatch =
      await timelockProgram.account.transactionBatch.fetch(transactionBatch.publicKey);
    const updatedTimelockAccount = await timelockProgram.account.timelock.fetch(
      timelockKp.publicKey
    );

    // Check if the fifth transaction did execute
    assert.strictEqual(
      updatedTransactionBatch.transactions[4].didExecute,
      true,
      "The remove enqueuer transaction should have been executed."
    );

    // Verify the transaction batch status is 'Executed'
    assert.ok(
      "executed" in updatedTransactionBatch.status,
      "The batch status should be 'Executed' after all transactions are processed."
    );

    // Verify the enqueuer was removed correctly
    assert.ok(
      !updatedTimelockAccount.optimisticProposers
        .map((enqueuer) => enqueuer.toString())
        .includes(enqueuer3.publicKey.toString()),
      "The enqueuer should have been removed from the timelock."
    );
  });

  it("Enqueuer #1 creates, seals, enqueues, and cancels a transaction batch", async () => {
    // Step 1: Create a new Transaction Batch
    transactionBatchAuthority = anchor.web3.Keypair.generate();
    transactionBatch = anchor.web3.Keypair.generate();
    const transactionBatchSize = 30000; // Adequate size for the transaction batch

    await timelockProgram.methods
      .createTransactionBatch()
      .accounts({
        transactionBatchAuthority: enqueuer1.publicKey,
        timelock: timelockKp.publicKey,
        transactionBatch: transactionBatch.publicKey,
      })
      .preInstructions([
        await timelockProgram.account.transactionBatch.createInstruction(
          transactionBatch,
          transactionBatchSize
        ),
      ])
      .signers([enqueuer1, transactionBatch])
      .rpc();

    let transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been created
    assert.ok(
      "created" in transactionBatchAccount.status,
      "The transaction batch should be in 'Created' status after creation."
    );

    // Step 2: Seal the Transaction Batch
    await timelockProgram.methods
      .sealTransactionBatch()
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        transactionBatchAuthority: enqueuer1.publicKey,
      })
      .signers([enqueuer1])
      .rpc();

    transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been sealed
    assert.ok(
      "sealed" in transactionBatchAccount.status,
      "The transaction batch should be in 'Sealed' status after sealing."
    );

    // Step 3: Enqueue the Transaction Batch
    await timelockProgram.methods
      .enqueueTransactionBatch()
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        authority:enqueuer1.publicKey, // Assuming recipient as the new authority
        timelock: timelockKp.publicKey,
      })
      .signers([enqueuer1])
      .rpc();

    transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been enqueued
    assert.ok(
      "enqueued" in transactionBatchAccount.status,
      "The transaction batch should be in 'Enqueued' status after enqueueing."
    );

    assert.ok(
      "optimisticProposer" in transactionBatchAccount.enqueuerType,
      "The batch should be shown as enqueued by an enqueuer."
    );

    // Step 4: Cancel the Transaction Batch
    await timelockProgram.methods
      .cancelTransactionBatch()
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        authority:enqueuer1.publicKey,
        timelock: timelockKp.publicKey,
      })
      .signers([enqueuer1])
      .rpc();

    transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been cancelled
    assert.ok(
      "cancelled" in transactionBatchAccount.status,
      "The transaction batch should be in 'Cancelled' status after cancellation."
    );
  });

  it("Enqueuer #1 creates, seals, and enqueues a transaction batch; enqueuer #2 cancels it", async () => {
    // Step 1: Create a new Transaction Batch
    transactionBatchAuthority = anchor.web3.Keypair.generate();
    transactionBatch = anchor.web3.Keypair.generate();
    const transactionBatchSize = 30000; // Adequate size for the transaction batch

    await timelockProgram.methods
      .createTransactionBatch()
      .accounts({
        transactionBatchAuthority: enqueuer1.publicKey,
        timelock: timelockKp.publicKey,
        transactionBatch: transactionBatch.publicKey,
      })
      .preInstructions([
        await timelockProgram.account.transactionBatch.createInstruction(
          transactionBatch,
          transactionBatchSize
        ),
      ])
      .signers([enqueuer1, transactionBatch])
      .rpc();

    let transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been created
    assert.ok(
      "created" in transactionBatchAccount.status,
      "The transaction batch should be in 'Created' status after creation."
    );

    // Step 2: Seal the Transaction Batch
    await timelockProgram.methods
      .sealTransactionBatch()
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        transactionBatchAuthority: enqueuer1.publicKey,
      })
      .signers([enqueuer1])
      .rpc();

    transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been sealed
    assert.ok(
      "sealed" in transactionBatchAccount.status,
      "The transaction batch should be in 'Sealed' status after sealing."
    );

    // Step 3: Enqueue the Transaction Batch

    // First, this should fail because of cooldown
    try {
      await timelockProgram.methods
        .enqueueTransactionBatch()
        .accounts({
          transactionBatch: transactionBatch.publicKey,
          authority:enqueuer1.publicKey, // Assuming recipient as the new authority
          timelock: timelockKp.publicKey,
        })
        .signers([enqueuer1])
        .rpc();
      assert.fail("Should not allow enqueuing before cooldown.");
    } catch (err) {
      assert.include(err.message, "OptimisticProposerCooldown");
    }

    let currentClock = await banksClient.getClock();
    let newSlot = currentClock.slot + 300n;
    context.setClock(
      new Clock(
        newSlot,
        currentClock.epochStartTimestamp,
        currentClock.epoch,
        currentClock.leaderScheduleEpoch,
        currentClock.unixTimestamp
      )
    );

    // now it'll succeed
    await timelockProgram.methods
        .enqueueTransactionBatch()
        .accounts({
          transactionBatch: transactionBatch.publicKey,
          authority:enqueuer1.publicKey, // Assuming recipient as the new authority
          timelock: timelockKp.publicKey,
        })
        .signers([enqueuer1])
        .preInstructions([
          // this is to get around bankrun thinking we've processed the same transaction multiple times
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 69,
          }),
        ])
        .rpc();

    transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been enqueued
    assert.ok(
      "enqueued" in transactionBatchAccount.status,
      "The transaction batch should be in 'Enqueued' status after enqueueing."
    );

    // Step 4: Cancel the Transaction Batch
    await timelockProgram.methods
      .cancelTransactionBatch()
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        authority:enqueuer2.publicKey,
        timelock: timelockKp.publicKey,
      })
      .signers([enqueuer2])
      .rpc();

    transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been cancelled
    assert.ok(
      "cancelled" in transactionBatchAccount.status,
      "The transaction batch should be in 'Cancelled' status after cancellation."
    );
  });

  it("Enqueuer #2 creates, seals, and enqueues a transaction batch; timelock authority cancels it", async () => {
    // Step 1: Create a new Transaction Batch
    transactionBatchAuthority = anchor.web3.Keypair.generate();
    transactionBatch = anchor.web3.Keypair.generate();
    const transactionBatchSize = 30000; // Adequate size for the transaction batch

    await timelockProgram.methods
      .createTransactionBatch()
      .accounts({
        transactionBatchAuthority: enqueuer2.publicKey,
        timelock: timelockKp.publicKey,
        transactionBatch: transactionBatch.publicKey,
      })
      .preInstructions([
        await timelockProgram.account.transactionBatch.createInstruction(
          transactionBatch,
          transactionBatchSize
        ),
      ])
      .signers([enqueuer2, transactionBatch])
      .rpc();

    let transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been created
    assert.ok(
      "created" in transactionBatchAccount.status,
      "The transaction batch should be in 'Created' status after creation."
    );

    // Step 2: Seal the Transaction Batch
    await timelockProgram.methods
      .sealTransactionBatch()
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        transactionBatchAuthority: enqueuer2.publicKey,
      })
      .signers([enqueuer2])
      .rpc();

    transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been sealed
    assert.ok(
      "sealed" in transactionBatchAccount.status,
      "The transaction batch should be in 'Sealed' status after sealing."
    );

    // Step 3: Enqueue the Transaction Batch
    await timelockProgram.methods
      .enqueueTransactionBatch()
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        authority:enqueuer2.publicKey, // Assuming recipient as the new authority
        timelock: timelockKp.publicKey,
      })
      .signers([enqueuer2])
      .rpc();

    transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been enqueued
    assert.ok(
      "enqueued" in transactionBatchAccount.status,
      "The transaction batch should be in 'Enqueued' status after enqueueing."
    );

    // Step 4: Cancel the Transaction Batch
    await timelockProgram.methods
      .cancelTransactionBatch()
      .accounts({
        transactionBatch: transactionBatch.publicKey,
        authority:recipient.publicKey,
        timelock: timelockKp.publicKey,
      })
      .signers([recipient])
      .rpc();

    transactionBatchAccount = await timelockProgram.account.transactionBatch.fetch(
      transactionBatch.publicKey
    );

    // Verify the transaction batch has been cancelled
    assert.ok(
      "cancelled" in transactionBatchAccount.status,
      "The transaction batch should be in 'Cancelled' status after cancellation."
    );
  });

  it("Prevents unauthorized users from modifying the timelock", async () => {
    const unauthorizedUser = anchor.web3.Keypair.generate();
    const newDelay = new anchor.BN(10);

    try {
      await timelockProgram.methods
        .setDelayInSlots(newDelay)
        .accounts({
          timelock: timelockKp.publicKey,
          timelockSigner: unauthorizedUser.publicKey, // incorrect signer
        })
        .signers([unauthorizedUser]) // unauthorized signer attempts the operation
        .rpc();
      assert.fail("Should not allow unauthorized modifications.");
    } catch (error) {
      assert.include(
        error.message,
        "AnchorError caused by account: timelock_signer. Error Code: ConstraintSeeds."
      );
    }
  });
});
