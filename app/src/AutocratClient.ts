import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AddressLookupTableAccount, Keypair, PublicKey } from "@solana/web3.js";

import { Autocrat } from "./types/autocrat";
const AutocratIDL: Autocrat = require("./idl/autocrat.json");
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
import {
  getAmmAddr,
  getDaoTreasuryAddr,
  getVaultAddr,
  getVaultFinalizeMintAddr,
  getVaultRevertMintAddr,
} from "./utils";
import { ConditionalVaultClient } from "./ConditionalVaultClient";
import { AmmClient } from "./AmmClient";

export type CreateClientParams = {
  provider: AnchorProvider;
  autocratProgramId?: PublicKey;
  conditionalVaultProgramId?: PublicKey;
  ammProgramId?: PublicKey;
};

export class AutocratClient {
  public readonly provider: AnchorProvider;
  public readonly autocrat: Program<Autocrat>;
  public readonly vaultClient: ConditionalVaultClient;
  public readonly ammClient: AmmClient;
  public readonly luts: AddressLookupTableAccount[];

  constructor(
    provider: AnchorProvider,
    autocratProgramId: PublicKey,
    conditionalVaultProgramId: PublicKey,
    ammProgramId: PublicKey,
    luts: AddressLookupTableAccount[]
  ) {
    this.provider = provider;
    this.autocrat = new Program<Autocrat>(
      AutocratIDL,
      autocratProgramId,
      provider
    );
    this.vaultClient = ConditionalVaultClient.createClient({
      provider,
      conditionalVaultProgramId,
    });
    this.ammClient = AmmClient.createClient({ provider, ammProgramId });
    this.luts = luts;
  }

  public static async createClient(
    createAutocratClientParams: CreateClientParams
  ): Promise<AutocratClient> {
    let {
      provider,
      autocratProgramId,
      conditionalVaultProgramId,
      ammProgramId,
    } = createAutocratClientParams;

    const luts: AddressLookupTableAccount[] = [];

    return new AutocratClient(
      provider,
      autocratProgramId || AUTOCRAT_PROGRAM_ID,
      conditionalVaultProgramId || CONDITIONAL_VAULT_PROGRAM_ID,
      ammProgramId || AMM_PROGRAM_ID,
      luts
    );
  }

  async getProposal(proposal: PublicKey) {
    return this.autocrat.account.proposal.fetch(proposal);
  }

  async getDao(dao: PublicKey) {
    return this.autocrat.account.dao.fetch(dao);
  }

  async finalizeProposal(proposal: PublicKey) {
    let storedProposal = await this.getProposal(proposal);
    let storedDao = await this.getDao(storedProposal.dao);

    return this.finalizeProposalIx(
      proposal,
      storedProposal.instruction,
      storedProposal.dao,
      storedProposal.openbookTwapPassMarket,
      storedProposal.openbookTwapFailMarket,
      storedDao.tokenMint,
      storedDao.usdcMint
    ).rpc();
  }

  finalizeProposalIx(
    proposal: PublicKey,
    instruction: any,
    dao: PublicKey,
    openbookTwapPassMarket: PublicKey,
    openbookTwapFailMarket: PublicKey,
    daoToken: PublicKey,
    usdc: PublicKey
  ) {
    let vaultProgramId = this.vaultClient.vaultProgram.programId;

    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
    const [baseVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      daoTreasury,
      daoToken,
      proposal
    );
    const [quoteVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      daoTreasury,
      usdc,
      proposal
    );

    const [passBase] = getVaultFinalizeMintAddr(vaultProgramId, baseVault);
    const [passQuote] = getVaultFinalizeMintAddr(vaultProgramId, quoteVault);

    const [failBase] = getVaultRevertMintAddr(vaultProgramId, baseVault);
    const [failQuote] = getVaultRevertMintAddr(vaultProgramId, quoteVault);

    const [passAmm] = getAmmAddr(
      this.ammClient.program.programId,
      passBase,
      passQuote,
      proposal
    );
    const [failAmm] = getAmmAddr(
      this.ammClient.program.programId,
      failBase,
      failQuote,
      proposal
    );

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
        vaultProgram: this.vaultClient.vaultProgram.programId,
        daoTreasury,
      })
      // .remainingAccounts(
      //   instruction.accounts
      //     .concat({
      //       pubkey: instruction.programId,
      //       isWritable: false,
      //       isSigner: false,
      //     })
      //     .map((meta: any) =>
      //       meta.pubkey.equals(daoTreasury)
      //         ? { ...meta, isSigner: false }
      //         : meta
      //     )
      // );
  }
}
