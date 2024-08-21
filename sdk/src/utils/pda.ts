import { AccountMeta, PublicKey } from "@solana/web3.js";
import { utils } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import BN from "bn.js";
import {
  fromWeb3JsPublicKey,
  toWeb3JsPublicKey,
} from "@metaplex-foundation/umi-web3js-adapters";
import { MPL_TOKEN_METADATA_PROGRAM_ID } from "../constants";

export const getQuestionAddr = (
  programId: PublicKey,
  questionId: Uint8Array,
  oracle: PublicKey,
  numConditions: number
) => {
  if (questionId.length != 32) {
    throw new Error("questionId must be 32 bytes");
  }

  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("question"),
      Buffer.from(questionId),
      oracle.toBuffer(),
      new BN(numConditions).toBuffer("le", 1),
    ],
    programId
  );
};

export const getVaultAddr = (
  programId: PublicKey,
  settlementAuthority: PublicKey,
  underlyingTokenMint: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("conditional_vault"),
      settlementAuthority.toBuffer(),
      underlyingTokenMint.toBuffer(),
    ],
    programId
  );
};

export const getConditionalTokenMintAddr = (
  programId: PublicKey,
  vault: PublicKey,
  index: number
) => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("conditional_token"),
      vault.toBuffer(),
      new BN(index).toBuffer("le", 1),
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

export const getMetadataAddr = (mint: PublicKey) => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );
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

export const getProposalAddr = (
  programId: PublicKey,
  proposer: PublicKey,
  nonce: BN
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("proposal"),
      proposer.toBuffer(),
      nonce.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
};

export const getAmmAddr = (
  programId: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey
): [PublicKey, number] => {
  return PublicKey.findProgramAddressSync(
    [
      utils.bytes.utf8.encode("amm__"),
      baseMint.toBuffer(),
      quoteMint.toBuffer(),
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
