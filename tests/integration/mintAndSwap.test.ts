import {
  ConditionalVaultClient,
  AmmClient,
  getAmmAddr,
  SwapType,
  InstructionUtils,
} from "@metadaoproject/futarchy/v0.4";
import { sha256 } from "@noble/hashes/sha256";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";

export default async function test() {
  let vaultClient: ConditionalVaultClient = this.vaultClient;
  let ammClient: AmmClient = this.ammClient;

  let alice: Keypair = Keypair.generate();
  let operator: Keypair = Keypair.generate();

  const numOutcomes = 2;

  let question: PublicKey = await vaultClient.initializeQuestion(
    sha256(new TextEncoder().encode("Will it rain tomorrow?/YES/NO")),
    operator.publicKey,
    numOutcomes
  );

  let USDC: PublicKey = await this.createMint(operator.publicKey, 6);

  const usdcAccount = await this.createTokenAccount(USDC, this.payer.publicKey);
  await this.mintTo(USDC, this.payer.publicKey, operator, 10000 * 10 ** 6);

  this.createTokenAccount(USDC, alice.publicKey);
  await this.mintTo(USDC, alice.publicKey, operator, 10000 * 10 ** 6);

  const vault = await vaultClient.initializeVault(question, USDC, numOutcomes);
  const storedVault = await vaultClient.fetchVault(vault);

  const YES = storedVault.conditionalTokenMints[0];
  const NO = storedVault.conditionalTokenMints[1];

  // Initialize AMM
  await ammClient
    .initializeAmmIx(
      YES,
      NO,
      new BN(100), // fee
      new BN(1000) // k
    )
    .rpc();
  const amm = getAmmAddr(ammClient.getProgramId(), YES, NO)[0];

  // Create token accounts for Alice
  //   await this.createTokenAccount(YES, alice.publicKey);
  //   await this.createTokenAccount(NO, alice.publicKey);

  // Add initial liquidity to AMM
  await vaultClient
    .splitTokensIx(
      question,
      vault,
      USDC,
      new BN(1000 * 10 ** 6),
      numOutcomes,
      this.payer.publicKey
    )
    .rpc();
  await ammClient
    .addLiquidityIx(
      amm,
      YES,
      NO,
      new BN(500 * 10 ** 6),
      new BN(500 * 10 ** 6),
      new BN(0)
    )
    .rpc();

  // Perform mint and swap in the same transaction
  const mintAmount = new BN(500 * 10 ** 6);
  const swapAmount = new BN(250 * 10 ** 6);

  const mintTx = vaultClient.splitTokensIx(
    question,
    vault,
    USDC,
    mintAmount,
    numOutcomes,
    alice.publicKey
  );

  const swapTx = ammClient.swapIx(
    amm,
    YES,
    NO,
    { buy: {} },
    swapAmount,
    new BN(1),
    alice.publicKey
  );

  const instructions = await InstructionUtils.getInstructions(mintTx, swapTx);

  const tx = new Transaction().add(...instructions);
  tx.recentBlockhash = (await this.banksClient.getLatestBlockhash())[0];
  tx.feePayer = this.payer.publicKey;
  tx.sign(this.payer, alice);

  await this.banksClient.processTransaction(tx);

  // Assert balances
  const usdcBalance = await this.getTokenBalance(USDC, alice.publicKey);
  const yesBalance = await this.getTokenBalance(YES, alice.publicKey);
  const noBalance = await this.getTokenBalance(NO, alice.publicKey);

  assert.equal(
    usdcBalance,
    9500 * 10 ** 6,
    "Alice's USDC balance should be 9500000000"
  );
  assert.isAbove(
    Number(yesBalance),
    250 * 10 ** 6,
    "Alice's YES balance should be more than 250000000"
  );
  assert.equal(
    noBalance,
    250 * 10 ** 6,
    "Alice's NO balance should be less than 250000000"
  );
}
