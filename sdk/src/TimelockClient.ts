import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

import { Timelock, IDL as TimelockIDL } from "./types/timelock";
import { getTimelockAddr } from "./utils";
import { TimelockAccount } from "./types";

export class TimelockClient {
  public readonly provider: AnchorProvider;
  public readonly timelockProgram: Program<Timelock>;

  constructor(provider: AnchorProvider, timelockProgramId: PublicKey) {
    this.provider = provider;
    this.timelockProgram = new Program(
      TimelockIDL,
      timelockProgramId,
      provider
    );
  }

  async getTimelock(timelock: PublicKey): Promise<TimelockAccount> {
    return this.timelockProgram.account.timelock.fetch(timelock);
  }

  async createTimelock(
    authority: PublicKey,
    enqueuers: PublicKey[],
    delayInSlots: BN,
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
      timelockId
    ).rpc();

    return timelock;
  }

  createTimelockIx(
    admin: PublicKey,
    enqueuers: PublicKey[],
    delayInSlots: BN,
    timelockId: BN
  ) {
    const timelock = getTimelockAddr(
      this.timelockProgram.programId,
      timelockId
    )[0];

    return this.timelockProgram.methods
      .createTimelock({
        maxEnqueuers: 10,
        enqueuers,
        admin,
        delayInSlots: new BN(delayInSlots),
        timelockId,
      })
      .accounts({
        timelock,
      });
  }
}
