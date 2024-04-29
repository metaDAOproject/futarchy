import { AccountMeta, PublicKey } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";

export const getVaultAddr = (
  programId: PublicKey,
  settlementAuthority: PublicKey,
  underlyingTokenMint: PublicKey,
  proposal: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("conditional_vault"),
      settlementAuthority.toBuffer(),
      underlyingTokenMint.toBuffer(),
      proposal.toBuffer(),
    ],
    programId
  );
};

export const getVaultFinalizeMintAddr = (
  programId: PublicKey,
  vault: PublicKey
) => {
  return getVaultMintAddr(programId, vault, "conditional_on_finalize_mint");
};

export const getVaultRevertMintAddr = (
  programId: PublicKey,
  vault: PublicKey
) => {
  return getVaultMintAddr(programId, vault, "conditional_on_revert_mint");
};

const getVaultMintAddr = (
  programId: PublicKey,
  vault: PublicKey,
  seed: string
) => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode(seed), vault.toBuffer()],
    programId
  );
};

export const getDaoTreasuryAddr = (
  programId: PublicKey,
  dao: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync([dao.toBuffer()], programId);
};

export const getProposalInstructionsAddr = (
  programId: PublicKey,
  proposal: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("proposal_instructions"), proposal.toBuffer()],
    programId
  );
};

export const getProposalVaultAddr = (
  programId: PublicKey,
  proposal: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("proposal_vault"), proposal.toBuffer()],
    programId
  );
};

export const getAmmAddr = (
  programId: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  proposal: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("amm__"),
      baseMint.toBuffer(),
      quoteMint.toBuffer(),
      proposal.toBuffer(),
    ],
    programId
  );
};

export const getAmmLpMintAddr = (
  programId: PublicKey,
  amm: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("amm_lp_mint"), amm.toBuffer()],
    programId
  );
};

export const getAmmAuthAddr = (programId: PublicKey): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [utils.bytes.utf8.encode("amm_auth")],
    programId
  );
};

export const getATA = (mint: PublicKey, owner: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
};
