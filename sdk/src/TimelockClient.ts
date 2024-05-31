import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";

import {
  Timelock as TimelockProgram,
  IDL as TimelockIDL,
} from "./types/timelock";
import { getTimelockAddr } from "./utils";
import {
  Timelock,
  TimelockTransactionAccount,
  TransactionBatch,
} from "./types";

export class TimelockClient {
  public readonly provider: AnchorProvider;
  public readonly timelockProgram: Program<TimelockProgram>;

  constructor(provider: AnchorProvider, timelockProgramId: PublicKey) {
    this.provider = provider;
    this.timelockProgram = new Program(
      TimelockIDL,
      timelockProgramId,
      provider
    );
  }

  async getTimelock(timelock: PublicKey): Promise<Timelock> {
    return this.timelockProgram.account.timelock.fetch(timelock);
  }

  async getTransactionBatch(
    transactionBatch: PublicKey
  ): Promise<TransactionBatch> {
    return this.timelockProgram.account.transactionBatch.fetch(
      transactionBatch
    );
  }

  setDelayInSlotsIx({
    timelock,
    delayInSlots,
  }: {
    timelock: PublicKey;
    delayInSlots: BN;
  }) {
    return this.timelockProgram.methods
      .setDelayInSlots(delayInSlots)
      .accounts({ timelock });
  }

  setAdminIx({ timelock, admin }: { timelock: PublicKey; admin: PublicKey }) {
    return this.timelockProgram.methods.setAdmin(admin).accounts({ timelock });
  }

  async createTimelock(
    authority: PublicKey,
    enqueuers: PublicKey[],
    delayInSlots: BN,
    maxEnqueuers: number = 10,
    timelockId: BN = new BN(Math.random() * 1e30)
  ): Promise<PublicKey> {
    const timelock = getTimelockAddr(
      this.timelockProgram.programId,
      timelockId
    )[0];

    await this.createTimelockIx(
      authority,
      enqueuers,
      delayInSlots,
      maxEnqueuers,
      timelockId
    ).rpc();

    return timelock;
  }

  createTimelockIx(
    admin: PublicKey,
    enqueuers: PublicKey[],
    delayInSlots: BN,
    maxEnqueuers: number,
    timelockId: BN
  ) {
    const timelock = getTimelockAddr(
      this.timelockProgram.programId,
      timelockId
    )[0];

    return this.timelockProgram.methods
      .createTimelock({
        maxEnqueuers,
        enqueuers,
        admin,
        delayInSlots: new BN(delayInSlots),
        timelockId,
      })
      .accounts({
        timelock,
      });
  }

  async createTransactionBatchIx({
    timelock,
    transactionBatchKp = Keypair.generate(),
    transactionBatchSize = 10_000, // 10 kilobytes
    transactionBatchAuthority = this.provider.publicKey,
  }: {
    timelock: PublicKey;
    transactionBatchKp?: Keypair;
    transactionBatchSize?: number;
    // if you pass a public key, you need to sign the instruction later
    transactionBatchAuthority?: PublicKey;
  }) {
    return this.timelockProgram.methods
      .createTransactionBatch({ transactionBatchAuthority })
      .accounts({
        timelock,
        transactionBatch: transactionBatchKp.publicKey,
      })
      .preInstructions([
        await this.timelockProgram.account.transactionBatch.createInstruction(
          transactionBatchKp,
          transactionBatchSize
        ),
      ])
      .signers([transactionBatchKp]);
  }

  async addTransaction({
    transactionBatch,
    instruction,
  }: {
    transactionBatch: PublicKey;
    instruction: TransactionInstruction;
  }) {
    await this.addTransactionIx({
      transactionBatch,
      programId: instruction.programId,
      accounts: instruction.keys,
      data: instruction.data,
    }).rpc();
  }

  addTransactionIx({
    transactionBatch,
    programId,
    accounts,
    data,
  }: {
    transactionBatch: PublicKey;
    programId: PublicKey;
    accounts: TimelockTransactionAccount[];
    data: Buffer;
  }) {
    return this.timelockProgram.methods
      .addTransaction({ programId, accounts, data })
      .accounts({
        transactionBatch,
        transactionBatchAuthority: this.provider.publicKey,
      });
  }

  enqueueTransactionBatchIx({
    timelock,
    transactionBatch,
    timelockAdmin,
  }: {
    timelock: PublicKey;
    transactionBatch: PublicKey;
    timelockAdmin: PublicKey;
  }) {
    return this.timelockProgram.methods.enqueueTransactionBatch().accounts({
      timelock,
      transactionBatch,
      admin: timelockAdmin,
    });
  }

  // copy the exact parameters from above
  cancelTransactionBatchIx({
    timelock,
    transactionBatch,
    timelockAdmin,
  }: {
    timelock: PublicKey;
    transactionBatch: PublicKey;
    timelockAdmin: PublicKey;
  }) {
    return this.timelockProgram.methods.cancelTransactionBatch().accounts({
      timelock,
      transactionBatch,
      admin: timelockAdmin,
    });
  }

  sealTransactionBatchIx({
    transactionBatch,
    transactionBatchAuthority = this.provider.publicKey,
  }: {
    transactionBatch: PublicKey;
    transactionBatchAuthority?: PublicKey;
  }) {
    return this.timelockProgram.methods.sealTransactionBatch().accounts({
      transactionBatch,
      transactionBatchAuthority,
    });
  }

  executeTransactionBatchIx({
    transactionBatch,
    timelock,
  }: {
    transactionBatch: PublicKey;
    timelock: PublicKey;
  }) {
    return this.timelockProgram.methods.executeTransactionBatch().accounts({
      transactionBatch,
      timelock,
    });
  }
}
