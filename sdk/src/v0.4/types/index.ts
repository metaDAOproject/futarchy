import { Autocrat as AutocratProgram, IDL as AutocratIDL } from "./autocrat.js";
export { AutocratProgram, AutocratIDL };

import { Amm as AmmProgram, IDL as AmmIDL } from "./amm.js";
export { AmmProgram, AmmIDL };

import {
  ConditionalVault as ConditionalVaultProgram,
  IDL as ConditionalVaultIDL,
} from "./conditional_vault.js";
export { ConditionalVaultProgram, ConditionalVaultIDL };

export { LowercaseKeys } from "./utils.js";

import type { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export type Question = IdlAccounts<ConditionalVaultProgram>["question"];
export type ConditionalVault =
  IdlAccounts<ConditionalVaultProgram>["conditionalVault"];

export type InitializeDaoParams =
  IdlTypes<AutocratProgram>["InitializeDaoParams"];
export type UpdateDaoParams = IdlTypes<AutocratProgram>["UpdateDaoParams"];
export type ProposalInstruction =
  IdlTypes<AutocratProgram>["ProposalInstruction"];

export type Dao = IdlAccounts<AutocratProgram>["dao"];
export type Proposal = IdlAccounts<AutocratProgram>["proposal"];
export type Amm = IdlAccounts<AmmProgram>["amm"];
