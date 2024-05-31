import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";
import { PublicKey, Keypair } from "@solana/web3.js";


import { assert } from "chai";

import { BanksClient, Clock, startAnchor } from "solana-bankrun";

const TIMELOCK_PROGRAM_ID = new PublicKey(
  "tiME1hz9F5C5ZecbvE5z6Msjy8PKfTqo1UuRYXfndKF"
);

import { Timelock } from "../target/types/timelock";
import { ComputeBudgetProgram, Connection } from "@solana/web3.js";
import { TimelockClient } from "@metadaoproject/futarchy/src/TimelockClient";
import { getTimelockAddr } from "@metadaoproject/futarchy";
const TimelockIDL: Timelock = require("../target/idl/timelock.json");

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
  const timelockAuthority = anchor.web3.Keypair.generate();

  let provider: BankrunProvider,
    connection,
    timelockClient: TimelockClient,
    payer,
    context,
    banksClient: BanksClient,
    timelock: PublicKey,
    recipient,
    timelockKp: anchor.web3.Keypair,
    timelockSignerPubkey: anchor.web3.PublicKey,
    transactionBatchAuthority: anchor.web3.Keypair,
    transactionBatch: anchor.web3.Keypair;
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
    timelockClient = new TimelockClient(
      provider as any as anchor.AnchorProvider,
      TIMELOCK_PROGRAM_ID
    );
  });

  it("Creates a new timelock", async () => {
    const delayInSlots = new anchor.BN(1);
    const timelockId = new BN(Math.random() * 10000000000);
    const maxEnqueuers = 10;

    let bump: number;
    [timelock, bump] = getTimelockAddr(
      timelockClient.timelockProgram.programId,
      timelockId
    );

    await timelockClient.createTimelock(
      timelockAuthority.publicKey,
      [payer.publicKey],
      delayInSlots,
      maxEnqueuers,
      timelockId
    );

    let storedTimelock = await timelockClient.getTimelock(timelock);
    assert.equal(
      storedTimelock.delayInSlots.toString(),
      delayInSlots.toString()
    );
    assert.equal(storedTimelock.id.toString(), timelockId.toString());
    assert.equal(storedTimelock.pdaBump, bump);
    assert.equal(storedTimelock.maxEnqueuers, maxEnqueuers);
    assert.equal(storedTimelock.enqueuers.length, 1);
    assert.equal(
      storedTimelock.enqueuers[0].toString(),
      payer.publicKey.toString()
    );
    assert.equal(storedTimelock.admin.toString(), timelockAuthority.publicKey.toString());
  });

  it("Creates a transaction batch", async () => {
    transactionBatchAuthority = Keypair.generate();
    transactionBatch = Keypair.generate();
    const transactionBatchSize = 30000; // Adjust size as needed

    await (
      await timelockClient.createTransactionBatchIx({
        timelock,
        transactionBatchKp: transactionBatch,
        transactionBatchSize,
        transactionBatchAuthority: transactionBatchAuthority.publicKey,
      })
    ).rpc();

    const transactionBatchAccount = await timelockClient.getTransactionBatch(
      transactionBatch.publicKey
    );
    console.log(transactionBatchAccount)
    console.log(timelock)
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

  // // Example additional test: "Adds three transactions to the transaction batch"
  // it("Adds three transactions to the transaction batch", async () => {
  //   recipient = anchor.web3.Keypair.generate();

  //   await fakeRequestAirdrop(
  //     banksClient,
  //     payer,
  //     timelockSignerPubkey,
  //     200_000_000
  //   );

  //   // Transaction 1: Transfer SOL
  //   let transferInstruction = anchor.web3.SystemProgram.transfer({
  //     fromPubkey: timelockSignerPubkey,
  //     toPubkey: recipient.publicKey,
  //     lamports: 100_000_000,
  //   });
  //   await timelockProgram.methods
  //     .addTransaction(
  //       transferInstruction.programId,
  //       transferInstruction.keys.map((key) => ({
  //         pubkey: key.pubkey,
  //         isSigner: key.isSigner,
  //         isWritable: key.isWritable,
  //       })),
  //       transferInstruction.data
  //     )
  //     .accounts({
  //       transactionBatch: transactionBatch.publicKey,
  //       transactionBatchAuthority: transactionBatchAuthority.publicKey,
  //     })
  //     .signers([transactionBatchAuthority])
  //     .rpc();

  //   // Transaction 2: Set Delay in Slots
  //   const newDelayInSlots = new BN(2);
  //   let setDelayInSlotsInstruction =
  //     timelockProgram.instruction.setDelayInSlots(newDelayInSlots, {
  //       accounts: {
  //         timelock: timelockKp.publicKey,
  //         timelockSigner: timelockSignerPubkey,
  //       },
  //     });

  //   await timelockProgram.methods
  //     .addTransaction(
  //       setDelayInSlotsInstruction.programId,
  //       setDelayInSlotsInstruction.keys.map((key) => ({
  //         pubkey: key.pubkey,
  //         isSigner: key.isSigner,
  //         isWritable: key.isWritable,
  //       })),
  //       setDelayInSlotsInstruction.data
  //     )
  //     .accounts({
  //       transactionBatch: transactionBatch.publicKey,
  //       transactionBatchAuthority: transactionBatchAuthority.publicKey,
  //     })
  //     .signers([transactionBatchAuthority])
  //     .rpc();

  //   // Transaction 3: Change Authority
  //   let setAuthorityInstruction = timelockProgram.instruction.setAuthority(
  //     recipient.publicKey,
  //     {
  //       accounts: {
  //         timelock: timelockKp.publicKey,
  //         timelockSigner: timelockSignerPubkey,
  //       },
  //     }
  //   );

  //   await timelockProgram.methods
  //     .addTransaction(
  //       setAuthorityInstruction.programId,
  //       setAuthorityInstruction.keys.map((key) => ({
  //         pubkey: key.pubkey,
  //         isSigner: key.isSigner,
  //         isWritable: key.isWritable,
  //       })),
  //       setAuthorityInstruction.data
  //     )
  //     .accounts({
  //       transactionBatch: transactionBatch.publicKey,
  //       transactionBatchAuthority: transactionBatchAuthority.publicKey,
  //     })
  //     .signers([transactionBatchAuthority])
  //     .rpc();

  //   // Verify the transactions
  //   const transactionBatchAccount =
  //     await timelockProgram.account.transactionBatch.fetch(
  //       transactionBatch.publicKey
  //     );
  //   assert.strictEqual(
  //     transactionBatchAccount.transactions.length,
  //     3,
  //     "There should be three transactions in the batch."
  //   );
  // });

  // it("Fails to enqueue a non-Sealed batch", async () => {
  //   // Assume the batch is new and not yet sealed
  //   try {
  //     await timelockProgram.methods
  //       .enqueueTransactionBatch()
  //       .accounts({
  //         transactionBatch: transactionBatch.publicKey,
  //         authority: timelockAuthority.publicKey,
  //         timelock: timelockKp.publicKey,
  //       })
  //       .signers([timelockAuthority])
  //       .rpc();
  //     assert.fail(
  //       "Should have thrown an error when enqueuing a non-Sealed batch."
  //     );
  //   } catch (error) {
  //     assert.include(error.message, "CannotEnqueueTransactionBatch");
  //   }
  // });

  // it("Seals the transaction batch", async () => {
  //   await timelockProgram.methods
  //     .sealTransactionBatch()
  //     .accounts({
  //       transactionBatch: transactionBatch.publicKey,
  //       transactionBatchAuthority: transactionBatchAuthority.publicKey,
  //     })
  //     .signers([transactionBatchAuthority])
  //     .rpc();

  //   const sealedTransactionBatch =
  //     await timelockProgram.account.transactionBatch.fetch(
  //       transactionBatch.publicKey
  //     );

  //   // Assert the transaction batch is now sealed
  //   assert.ok(
  //     "sealed" in sealedTransactionBatch.status,
  //     "The batch status should be 'Sealed' after sealing."
  //   );
  // });

  // it("Fails to cancel a batch that is not Enqueued", async () => {
  //   // Assume the batch is new or sealed but not enqueued
  //   try {
  //     await timelockProgram.methods
  //       .cancelTransactionBatch()
  //       .accounts({
  //         transactionBatch: transactionBatch.publicKey,
  //         authority: timelockAuthority.publicKey,
  //         timelock: timelockKp.publicKey,
  //       })
  //       .signers([timelockAuthority])
  //       .rpc();
  //     assert.fail(
  //       "Should have thrown an error when canceling a batch that is not Enqueued."
  //     );
  //   } catch (error) {
  //     assert.include(error.message, "CannotCancelTimelock");
  //   }
  // });

  // it("Fails to execute transactions in a batch not in Enqueued state", async () => {
  //   // Assume the batch is new or sealed but not enqueued
  //   try {
  //     await timelockProgram.methods
  //       .executeTransactionBatch()
  //       .accounts({
  //         timelock: timelockKp.publicKey,
  //         timelockSigner: timelockSignerPubkey,
  //         transactionBatch: transactionBatch.publicKey,
  //       })
  //       .rpc();
  //     assert.fail(
  //       "Should have thrown an error when trying to execute transactions in a non-Enqueued batch."
  //     );
  //   } catch (error) {
  //     assert.include(error.message, "CannotExecuteTransactions");
  //   }
  // });

  // it("Fails to add transactions to a sealed batch", async () => {
  //   // Try adding a transaction to the sealed batch
  //   let transferInstruction = anchor.web3.SystemProgram.transfer({
  //     fromPubkey: timelockSignerPubkey,
  //     toPubkey: recipient.publicKey,
  //     lamports: 100_000_000,
  //   });

  //   try {
  //     await timelockProgram.methods
  //       .addTransaction(
  //         transferInstruction.programId,
  //         transferInstruction.keys.map((key) => ({
  //           pubkey: key.pubkey,
  //           isSigner: key.isSigner,
  //           isWritable: key.isWritable,
  //         })),
  //         transferInstruction.data
  //       )
  //       .accounts({
  //         transactionBatch: transactionBatch.publicKey,
  //         transactionBatchAuthority: transactionBatchAuthority.publicKey,
  //       })
  //       .signers([transactionBatchAuthority])
  //       .rpc();
  //     assert.fail(
  //       "Should have thrown an error when adding a transaction to a sealed batch."
  //     );
  //   } catch (error) {
  //     assert.include(error.message, "CannotAddTransactions");
  //   }
  // });

  // it("Fails to seal a non-Created batch", async () => {
  //   try {
  //     await timelockProgram.methods
  //       .sealTransactionBatch()
  //       .accounts({
  //         transactionBatch: transactionBatch.publicKey,
  //         transactionBatchAuthority: transactionBatchAuthority.publicKey,
  //       })
  //       .signers([transactionBatchAuthority])
  //       .rpc();
  //     assert.fail(
  //       "Should have thrown an error when sealing a non-Created batch."
  //     );
  //   } catch (error) {
  //     assert.include(error.message, "CannotSealTransactionBatch");
  //   }
  // });

  // it("Enqueues the transaction batch", async () => {
  //   await timelockProgram.methods
  //     .enqueueTransactionBatch()
  //     .accounts({
  //       transactionBatch: transactionBatch.publicKey,
  //       authority: timelockAuthority.publicKey,
  //       timelock: timelockKp.publicKey,
  //     })
  //     .signers([timelockAuthority])
  //     .rpc();

  //   const enqueuedTransactionBatch =
  //     await timelockProgram.account.transactionBatch.fetch(
  //       transactionBatch.publicKey
  //     );

  //   // Assert the transaction batch is now in TimelockStarted status
  //   assert.ok(
  //     "enqueued" in enqueuedTransactionBatch.status,
  //     "The batch status should be 'Enqueued' after enqueueing."
  //   );

  //   // Assert the enqueued slot is set
  //   assert.ok(
  //     enqueuedTransactionBatch.enqueuedSlot.toNumber() > 0,
  //     "The enqueued slot should be set and greater than 0."
  //   );
  // });

  // it("Fails to execute transactions before the required delay period", async () => {
  //   // Attempt to execute before delay
  //   try {
  //     await timelockProgram.methods
  //       .executeTransactionBatch()
  //       .accounts({
  //         timelock: timelockKp.publicKey,
  //         timelockSigner: timelockSignerPubkey,
  //         transactionBatch: transactionBatch.publicKey,
  //       })
  //       .rpc();
  //     assert.fail("Should not execute before the delay period.");
  //   } catch (error) {
  //     assert.include(error.message, "NotReady");
  //   }
  // });

  // it("Executes the transfer sol transaction in the batch", async () => {
  //   let currentClock = await banksClient.getClock();
  //   let newSlot = currentClock.slot + 3n;
  //   context.setClock(
  //     new Clock(
  //       newSlot,
  //       currentClock.epochStartTimestamp,
  //       currentClock.epoch,
  //       currentClock.leaderScheduleEpoch,
  //       currentClock.unixTimestamp
  //     )
  //   );

  //   await timelockProgram.methods
  //     .executeTransactionBatch()
  //     .accounts({
  //       timelock: timelockKp.publicKey,
  //       timelockSigner: timelockSignerPubkey,
  //       transactionBatch: transactionBatch.publicKey,
  //     })
  //     .remainingAccounts([
  //       { pubkey: timelockSignerPubkey, isWritable: true, isSigner: false },
  //       { pubkey: recipient.publicKey, isWritable: true, isSigner: false },
  //       {
  //         pubkey: anchor.web3.SystemProgram.programId,
  //         isWritable: false,
  //         isSigner: false,
  //       },
  //     ])
  //     .rpc();

  //   // Verification step
  //   const transactionBatchAccount =
  //     await timelockProgram.account.transactionBatch.fetch(
  //       transactionBatch.publicKey
  //     );

  //   // Check if the first transaction did execute
  //   assert.strictEqual(
  //     transactionBatchAccount.transactions[0].didExecute,
  //     true,
  //     "The transfer SOL transaction should have been executed."
  //   );
  //   // Verify recipient's balance
  //   const recipientBalance = await banksClient.getBalance(recipient.publicKey);
  //   assert.strictEqual(
  //     recipientBalance,
  //     100_000_000n, // This should match the lamports sent in the transaction
  //     "The recipient's balance should be increased by the amount of lamports sent."
  //   );
  // });

  // it("Executes the set delay in slots transaction in the batch", async () => {
  //   await timelockProgram.methods
  //     .executeTransactionBatch()
  //     .accounts({
  //       timelock: timelockKp.publicKey,
  //       timelockSigner: timelockSignerPubkey,
  //       transactionBatch: transactionBatch.publicKey,
  //     })
  //     .remainingAccounts([
  //       { pubkey: timelockSignerPubkey, isWritable: false, isSigner: false },
  //       { pubkey: timelockKp.publicKey, isWritable: true, isSigner: false },
  //       {
  //         pubkey: timelockProgram.programId,
  //         isWritable: false,
  //         isSigner: false,
  //       },
  //     ])
  //     .rpc();

  //   // Verification step
  //   const transactionBatchAccount =
  //     await timelockProgram.account.transactionBatch.fetch(
  //       transactionBatch.publicKey
  //     );

  //   // Check if the second transaction did execute
  //   assert.strictEqual(
  //     transactionBatchAccount.transactions[1].didExecute,
  //     true,
  //     "The set delay in slots transaction should have been executed."
  //   );

  //   // Fetch the updated timelock account to verify the delay has been modified
  //   const updatedTimelockAccount = await timelockProgram.account.timelock.fetch(
  //     timelockKp.publicKey
  //   );

  //   // The new delay in slots set by the transaction
  //   const newDelayInSlots = new BN(2); // Ensure this matches the value set in the transaction

  //   // Verify the timelock delay was updated correctly
  //   assert.ok(
  //     updatedTimelockAccount.delayInSlots.eq(newDelayInSlots),
  //     `The delay in slots should be updated to ${newDelayInSlots.toString()}`
  //   );
  // });

  // it("Executes the change authority transaction and verifies the update", async () => {
  //   await timelockProgram.methods
  //     .executeTransactionBatch()
  //     .accounts({
  //       timelock: timelockKp.publicKey,
  //       timelockSigner: timelockSignerPubkey,
  //       transactionBatch: transactionBatch.publicKey,
  //     })
  //     .remainingAccounts([
  //       { pubkey: timelockSignerPubkey, isWritable: false, isSigner: false },
  //       { pubkey: timelockKp.publicKey, isWritable: true, isSigner: false },
  //       {
  //         pubkey: timelockProgram.programId,
  //         isWritable: false,
  //         isSigner: false,
  //       },
  //     ])
  //     .preInstructions([
  //       // this is to get around bankrun thinking we've processed the same transaction multiple times
  //       ComputeBudgetProgram.setComputeUnitPrice({
  //         microLamports: 1,
  //       }),
  //     ])
  //     .rpc();

  //   // Fetch the updated TransactionBatch and timelock account to verify changes
  //   const updatedTransactionBatch =
  //     await timelockProgram.account.transactionBatch.fetch(
  //       transactionBatch.publicKey
  //     );
  //   const updatedTimelockAccount = await timelockProgram.account.timelock.fetch(
  //     timelockKp.publicKey
  //   );

  //   // Check if the third transaction did execute
  //   assert.strictEqual(
  //     updatedTransactionBatch.transactions[2].didExecute,
  //     true,
  //     "The change authority transaction should have been executed."
  //   );

  //   // Verify the transaction batch status is 'Executed'
  //   assert.ok(
  //     "executed" in updatedTransactionBatch.status,
  //     "The batch status should be 'Executed' after all transactions are processed."
  //   );

  //   // Verify the timelock authority was updated correctly
  //   assert.ok(
  //     updatedTimelockAccount.authority.equals(recipient.publicKey),
  //     "The recipient should now be the authority of the timelock."
  //   );
  // });

  // it("Creates, seals, enqueues, and then cancels a transaction batch", async () => {
  //   // Step 1: Create a new Transaction Batch
  //   transactionBatchAuthority = anchor.web3.Keypair.generate();
  //   transactionBatch = anchor.web3.Keypair.generate();
  //   const transactionBatchSize = 30000; // Adequate size for the transaction batch

  //   await timelockProgram.methods
  //     .createTransactionBatch()
  //     .accounts({
  //       transactionBatchAuthority: transactionBatchAuthority.publicKey,
  //       timelock: timelockKp.publicKey,
  //       transactionBatch: transactionBatch.publicKey,
  //     })
  //     .preInstructions([
  //       await timelockProgram.account.transactionBatch.createInstruction(
  //         transactionBatch,
  //         transactionBatchSize
  //       ),
  //     ])
  //     .signers([transactionBatchAuthority, transactionBatch])
  //     .rpc();

  //   let transactionBatchAccount =
  //     await timelockProgram.account.transactionBatch.fetch(
  //       transactionBatch.publicKey
  //     );

  //   // Verify the transaction batch has been created
  //   assert.ok(
  //     "created" in transactionBatchAccount.status,
  //     "The transaction batch should be in 'Created' status after creation."
  //   );

  //   // Step 2: Seal the Transaction Batch
  //   await timelockProgram.methods
  //     .sealTransactionBatch()
  //     .accounts({
  //       transactionBatch: transactionBatch.publicKey,
  //       transactionBatchAuthority: transactionBatchAuthority.publicKey,
  //     })
  //     .signers([transactionBatchAuthority])
  //     .rpc();

  //   transactionBatchAccount =
  //     await timelockProgram.account.transactionBatch.fetch(
  //       transactionBatch.publicKey
  //     );

  //   // Verify the transaction batch has been sealed
  //   assert.ok(
  //     "sealed" in transactionBatchAccount.status,
  //     "The transaction batch should be in 'Sealed' status after sealing."
  //   );

  //   // Step 3: Enqueue the Transaction Batch
  //   await timelockProgram.methods
  //     .enqueueTransactionBatch()
  //     .accounts({
  //       transactionBatch: transactionBatch.publicKey,
  //       authority: recipient.publicKey, // Assuming recipient as the new authority
  //       timelock: timelockKp.publicKey,
  //     })
  //     .signers([recipient])
  //     .rpc();

  //   transactionBatchAccount =
  //     await timelockProgram.account.transactionBatch.fetch(
  //       transactionBatch.publicKey
  //     );

  //   // Verify the transaction batch has been enqueued
  //   assert.ok(
  //     "enqueued" in transactionBatchAccount.status,
  //     "The transaction batch should be in 'Enqueued' status after enqueueing."
  //   );

  //   // Step 4: Cancel the Transaction Batch
  //   await timelockProgram.methods
  //     .cancelTransactionBatch()
  //     .accounts({
  //       transactionBatch: transactionBatch.publicKey,
  //       authority: recipient.publicKey,
  //       timelock: timelockKp.publicKey,
  //     })
  //     .signers([recipient])
  //     .rpc();

  //   transactionBatchAccount =
  //     await timelockProgram.account.transactionBatch.fetch(
  //       transactionBatch.publicKey
  //     );

  //   // Verify the transaction batch has been cancelled
  //   assert.ok(
  //     "cancelled" in transactionBatchAccount.status,
  //     "The transaction batch should be in 'Cancelled' status after cancellation."
  //   );
  // });

  // it("Prevents unauthorized users from modifying the timelock", async () => {
  //   const unauthorizedUser = anchor.web3.Keypair.generate();
  //   const newDelay = new anchor.BN(10);

  //   try {
  //     await timelockProgram.methods
  //       .setDelayInSlots(newDelay)
  //       .accounts({
  //         timelock: timelockKp.publicKey,
  //         timelockSigner: unauthorizedUser.publicKey, // incorrect signer
  //       })
  //       .signers([unauthorizedUser]) // unauthorized signer attempts the operation
  //       .rpc();
  //     assert.fail("Should not allow unauthorized modifications.");
  //   } catch (error) {
  //     assert.include(
  //       error.message,
  //       "AnchorError caused by account: timelock_signer. Error Code: ConstraintSeeds."
  //     );
  //   }
  // });
});
