import { Autocrat } from "./autocrat";
export { Autocrat, IDL as AutocratIDL } from "./autocrat";

import { Amm } from "./amm";
export { Amm, IDL as AmmIDL } from "./amm";

import { ConditionalVault } from "./conditional_vault";
export {
  ConditionalVault,
  IDL as ConditionalVaultIDL,
} from "./conditional_vault";

export { LowercaseKeys } from "./utils";

import type { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Timelock } from "./timelock";

export type InitializeDaoParams = IdlTypes<Autocrat>["InitializeDaoParams"];
export type UpdateDaoParams = IdlTypes<Autocrat>["UpdateDaoParams"];
export type ProposalInstruction = IdlTypes<Autocrat>["ProposalInstruction"];

export type Proposal = IdlAccounts<Autocrat>["proposal"];
export type ProposalWrapper = {
  account: Proposal;
  publicKey: PublicKey;
};

export type DaoAccount = IdlAccounts<Autocrat>["dao"];
export type ProposalAccount = IdlAccounts<Autocrat>["proposal"];

export type AmmAccount = IdlAccounts<Amm>["amm"];

export type ConditionalVaultAccount =
  IdlAccounts<ConditionalVault>["conditionalVault"];

export type TimelockAccount = IdlAccounts<Timelock>["timelock"];
export type transactionBatchAccount = IdlAccounts<Timelock>["transactionBatch"];
