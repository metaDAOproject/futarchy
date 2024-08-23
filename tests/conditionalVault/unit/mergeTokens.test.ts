import { sha256, ConditionalVaultClient } from "@metadaoproject/futarchy";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createAssociatedTokenAccount, createMint, getAccount, mintTo } from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";

export default function suite() {
    let vaultClient: ConditionalVaultClient;
    let question: PublicKey;
    let vault: PublicKey;
    let underlyingTokenMint: PublicKey;
    let userUnderlyingTokenAccount: PublicKey;
    before(function () {
        vaultClient = this.vaultClient;
    });

    beforeEach(async function () {
        let questionId = sha256(new Uint8Array([9, 2, 1]));
        let oracle = Keypair.generate();

        question = await vaultClient.initializeQuestion(
            questionId,
            oracle.publicKey,
            2
        );

        underlyingTokenMint = await createMint(
            this.banksClient,
            this.payer,
            this.payer.publicKey,
            null,
            8
        );

        vault = await vaultClient.initializeNewVault(
            question,
            underlyingTokenMint,
            2
        );

        userUnderlyingTokenAccount = await createAssociatedTokenAccount(
            this.banksClient,
            this.payer,
            underlyingTokenMint,
            this.payer.publicKey
        );

        // Mint some underlying tokens to the user's account
        await mintTo(
            this.banksClient,
            this.payer,
            underlyingTokenMint,
            userUnderlyingTokenAccount,
            this.payer,
            1000
        );


        await vaultClient
            .splitTokensIx(question, vault, underlyingTokenMint, new anchor.BN(1000), 2)
            .rpc();
    });

    it("merges tokens", async function () {
        const balanceBefore = await getAccount(this.banksClient, token.getAssociatedTokenAddressSync(underlyingTokenMint, this.payer.publicKey)).then(acc => acc.amount);
        await vaultClient
            .mergeTokensIx(question, vault, underlyingTokenMint, new anchor.BN(600), 2)
            .rpc();
        const balanceAfter = await getAccount(this.banksClient, token.getAssociatedTokenAddressSync(underlyingTokenMint, this.payer.publicKey)).then(acc => acc.amount);

        assert.isTrue(balanceAfter > balanceBefore);
        assert.equal(balanceAfter - balanceBefore, 600);
    });
}