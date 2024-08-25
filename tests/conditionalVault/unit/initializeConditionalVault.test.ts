import {
  sha256,
  ConditionalVaultClient,
  getVaultAddr,
  getConditionalTokenMintAddr,
} from "@metadaoproject/futarchy";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, getMint } from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";

export default function suite() {
  let vaultClient: ConditionalVaultClient;
  let underlyingTokenMint: PublicKey;

  before(async function () {
    vaultClient = this.vaultClient;
    underlyingTokenMint = await createMint(
      this.banksClient,
      this.payer as Keypair,
      Keypair.generate().publicKey,
      null,
      8
    );
  });

  const testCases = [
    { name: "2-outcome question", idArray: [3, 2, 1], outcomes: 2 },
    { name: "3-outcome question", idArray: [4, 5, 6], outcomes: 3 },
    { name: "4-outcome question", idArray: [7, 8, 9], outcomes: 4 },
  ];

  testCases.forEach(({ name, idArray, outcomes }) => {
    describe(name, function () {
      let question: PublicKey;
      let oracle: Keypair = Keypair.generate();

      beforeEach(async function () {
        let questionId = sha256(new Uint8Array(idArray));
        question = await vaultClient.initializeQuestion(
          questionId,
          oracle.publicKey,
          outcomes
        );
      });

      it("initializes vaults correctly", async function () {
        await vaultClient
          .initializeVaultIx(question, underlyingTokenMint, outcomes)
          .rpc();

        const [vault, pdaBump] = getVaultAddr(
          vaultClient.vaultProgram.programId,
          question,
          underlyingTokenMint
        );

        const storedVault = await vaultClient.fetchVault(vault);
        assert.ok(storedVault.question.equals(question));
        assert.ok(storedVault.underlyingTokenMint.equals(underlyingTokenMint));

        const vaultUnderlyingTokenAccount = token.getAssociatedTokenAddressSync(
          underlyingTokenMint,
          vault,
          true
        );
        assert.ok(
          storedVault.underlyingTokenAccount.equals(vaultUnderlyingTokenAccount)
        );
        const storedConditionalTokenMints = storedVault.conditionalTokenMints;
        storedConditionalTokenMints.forEach((mint, i) => {
          const [expectedMint] = getConditionalTokenMintAddr(
            vaultClient.vaultProgram.programId,
            vault,
            i
          );
          assert.ok(mint.equals(expectedMint));
        });
        assert.equal(storedVault.pdaBump, pdaBump);
        assert.equal(storedVault.decimals, 8);

        for (let mint of storedConditionalTokenMints) {
          const storedMint = await getMint(this.banksClient, mint);
          assert.ok(storedMint.mintAuthority.equals(vault));
          assert.equal(storedMint.supply.toString(), "0");
          assert.equal(storedMint.decimals, 8);
          assert.isNull(storedMint.freezeAuthority);
        }
      });
    });
  });
}
