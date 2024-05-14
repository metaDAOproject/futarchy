import {
  AddressLookupTableAccount,
  Blockhash,
  ConfirmOptions,
  Keypair,
  Signer,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { BanksClient } from "solana-bankrun";
import { addComputeUnits, addPriorityFee } from "./utils";
import { AmmClient } from "./AmmClient";
import { AnchorProvider, Program } from "@coral-xyz/anchor";

export type SignerOrKeypair = Signer | Keypair;

interface Client<ProgramType> {
  provider: AnchorProvider;
  program: ProgramType;
  luts: AddressLookupTableAccount[];
}

export class InstructionHandler<
  ProgramType,
  Type extends Client<ProgramType> = Client<ProgramType>
> {
  public instructions: TransactionInstruction[];
  public signers: Set<SignerOrKeypair>;
  public client: Type;

  public computeUnits = 200_000;
  public microLamportsPerComputeUnit = 0;

  public preInstructions: TransactionInstruction[];
  public postInstructions: TransactionInstruction[];

  constructor(
    instructions: TransactionInstruction[],
    signers: SignerOrKeypair[],
    client: Type
  ) {
    this.instructions = instructions;

    this.signers = new Set();
    signers.forEach((s) => this.signers.add(s));

    this.client = client;

    this.preInstructions = [];
    this.postInstructions = [];
  }

  addPreInstructions(
    instructions: TransactionInstruction[],
    signers: SignerOrKeypair[] = []
  ): InstructionHandler<ProgramType, Type> {
    this.preInstructions = [...instructions, ...this.preInstructions];
    signers.forEach((s) => this.signers.add(s));
    return this;
  }

  addPostInstructions(
    instructions: TransactionInstruction[],
    signers: SignerOrKeypair[] = []
  ): InstructionHandler<ProgramType, Type> {
    this.postInstructions = [...instructions, ...this.postInstructions];
    signers.forEach((s) => this.signers.add(s));
    return this;
  }

  async getVersionedTransaction(blockhash: Blockhash) {
    this.instructions = [
      ...this.preInstructions,
      ...this.instructions,
      ...this.postInstructions,
    ];

    if (this.microLamportsPerComputeUnit != 0) {
      this.instructions = [
        addPriorityFee(this.microLamportsPerComputeUnit),
        ...this.instructions,
      ];
    }

    if (this.computeUnits != 200_000) {
      this.instructions = [
        addComputeUnits(this.computeUnits),
        ...this.instructions,
      ];
    }

    const message = new TransactionMessage({
      payerKey: this.client.provider.wallet.publicKey,
      recentBlockhash: blockhash,
      instructions: this.instructions,
    }).compileToV0Message(this.client.luts);

    let tx = new VersionedTransaction(message);

    let signersArray = Array.from(this.signers);
    if (this.signers.size) {
      tx.sign(signersArray);
    }

    return tx;
  }

  setComputeUnits(computeUnits: number): InstructionHandler<ProgramType, Type> {
    this.computeUnits = computeUnits;
    return this;
  }

  setPriorityFee(
    microLamportsPerComputeUnit: number
  ): InstructionHandler<ProgramType, Type> {
    this.microLamportsPerComputeUnit = microLamportsPerComputeUnit;
    return this;
  }

  async bankrun(banksClient: BanksClient) {
    try {
      let [blockhash] = (await banksClient.getLatestBlockhash())!;
      const tx = await this.getVersionedTransaction(blockhash);
      return await banksClient.processTransaction(tx);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async rpc(opts: ConfirmOptions = { skipPreflight: true }) {
    try {
      let blockhash = (
        await this.client.provider.connection.getLatestBlockhash()
      ).blockhash;
      let tx = await this.getVersionedTransaction(blockhash);
      tx = await this.client.provider.wallet.signTransaction(tx);
      return await this.client.provider.connection.sendRawTransaction(
        tx.serialize(),
        opts
      );
    } catch (e) {
      console.log(e);
      throw e;
    }
  }
}
