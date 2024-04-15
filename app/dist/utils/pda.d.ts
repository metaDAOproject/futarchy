import { PublicKey } from "@solana/web3.js";
export declare const getDaoAddr: (programId: PublicKey) => [PublicKey, number];
export declare const getDaoTreasuryAddr: (programId: PublicKey) => [PublicKey, number];
export declare const getProposalAddr: (programId: PublicKey, proposalNumber: number) => [PublicKey, number];
export declare const getProposalInstructionsAddr: (programId: PublicKey, proposal: PublicKey) => [PublicKey, number];
export declare const getProposalVaultAddr: (programId: PublicKey, proposal: PublicKey) => [PublicKey, number];
export declare const getAmmAddr: (programId: PublicKey, baseMint: PublicKey, quoteMint: PublicKey) => [PublicKey, number];
export declare const getAmmPositionAddr: (programId: PublicKey, amm: PublicKey, user: PublicKey) => [PublicKey, number];
export declare const getAmmAuthAddr: (programId: PublicKey) => [PublicKey, number];
export declare const getATA: (mint: PublicKey, owner: PublicKey) => [PublicKey, number];