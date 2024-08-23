import { sha256, ConditionalVaultClient } from "@metadaoproject/futarchy";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createAssociatedTokenAccount, createMint, getAccount, getMint, mintTo } from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";

export default function suite() {
    let vaultClient: ConditionalVaultClient;
    let question: PublicKey;
    let vault: PublicKey;
    let underlyingTokenMint: PublicKey;

    before(function () {
        vaultClient = this.vaultClient;
    });

    beforeEach(async function () {
        let questionId = sha256(new Uint8Array([5, 2, 1]));
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

        let userUnderlyingTokenAccount = await createAssociatedTokenAccount(
            this.banksClient,
            this.payer,
            underlyingTokenMint,
            this.payer.publicKey
        );

        await mintTo(
            this.banksClient,
            this.payer,
            underlyingTokenMint,
            userUnderlyingTokenAccount,
            this.payer,
            10_000_000_000n
        );
    });

    it("splits tokens", async function () {
        await vaultClient
            .splitTokensIx(question, vault, underlyingTokenMint, new anchor.BN(1000), 2)
            .rpc();

        const storedVault = await vaultClient.fetchVault(vault);

        let storedVaultUnderlyingAcc = await getAccount(
            this.banksClient,
            storedVault.underlyingTokenAccount
        );
        assert.equal(storedVaultUnderlyingAcc.amount.toString(), "1000");

        const storedConditionalTokenMints = storedVault.conditionalTokenMints;
        for (let mint of storedConditionalTokenMints) {
            let storedMint = await getMint(
                this.banksClient,
                mint
            );
            assert.equal(storedMint.supply.toString(), "1000");
            let storedTokenAcc = await getAccount(
                this.banksClient,
                token.getAssociatedTokenAddressSync(mint, this.payer.publicKey)
                // await createAssociatedTokenAccount(this.banksClient, this.payer, mint, this.payer.publicKey)
            );
            assert.equal(storedTokenAcc.amount.toString(), "1000");
        }
    });
}