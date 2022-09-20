import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { ConditionalVault } from "../target/types/conditional_vault";
import { expect, assert } from "chai";
import * as token from "@solana/spl-token";

describe("Conditional vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace
    .ConditionalVault as Program<ConditionalVault>;

  it("Simple minting & burning flow", async () => {
    const proposalNumber = 324;
    const redeemableOnPass = true;

    const conditionalExpressionAcc =
      await generateConditionalExpressionPDAAddress(
        program,
        proposalNumber,
        redeemableOnPass
      );

    await program.methods
      .initializeConditionalExpression(
        new anchor.BN(proposalNumber),
        redeemableOnPass
      )
      .accounts({
        conditionalExpression: conditionalExpressionAcc,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedConditionalExpression =
      await program.account.conditionalExpression.fetch(
        conditionalExpressionAcc
      );

    assert.ok(
      storedConditionalExpression.proposalNumber.eq(
        new anchor.BN(proposalNumber)
      )
    );
    assert.equal(storedConditionalExpression.passOrFailFlag, redeemableOnPass);

    const mintAuthority = anchor.web3.Keypair.generate();

    const mint = await token.createMint(
      provider.connection,
      provider.wallet.payer,
      mintAuthority.publicKey,
      null,
      2
    );

    const conditionalVaultAcc = await generateConditionalVaultPDAAddress(
      program,
      conditionalExpressionAcc,
      mint
    );

    const vaultTokenAcc = (
      await token.getOrCreateAssociatedTokenAccount(
        provider.connection,
        provider.wallet.payer,
        mint,
        conditionalVaultAcc,
        true
      )
    ).address;

    await program.methods
      .initializeConditionalVault()
      .accounts({
        conditionalExpression: conditionalExpressionAcc,
        splTokenAccount: vaultTokenAcc,
        splMint: mint,
        conditionalVault: conditionalVaultAcc,
        initializer: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedConditionalVault = await program.account.conditionalVault.fetch(
      conditionalVaultAcc
    );

    assert.ok(
      storedConditionalVault.conditionalExpression.equals(
        conditionalExpressionAcc
      )
    );
    assert.ok(storedConditionalVault.splTokenAccount.equals(vaultTokenAcc));
    assert.ok(storedConditionalVault.splMint.equals(mint));

    const conditionalTokenAcc = await generateConditionalTokenAccountPDAAddress(
      program,
      conditionalVaultAcc,
      provider.wallet.publicKey // the provider's wallet will be the one minting
    );

    await program.methods
      .initializeConditionalTokenAccount()
      .accounts({
        conditionalVault: conditionalVaultAcc,
        conditionalTokenAccount: conditionalTokenAcc,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const storedConditionalTokenAccount =
      await program.account.conditionalTokenAccount.fetch(conditionalTokenAcc);

    assert.ok(
      storedConditionalTokenAccount.conditionalVault.equals(conditionalVaultAcc)
    );
    assert.ok(
      storedConditionalTokenAccount.authority.equals(provider.wallet.publicKey)
    );
    assert.ok(storedConditionalTokenAccount.balance.eq(new anchor.BN(0)));
    assert.ok(
      storedConditionalTokenAccount.depositedAmount.eq(new anchor.BN(0))
    );
  });
});

async function generateConditionalExpressionPDAAddress(
  program: Program,
  proposalNumber: number,
  redeemableOnPass: boolean
) {
  const [conditionalExpressionAcc] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("conditional-expression"),
        new anchor.BN(proposalNumber).toBuffer("be", 8),
        Buffer.from([redeemableOnPass]),
      ],
      program.programId
    );

  return conditionalExpressionAcc;
}

async function generateConditionalVaultPDAAddress(
  program: Program,
  conditionalExpressionAddress: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey
) {
  const [conditionalVaultAcc] = await anchor.web3.PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode("conditional-vault"),
      conditionalExpressionAddress.toBuffer(),
      mint.toBuffer(),
    ],
    program.programId
  );
  return conditionalVaultAcc;
}

async function generateConditionalTokenAccountPDAAddress(
  program: Program,
  conditionalVault: anchor.web3.PublicKey,
  user: anchor.web3.PublicKey
) {
  const [conditionalTokenAcc] = await anchor.web3.PublicKey.findProgramAddress(
    [
      anchor.utils.bytes.utf8.encode("conditional-token-account"),
      conditionalVault.toBuffer(),
      user.toBuffer(),
    ],
    program.programId
  );

  return conditionalTokenAcc;
}
