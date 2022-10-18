import * as anchor from "@project-serum/anchor";
import { expect, assert } from "chai";
import * as token from "@solana/spl-token";
import { ConditionalVault } from "../target/types/conditional_vault";

export const mintConditionalTokens = async (
  program: anchor.Program<ConditionalVault>,
  conditionalVault: anchor.web3.PublicKey,
  amount: number,
  depositAccount: anchor.web3.PublicKey,
  userUnderlyingTokenAccount: anchor.web3.PublicKey,
  userConditionalTokenAccount: anchor.web3.PublicKey
) => {
  const provider = program.provider;
  const storedConditionalVault = await program.account.conditionalVault.fetch(
    conditionalVault
  );
  const conditionalTokenMint = storedConditionalVault.conditionalTokenMint;
  const vaultUnderlyingTokenAccount =
    storedConditionalVault.underlyingTokenAccount;

  const preMintUserUnderlyingBalance = (
    await token.getAccount(provider.connection, userUnderlyingTokenAccount)
  ).amount;
  const preMintVaultUnderlyingBalance = (
    await token.getAccount(provider.connection, vaultUnderlyingTokenAccount)
  ).amount;
  const preMintUserConditionalBalance = (
    await token.getAccount(provider.connection, userConditionalTokenAccount)
  ).amount;

  let storedDepositAccount = await program.account.depositAccount.fetch(
    depositAccount
  );
  const preMintDepositAmount = storedDepositAccount.depositedAmount;

  await program.methods
    .mintConditionalTokens(new anchor.BN(amount))
    .accounts({
      conditionalVault,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      conditionalTokenMint,
      user: provider.wallet.publicKey,
      depositAccount,
      vaultUnderlyingTokenAccount,
      userUnderlyingTokenAccount,
      userConditionalTokenAccount,
    })
    .rpc();

  assert.equal(
    (await token.getAccount(provider.connection, userUnderlyingTokenAccount))
      .amount,
    preMintUserUnderlyingBalance - BigInt(amount)
  );

  assert.equal(
    (await token.getAccount(provider.connection, vaultUnderlyingTokenAccount))
      .amount,
    preMintVaultUnderlyingBalance + BigInt(amount)
  );
  assert.equal(
    (await token.getAccount(provider.connection, userConditionalTokenAccount))
      .amount,
    preMintUserConditionalBalance + BigInt(amount)
  );

  storedDepositAccount = await program.account.depositAccount.fetch(
    depositAccount
  );

  // these should remain the same
  assert.ok(storedDepositAccount.conditionalVault.equals(conditionalVault));
  assert.ok(storedDepositAccount.depositor.equals(provider.wallet.publicKey));
  // this should increase
  assert.ok(
    storedDepositAccount.depositedAmount.eq(
      preMintDepositAmount.add(new anchor.BN(amount))
    )
  );

  console.log("Conditional token account successfully credited after deposit.");
};

type Program = anchor.Program<ConditionalVault>;
type PublicKey = anchor.web3.PublicKey;

export const redeemConditionalTokensForUnderlyingTokens = async (
  program: Program,
  userConditionalTokenAccount: PublicKey,
  userUnderlyingTokenAccount: PublicKey,
  conditionalVault: PublicKey,
  proposal: PublicKey
) => {
  const provider = program.provider;

  const storedConditionalVault = await program.account.conditionalVault.fetch(
    conditionalVault
  );
  const conditionalTokenMint = storedConditionalVault.conditionalTokenMint;
  const vaultUnderlyingTokenAccount =
    storedConditionalVault.underlyingTokenAccount;
  const conditionalExpression = storedConditionalVault.conditionalExpression;

  const preMintUserConditionalBalance = (
    await token.getAccount(provider.connection, userConditionalTokenAccount)
  ).amount;
  const preMintUserUnderlyingBalance = (
    await token.getAccount(provider.connection, userUnderlyingTokenAccount)
  ).amount;

  await program.methods
    .redeemConditionalTokensForUnderlyingTokens()
    .accounts({
      user: provider.wallet.publicKey,
      userConditionalTokenAccount,
      userUnderlyingTokenAccount,
      vaultUnderlyingTokenAccount,
      conditionalVault,
      proposal,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      conditionalExpression,
      conditionalTokenMint,
    })
    .rpc();

  assert.equal(
    (await token.getAccount(provider.connection, userUnderlyingTokenAccount))
      .amount,
    preMintUserConditionalBalance + preMintUserUnderlyingBalance
  );
  assert.equal(
    (await token.getAccount(provider.connection, vaultUnderlyingTokenAccount))
      .amount,
    BigInt(0)
  );
  assert.equal(
    (await token.getAccount(provider.connection, userConditionalTokenAccount))
      .amount,
    BigInt(0)
  );

  console.log("Underlying tokens successfully redeemed after proposal pass");
};
