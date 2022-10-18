import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";

const BIG_ENDIAN = "be";

export async function generateConditionalExpressionPDAAddress(
  program: Program,
  proposalNumber: number,
  redeemableOnPass: boolean
) {
  const [conditionalExpressionPDAAddress] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("conditional-expression"),
        new anchor.BN(proposalNumber).toBuffer(BIG_ENDIAN, 8),
        Buffer.from([redeemableOnPass]),
      ],
      program.programId
    );

  return conditionalExpressionPDAAddress;
}

export async function generateConditionalVaultPDAAddress(
  program: Program,
  conditionalExpressionAddress: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey
) {
  const [conditionalVaultPDAAddress] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("conditional-vault"),
        conditionalExpressionAddress.toBuffer(),
        mint.toBuffer(),
      ],
      program.programId
    );
  return conditionalVaultPDAAddress;
}

export async function generateDepositAccountPDAAddress(
  program: Program,
  conditionalVault: anchor.web3.PublicKey,
  user: anchor.web3.PublicKey
) {
  const [depositAccountPDAAddress] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("deposit-account"),
        conditionalVault.toBuffer(),
        user.toBuffer(),
      ],
      program.programId
    );

  return depositAccountPDAAddress;
}
