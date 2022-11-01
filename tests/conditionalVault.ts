// import * as anchor from "@project-serum/anchor";
// import { Program } from "@project-serum/anchor";
// import { ConditionalVault } from "../target/types/conditional_vault";
// import { expect, assert } from "chai";
// import * as token from "@solana/spl-token";
// import * as accountInitUtils from "./accountInitializationUtils";
// import {
//   generateConditionalVaultPDAAddress,
//   generateDepositAccountPDAAddress,
//   generateConditionalExpressionPDAAddress,
// } from "./pdaGenerationUtils";
// import * as utils from "./utils"; 

// describe("Conditional vault", () => {
//   const provider = anchor.AnchorProvider.env();
//   anchor.setProvider(provider);

//   const program = anchor.workspace
//     .ConditionalVault as Program<ConditionalVault>;

//   it("User can redeem conditional tokens for underlying tokens after condition evalutes to true", async () => {
//     const proposalNumber = 324;
//     const redeemableOnPass = true;

//     const proposal = await accountInitUtils.initializeProposalAccount(
//       program,
//       proposalNumber
//     );

//     const conditionalExpression =
//       await accountInitUtils.initializeConditionalExpression(
//         program,
//         proposal,
//         redeemableOnPass
//       );

//     const [underlyingTokenMint, underlyingTokenMintAuthority] =
//       await accountInitUtils.initializeUnderlyingTokenMint(provider);

//     const [
//       conditionalVault,
//       conditionalTokenMint,
//       vaultUnderlyingTokenAccount,
//     ] = await accountInitUtils.initializeConditionalVault(
//       program,
//       conditionalExpression,
//       underlyingTokenMint
//     );

//     const depositAccount = await accountInitUtils.initializeDepositAccount(
//       program,
//       conditionalVault
//     );

//     const userUnderlyingTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       provider.wallet.publicKey
//     );

//     const underlyingAmountToMint = 1000;
//     const conditionalAmountToMint = 400;

//     await token.mintTo(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       userUnderlyingTokenAccount,
//       underlyingTokenMintAuthority,
//       underlyingAmountToMint
//     );

//     const userConditionalTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       conditionalTokenMint,
//       provider.wallet.publicKey
//     );

//     await utils.mintConditionalTokens(
//       program,
//       conditionalVault,
//       conditionalAmountToMint,
//       depositAccount,
//       userUnderlyingTokenAccount,
//       userConditionalTokenAccount
//     );

//     await program.methods
//       .passProposal()
//       .accounts({
//         proposal,
//       })
//       .rpc();

//     await utils.redeemConditionalTokensForUnderlyingTokens(
//       program,
//       userConditionalTokenAccount,
//       userUnderlyingTokenAccount,
//       conditionalVault,
//       proposal
//     );
//   });

//   it("User can redeem a deposit account for underlying tokens if the condition evaluates to false", async () => {
//     const proposalNumber = 0;
//     const redeemableOnPass = false;

//     const proposal = await accountInitUtils.initializeProposalAccount(
//       program,
//       proposalNumber
//     );

//     const conditionalExpression =
//       await accountInitUtils.initializeConditionalExpression(
//         program,
//         proposal,
//         redeemableOnPass
//       );

//     const [underlyingTokenMint, underlyingTokenMintAuthority] =
//       await accountInitUtils.initializeUnderlyingTokenMint(provider);

//     const [
//       conditionalVault,
//       conditionalTokenMint,
//       vaultUnderlyingTokenAccount,
//     ] = await accountInitUtils.initializeConditionalVault(
//       program,
//       conditionalExpression,
//       underlyingTokenMint
//     );

//     const depositAccount = await accountInitUtils.initializeDepositAccount(
//       program,
//       conditionalVault
//     );

//     const userUnderlyingTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       provider.wallet.publicKey
//     );

//     const underlyingAmountToMint = 1000;
//     const conditionalAmountToMint = 400;

//     await token.mintTo(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       userUnderlyingTokenAccount,
//       underlyingTokenMintAuthority,
//       underlyingAmountToMint
//     );

//     const userConditionalTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       conditionalTokenMint,
//       provider.wallet.publicKey
//     );

//     await utils.mintConditionalTokens(
//       program,
//       conditionalVault,
//       conditionalAmountToMint,
//       depositAccount,
//       userUnderlyingTokenAccount,
//       userConditionalTokenAccount
//     );

