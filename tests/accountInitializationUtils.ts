import * as anchor from "@project-serum/anchor";
import { expect, assert } from "chai";
import * as pdaGenUtils from "./pdaGenerationUtils";
import * as token from "@solana/spl-token";
import {Program} from "./metaDAO";

export async function initializeMetaDAO(
  program: Program
) {
  const metaDAOAccount = await pdaGenUtils.generateMetaDAOPDAAddress(program);

  await program.methods.initializeMetaDao()
    .accounts({
      metaDao: metaDAOAccount,
      initializer: program.provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  const storedMetaDAO =
    await program.account.metaDao.fetch(
      metaDAOAccount
    );

  assert.equal(storedMetaDAO.members.length, 0);

  return metaDAOAccount;
}

export async function initializeMemberDAO(
  program: Program,
  name: string,
) {
  const memberDAOAccount = await pdaGenUtils.generateMemberDAOPDAAddress(program, name);

  await program.methods.initializeMemberDao(name)
    .accounts({
      memberDao: memberDAOAccount,
      initializer: program.provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  const storedMemberDAO =
    await program.account.memberDao.fetch(
      memberDAOAccount
    );
  
  assert.equal(storedMemberDAO.name, name);

  return memberDAOAccount;
}

export async function initializeConditionalExpression(
  program: Program,
  proposal: anchor.web3.PublicKey,
  redeemableOnPass: boolean
) {
  const conditionalExpressionAccount =
    await pdaGenUtils.generateConditionalExpressionPDAAddress(
      program,
      proposal,
      redeemableOnPass
    );

  await program.methods
    .initializeConditionalExpression(redeemableOnPass)
    .accounts({
      conditionalExpression: conditionalExpressionAccount,
      initializer: program.provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
      proposal,
    })
    .rpc();

  const storedConditionalExpression =
    await program.account.conditionalExpression.fetch(
      conditionalExpressionAccount
    );

  assert.ok(storedConditionalExpression.proposal.equals(proposal));
  assert.equal(storedConditionalExpression.passOrFailFlag, redeemableOnPass);

  // console.log("Conditional expression successfully initialized.");

  return conditionalExpressionAccount;
}

export const initializeUnderlyingTokenMint = async (
  provider: anchor.Provider
) => {
  const underlyingTokenMintAuthority = anchor.web3.Keypair.generate();

  const underlyingTokenMint = await token.createMint(
    provider.connection,
    provider.wallet.payer,
    underlyingTokenMintAuthority.publicKey,
    null,
    2
  );

  return [underlyingTokenMint, underlyingTokenMintAuthority];
};

export const initializeConditionalVault = async (
  program: Program,
  conditionalExpression: anchor.web3.PublicKey,
  underlyingTokenMint: anchor.web3.PublicKey
) => {
  const provider = program.provider;

  const conditionalVault = await pdaGenUtils.generateConditionalVaultPDAAddress(
    program,
    conditionalExpression,
    underlyingTokenMint
  );

  const conditionalTokenMint = await token.createMint(
    provider.connection,
    provider.wallet.payer,
    conditionalVault, // mint authority
    null,
    2
  );

  const vaultUnderlyingTokenAccount = (
    await token.getOrCreateAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      underlyingTokenMint,
      conditionalVault,
      true
    )
  ).address;

  await program.methods
    .initializeConditionalVault()
    .accounts({
      conditionalVault,
      conditionalExpression,
      underlyingTokenMint,
      conditionalTokenMint: conditionalTokenMint,
      vaultUnderlyingTokenAccount: vaultUnderlyingTokenAccount,
      initializer: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  const storedConditionalVault = await program.account.conditionalVault.fetch(
    conditionalVault
  );

  assert.ok(
    storedConditionalVault.conditionalExpression.equals(conditionalExpression)
  );
  assert.ok(
    storedConditionalVault.underlyingTokenAccount.equals(
      vaultUnderlyingTokenAccount
    )
  );
  assert.ok(
    storedConditionalVault.underlyingTokenMint.equals(underlyingTokenMint)
  );
  assert.ok(
    storedConditionalVault.conditionalTokenMint.equals(conditionalTokenMint)
  );

  // console.log("Conditional vault successfully initialized.");

  return [conditionalVault, conditionalTokenMint, vaultUnderlyingTokenAccount];
};

export const initializeDepositAccount = async (
  program: Program,
  conditionalVault: anchor.web3.PublicKey
) => {
  const provider = program.provider;

  const depositAccount = await pdaGenUtils.generateDepositAccountPDAAddress(
    program,
    conditionalVault,
    provider.wallet.publicKey // the provider's wallet will be the one minting
  );

  await program.methods
    .initializeDepositAccount()
    .accounts({
      conditionalVault,
      depositAccount,
      depositor: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  let storedDepositAccount = await program.account.depositAccount.fetch(
    depositAccount
  );

  assert.ok(storedDepositAccount.conditionalVault.equals(conditionalVault));
  assert.ok(storedDepositAccount.depositor.equals(provider.wallet.publicKey));
  assert.ok(storedDepositAccount.depositedAmount.eq(new anchor.BN(0)));

  // console.log("Deposit account successfully initialized.");

  return depositAccount;
};

export const initializeProposalAccount = async (
  program: Program,
  proposalNumber: number
) => {
  const provider = program.provider;
  const proposalKeypair = anchor.web3.Keypair.generate();

  await program.methods
    .initializeProposal(new anchor.BN(proposalNumber))
    .accounts({
      proposal: proposalKeypair.publicKey,
      initializer: provider.wallet.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([proposalKeypair])
    .rpc();

  return proposalKeypair.publicKey;
};
