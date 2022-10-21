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

    const proposal = await accountInitUtils.initializeProposalAccount(
      program,
      proposalNumber
    );

    const conditionalExpression =
      await accountInitUtils.initializeConditionalExpression(
        program,
        proposal,
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

    const proposal = await accountInitUtils.initializeProposalAccount(
      program,
      proposalNumber
    );

    const conditionalExpression =
      await accountInitUtils.initializeConditionalExpression(
        program,
        proposal,
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

  it("Adversary cannot redeem deposit account or empty conditional token account for underlying tokens when condition evaluates to true.", async () => {
    const proposalNumber = 38910;
    const redeemableOnPass = false;

    const proposal = await accountInitUtils.initializeProposalAccount(
      program,
      proposalNumber
    );

    const conditionalExpression =
      await accountInitUtils.initializeConditionalExpression(
        program,
        proposal,
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

    // main user sends away their conditional tokens
    const conditionalTokenBurnAccount = await token.createAccount(
      provider.connection,
      provider.wallet.payer,
      conditionalTokenMint,
      anchor.web3.Keypair.generate().publicKey
    );

    await token.transfer(
      provider.connection,
      provider.wallet.payer,
      userConditionalTokenAccount,
      conditionalTokenBurnAccount,
      provider.wallet.publicKey,
      conditionalAmountToMint
    );

    await program.methods
      .failProposal()
      .accounts({
        proposal,
      })
      .rpc();

    try {
      await utils.redeemDepositAccountForUnderlyingTokens(
        program,
        depositAccount,
        userUnderlyingTokenAccount,
        conditionalVault,
        proposal
      );
      assert.fail();
    } catch (err) {
      assert.strictEqual(err.error.errorCode.number, 6001);
      assert.strictEqual(err.error.errorMessage, "Conditional expression needs to evaluate to false before deposit accounts can be redeemed for underlying tokens");
    }

    // this should pass, but because the user's conditional token account is empty, they should get 0 underlying tokens
    await utils.redeemConditionalTokensForUnderlyingTokens(program, userConditionalTokenAccount, userUnderlyingTokenAccount, conditionalVault, proposal);

    assert.equal(
      (await token.getAccount(provider.connection, userUnderlyingTokenAccount))
        .amount,
      BigInt(underlyingAmountToMint - conditionalAmountToMint)
    );
  });

  it("Adversary cannot redeem conditional tokens when the expression evaluates to false", async () => {
    const proposalNumber = 38910;
    const redeemableOnPass = false;

    const proposal = await accountInitUtils.initializeProposalAccount(
      program,
      proposalNumber
    );

    const conditionalExpression =
      await accountInitUtils.initializeConditionalExpression(
        program,
        proposal,
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
    it("Adversary cannot redeem deposit account or empty conditional token account for underlying tokens when condition evaluates to true.", async () => {
      const proposalNumber = 38910;
      const redeemableOnPass = false;
  
      const proposal = await accountInitUtils.initializeProposalAccount(
        program,
        proposalNumber
      );
  
      const conditionalExpression =
        await accountInitUtils.initializeConditionalExpression(
          program,
          proposal,
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

      // main user sends away conditional tokens to Bob, who will try to redeem them even though expression evaluates to false
      const bob = anchor.web3.Keypair.generate();
      const bobConditionalTokenAccount = await token.createAccount(
        provider.connection,
        provider.wallet.payer,
        conditionalTokenMint,
        bob.publicKey,
      );
      const bobUnderlyingTokenAccount = await token.createAccount(
        provider.connection,
        provider.wallet.payer,
        underlyingTokenMint,
        bob.publicKey,
      )
      await token.transfer(
        provider.connection,
        provider.wallet.payer,
        userConditionalTokenAccount,
        conditionalTokenBurnAccount,
        provider.wallet.publicKey,
        conditionalAmountToMint
      );
  
      await program.methods
        .failProposal()
        .accounts({
          proposal,
        })
        .rpc();
  
      try {
        await program.methods.redeemConditionalTokensForUnderlyingTokens()
          .accounts({
            user: bob.publicKey,
            userConditionalTokenAccount: bobConditionalTokenAccount,
            userUnderlyingTokenAccount: bobUnderlyingTokenAccount,
            vaultUnderlyingTokenAccount,
            conditionalVault,
            proposal,
            tokenProgram: token.TOKEN_PROGRAM_ID,
            conditionalExpression,
            conditionalTokenMint,
          })
          .rpc();
        assert.fail();
      } catch (err) {
        assert.strictEqual(err.error.errorCode.number, 6000);
        assert.strictEqual(err.error.errorMessage, "Conditional expression needs to evaluate to true before conditional tokens can be redeemed for underlying tokens");
      }
    });
  });
});
