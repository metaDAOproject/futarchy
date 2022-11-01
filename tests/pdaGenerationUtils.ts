import * as anchor from "@project-serum/anchor";
import { Program } from "./metaDAO";

const BIG_ENDIAN = "be";

export async function generateMetaDAOPDAAddress(
  program: Program
) {
  const [metaDAOPDAAddress] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB"), 
      ],
      program.programId
    );

  return metaDAOPDAAddress;
}

export async function generateConditionalExpressionPDAAddress(
  program: Program,
  proposal: anchor.web3.PublicKey,
  redeemableOnPass: boolean
) {
  const [conditionalExpressionPDAAddress] =
    await anchor.web3.PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("conditional-expression"),
        proposal.toBuffer(),
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
