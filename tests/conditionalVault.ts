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

  it("Simple minting & burning flow", async () => {
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
    assert.ok(storedConditionalVault.underlyingTokenAccount.equals(vaultUnderlyingTokenAccount));
    assert.ok(storedConditionalVault.underlyingTokenMint.equals(underlyingTokenMint));
    assert.ok(storedConditionalVault.conditionalTokenMint.equals(conditionalTokenMint));

    console.log("Conditional vault successfully initialized.");

    // const conditionalTokenAcc = await generateConditionalTokenAccountPDAAddress(
    //   program,
    //   conditionalVaultAcc,
    //   provider.wallet.publicKey // the provider's wallet will be the one minting
    // );

    // await program.methods
    //   .initializeConditionalTokenAccount()
    //   .accounts({
    //     conditionalVault: conditionalVaultAcc,
    //     conditionalTokenAccount: conditionalTokenAcc,
    //     authority: provider.wallet.publicKey,
    //     systemProgram: anchor.web3.SystemProgram.programId,
    //   })
    //   .rpc();

    // let storedConditionalTokenAccount =
    //   await program.account.conditionalTokenAccount.fetch(conditionalTokenAcc);

    // assert.ok(
    //   storedConditionalTokenAccount.conditionalVault.equals(conditionalVaultAcc)
    // );
    // assert.ok(
    //   storedConditionalTokenAccount.authority.equals(provider.wallet.publicKey)
    // );
    // assert.ok(storedConditionalTokenAccount.balance.eq(new anchor.BN(0)));
    // assert.ok(
    //   storedConditionalTokenAccount.depositedAmount.eq(new anchor.BN(0))
    // );

    // console.log("Conditional token account successfully initialized.");

    // const userSPLTokenAccount = await token.createAccount(
    //   provider.connection,
    //   provider.wallet.payer,
    //   mint,
    //   provider.wallet.publicKey
    // );

    // const amountToMint = 1000;
    // const amountToDeposit = 400;

    // await token.mintTo(
    //   provider.connection,
    //   provider.wallet.payer,
    //   mint,
    //   userSPLTokenAccount,
    //   mintAuthority,
    //   amountToMint
    // );

    // await program.methods
    //   .mintConditionalTokens(new anchor.BN(amountToDeposit))
    //   .accounts({
    //     conditionalVault: conditionalVaultAcc,
    //     conditionalTokenAccount: conditionalTokenAcc,
    //     userSplTokenAccount: userSPLTokenAccount,
    //     vaultSplTokenAccount: vaultSplTokenAcc,
    //     user: provider.wallet.publicKey,
    //     tokenProgram: token.TOKEN_PROGRAM_ID,
    //   })
    //   .rpc();

    // storedConditionalTokenAccount =
    //   await program.account.conditionalTokenAccount.fetch(conditionalTokenAcc);

    // assert.equal(
    //   (await token.getAccount(provider.connection, userSPLTokenAccount)).amount,
    //   amountToMint - amountToDeposit
    // );
    // assert.equal(
    //   (await token.getAccount(provider.connection, vaultSplTokenAcc)).amount,
    //   amountToDeposit
    // );

    // // these should remain the same
    // assert.ok(
    //   storedConditionalTokenAccount.conditionalVault.equals(conditionalVaultAcc)
    // );
    // assert.ok(
    //   storedConditionalTokenAccount.authority.equals(provider.wallet.publicKey)
    // );
    // // these should increase
    // assert.ok(
    //   storedConditionalTokenAccount.balance.eq(new anchor.BN(amountToDeposit))
    // );
    // assert.ok(
    //   storedConditionalTokenAccount.depositedAmount.eq(
    //     new anchor.BN(amountToDeposit)
    //   )
    // );

    // console.log(
    //   "Conditional token account successfully credited after deposit."
    // );

    // const proposalAcc = anchor.web3.Keypair.generate();

    // await program.methods
    //   .initializeProposal(new anchor.BN(proposalNumber))
    //   .accounts({
    //     proposal: proposalAcc.publicKey,
    //     initializer: provider.wallet.publicKey,
    //     systemProgram: anchor.web3.SystemProgram.programId,
    //   })
    //   .signers([proposalAcc])
    //   .rpc();

    // await program.methods
    //   .passProposal()
    //   .accounts({
    //     proposal: proposalAcc.publicKey,
    //   })
    //   .rpc();

    // await program.methods
    //   .claimUnderlyingTokens()
    //   .accounts({
    //     proposal: proposalAcc.publicKey,
    //     conditionalExpression: conditionalExpressionAcc,
    //     conditionalTokenAccount: conditionalTokenAcc,
    //     userSplTokenAccount: userSPLTokenAccount,
    //     vaultSplTokenAccount: vaultSplTokenAcc,
    //     conditionalVault: conditionalVaultAcc,
    //     user: provider.wallet.publicKey,
    //   })
    //   .rpc();

    // storedConditionalTokenAccount =
    //   await program.account.conditionalTokenAccount.fetch(conditionalTokenAcc);

    // assert.equal(
    //   (await token.getAccount(provider.connection, userSPLTokenAccount)).amount,
    //   amountToMint
    // );
    // assert.equal(
    //   (await token.getAccount(provider.connection, vaultSplTokenAcc)).amount,
    //   0
    // );

    // assert.ok(storedConditionalTokenAccount.balance.eq(new anchor.BN(0)));

    // console.log("Underlying tokens successfully redeemed after proposal pass");
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

async function generateConditionalTokenAccountPDAAddress(
  program: Program,
  conditionalVault: anchor.web3.PublicKey,
  user: anchor.web3.PublicKey
) {
  const [conditionalTokenAcc] = await anchor.web3.PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode("conditional-token-account"),
      conditionalVault.toBuffer(),
      user.toBuffer(),
    ],
    program.programId
  );

  return conditionalTokenAcc;
}
