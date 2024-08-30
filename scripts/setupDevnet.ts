import * as token from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { ConditionalVaultAccount, ConditionalVaultClient, getQuestionAddr, getVaultAddr } from "@metadaoproject/futarchy/v0.4";
import { sha256 } from "@metadaoproject/futarchy";
import { Question } from "@metadaoproject/futarchy/v0.4";


const provider = anchor.AnchorProvider.env();
const payer = provider.wallet["payer"];
const vaultProgram: ConditionalVaultClient = ConditionalVaultClient.createClient({ provider });

async function main() {
    const questionId = sha256(
        new TextEncoder().encode(
            "Grant ID #1/E-UP/E-DOWN"
        )
    );
    const question = getQuestionAddr(vaultProgram.vaultProgram.programId, questionId, payer.publicKey, 2)[0];
    const storedQuestion: Question | null = await vaultProgram.fetchQuestion(question);

    if (!storedQuestion) {
        await vaultProgram.initializeQuestionIx(questionId, payer.publicKey, 2).rpc();
    }

    const underlyingMint = await token.createMint(provider.connection, payer, payer.publicKey, null, 6);

    const vault = getVaultAddr(vaultProgram.vaultProgram.programId, question, underlyingMint)[0];
    const storedVault: ConditionalVaultAccount | null = await vaultProgram.fetchVault(vault);

    if (!storedVault) {
        await vaultProgram.initializeVaultIx(question, underlyingMint, 2).rpc();
    }

    console.log(await vaultProgram.fetchVault(vault));

}

main();