//     await program.methods
//       .passProposal()
//       .accounts({
//         proposal,
//       })
//       .rpc();

//     await utils.redeemDepositAccountForUnderlyingTokens(
//       program,
//       depositAccount,
//       userUnderlyingTokenAccount,
//       conditionalVault,
//       proposal
//     );
//   });

//   it("Adversary cannot redeem deposit account or empty conditional token account for underlying tokens when condition evaluates to true.", async () => {
//     const proposalNumber = 38910;
//     const redeemableOnPass = false;

//     const proposal = await accountInitUtils.initializeProposalAccount(
//       program,
//       proposalNumber
//     );

//     const conditionalExpression =
//       await accountInitUtils.initializeConditionalExpression(
//         program,
//         proposal,
//         redeemableOnPass
//       );

//     const [underlyingTokenMint, underlyingTokenMintAuthority] =
//       await accountInitUtils.initializeUnderlyingTokenMint(provider);

//     const [
//       conditionalVault,
//       conditionalTokenMint,
//       vaultUnderlyingTokenAccount,
//     ] = await accountInitUtils.initializeConditionalVault(
//       program,
//       conditionalExpression,
//       underlyingTokenMint
//     );

//     const depositAccount = await accountInitUtils.initializeDepositAccount(
//       program,
//       conditionalVault
//     );

//     const userUnderlyingTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       provider.wallet.publicKey
//     );

//     const underlyingAmountToMint = 1000;
//     const conditionalAmountToMint = 400;

//     await token.mintTo(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       userUnderlyingTokenAccount,
//       underlyingTokenMintAuthority,
//       underlyingAmountToMint
//     );

//     const userConditionalTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       conditionalTokenMint,
//       provider.wallet.publicKey
//     );

//     await utils.mintConditionalTokens(
//       program,
//       conditionalVault,
//       conditionalAmountToMint,
//       depositAccount,
//       userUnderlyingTokenAccount,
//       userConditionalTokenAccount
//     );

//     // main user sends away their conditional tokens
//     const conditionalTokenBurnAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       conditionalTokenMint,
//       anchor.web3.Keypair.generate().publicKey
//     );

//     await token.transfer(
//       provider.connection,
//       provider.wallet.payer,
//       userConditionalTokenAccount,
//       conditionalTokenBurnAccount,
//       provider.wallet.publicKey,
//       conditionalAmountToMint
//     );

//     await program.methods
//       .failProposal()
//       .accounts({
//         proposal,
//       })
//       .rpc();

//     try {
//       await utils.redeemDepositAccountForUnderlyingTokens(
//         program,
//         depositAccount,
//         userUnderlyingTokenAccount,
//         conditionalVault,
//         proposal
//       );
//       assert.fail();
//     } catch (err) {
//       assert.strictEqual(err.error.errorCode.number, 6001);
//       assert.strictEqual(
//         err.error.errorMessage,
//         "Conditional expression needs to evaluate to false before deposit accounts can be redeemed for underlying tokens"
//       );
//     }

//     // this should pass, but because the user's conditional token account is empty, they should get 0 underlying tokens
//     await utils.redeemConditionalTokensForUnderlyingTokens(
//       program,
//       userConditionalTokenAccount,
//       userUnderlyingTokenAccount,
//       conditionalVault,
//       proposal
//     );

//     assert.equal(
//       (await token.getAccount(provider.connection, userUnderlyingTokenAccount))
//         .amount,
//       BigInt(underlyingAmountToMint - conditionalAmountToMint)
//     );
//   });

//   it("Adversary cannot redeem conditional tokens when the expression evaluates to false", async () => {
//     const proposalNumber = 38910;
//     const redeemableOnPass = false;

//     const proposal = await accountInitUtils.initializeProposalAccount(
//       program,
//       proposalNumber
//     );

//     const conditionalExpression =
//       await accountInitUtils.initializeConditionalExpression(
//         program,
//         proposal,
//         redeemableOnPass
//       );

//     const [underlyingTokenMint, underlyingTokenMintAuthority] =
//       await accountInitUtils.initializeUnderlyingTokenMint(provider);

