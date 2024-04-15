export * from "./filters";
export * from "./pda";
export * from "./numbers";
import { AccountMeta, PublicKey } from "@solana/web3.js";
export declare enum PriorityFeeTier {
    NORMAL = 35,
    HIGH = 3571,
    TURBO = 357142
}
export declare const addComputeUnits: (num_units?: number) => import("@solana/web3.js").TransactionInstruction;
export declare const addPriorityFee: (pf: number) => import("@solana/web3.js").TransactionInstruction;
export declare const pubkeyToAccountInfo: (pubkey: PublicKey, isWritable: boolean, isSigner?: boolean) => AccountMeta;
export declare function sleep(ms: number): Promise<unknown>;
