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

  it("Conditional expressions can be initialized", async () => {
    const proposalNumber = 324;
    const redeemableOnPass = true;

    const [conditionalExpressionAcc, ] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("conditional-expression"),
          new anchor.BN(proposalNumber).toBuffer("be", 8),
          Buffer.from([redeemableOnPass]),
        ],
        program.programId
      );

    await program.methods
      .initializeConditionalExpression(
        new anchor.BN(proposalNumber),
        redeemableOnPass
      )
      .accounts({
        conditionalExpression: conditionalExpressionAcc,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedConditionalExpression =
      await program.account.conditionalExpression.fetch(
        conditionalExpressionAcc
      );

    assert.ok(
      storedConditionalExpression.proposalNumber.eq(
        new anchor.BN(proposalNumber)
      )
    );
    assert.equal(storedConditionalExpression.passOrFailFlag, redeemableOnPass);
  });

  it("Conditional vaults can be initialized", async () => {
    const proposalNumber = 123;
    const redeemableOnPass = false;

    const [conditionalExpressionAcc, ] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("conditional-expression"),
          new anchor.BN(proposalNumber).toBuffer("be", 8),
          Buffer.from([redeemableOnPass]),
        ],
        program.programId
      );

    const mintAuthority = anchor.web3.Keypair.generate();

    const mint = await token.createMint(
      provider.connection,
      provider.wallet.payer,
      mintAuthority.publicKey,
      null,
      2
    );

    const [conditionalVaultAcc, ] =
        await anchor.web3.PublicKey.findProgramAddress(
            [
                anchor.utils.bytes.utf8.encode("conditional-vault"),
                conditionalExpressionAcc.toBuffer(),
                mint.toBuffer(),
            ],
            program.programId
    );

    const vaultTokenAcc = (
      await token.getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        conditionalVaultAcc,
        true
      )
    ).address;

    await program.methods
      .initializeConditionalExpression(
        new anchor.BN(proposalNumber),
        redeemableOnPass
      )
      .accounts({
        conditionalExpression: conditionalExpressionAcc,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .initializeConditionalVault()
      .accounts({
        conditionalExpression: conditionalExpressionAcc,
        splTokenAccount: vaultTokenAcc,
        splMint: mint,
        conditionalVault: conditionalVaultAcc,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedConditionalVault = await program.account.conditionalVault.fetch(
      conditionalVaultAcc
    );

    assert.ok(
      storedConditionalVault.conditionalExpression.equals(
        conditionalExpressionAcc
      )
    );
    assert.ok(storedConditionalVault.splTokenAccount.equals(vaultTokenAcc));
    assert.ok(storedConditionalVault.splMint.equals(mint));
  });

  it("Conditional token accounts can be initialized", async () => {
    const proposalNumber = 482;
    const redeemableOnPass = true;

    const [conditionalExpressionAcc, ] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("conditional-expression"),
          new anchor.BN(proposalNumber).toBuffer("be", 8),
          Buffer.from([redeemableOnPass]),
        ],
        program.programId
      );

    const mintAuthority = anchor.web3.Keypair.generate();

    const mint = await token.createMint(
      provider.connection,
      provider.wallet.payer,
      mintAuthority.publicKey,
      null,
      2
    );

    const [conditionalVaultAcc, ] =
        await anchor.web3.PublicKey.findProgramAddress(
            [
                anchor.utils.bytes.utf8.encode("conditional-vault"),
                conditionalExpressionAcc.toBuffer(),
                mint.toBuffer(),
            ],
            program.programId
    );

    const vaultTokenAcc = (
      await token.getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        conditionalVaultAcc,
        true
      )
    ).address;

    const [conditionalTokenAcc, ] =
        await anchor.web3.PublicKey.findProgramAddress(
            [
                anchor.utils.bytes.utf8.encode("conditional-token-account"),
                conditionalVaultAcc.toBuffer(),
                provider.wallet.publicKey.toBuffer() // this conditional token account will belong to the provider wallet
            ],
            program.programId
    );

    await program.methods
      .initializeConditionalExpression(
        new anchor.BN(proposalNumber),
        redeemableOnPass
      )
      .accounts({
        conditionalExpression: conditionalExpressionAcc,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .initializeConditionalVault()
      .accounts({
        conditionalExpression: conditionalExpressionAcc,
        splTokenAccount: vaultTokenAcc,
        splMint: mint,
        conditionalVault: conditionalVaultAcc,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .initializeConditionalTokenAccount()
      .accounts({
        conditionalVault: conditionalVaultAcc,
        conditionalTokenAccount: conditionalTokenAcc,
        authority: provider.wallet.publicKey, 
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedConditionalTokenAccount =
      await program.account.conditionalTokenAccount.fetch(
        conditionalTokenAcc
      );

    assert.ok(
      storedConditionalTokenAccount.conditionalVault.equals(
        conditionalVaultAcc
      )
    );
    assert.ok(
      storedConditionalTokenAccount.authority.equals(provider.wallet.publicKey)
    );
    assert.ok(storedConditionalTokenAccount.balance.eq(new anchor.BN(0)));
    assert.ok(
      storedConditionalTokenAccount.depositedAmount.eq(new anchor.BN(0))
    );
  });

  //it("Can be initialized", async () => {
  //  const conditionalVaultAccount = anchor.web3.Keypair.generate();

  //it("Accounts can initialize conditional token accounts", async () => {
  //  const conditionalTokenAccount = anchor.web3.Keypair.generate();
  //  const proposalNumber = 564;
  //  const redeemableOnPass = true;

  //  await program.methods.initializeConditionalTokenAccount(new anchor.BN(proposalNumber), redeemableOnPass)
  //  	.accounts({
  //      	    conditionalTokenAccount: conditionalTokenAccount.publicKey,
  //      	    authority: provider.wallet.publicKey,
  //      	    systemProgram: anchor.web3.SystemProgram.programId
  //      })
  //      .signers([conditionalTokenAccount])
  //      .rpc();

  //  const createdAccount = await program.account.conditionalTokenAccount.fetch(conditionalTokenAccount.publicKey);

  //  assert.ok(createdAccount.balance.eq(new anchor.BN(0)));
  //  assert.ok(createdAccount.proposalNumber.eq(new anchor.BN(proposalNumber)));
  //  assert.ok(createdAccount.authority.equals(provider.wallet.publicKey));
  //  assert.equal(createdAccount.redeemableOnPass, redeemableOnPass);
  //});

  ////it("Accounts can mint redeemable-on-pass tokens", async () => {
  ////  const conditionalTokenAccount = anchor.web3.Keypair.generate();
  ////  const proposalNumber = 123;
  ////  const redeemableOnPass = true;

  ////  await program.methods.initializeConditionalTokenAccount(new anchor.BN(proposalNumber), redeemableOnPass)
  ////  	.accounts({
  ////      	    conditionalTokenAccount: conditionalTokenAccount.publicKey,
  ////      	    authority: provider.wallet.publicKey,
  ////      	    systemProgram: anchor.web3.SystemProgram.programId
  ////      })
  ////      .signers([conditionalTokenAccount])

  //it("Can be initialized", async () => {
  //  const conditionalVaultAccount = anchor.web3.Keypair.generate();

  //it("Accounts can initialize conditional token accounts", async () => {
  //  const conditionalTokenAccount = anchor.web3.Keypair.generate();
  //  const proposalNumber = 564;
  //  const redeemableOnPass = true;

  //  await program.methods.initializeConditionalTokenAccount(new anchor.BN(proposalNumber), redeemableOnPass)
  //  	.accounts({
  //      	    conditionalTokenAccount: conditionalTokenAccount.publicKey,
  //      	    authority: provider.wallet.publicKey,
  //      	    systemProgram: anchor.web3.SystemProgram.programId
  //      })
  //      .signers([conditionalTokenAccount])
  //      .rpc();

  //  const createdAccount = await program.account.conditionalTokenAccount.fetch(conditionalTokenAccount.publicKey);

  //  assert.ok(createdAccount.balance.eq(new anchor.BN(0)));
  //  assert.ok(createdAccount.proposalNumber.eq(new anchor.BN(proposalNumber)));
  //  assert.ok(createdAccount.authority.equals(provider.wallet.publicKey));
  //  assert.equal(createdAccount.redeemableOnPass, redeemableOnPass);
  //});

  ////it("Accounts can mint redeemable-on-pass tokens", async () => {
  ////  const conditionalTokenAccount = anchor.web3.Keypair.generate();
  ////  const proposalNumber = 123;
  ////  const redeemableOnPass = true;

  ////  await program.methods.initializeConditionalTokenAccount(new anchor.BN(proposalNumber), redeemableOnPass)
  ////  	.accounts({
  ////      	    conditionalTokenAccount: conditionalTokenAccount.publicKey,
  ////      	    authority: provider.wallet.publicKey,
  ////      	    systemProgram: anchor.web3.SystemProgram.programId
  ////      })
  ////      .signers([conditionalTokenAccount])
  ////      .rpc();

  ////  const createdAccount = await program.account.conditionalTokenAccount.fetch(conditionalTokenAccount.publicKey);

  ////  assert.ok(createdAccount.balance.eq(new anchor.BN(0)));
  ////  assert.ok(createdAccount.proposalNumber.eq(new anchor.BN(proposalNumber)));
  ////  assert.ok(createdAccount.authority.equals(provider.wallet.publicKey));
  ////  assert.equal(createdAccount.redeemableOnPass, redeemableOnPass);

  ////  const mintAuthority = anchor.web3.Keypair.generate();

  ////  const mint = token.createMint(
  ////    provider.connection,
  ////    provider.wallet.payer,
  ////    mintAuthority.publicKey,
  ////    null,
  ////    2
  ////  );

  ////  // this is the depositor's normal token account i.e., the account that gets drained in the mint
  ////  const depositorTokenAccount = (await token.getOrCreateAssociatedTokenAccount(
  ////    connection,
  ////    provider.wallet.payer,
  ////    mint,
  ////    multisigSigner,
  ////    true
  ////  )).address;

  ////  const conditionalVaultTokenAccount = (await token.getOrCreateAssociatedTokenAccount(
  ////    connection,
  ////    provider.wallet.payer,
  ////    mint,
  ////    multisigSigner,
  ////    true
  ////  )).address;

  ////
  ////  await program.methods.mintConditionalTokens
  ////});

  //it("Accounts can mint redeemable-on-fail tokens", async () => {
  //  //
  //});

  //it("Accounts cannot mint conditional tokens for a proposal that isn't active", async () => {
  //  //
  //});

  //it("Accounts cannot mint conditional tokens with an insufficient normal token balance", async () => {
  //  //
  //});

  //it("Accounts can burn redeemable-on-pass tokens", async () => {
  //  //
  //});
  //it("Accounts can burn redeemable-on-fail tokens", async () => {
  //  //
  //});

  //it("Accounts cannot burn conditional tokens before a proposal has passed or failed", async () => {
  //  //
  //});
});
