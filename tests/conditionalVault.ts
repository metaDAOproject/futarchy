import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { ConditionalVault } from "../target/types/conditional_vault";
import { expect, assert } from "chai";
import * as token from "@solana/spl-token";

describe("Conditional vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ConditionalVault as Program<ConditionalVault>;

  it("Conditional expressions can be initialized", async () => {
    const proposalNumber = 324;
    const redeemableOnPass = true;

    const conditionalExpressionAcc = anchor.web3.Keypair.generate();

    await program.methods.initializeConditionalExpression(
	    new anchor.BN(proposalNumber),
	    redeemableOnPass
    	)
	.accounts({
		conditionalExpression: conditionalExpressionAcc.publicKey,
		initializer: provider.wallet.publicKey,
		systemProgram: anchor.web3.SystemProgram.programId,
	})
	.signers([conditionalExpressionAcc])
	.rpc();
    
    const storedConditionalExpression = await program.account.conditionalExpression.fetch(conditionalExpressionAcc.publicKey);

    assert.ok(storedConditionalExpression.proposalNumber.eq(new anchor.BN(proposalNumber)));
    assert.equal(storedConditionalExpression.passOrFailFlag, redeemableOnPass);
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
