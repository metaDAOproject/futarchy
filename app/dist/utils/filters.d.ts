import { GetProgramAccountsFilter, PublicKey } from "@solana/web3.js";
export declare const filterPositionsByUser: (userAddr: PublicKey) => GetProgramAccountsFilter;
export declare const filterPositionsByAmm: (ammAddr: PublicKey) => GetProgramAccountsFilter;
