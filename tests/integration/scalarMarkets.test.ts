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
  
    let bob: Keypair = Keypair.generate();
    let carol: Keypair = Keypair.generate();
    let dan: Keypair = Keypair.generate();
    let alice: Keypair = Keypair.generate();
    let operator: Keypair = Keypair.generate();

    //tests varying numOutcomes TODO: get back to this once we figure out how to create markets with more than 2 outcomes
    console.log("Testing varying numOutcomes");
    const colors = ["red", "blue", "green", "yellow", "purple"];
    for (let i = 2; i <= 5; i++) {
        let question: PublicKey = await vaultClient.initializeQuestion(
            sha256(new TextEncoder().encode("What is the color of the sky?" + colors.slice(0, i).map(color => `/${color}`).join(""))),
            operator.publicKey,
            i // numOutcomes
        );
        let USDC: PublicKey = await this.createMint(operator.publicKey, 6);
        await this.createTokenAccount(USDC, this.payer.publicKey);
        await this.mintTo(USDC, this.payer.publicKey, operator, 10000 * 10 ** 6);
        const vault = await vaultClient.initializeVault(question, USDC, i);
        const storedVault = await vaultClient.fetchVault(vault);
        const conditionalTokenMints = storedVault.conditionalTokenMints;
        assert.isTrue(conditionalTokenMints.length === i);
        console.log("Number of conditional token mints: ", conditionalTokenMints.length);

        for (let j = 0; j < i; j++) {
            await this.createTokenAccount(conditionalTokenMints[j], alice.publicKey);
        }
    }
  
    const numOutcomes = 2;
  
    console.log("Initializing question: Will Donald Trump get the W?/YES/NO");
    let question: PublicKey = await vaultClient.initializeQuestion(
      sha256(new TextEncoder().encode("Will Donald Trump get the W?/YES/NO")),
      operator.publicKey,
      numOutcomes
    );
  
    let USDC: PublicKey = await this.createMint(operator.publicKey, 6);
  
    const usdcAccount = await this.createTokenAccount(USDC, this.payer.publicKey);
    const payerMintAmount = 10000000 * 10 ** 6;
    await this.mintTo(USDC, this.payer.publicKey, operator, payerMintAmount);
  
    this.createTokenAccount(USDC, alice.publicKey);
    const aliceMintAmount = 10000000 * 10 ** 6;
    await this.mintTo(USDC, alice.publicKey, operator, aliceMintAmount);

    this.createTokenAccount(USDC, bob.publicKey);
    const bobMintAmount = 10000000 * 10 ** 6;
    await this.mintTo(USDC, bob.publicKey, operator, bobMintAmount);

    this.createTokenAccount(USDC, carol.publicKey);
    const carolMintAmount = 10000000 * 10 ** 6;
    await this.mintTo(USDC, carol.publicKey, operator, carolMintAmount);

    this.createTokenAccount(USDC, dan.publicKey);
    const danMintAmount = 10000000 * 10 ** 6;
    await this.mintTo(USDC, dan.publicKey, operator, danMintAmount);
  
    const vault = await vaultClient.initializeVault(question, USDC, numOutcomes);
    const storedVault = await vaultClient.fetchVault(vault);
  
    const YES = storedVault.conditionalTokenMints[0];
    const NO = storedVault.conditionalTokenMints[1];
  
    // Initialize AMM
    await ammClient
      .initializeAmmIx(
        YES,
        NO,
        new BN(100), 
        new BN(1000)
      )
      .rpc();
    const amm = getAmmAddr(ammClient.getProgramId(), YES, NO)[0];
  
    // Create token accounts for Alice, Bob, Carol, and Dan
    await this.createTokenAccount(YES, alice.publicKey);
    await this.createTokenAccount(NO, alice.publicKey);
    await this.createTokenAccount(YES, bob.publicKey);
    await this.createTokenAccount(NO, bob.publicKey);
    await this.createTokenAccount(YES, carol.publicKey);
    await this.createTokenAccount(NO, carol.publicKey);
    await this.createTokenAccount(YES, dan.publicKey);
    await this.createTokenAccount(NO, dan.publicKey);
  
    //ensure addLiquidityIx fails with 0 amounts
    let failed = false;
    try {
        await ammClient
          .addLiquidityIx(
            amm,
            YES,
            NO,
            new BN(0),
            new BN(0),
            new BN(numOutcomes),
            this.payer.publicKey
          )
          .rpc();
    } catch (e) {
      failed = true;
    }
    assert.isTrue(failed, "addLiquidityIx should fail with 0 amounts");

    //ensure splitTokensIx gives 0 yes and no tokens with 0 usdc
    failed = false;
    await vaultClient
      .splitTokensIx(
        question,
        vault,
        USDC,
        new BN(0),
        numOutcomes,
        alice.publicKey
      )
      .signers([alice])
      .rpc();
    let yesBalance = await this.getTokenBalance(YES, alice.publicKey);
    let noBalance = await this.getTokenBalance(NO, alice.publicKey);
    assert.equal(yesBalance, new BN(0), "YES balance should be 0");
    assert.equal(noBalance, new BN(0), "NO balance should be 0");

    // return;
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

    //perform splitTokensIx for bob
    await vaultClient
      .splitTokensIx(
        question,
        vault,
        USDC,
        new BN(1000 * 10 ** 6),
        numOutcomes,
        bob.publicKey
      )
      .signers([bob])
      .rpc();
    yesBalance = await this.getTokenBalance(YES, bob.publicKey);
    noBalance = await this.getTokenBalance(NO, bob.publicKey);
    console.log("YES balance for bob: ", yesBalance);
    console.log("NO balance for bob: ", noBalance);

    return;
  
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
    yesBalance = await this.getTokenBalance(YES, alice.publicKey);
    noBalance = await this.getTokenBalance(NO, alice.publicKey);
  
    console.log("USDC balance: ", usdcBalance);
    console.log("YES balance: ", yesBalance);
    console.log("NO balance: ", noBalance);
    assert.equal(
      usdcBalance,
      aliceMintAmount - mintAmount.toNumber(),
      "Alice's USDC balance should be 9500000000"
    );
    assert.isTrue(
      yesBalance > 500 * 10 ** 6,
      "Alice's YES balance should be more than 500"
    );
    assert.equal(
      noBalance,
      250 * 10 ** 6,
      "Alice's NO balance should be less than 250"
    );
  }
  