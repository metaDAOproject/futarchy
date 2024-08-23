import { sha256, ConditionalVaultClient, getQuestionAddr } from "@metadaoproject/futarchy";
import { Keypair } from "@solana/web3.js";
import { assert } from "chai";

export default function suite() {
    let vaultClient: ConditionalVaultClient;
    before(function () {
        vaultClient = this.vaultClient;
    });

    it("initializes 2-outcome questions", async function () {
        let questionId = sha256(new Uint8Array([1, 2, 3]));

        let oracle = Keypair.generate();

        await vaultClient
            .initializeQuestionIx(questionId, oracle.publicKey, 2)
            .rpc();

        let [question] = getQuestionAddr(
            vaultClient.vaultProgram.programId,
            questionId,
            oracle.publicKey,
            2
        );

        const storedQuestion = await vaultClient.fetchQuestion(question);
        assert.deepEqual(storedQuestion.questionId, Array.from(questionId));
        assert.ok(storedQuestion.oracle.equals(oracle.publicKey));
        assert.deepEqual(storedQuestion.payoutNumerators, [0, 0]);
        assert.equal(storedQuestion.payoutDenominator, 0);
    });
}