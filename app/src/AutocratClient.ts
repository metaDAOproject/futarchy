import { AnchorProvider, IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountMeta,
  AddressLookupTableAccount,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { PriceMath } from "./utils/priceMath";

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
  MAINNET_USDC,
  USDC_DECIMALS,
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

export type ProposalInstruction = IdlTypes<Autocrat>["ProposalInstruction"];
export type InitializeDaoParams = IdlTypes<Autocrat>["InitializeDaoParams"];

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

  getProposalPdas(
    proposal: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    dao: PublicKey
  ): {
    baseVault: PublicKey;
    quoteVault: PublicKey;
    passBaseMint: PublicKey;
    passQuoteMint: PublicKey;
    failBaseMint: PublicKey;
    failQuoteMint: PublicKey;
    passAmm: PublicKey;
    failAmm: PublicKey;
  } {
    let vaultProgramId = this.vaultClient.vaultProgram.programId;
    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
    const [baseVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      daoTreasury,
      baseMint,
      proposal
    );
    const [quoteVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      daoTreasury,
      quoteMint,
      proposal
    );

    const [passBaseMint] = getVaultFinalizeMintAddr(vaultProgramId, baseVault);
    const [passQuoteMint] = getVaultFinalizeMintAddr(vaultProgramId, quoteVault);

    const [failBaseMint] = getVaultRevertMintAddr(vaultProgramId, baseVault);
    const [failQuoteMint] = getVaultRevertMintAddr(vaultProgramId, quoteVault);

    const [passAmm] = getAmmAddr(
      this.ammClient.program.programId,
      passBaseMint,
      passQuoteMint,
      proposal
    );
    const [failAmm] = getAmmAddr(
      this.ammClient.program.programId,
      failBaseMint,
      failQuoteMint,
      proposal
    );

    return {
      baseVault,
      quoteVault,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      passAmm,
      failAmm
    };
  }

  async initializeDao(
    tokenMint: PublicKey,
    tokenPriceUiAmount: number,
    tokenDecimals: number,
    minBaseFutarchicLiquidity: BN,
    minQuoteFutarchicLiquidity: BN,
    usdcMint: PublicKey = MAINNET_USDC,
    daoKeypair: Keypair = Keypair.generate()
  ): Promise<PublicKey> {
    let scaledPrice = PriceMath.getAmmPrice(tokenPriceUiAmount, tokenDecimals, USDC_DECIMALS);

    console.log(PriceMath.getHumanPrice(scaledPrice, tokenDecimals, USDC_DECIMALS));

    await this.initializeDaoIx(
      daoKeypair,
      tokenMint,
      {
        twapInitialObservation: scaledPrice,
        twapMaxObservationChangePerUpdate: scaledPrice.divn(50),
        minBaseFutarchicLiquidity,
        minQuoteFutarchicLiquidity,
        passThresholdBps: null,
        slotsPerProposal: null,
      },
      usdcMint
    ).rpc();

    return daoKeypair.publicKey;
  }

  initializeDaoIx(
    daoKeypair: Keypair,
    tokenMint: PublicKey,
    params: InitializeDaoParams,
    usdcMint: PublicKey = MAINNET_USDC
  ) {
    return this.autocrat.methods
      .initializeDao(params)
      .accounts({
        dao: daoKeypair.publicKey,
        tokenMint,
        usdcMint,
      })
      .signers([daoKeypair]);
  }

  async initializeProposal(
    dao: PublicKey,
    descriptionUrl: string,
    instruction: ProposalInstruction
  ): Promise<PublicKey> {
    let vaultProgramId = this.vaultClient.vaultProgram.programId;
    const proposalKP = Keypair.generate();
    const proposal = proposalKP.publicKey;

    const storedDao = await this.getDao(dao);
    const daoTreasury = storedDao.treasury;

    await this.vaultClient
      .initializeVaultIx(storedDao.treasury, storedDao.tokenMint, proposal)
      .rpc();
    await this.vaultClient
      .initializeVaultIx(storedDao.treasury, storedDao.usdcMint, proposal)
      .rpc();
    const [baseVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      daoTreasury,
      storedDao.tokenMint,
      proposal
    );
    const [quoteVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      daoTreasury,
      storedDao.usdcMint,
      proposal
    );

    await this.vaultClient.mintConditionalTokens(baseVault, 10);
    await this.vaultClient.mintConditionalTokens(quoteVault, 10_000);

    const [passBase] = getVaultFinalizeMintAddr(vaultProgramId, baseVault);
    const [passQuote] = getVaultFinalizeMintAddr(vaultProgramId, quoteVault);

    const [failBase] = getVaultRevertMintAddr(vaultProgramId, baseVault);
    const [failQuote] = getVaultRevertMintAddr(vaultProgramId, quoteVault);

    await this.ammClient
      .createAmm(
        passBase,
        passQuote,
        storedDao.twapInitialObservation,
        storedDao.twapMaxObservationChangePerUpdate,
        proposal
      )
      .rpc();

    await this.ammClient
      .createAmm(
        failBase,
        failQuote,
        storedDao.twapInitialObservation,
        storedDao.twapMaxObservationChangePerUpdate,
        proposal
      )
      .rpc();

    await this.initializeProposalIx(
      proposalKP,
      descriptionUrl,
      instruction,
      dao,
      storedDao.tokenMint,
      storedDao.usdcMint
    )
      .preInstructions([
        await this.autocrat.account.proposal.createInstruction(
          proposalKP,
          2500
        ),
      ])
      .rpc();

    return proposal;
  }

  initializeProposalIx(
    proposalKeypair: Keypair,
    descriptionUrl: string,
    instruction: ProposalInstruction,
    dao: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey
  ) {
    let vaultProgramId = this.vaultClient.vaultProgram.programId;
    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
    const [baseVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      daoTreasury,
      baseMint,
      proposalKeypair.publicKey
    );
    const [quoteVault] = getVaultAddr(
      this.vaultClient.vaultProgram.programId,
      daoTreasury,
      quoteMint,
      proposalKeypair.publicKey
    );

    const [passBase] = getVaultFinalizeMintAddr(vaultProgramId, baseVault);
    const [passQuote] = getVaultFinalizeMintAddr(vaultProgramId, quoteVault);

    const [failBase] = getVaultRevertMintAddr(vaultProgramId, baseVault);
    const [failQuote] = getVaultRevertMintAddr(vaultProgramId, quoteVault);

    const [passAmm] = getAmmAddr(
      this.ammClient.program.programId,
      passBase,
      passQuote,
      proposalKeypair.publicKey
    );
    const [failAmm] = getAmmAddr(
      this.ammClient.program.programId,
      failBase,
      failQuote,
      proposalKeypair.publicKey
    );

    return (
      this.autocrat.methods
        .initializeProposal(descriptionUrl, instruction)
        // .preInstructions([
        //   await this.autocrat.account.proposal.createInstruction(proposalKeypair, 2500),
        // ])
        .accounts({
          proposal: proposalKeypair.publicKey,
          dao,
          daoTreasury,
          baseVault,
          quoteVault,
          passAmm,
          failAmm,
          proposer: this.provider.publicKey,
        })
        .signers([proposalKeypair])
    );
  }

  async finalizeProposal(proposal: PublicKey) {
    let storedProposal = await this.getProposal(proposal);
    let storedDao = await this.getDao(storedProposal.dao);

    return this.finalizeProposalIx(
      proposal,
      storedProposal.instruction,
      storedProposal.dao,
      storedDao.tokenMint,
      storedDao.usdcMint
    ).rpc();
  }

  finalizeProposalIx(
    proposal: PublicKey,
    instruction: any,
    dao: PublicKey,
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

    return this.autocrat.methods.finalizeProposal().accounts({
      proposal,
      passAmm,
      failAmm,
      dao,
      baseVault,
      quoteVault,
      vaultProgram: this.vaultClient.vaultProgram.programId,
      daoTreasury,
    });
  }

  async executeProposal(proposal: PublicKey) {
    let storedProposal = await this.getProposal(proposal);

    return this.executeProposalIx(
      proposal,
      storedProposal.dao,
      storedProposal.instruction
    ).rpc();
  }

  executeProposalIx(proposal: PublicKey, dao: PublicKey, instruction: any) {
    const [daoTreasury] = getDaoTreasuryAddr(this.autocrat.programId, dao);
    return this.autocrat.methods
      .executeProposal()
      .accounts({
        proposal,
        dao,
        daoTreasury,
      })
      .remainingAccounts(
        instruction.accounts
          .concat({
            pubkey: instruction.programId,
            isWritable: false,
            isSigner: false,
          })
          .map((meta: AccountMeta) =>
            meta.pubkey.equals(daoTreasury)
              ? { ...meta, isSigner: false }
              : meta
          )
      );
  }

}
