import { ConditionalVaultClient, sha256 } from "@metadaoproject/futarchy";
import { Keypair, PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { assert } from "chai";
import { createMint, getMint, mintTo, createAssociatedTokenAccount, transfer } from "spl-token-bankrun";
import * as token from "@solana/spl-token";

export default async function test() {
    // A binary prediction market test. Alice, Bob, and Charlie are betting on
    // who's going to win the next election: Trump or Harris. Alice and Bob each
    // split 100 USDC into TRUMP and HARRIS tokens. Alice is a trump supporter
    // and buys 30 TRUMP tokens in exchange for 40 HARRIS tokens from Bob. Charlie
    // buys an additional 30 HARRIS tokens from Alice.

    // Alice should have 130 TRUMP and 30 HARRIS tokens. Bob should have 70 TRUMP
    // and 140 HARRIS tokens. Charlie should have 30 HARRIS tokens.

    // Alice faces a cash crunch, and merges 15 TRUMP and 15 HARRIS tokens into 15
    // USDC. She should now have 15 USDC, 15 TRUMP, and 15 HARRIS tokens.

    // Bob becomes a trump supporter, and as a display of his newfound
    // allegiance, he sends all of his HARRIS tokens to the vault (to burn them).
    // Bob should now have 70 TRUMP tokens.

    // The market resolves in favor of Harris. When redeeming, Alice should get 15
    // USDC, Bob should get nothing, and Charlie should get 30 USDC.

    let vaultClient: ConditionalVaultClient = this.vaultClient;

    let alice: Keypair = Keypair.generate();
    let bob: Keypair = Keypair.generate();
    let charlie: Keypair = Keypair.generate();
    let operator: Keypair = Keypair.generate();

    let question: PublicKey = await vaultClient.initializeQuestion(sha256(new TextEncoder().encode("Who's going to win the next election?")), operator.publicKey, 2);

    let USDC: PublicKey = await createMint(this.banksClient, this.payer, operator.publicKey, null, 6);

    let createUSDCAccount = async (owner: PublicKey) => {
        return await createAssociatedTokenAccount(
            this.banksClient,
            this.payer,
            USDC,
            owner
        );
    }

    let aliceUSDC = await createUSDCAccount(alice.publicKey);
    let bobUSDC = await createUSDCAccount(bob.publicKey);
    let charlieUSDC = await createUSDCAccount(charlie.publicKey);

    await mintTo(
        this.banksClient,
        this.payer,
        USDC,
        aliceUSDC,
        operator,
        100 * 10 ** 6
    );

    await mintTo(
        this.banksClient,
        this.payer,
        USDC,
        bobUSDC,
        operator,
        100 * 10 ** 6
    );

    const vault = await vaultClient.initializeNewVault(question, USDC, 2);
    const storedVault = await vaultClient.fetchVault(vault);

    await vaultClient.splitTokensIx(question, vault, USDC, new BN(100 * 10 ** 6), 2, alice).signers([alice]).rpc();

    await vaultClient.splitTokensIx(question, vault, USDC, new BN(100 * 10 ** 6), 2, bob).signers([bob]).rpc();

    const TRUMP = storedVault.conditionalTokenMints[0];
    const HARRIS = storedVault.conditionalTokenMints[1];

    const aliceTRUMP = token.getAssociatedTokenAddressSync(TRUMP, alice.publicKey);
    const aliceHARRIS = token.getAssociatedTokenAddressSync(HARRIS, alice.publicKey);

    const bobTRUMP = token.getAssociatedTokenAddressSync(TRUMP, bob.publicKey);
    const bobHARRIS = token.getAssociatedTokenAddressSync(HARRIS, bob.publicKey);

    await transfer(this.banksClient, this.payer, aliceHARRIS, bobHARRIS, alice, new BN(30 * 10 ** 6));
    await transfer(this.banksClient, this.payer, bobTRUMP, aliceTRUMP, bob, new BN(40 * 10 ** 6));

    await vaultClient.mergeTokensIx(question, vault, USDC, new BN(15 * 10 ** 6), 2, alice).signers([alice]).rpc();



    // const aliceHARRIS = await createAssociatedTokenAccount(this.banksClient, this.payer, HARRIS, alice.publicKey);



    // storedVault.



    //     banksClient: BanksClient,
    //   payer: Signer,
    //   source: PublicKey,
    //   destination: PublicKey,
    //   owner: PublicKey | Signer,
    //   amount: number | bigint,





    // let question: PublicKey = PublicKey.default;
    // let vault: PublicKey = PublicKey.default;
    // let underlyingTokenMint: PublicKey = PublicKey.default;

    // await vaultClient.initializeQuestion(question, underlyingTokenMint, [alice.publicKey, bob.publicKey], 2);
}