//     const [
//       conditionalVault,
//       conditionalTokenMint,
//       vaultUnderlyingTokenAccount,
//     ] = await accountInitUtils.initializeConditionalVault(
//       program,
//       conditionalExpression,
//       underlyingTokenMint
//     );

//     const depositAccount = await accountInitUtils.initializeDepositAccount(
//       program,
//       conditionalVault
//     );

//     const userUnderlyingTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       provider.wallet.publicKey
//     );

//     const underlyingAmountToMint = 1000;
//     const conditionalAmountToMint = 400;

//     await token.mintTo(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       userUnderlyingTokenAccount,
//       underlyingTokenMintAuthority,
//       underlyingAmountToMint
//     );

//     const userConditionalTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       conditionalTokenMint,
//       provider.wallet.publicKey
//     );

//     await utils.mintConditionalTokens(
//       program,
//       conditionalVault,
//       conditionalAmountToMint,
//       depositAccount,
//       userUnderlyingTokenAccount,
//       userConditionalTokenAccount
//     );
//   });

//   it("Adversary cannot mint conditional tokens without an equivalent amount of underlying tokens", async () => {
//     const proposalNumber = 38910;
//     const redeemableOnPass = false;

//     const proposal = await accountInitUtils.initializeProposalAccount(
//       program,
//       proposalNumber
//     );

//     const conditionalExpression =
//       await accountInitUtils.initializeConditionalExpression(
//         program,
//         proposal,
//         redeemableOnPass
//       );

//     const [underlyingTokenMint, underlyingTokenMintAuthority] =
//       await accountInitUtils.initializeUnderlyingTokenMint(provider);

//     const [
//       conditionalVault,
//       conditionalTokenMint,
//       vaultUnderlyingTokenAccount,
//     ] = await accountInitUtils.initializeConditionalVault(
//       program,
//       conditionalExpression,
//       underlyingTokenMint
//     );

//     const depositAccount = await accountInitUtils.initializeDepositAccount(
//       program,
//       conditionalVault
//     );

//     const userUnderlyingTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       provider.wallet.publicKey
//     );

//     const underlyingAmountToMint = 200;
//     const conditionalAmountToMint = 400;

//     await token.mintTo(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       userUnderlyingTokenAccount,
//       underlyingTokenMintAuthority,
//       underlyingAmountToMint
//     );

//     const userConditionalTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       conditionalTokenMint,
//       provider.wallet.publicKey
//     );

//     try {
//       await program.methods
//         .mintConditionalTokens(new anchor.BN(conditionalAmountToMint))
//         .accounts({
//           conditionalVault,
//           tokenProgram: token.TOKEN_PROGRAM_ID,
//           conditionalTokenMint,
//           user: provider.wallet.publicKey,
//           depositAccount,
//           vaultUnderlyingTokenAccount,
//           userUnderlyingTokenAccount,
//           userConditionalTokenAccount,
//         })
//         .rpc();
//       assert.fail();
//     } catch (err) {
//       assert.ok(err.logs.includes("Program log: Error: insufficient funds"));
//     }
//   });

//   it("Adversary tries to mint conditional tokens with underlying tokens that don't match the vault's underlying tokens", async () => {
//     const proposalNumber = 38910;
//     const redeemableOnPass = false;

//     const proposal = await accountInitUtils.initializeProposalAccount(
//       program,
//       proposalNumber
//     );

//     const conditionalExpression =
//       await accountInitUtils.initializeConditionalExpression(
//         program,
//         proposal,
//         redeemableOnPass
//       );

//     const [underlyingTokenMint, underlyingTokenMintAuthority] =
//       await accountInitUtils.initializeUnderlyingTokenMint(provider);

//     const [
//       conditionalVault,
//       conditionalTokenMint,
//       vaultUnderlyingTokenAccount,
//     ] = await accountInitUtils.initializeConditionalVault(
//       program,
//       conditionalExpression,
//       underlyingTokenMint
//     );

//     const prankUnderlyingTokenMintAuthority = anchor.web3.Keypair.generate();
//     const prankUnderlyingTokenMint = await token.createMint(
//       provider.connection,
//       provider.wallet.payer,
//       prankUnderlyingTokenMintAuthority.publicKey,
//       null,
//       2
//     );
//     const prankUserUnderlyingTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       prankUnderlyingTokenMint,
//       provider.wallet.publicKey
//     );
//     const prankVaultUnderlyingTokenAccount =
//       await token.getOrCreateAssociatedTokenAccount(
//         provider.connection,
//         provider.wallet.payer,
//         prankUnderlyingTokenMint,
//         conditionalVault,
//         true
//       );

