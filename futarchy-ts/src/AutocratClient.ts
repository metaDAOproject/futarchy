import { AnchorProvider, IdlTypes, Program } from "@coral-xyz/anchor";
import {
  AccountMeta,
  AddressLookupTableAccount,
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { PriceMath } from "./utils/priceMath";
import { ProposalInstruction, InitializeDaoParams } from "./types";

import { Autocrat, IDL as AutocratIDL } from "./types/autocrat";
import {
  ConditionalVault,
  IDL as ConditionalVaultIDL,
} from "./types/conditional_vault";

import BN from "bn.js";
import {
  AMM_PROGRAM_ID,
  AUTOCRAT_PROGRAM_ID,
  CONDITIONAL_VAULT_PROGRAM_ID,
  MAINNET_USDC,
  USDC_DECIMALS,
} from "./constants";
import {
  getATA,
  getAmmAddr,
  getAmmLpMintAddr,
  getDaoTreasuryAddr,
  getVaultAddr,
  getVaultFinalizeMintAddr,
  getVaultRevertMintAddr,
} from "./utils";
import { ConditionalVaultClient } from "./ConditionalVaultClient";
import { AmmClient } from "./AmmClient";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  unpackMint,
} from "@solana/spl-token";

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

  public static createClient(
    createAutocratClientParams: CreateClientParams
  ): AutocratClient {
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
    passLp: PublicKey;
    failLp: PublicKey;
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
    const [passQuoteMint] = getVaultFinalizeMintAddr(
      vaultProgramId,
      quoteVault
    );

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

    const [passLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      passAmm
    );
    const [failLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      failAmm
    );

    return {
      baseVault,
      quoteVault,
      passBaseMint,
      passQuoteMint,
      failBaseMint,
      failQuoteMint,
      passAmm,
      failAmm,
      passLp,
      failLp,
    };
  }

  async initializeDao(
    tokenMint: PublicKey,
    tokenPriceUiAmount: number,
    minBaseFutarchicLiquidity: number,
    minQuoteFutarchicLiquidity: number,
    usdcMint: PublicKey = MAINNET_USDC,
    daoKeypair: Keypair = Keypair.generate()
  ): Promise<PublicKey> {
    let tokenDecimals = unpackMint(
      tokenMint,
      await this.provider.connection.getAccountInfo(tokenMint)
    ).decimals;

    let scaledPrice = PriceMath.getAmmPrice(
      tokenPriceUiAmount,
      tokenDecimals,
      USDC_DECIMALS
    );

    console.log(
      PriceMath.getHumanPrice(scaledPrice, tokenDecimals, USDC_DECIMALS)
    );

    await this.initializeDaoIx(
      daoKeypair,
      tokenMint,
      {
        twapInitialObservation: scaledPrice,
        twapMaxObservationChangePerUpdate: scaledPrice.divn(50),
        minQuoteFutarchicLiquidity: new BN(minQuoteFutarchicLiquidity).mul(
          new BN(10).pow(new BN(USDC_DECIMALS))
        ),
        minBaseFutarchicLiquidity: new BN(minBaseFutarchicLiquidity).mul(
          new BN(10).pow(new BN(tokenDecimals))
        ),
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
    instruction: ProposalInstruction,
    baseTokensToLP: BN,
    quoteTokensToLP: BN
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

    // await this.vaultClient.mintConditionalTokens(baseVault, 10);
    // await this.vaultClient.mintConditionalTokens(quoteVault, 10_000);
    await this.vaultClient
      .mintConditionalTokensIx(baseVault, storedDao.tokenMint, baseTokensToLP)
      .rpc();
    await this.vaultClient
      .mintConditionalTokensIx(quoteVault, storedDao.usdcMint, quoteTokensToLP)
      .rpc();

    const [passBase] = getVaultFinalizeMintAddr(vaultProgramId, baseVault);
    const [passQuote] = getVaultFinalizeMintAddr(vaultProgramId, quoteVault);
    const [passAmm] = getAmmAddr(
      this.ammClient.program.programId,
      passBase,
      passQuote,
      proposal
    );

    const [failBase] = getVaultRevertMintAddr(vaultProgramId, baseVault);
    const [failQuote] = getVaultRevertMintAddr(vaultProgramId, quoteVault);
    const [failAmm] = getAmmAddr(
      this.ammClient.program.programId,
      failBase,
      failQuote,
      proposal
    );

    let tx = await this.ammClient
      .createAmmIx(
        passBase,
        passQuote,
        storedDao.twapInitialObservation,
        storedDao.twapMaxObservationChangePerUpdate,
        proposal
      )
      .postInstructions([
        await this.ammClient
          .addLiquidityIx(
            passAmm,
            passBase,
            passQuote,
            quoteTokensToLP,
            baseTokensToLP,
            new BN(0)
          )
          .instruction(),
        await this.ammClient
          .createAmmIx(
            failBase,
            failQuote,
            storedDao.twapInitialObservation,
            storedDao.twapMaxObservationChangePerUpdate,
            proposal
          )
          .instruction(),
        await this.ammClient
          .addLiquidityIx(
            failAmm,
            failBase,
            failQuote,
            quoteTokensToLP,
            baseTokensToLP,
            new BN(0)
          )
          .instruction(),
      ])
      .rpc();

    //   tx.feePayer = this.provider.publicKey;
    // let blockhash = await this.provider.connection.banksClient.getLatestBlockhash();
    // [tx.recentBlockhash] = blockhash;
    // console.log(tx);
    // let msg = tx.compileMessage();
    // console.log(msg.serialize().length);

    // return;
    // .rpc();

    // .rpc();

    // .rpc();

    // this is how many original tokens are created
    const lpTokens = quoteTokensToLP;

    // let tx = await this.initializeProposalIx(
    //   proposalKP,
    //   descriptionUrl,
    //   instruction,
    //   dao,
    //   storedDao.tokenMint,
    //   storedDao.usdcMint,
    //   lpTokens,
    //   lpTokens
    // )
    //   .preInstructions([
    //     await this.autocrat.account.proposal.createInstruction(
    //       proposalKP,
    //       2500
    //     ),
    //   ])
    //   .transaction();

    // tx.feePayer = this.provider.publicKey;
    // console.log(await this.provider.connection.banksClient.getLatestBlockhash());
    // let blockhash = await this.provider.connection.banksClient.getLatestBlockhash();
    // [tx.recentBlockhash] = blockhash;
    // let msg = tx.compileMessage();
    // console.log(msg.serialize().length);
    // console.log(msg.recentBlockhash = );
    // Connection

    // console.log(tx.feePayer = payer.publicKey);

    await this.initializeProposalIx(
      proposalKP,
      descriptionUrl,
      instruction,
      dao,
      storedDao.tokenMint,
      storedDao.usdcMint,
      lpTokens,
      lpTokens
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
    quoteMint: PublicKey,
    passLpTokensToLock: BN,
    failLpTokensToLock: BN
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

    const [passLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      passAmm
    );
    const [failLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      failAmm
    );

    const passLpVaultAccount = getATA(passLp, daoTreasury)[0];
    const failLpVaultAccount = getATA(failLp, daoTreasury)[0];

    return (
      this.autocrat.methods
        .initializeProposal({
          descriptionUrl,
          instruction,
          passLpTokensToLock,
          failLpTokensToLock,
        })
        // .preInstructions([
        //   await this.autocrat.account.proposal.createInstruction(proposalKeypair, 2500),
        // ])
        .accounts({
          proposal: proposalKeypair.publicKey,
          dao,
          baseVault,
          quoteVault,
          passAmm,
          failAmm,
          passLpMint: passLp,
          failLpMint: failLp,
          passLpUserAccount: getATA(passLp, this.provider.publicKey)[0],
          failLpUserAccount: getATA(failLp, this.provider.publicKey)[0],
          passLpVaultAccount,
          failLpVaultAccount,
          proposer: this.provider.publicKey,
        })
        .preInstructions([
          createAssociatedTokenAccountIdempotentInstruction(
            this.provider.publicKey,
            passLpVaultAccount,
            daoTreasury,
            passLp
          ),
          createAssociatedTokenAccountIdempotentInstruction(
            this.provider.publicKey,
            failLpVaultAccount,
            daoTreasury,
            failLp
          ),
        ])
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

    const [passLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      passAmm
    );
    const [failLp] = getAmmLpMintAddr(
      this.ammClient.program.programId,
      failAmm
    );

    return this.autocrat.methods.finalizeProposal().accounts({
      proposal,
      passAmm,
      failAmm,
      dao,
      baseVault,
      quoteVault,
      passLpUserAccount: getATA(passLp, this.provider.publicKey)[0],
      failLpUserAccount: getATA(failLp, this.provider.publicKey)[0],
      passLpVaultAccount: getATA(passLp, daoTreasury)[0],
      failLpVaultAccount: getATA(failLp, daoTreasury)[0],
      vaultProgram: this.vaultClient.vaultProgram.programId,
      treasury: daoTreasury,
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
        // daoTreasury,
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
