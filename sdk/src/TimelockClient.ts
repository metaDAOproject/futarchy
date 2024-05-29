import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";

import { Timelock, IDL as TimelockIDL } from "./types/timelock";

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

  async createTimelockIx(
    authority: PublicKey,
    enqueuers: PublicKey[],
    delayInSlots: number,
    timelockKeypair: Keypair
  ) {
    const [timelockSigner] = PublicKey.findProgramAddressSync(
      [timelockKeypair.publicKey.toBuffer()],
      this.timelockProgram.programId
    );
    const timelockSize = 200; // Big enough.
    return this.timelockProgram.methods
      .createTimelock(enqueuers, authority, new BN(delayInSlots))
      .accounts({
        timelock: timelockKeypair.publicKey,
        timelockSigner,
      })
      .preInstructions([
        await this.timelockProgram.account.timelock.createInstruction(timelockKeypair, timelockSize),
      ])
      .signers([timelockKeypair])
  }
}