//     const depositAccount = await accountInitUtils.initializeDepositAccount(
//       program,
//       conditionalVault
//     );

//     const underlyingAmountToMint = 1000;
//     const conditionalAmountToMint = 400;

//     await token.mintTo(
//       provider.connection,
//       provider.wallet.payer,
//       prankUnderlyingTokenMint,
//       prankUserUnderlyingTokenAccount,
//       prankUnderlyingTokenMintAuthority,
//       underlyingAmountToMint
//     );

//     const userConditionalTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       conditionalTokenMint,
//       provider.wallet.publicKey
//     );

//     // a hack, maybe there's a better way to do this
//     let failedForRightReasons = true;
//     try {
//       await program.methods
//         .mintConditionalTokens(new anchor.BN(conditionalAmountToMint))
//         .accounts({
//           conditionalVault,
//           tokenProgram: token.TOKEN_PROGRAM_ID,
//           conditionalTokenMint,
//           user: provider.wallet.publicKey,
//           depositAccount,
//           vaultUnderlyingTokenAccount,
//           userUnderlyingTokenAccount: prankUserUnderlyingTokenAccount,
//           userConditionalTokenAccount,
//         })
//         .rpc();
//       failedForRightReasons = false;
//       assert.fail();
//     } catch (err) {
//       assert.ok(failedForRightReasons);
//     }
//   });

//   it("Adversary tries to redeem a deposit account multiple times", async () => {
//     const proposalNumber = 391031;
//     const redeemableOnPass = true;

//     const proposal = await accountInitUtils.initializeProposalAccount(
//       program,
//       proposalNumber
//     );

//     const conditionalExpression =
//       await accountInitUtils.initializeConditionalExpression(
//         program,
//         proposal,
//         redeemableOnPass
//       );

//     const [underlyingTokenMint, underlyingTokenMintAuthority] =
//       await accountInitUtils.initializeUnderlyingTokenMint(provider);

//     const [
//       conditionalVault,
//       conditionalTokenMint,
//       vaultUnderlyingTokenAccount,
//     ] = await accountInitUtils.initializeConditionalVault(
//       program,
//       conditionalExpression,
//       underlyingTokenMint
//     );

//     const depositAccount = await accountInitUtils.initializeDepositAccount(
//       program,
//       conditionalVault
//     );

//     const userUnderlyingTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       provider.wallet.publicKey
//     );

//     const underlyingAmountToMint = 1000;
//     const conditionalAmountToMint = 400;

//     await token.mintTo(
//       provider.connection,
//       provider.wallet.payer,
//       underlyingTokenMint,
//       userUnderlyingTokenAccount,
//       underlyingTokenMintAuthority,
//       underlyingAmountToMint
//     );

//     const userConditionalTokenAccount = await token.createAccount(
//       provider.connection,
//       provider.wallet.payer,
//       conditionalTokenMint,
//       provider.wallet.publicKey
//     );

//     await utils.mintConditionalTokens(
//       program,
//       conditionalVault,
//       conditionalAmountToMint,
//       depositAccount,
//       userUnderlyingTokenAccount,
//       userConditionalTokenAccount
//     );

//     await program.methods
//       .failProposal()
//       .accounts({
//         proposal,
//       })
//       .rpc();

//     // first one should be fine
//     await utils.redeemDepositAccountForUnderlyingTokens(
//       program,
//       depositAccount,
//       userUnderlyingTokenAccount,
//       conditionalVault,
//       proposal
//     );

//     assert.equal(
//       (await token.getAccount(provider.connection, userUnderlyingTokenAccount))
//         .amount,
//       BigInt(underlyingAmountToMint)
//     );
    
//     // second one should also go through, but shouldn't increase user's balance
//     await utils.redeemDepositAccountForUnderlyingTokens(
//       program,
//       depositAccount,
//       userUnderlyingTokenAccount,
//       conditionalVault,
//       proposal
//     );

//     assert.equal(
//       (await token.getAccount(provider.connection, userUnderlyingTokenAccount))
//         .amount,
//       BigInt(underlyingAmountToMint)
//     );
//   });
// });
