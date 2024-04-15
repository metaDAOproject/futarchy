import { Autocrat as AutocratIDLType } from './autocrat';
import { Amm as AmmIDLType } from './amm';

import type { IdlAccounts, IdlTypes } from "@coral-xyz/anchor";
import { PublicKey } from '@solana/web3.js';

export type UpdateDaoParams = IdlTypes<AutocratIDLType>['UpdateDaoParams'];
export type ProposalInstruction = IdlTypes<AutocratIDLType>['ProposalInstruction'];

export type Proposal = IdlAccounts<AutocratIDLType>['proposal'];
export type ProposalWrapper = {
    account: Proposal,
    publicKey: PublicKey
}

export type ProposalVault = IdlAccounts<AutocratIDLType>['proposalVault'];
export type ProposalInstructions = IdlAccounts<AutocratIDLType>['proposalInstructions'];

export type Dao = IdlAccounts<AutocratIDLType>['dao'];
export type DaoTreasury = IdlAccounts<AutocratIDLType>['daoTreasury'];

export type Amm = IdlAccounts<AmmIDLType>['amm'];
export type AmmWrapper = {
    account: Amm,
    publicKey: PublicKey
}

export type AmmPosition = IdlAccounts<AmmIDLType>['ammPosition'];
export type AmmPositionWrapper = {
    account: AmmPosition,
    publicKey: PublicKey
}