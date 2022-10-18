import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { ConditionalVault } from "../target/types/conditional_vault";
import { expect, assert } from "chai";
import * as token from "@solana/spl-token";
import * as accountInitUtils from "./accountInitializationUtils";
import {
  generateConditionalVaultPDAAddress,
  generateDepositAccountPDAAddress,
  generateConditionalExpressionPDAAddress,
} from "./pdaGenerationUtils";
import * as utils from "./utils";

describe("Conditional vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .ConditionalVault as Program<ConditionalVault>;

  it("Flow #1 - user mints, condition evalutes to true, user redeems conditional tokens", async () => {
    const proposalNumber = 324;
    const redeemableOnPass = true;

    const conditionalExpression =
      await accountInitUtils.initializeConditionalExpression(
        program,
        proposalNumber,
        redeemableOnPass
      );

    const [underlyingTokenMint, underlyingTokenMintAuthority] =
      await accountInitUtils.initializeUnderlyingTokenMint(provider);

    const [
      conditionalVault,
      conditionalTokenMint,
      vaultUnderlyingTokenAccount,
    ] = await accountInitUtils.initializeConditionalVault(
      program,
      conditionalExpression,
      underlyingTokenMint
    );

    const depositAccount = await accountInitUtils.initializeDepositAccount(
      program,
      conditionalVault
    );

    const userUnderlyingTokenAccount = await token.createAccount(
      provider.connection,
      provider.wallet.payer,
      underlyingTokenMint,
      provider.wallet.publicKey
    );

    const underlyingAmountToMint = 1000;
    const conditionalAmountToMint = 400;

    await token.mintTo(
      provider.connection,
      provider.wallet.payer,
      underlyingTokenMint,
      userUnderlyingTokenAccount,
      underlyingTokenMintAuthority,
      underlyingAmountToMint
    );

    const userConditionalTokenAccount = await token.createAccount(
      provider.connection,
      provider.wallet.payer,
      conditionalTokenMint,
      provider.wallet.publicKey
    );

    await utils.mintConditionalTokens(
      program,
      conditionalVault,
      conditionalAmountToMint,
      depositAccount,
      userUnderlyingTokenAccount,
      userConditionalTokenAccount
    );

    const proposal = await accountInitUtils.initializeProposalAccount(
      program,
      proposalNumber
    );

    await program.methods
      .passProposal()
      .accounts({
        proposal,
      })
      .rpc();

    await utils.redeemConditionalTokensForUnderlyingTokens(
      program,
      userConditionalTokenAccount,
      userUnderlyingTokenAccount,
      conditionalVault,
      proposal
    );
  });

  it("Flow #2 - user mints, condition evaluates to false, user redeems deposit account", async () => {
    const proposalNumber = 0;
    const redeemableOnPass = false;

    const conditionalExpression =
      await accountInitUtils.initializeConditionalExpression(
        program,
        proposalNumber,
        redeemableOnPass
      );

    const [underlyingTokenMint, underlyingTokenMintAuthority] =
      await accountInitUtils.initializeUnderlyingTokenMint(provider);

    const [
      conditionalVault,
      conditionalTokenMint,
      vaultUnderlyingTokenAccount,
    ] = await accountInitUtils.initializeConditionalVault(
      program,
      conditionalExpression,
      underlyingTokenMint
    );

    const depositAccount = await accountInitUtils.initializeDepositAccount(
      program,
      conditionalVault
    );

    const userUnderlyingTokenAccount = await token.createAccount(
      provider.connection,
      provider.wallet.payer,
      underlyingTokenMint,
      provider.wallet.publicKey
    );

    const underlyingAmountToMint = 1000;
    const conditionalAmountToMint = 400;

    await token.mintTo(
      provider.connection,
      provider.wallet.payer,
      underlyingTokenMint,
      userUnderlyingTokenAccount,
      underlyingTokenMintAuthority,
      underlyingAmountToMint
    );

    const userConditionalTokenAccount = await token.createAccount(
      provider.connection,
      provider.wallet.payer,
      conditionalTokenMint,
      provider.wallet.publicKey
    );

    await utils.mintConditionalTokens(
      program,
      conditionalVault,
      conditionalAmountToMint,
      depositAccount,
      userUnderlyingTokenAccount,
      userConditionalTokenAccount
    );

    const proposal = await accountInitUtils.initializeProposalAccount(
      program,
      proposalNumber
    );

    await program.methods
      .passProposal()
      .accounts({
        proposal,
      })
      .rpc();

    await utils.redeemDepositAccountForUnderlyingTokens(
      program,
      depositAccount,
      userUnderlyingTokenAccount,
      conditionalVault,
      proposal
    );
  });
});
