import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { ConditionalVault } from "../target/types/conditional_vault";
import { expect, assert } from "chai";
import * as token from "@solana/spl-token";

describe("Conditional vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .ConditionalVault as Program<ConditionalVault>;

  it("Flow #1 - user mints, condition evalutes to true, user redeems conditional tokens", async () => {
    const proposalNumber = 324;
    const redeemableOnPass = true;

    const conditionalExpressionAccount =
      await generateConditionalExpressionPDAAddress(
        program,
        proposalNumber,
        redeemableOnPass
      );

    await program.methods
      .initializeConditionalExpression(
        new anchor.BN(proposalNumber),
        redeemableOnPass
      )
      .accounts({
        conditionalExpression: conditionalExpressionAccount,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedConditionalExpression =
      await program.account.conditionalExpression.fetch(
        conditionalExpressionAccount
      );

    assert.ok(
      storedConditionalExpression.proposalNumber.eq(
        new anchor.BN(proposalNumber)
      )
    );
    assert.equal(storedConditionalExpression.passOrFailFlag, redeemableOnPass);

    console.log("Conditional expression successfully initialized.");

    const underlyingTokenMintAuthority = anchor.web3.Keypair.generate();

    const underlyingTokenMint = await token.createMint(
      provider.connection,
      provider.wallet.payer,
      underlyingTokenMintAuthority.publicKey,
      null,
      2
    );

    const conditionalVaultAccount = await generateConditionalVaultPDAAddress(
      program,
      conditionalExpressionAccount,
      underlyingTokenMint
    );

    const conditionalTokenMint = await token.createMint(
      provider.connection,
      provider.wallet.payer,
      conditionalVaultAccount, // mint authority
      null,
      2
    );

    const vaultUnderlyingTokenAccount = (
      await token.getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        underlyingTokenMint,
        conditionalVaultAccount,
        true
      )
    ).address;

    await program.methods
      .initializeConditionalVault()
      .accounts({
        conditionalVault: conditionalVaultAccount,
        conditionalExpression: conditionalExpressionAccount,
        underlyingTokenMint: underlyingTokenMint,
        conditionalTokenMint: conditionalTokenMint,
        vaultUnderlyingTokenAccount: vaultUnderlyingTokenAccount,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedConditionalVault = await program.account.conditionalVault.fetch(
      conditionalVaultAccount
    );

    assert.ok(
      storedConditionalVault.conditionalExpression.equals(
        conditionalExpressionAccount
      )
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

    console.log("Conditional vault successfully initialized.");

    const depositAccount = await generateDepositAccountPDAAddress(
      program,
      conditionalVaultAccount,
      provider.wallet.publicKey // the provider's wallet will be the one minting
    );

    await program.methods
      .initializeDepositAccount()
      .accounts({
        conditionalVault: conditionalVaultAccount,
        depositAccount,
        depositor: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    let storedDepositAccount = await program.account.depositAccount.fetch(
      depositAccount
    );

    assert.ok(
      storedDepositAccount.conditionalVault.equals(conditionalVaultAccount)
    );
    assert.ok(storedDepositAccount.depositor.equals(provider.wallet.publicKey));
    assert.ok(storedDepositAccount.depositedAmount.eq(new anchor.BN(0)));

    console.log("Deposit account successfully initialized.");

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

    await program.methods
      .mintConditionalTokens(new anchor.BN(conditionalAmountToMint))
      .accounts({
        conditionalVault: conditionalVaultAccount,
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
      underlyingAmountToMint - conditionalAmountToMint
    );
    assert.equal(
      (await token.getAccount(provider.connection, vaultUnderlyingTokenAccount))
        .amount,
      conditionalAmountToMint
    );
    assert.equal(
      (await token.getAccount(provider.connection, userConditionalTokenAccount))
        .amount,
      conditionalAmountToMint
    );

    storedDepositAccount = await program.account.depositAccount.fetch(
      depositAccount
    );

    // these should remain the same
    assert.ok(
      storedDepositAccount.conditionalVault.equals(conditionalVaultAccount)
    );
    assert.ok(storedDepositAccount.depositor.equals(provider.wallet.publicKey));
    // this should increase
    assert.ok(
      storedDepositAccount.depositedAmount.eq(
        new anchor.BN(conditionalAmountToMint)
      )
    );

    console.log(
      "Conditional token account successfully credited after deposit."
    );

    const proposalAccount = anchor.web3.Keypair.generate();

    await program.methods
      .initializeProposal(new anchor.BN(proposalNumber))
      .accounts({
        proposal: proposalAccount.publicKey,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([proposalAccount])
      .rpc();

    await program.methods
      .passProposal()
      .accounts({
        proposal: proposalAccount.publicKey,
      })
      .rpc();

    await program.methods
      .redeemConditionalTokensForUnderlyingTokens()
      .accounts({
        user: provider.wallet.publicKey,
        userConditionalTokenAccount,
        userUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        conditionalVault: conditionalVaultAccount,
        proposal: proposalAccount.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        conditionalExpression: conditionalExpressionAccount,
        conditionalTokenMint,
      })
      .rpc();

    assert.equal(
      (await token.getAccount(provider.connection, userUnderlyingTokenAccount))
        .amount,
      underlyingAmountToMint
    );
    assert.equal(
      (await token.getAccount(provider.connection, vaultUnderlyingTokenAccount))
        .amount,
      0
    );
    assert.equal(
      (await token.getAccount(provider.connection, userConditionalTokenAccount))
        .amount,
      0
    );

    console.log("Underlying tokens successfully redeemed after proposal pass");
  });

  it("Flow #2 - user mints, condition evaluates to false, user redeems deposit account", async () => {
    const proposalNumber = 0;
    const redeemableOnPass = false;

    const conditionalExpressionAccount =
      await generateConditionalExpressionPDAAddress(
        program,
        proposalNumber,
        redeemableOnPass
      );

    await program.methods
      .initializeConditionalExpression(
        new anchor.BN(proposalNumber),
        redeemableOnPass
      )
      .accounts({
        conditionalExpression: conditionalExpressionAccount,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedConditionalExpression =
      await program.account.conditionalExpression.fetch(
        conditionalExpressionAccount
      );

    assert.ok(
      storedConditionalExpression.proposalNumber.eq(
        new anchor.BN(proposalNumber)
      )
    );
    assert.equal(storedConditionalExpression.passOrFailFlag, redeemableOnPass);

    console.log("Conditional expression successfully initialized.");

    const underlyingTokenMintAuthority = anchor.web3.Keypair.generate();

    const underlyingTokenMint = await token.createMint(
      provider.connection,
      provider.wallet.payer,
      underlyingTokenMintAuthority.publicKey,
      null,
      2
    );

    const conditionalVaultAccount = await generateConditionalVaultPDAAddress(
      program,
      conditionalExpressionAccount,
      underlyingTokenMint
    );

    const conditionalTokenMint = await token.createMint(
      provider.connection,
      provider.wallet.payer,
      conditionalVaultAccount, // mint authority
      null,
      2
    );

    const vaultUnderlyingTokenAccount = (
      await token.getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        underlyingTokenMint,
        conditionalVaultAccount,
        true
      )
    ).address;

    await program.methods
      .initializeConditionalVault()
      .accounts({
        conditionalVault: conditionalVaultAccount,
        conditionalExpression: conditionalExpressionAccount,
        underlyingTokenMint: underlyingTokenMint,
        conditionalTokenMint: conditionalTokenMint,
        vaultUnderlyingTokenAccount: vaultUnderlyingTokenAccount,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedConditionalVault = await program.account.conditionalVault.fetch(
      conditionalVaultAccount
    );

    assert.ok(
      storedConditionalVault.conditionalExpression.equals(
        conditionalExpressionAccount
      )
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

    console.log("Conditional vault successfully initialized.");

    const depositAccount = await generateDepositAccountPDAAddress(
      program,
      conditionalVaultAccount,
      provider.wallet.publicKey // the provider's wallet will be the one minting
    );

    await program.methods
      .initializeDepositAccount()
      .accounts({
        conditionalVault: conditionalVaultAccount,
        depositAccount,
        depositor: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    let storedDepositAccount = await program.account.depositAccount.fetch(
      depositAccount
    );

    assert.ok(
      storedDepositAccount.conditionalVault.equals(conditionalVaultAccount)
    );
    assert.ok(storedDepositAccount.depositor.equals(provider.wallet.publicKey));
    assert.ok(storedDepositAccount.depositedAmount.eq(new anchor.BN(0)));

    console.log("Deposit account successfully initialized.");

    const userUnderlyingTokenAccount = await token.createAccount(
      provider.connection,
      provider.wallet.payer,
      underlyingTokenMint,
      provider.wallet.publicKey
    );

    const underlyingAmountToMint = 15000;
    const conditionalAmountToMint = 15000;

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

    await program.methods
      .mintConditionalTokens(new anchor.BN(conditionalAmountToMint))
      .accounts({
        conditionalVault: conditionalVaultAccount,
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
      underlyingAmountToMint - conditionalAmountToMint
    );
    assert.equal(
      (await token.getAccount(provider.connection, vaultUnderlyingTokenAccount))
        .amount,
      conditionalAmountToMint
    );
    assert.equal(
      (await token.getAccount(provider.connection, userConditionalTokenAccount))
        .amount,
      conditionalAmountToMint
    );

    storedDepositAccount = await program.account.depositAccount.fetch(
      depositAccount
    );

    // these should remain the same
    assert.ok(
      storedDepositAccount.conditionalVault.equals(conditionalVaultAccount)
    );
    assert.ok(storedDepositAccount.depositor.equals(provider.wallet.publicKey));
    // this should increase
    assert.ok(
      storedDepositAccount.depositedAmount.eq(
        new anchor.BN(conditionalAmountToMint)
      )
    );

    console.log(
      "Conditional token account successfully credited after deposit."
    );

    const proposalAccount = anchor.web3.Keypair.generate();

    await program.methods
      .initializeProposal(new anchor.BN(proposalNumber))
      .accounts({
        proposal: proposalAccount.publicKey,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([proposalAccount])
      .rpc();

    await program.methods
      .passProposal() // this invalidates the conditional tokens
      .accounts({
        proposal: proposalAccount.publicKey,
      })
      .rpc();

    await program.methods
      .redeemDepositAccountForUnderlyingTokens()
      .accounts({
        user: provider.wallet.publicKey,
        userDepositAccount: depositAccount,
        userUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        conditionalVault: conditionalVaultAccount,
        proposal: proposalAccount.publicKey,
        tokenProgram: token.TOKEN_PROGRAM_ID,
        conditionalExpression: conditionalExpressionAccount,
      })
      .rpc();

    assert.equal(
      (await token.getAccount(provider.connection, userUnderlyingTokenAccount))
        .amount,
      underlyingAmountToMint
    );
    assert.equal(
      (await token.getAccount(provider.connection, vaultUnderlyingTokenAccount))
        .amount,
      0
    );
    assert.equal(
      (await token.getAccount(provider.connection, userConditionalTokenAccount))
        .amount,
      conditionalAmountToMint
    ); // conditional token balance should remain the same - these tokens are now worthless

    storedDepositAccount = await program.account.depositAccount.fetch(
      depositAccount
    );

    assert.ok(storedDepositAccount.depositedAmount.eq(new anchor.BN(0)));

    console.log("Underlying tokens successfully redeemed after proposal pass");
  });
});

async function generateConditionalExpressionPDAAddress(
  program: Program,
  proposalNumber: number,
  redeemableOnPass: boolean
) {
  const [conditionalExpressionAcc] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("conditional-expression"),
        new anchor.BN(proposalNumber).toBuffer("be", 8),
        Buffer.from([redeemableOnPass]),
      ],
      program.programId
    );

  return conditionalExpressionAcc;
}

async function generateConditionalVaultPDAAddress(
  program: Program,
  conditionalExpressionAddress: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey
) {
  const [conditionalVaultAcc] = await anchor.web3.PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode("conditional-vault"),
      conditionalExpressionAddress.toBuffer(),
      mint.toBuffer(),
    ],
    program.programId
  );
  return conditionalVaultAcc;
}

async function generateDepositAccountPDAAddress(
  program: Program,
  conditionalVault: anchor.web3.PublicKey,
  user: anchor.web3.PublicKey
) {
  const [depositAcc] = await anchor.web3.PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode("deposit-account"),
      conditionalVault.toBuffer(),
      user.toBuffer(),
    ],
    program.programId
  );

  return depositAcc;
}
