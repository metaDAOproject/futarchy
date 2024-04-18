import { AddressLookupTableAccount, Blockhash, ConfirmOptions, Keypair, Signer, TransactionInstruction, VersionedTransaction } from "@solana/web3.js";
import { BanksClient } from "solana-bankrun";
import { AnchorProvider } from "@coral-xyz/anchor";
export type SignerOrKeypair = Signer | Keypair;
interface Client<ProgramType> {
    provider: AnchorProvider;
    program: ProgramType;
    luts: AddressLookupTableAccount[];
}
export declare class InstructionHandler<ProgramType, Type extends Client<ProgramType> = Client<ProgramType>> {
    instructions: TransactionInstruction[];
    signers: Set<SignerOrKeypair>;
    client: Type;
    computeUnits: number;
    microLamportsPerComputeUnit: number;
    preInstructions: TransactionInstruction[];
    postInstructions: TransactionInstruction[];
    constructor(instructions: TransactionInstruction[], signers: SignerOrKeypair[], client: Type);
    addPreInstructions(instructions: TransactionInstruction[], signers?: SignerOrKeypair[]): InstructionHandler<ProgramType, Type>;
    addPostInstructions(instructions: TransactionInstruction[], signers?: SignerOrKeypair[]): InstructionHandler<ProgramType, Type>;
    getVersionedTransaction(blockhash: Blockhash): Promise<VersionedTransaction>;
    setComputeUnits(computeUnits: number): InstructionHandler<ProgramType, Type>;
    setPriorityFee(microLamportsPerComputeUnit: number): InstructionHandler<ProgramType, Type>;
    bankrun(banksClient: BanksClient): Promise<import("solana-bankrun").BanksTransactionMeta>;
    rpc(opts?: ConfirmOptions): Promise<string>;
}
export {};
