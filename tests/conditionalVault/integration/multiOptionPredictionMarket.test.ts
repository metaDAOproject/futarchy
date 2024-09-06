import { ConditionalVaultClient, sha256 } from "@metadaoproject/futarchy";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import {
  createMint,
  getMint,
  mintTo,
  createAssociatedTokenAccount,
  transfer,
  getAccount,
} from "spl-token-bankrun";
import * as token from "@solana/spl-token";

export default async function test() {
  // A 10-option prediction market test. Alice, Bob, and Charlie are betting on
  // which of 10 candidates will win the next election. Each splits 100 USDC into
  // 10 different token types (CAND1, CAND2, ..., CAND10).

  let vaultClient: ConditionalVaultClient = this.vaultClient;

  let alice: Keypair = Keypair.generate();
  let bob: Keypair = Keypair.generate();
  let charlie: Keypair = Keypair.generate();
  let operator: Keypair = Keypair.generate();

  const numCandidates = 9;

  let question: PublicKey = await vaultClient.initializeQuestion(
    sha256(
      new TextEncoder().encode(
        "Who's going to win the next election?/CAND1/CAND2/CAND3/CAND4/CAND5/CAND6/CAND7/CAND8/CAND9/CAND10"
      )
    ),
    operator.publicKey,
    numCandidates
  );

  let USDC: PublicKey = await this.createMint(operator.publicKey, 6);

  await this.createTokenAccount(USDC, alice.publicKey);
  await this.createTokenAccount(USDC, bob.publicKey);
  await this.createTokenAccount(USDC, charlie.publicKey);

  await this.mintTo(USDC, alice.publicKey, operator, 100);
  await this.mintTo(USDC, bob.publicKey, operator, 100);
  await this.mintTo(USDC, charlie.publicKey, operator, 100);

  const vault = await vaultClient.initializeVault(question, USDC, numCandidates);
  const storedVault = await vaultClient.fetchVault(vault);

  // Add metadata to conditional tokens
  for (let i = 0; i < numCandidates; i++) {
    await vaultClient.addMetadataToConditionalTokensIx(
      vault,
      i,
      `Candidate ${i + 1}`,
      `CAND${i + 1}`,
      `https://example.com/candidate${i + 1}.png`
    ).rpc();
  }

  // Split tokens for Alice, Bob, and Charlie
  await vaultClient
    .splitTokensIx(question, vault, USDC, new BN(100), numCandidates, alice.publicKey)
    .signers([alice])
    .rpc();

  await vaultClient
    .splitTokensIx(question, vault, USDC, new BN(100), numCandidates, bob.publicKey)
    .signers([bob])
    .rpc();

  await vaultClient
    .splitTokensIx(question, vault, USDC, new BN(100), numCandidates, charlie.publicKey)
    .signers([charlie])
    .rpc();

  // Perform some token transfers
  const candidateTokens = storedVault.conditionalTokenMints;

  // Alice believes in CAND1, Bob in CAND2, and Charlie in CAND3
  await this.transfer(candidateTokens[1], alice, bob.publicKey, 50);
  await this.transfer(candidateTokens[2], alice, charlie.publicKey, 50);
  await this.transfer(candidateTokens[0], bob, alice.publicKey, 50);
  await this.transfer(candidateTokens[2], bob, charlie.publicKey, 50);
  await this.transfer(candidateTokens[0], charlie, alice.publicKey, 50);
  await this.transfer(candidateTokens[1], charlie, bob.publicKey, 50);

  // Resolve the question (let's say CAND3 wins)
  const resolutionArray = Array(numCandidates).fill(0);
  resolutionArray[2] = 1; // CAND3 wins
  await vaultClient.resolveQuestionIx(question, operator, resolutionArray).rpc();

  // Redeem tokens
  await vaultClient
    .redeemTokensIx(question, vault, USDC, numCandidates, alice.publicKey)
    .signers([alice])
    .rpc();
  await vaultClient
    .redeemTokensIx(question, vault, USDC, numCandidates, bob.publicKey)
    .signers([bob])
    .rpc();
  await vaultClient
    .redeemTokensIx(question, vault, USDC, numCandidates, charlie.publicKey)
    .signers([charlie])
    .rpc();

  // Assert final balances
  await this.assertBalance(USDC, alice.publicKey, 50);
  await this.assertBalance(USDC, bob.publicKey, 50);
  await this.assertBalance(USDC, charlie.publicKey, 200); // Charlie wins!

  // Verify that all conditional token balances are now 0
  for (let i = 0; i < numCandidates; i++) {
    await this.assertBalance(candidateTokens[i], alice.publicKey, 0);
    await this.assertBalance(candidateTokens[i], bob.publicKey, 0);
    await this.assertBalance(candidateTokens[i], charlie.publicKey, 0);
  }
}
