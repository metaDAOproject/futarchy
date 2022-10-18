import * as anchor from "@project-serum/anchor";
import { expect, assert } from "chai";
import * as token from "@solana/spl-token";
import { ConditionalVault } from "../target/types/conditional_vault";

type Program = anchor.Program<ConditionalVault>;
type PublicKey = anchor.web3.PublicKey;

export const mintConditionalTokens = async (
  program: Program,
  conditionalVault: PublicKey,
  amount: number,
  depositAccount: PublicKey,
  userUnderlyingTokenAccount: PublicKey,
  userConditionalTokenAccount: PublicKey
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

export const redeemDepositAccountForUnderlyingTokens = async (
  program: Program,
  userDepositAccount: PublicKey,
  userUnderlyingTokenAccount: PublicKey,
  conditionalVault: PublicKey,
  proposal: PublicKey
) => {
  const provider = program.provider;

  const storedConditionalVault = await program.account.conditionalVault.fetch(
    conditionalVault
  );
  const vaultUnderlyingTokenAccount =
    storedConditionalVault.underlyingTokenAccount;
  const conditionalExpression = storedConditionalVault.conditionalExpression;

  const preRedeemUserUnderlyingBalance = (
    await token.getAccount(provider.connection, userUnderlyingTokenAccount)
  ).amount;

  let storedDepositAccount = await program.account.depositAccount.fetch(
    userDepositAccount
  );
  const preRedeemUserDepositedAmount = storedDepositAccount.depositedAmount;

  await program.methods
    .redeemDepositAccountForUnderlyingTokens()
    .accounts({
      user: provider.wallet.publicKey,
      userDepositAccount,
      userUnderlyingTokenAccount,
      vaultUnderlyingTokenAccount,
      conditionalVault,
      proposal,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      conditionalExpression,
    })
    .rpc();

  assert.equal(
    (await token.getAccount(provider.connection, userUnderlyingTokenAccount))
      .amount,
    preRedeemUserUnderlyingBalance +
      BigInt(preRedeemUserDepositedAmount.toNumber())
  );
  // assert.equal(
  //   (await token.getAccount(provider.connection, vaultUnderlyingTokenAccount))
  //     .amount,
  //   0
  // );
  // assert.equal(
  //   (await token.getAccount(provider.connection, userConditionalTokenAccount))
  //     .amount,
  //   conditionalAmountToMint
  // ); // conditional token balance should remain the same - these tokens are now worthless

  storedDepositAccount = await program.account.depositAccount.fetch(
    userDepositAccount
  );

  assert.ok(storedDepositAccount.depositedAmount.eq(new anchor.BN(0)));

  console.log("Underlying tokens successfully redeemed after proposal pass");
};
