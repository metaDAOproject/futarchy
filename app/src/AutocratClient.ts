import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AddressLookupTableAccount, Keypair, PublicKey } from "@solana/web3.js";

import { Autocrat, IDL as AutocratIDL } from "./types/autocrat";
import {
  ConditionalVault,
  IDL as ConditionalVaultIDL,
} from "./types/conditional_vault";

import * as ixs from "./instructions/amm";
import BN from "bn.js";
import {
  AMM_PROGRAM_ID,
  AUTOCRAT_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
} from "./constants";
import { Amm, AmmWrapper } from "./types";
import { getDaoTreasuryAddr } from "./utils";

export type CreateClientParams = {
  provider: AnchorProvider;
  autocratProgramId?: PublicKey;
  conditionalVaultProgramId?: PublicKey;
};

export class AutocratClient {
  public readonly provider: AnchorProvider;
  public readonly autocrat: Program<Autocrat>;
  public readonly vault: Program<ConditionalVault>;
  public readonly luts: AddressLookupTableAccount[];

  constructor(
    provider: AnchorProvider,
    autocratProgramId: PublicKey,
    conditionalVaultProgramId: PublicKey,
    luts: AddressLookupTableAccount[]
  ) {
    this.provider = provider;
    this.autocrat = new Program<Autocrat>(
      AutocratIDL,
      autocratProgramId,
      provider
    );
    this.vault = new Program<ConditionalVault>(
      ConditionalVaultIDL,
      conditionalVaultProgramId,
      provider
    );
    this.luts = luts;
  }

  public static async createClient(
    createAutocratClientParams: CreateClientParams
  ): Promise<AutocratClient> {
    let { provider, autocratProgramId, conditionalVaultProgramId } =
      createAutocratClientParams;

    const luts: AddressLookupTableAccount[] = [];

    return new AutocratClient(
      provider,
      autocratProgramId || AUTOCRAT_PROGRAM_ID,
      conditionalVaultProgramId || CONDITIONAL_VAULT_PROGRAM_ID,
      luts
    );
  }

  finalizeProposal(
    proposal: PublicKey,
    instruction: any,
    dao: PublicKey,
    passAmm: PublicKey,
    failAmm: PublicKey,
    openbookTwapPassMarket: PublicKey,
    openbookTwapFailMarket: PublicKey,
    baseVault: PublicKey,
    quoteVault: PublicKey
  ) {
    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);

    return this.autocrat.methods
      .finalizeProposal()
      .accounts({
        proposal,
        passAmm,
        failAmm,
        openbookTwapPassMarket,
        openbookTwapFailMarket,
        dao,
        baseVault,
        quoteVault,
        vaultProgram: this.vault.programId,
        daoTreasury,
      })
      .remainingAccounts(
        instruction.accounts
          .concat({
            pubkey: instruction.programId,
            isWritable: false,
            isSigner: false,
          })
          .map((meta: any) =>
            meta.pubkey.equals(daoTreasury)
              ? { ...meta, isSigner: false }
              : meta
          )
      );
  }
}
