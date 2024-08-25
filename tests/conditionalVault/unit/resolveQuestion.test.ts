import { sha256, ConditionalVaultClient } from "@metadaoproject/futarchy";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";

export default function suite() {
  let vaultClient: ConditionalVaultClient;
  let question: PublicKey;
  let settlementAuthority: Keypair;

  before(function () {
    vaultClient = this.vaultClient;
  });

  beforeEach(async function () {
    let questionId = sha256(new Uint8Array([4, 2, 1]));
    settlementAuthority = Keypair.generate();
    question = await vaultClient.initializeQuestion(
      questionId,
      settlementAuthority.publicKey,
      2
    );
  });

  it("resolves questions", async function () {
    let storedQuestion = await vaultClient.fetchQuestion(question);

    assert.deepEqual(storedQuestion.payoutNumerators, [0, 0]);
    assert.equal(storedQuestion.payoutDenominator, 0);

    await vaultClient
      .resolveQuestionIx(question, settlementAuthority, [1, 0])
      .rpc();

    storedQuestion = await vaultClient.fetchQuestion(question);

    assert.deepEqual(storedQuestion.payoutNumerators, [1, 0]);
    assert.equal(storedQuestion.payoutDenominator, 1);
  });
}
