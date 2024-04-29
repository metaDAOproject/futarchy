import { Autocrat as AutocratIDLType } from "./autocrat";
import { Amm as AmmIDLType } from "./amm";

import type { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export type InitializeDaoParams =
  IdlTypes<AutocratIDLType>["InitializeDaoParams"];
export type UpdateDaoParams = IdlTypes<AutocratIDLType>["UpdateDaoParams"];
export type ProposalInstruction =
  IdlTypes<AutocratIDLType>["ProposalInstruction"];

export type Proposal = IdlAccounts<AutocratIDLType>["proposal"];
export type ProposalWrapper = {
  account: Proposal;
  publicKey: PublicKey;
};

export type Dao = IdlAccounts<AutocratIDLType>["dao"];

export type Amm = IdlAccounts<AmmIDLType>["amm"];
