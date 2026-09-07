import { PERMISSIONLESS_ACCOUNT } from "@metadaoproject/programs";
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import type { ProbeResult } from "./daoActions.js";

// Returns the multisig, spending limit and 0th vault pda for a given dao address
export const getSquadsPdasFromDao = async (
  daoAddress: string | PublicKey,
): Promise<{
  multisigPda: PublicKey;
  spendingLimitPda: PublicKey;
  vaultPda: PublicKey;
}> => {
  const dao =
    typeof daoAddress === "string" ? new PublicKey(daoAddress) : daoAddress;
  const [multisigPda] = multisig.getMultisigPda({
    createKey: dao,
  });

  const [spendingLimitPda] = multisig.getSpendingLimitPda({
    multisigPda: multisigPda,
    createKey: dao,
  });

  const [vaultPda] = multisig.getVaultPda({
    multisigPda: multisigPda,
    index: 0,
  });

  return {
    multisigPda,
    spendingLimitPda,
    vaultPda,
  };
};

export const createSquadsVaultTxAndProposal = async (
  squadsMultisig: PublicKey,
  transactionIndex: bigint,
  transactionMessage: TransactionMessage,
  payer: PublicKey,
  creator: PublicKey = PERMISSIONLESS_ACCOUNT.publicKey,
) => {
  const vaultTxCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda: squadsMultisig,
    transactionIndex: transactionIndex,
    creator,
    rentPayer: payer,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage,
  });

  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda: squadsMultisig,
    transactionIndex: transactionIndex,
    creator,
    rentPayer: payer,
    isDraft: false,
  });

  return {
    vaultTxCreateIx,
    proposalCreateIx,
  };
};

// Whether a vault transaction's message holds exactly `instructions`: the
// same programs, accounts (in order) and data, with no lookup tables
const holdsInstructions = (
  message: multisig.generated.VaultTransactionMessage,
  instructions: TransactionInstruction[],
) =>
  message.addressTableLookups.length === 0 &&
  message.instructions.length === instructions.length &&
  message.instructions.every((compiled, i) => {
    const instruction = instructions[i];
    const accounts = Array.from(compiled.accountIndexes).map(
      (index) => message.accountKeys[index],
    );
    return (
      message.accountKeys[compiled.programIdIndex]?.equals(
        instruction.programId,
      ) &&
      accounts.length === instruction.keys.length &&
      accounts.every((account, j) =>
        account?.equals(instruction.keys[j].pubkey),
      ) &&
      Buffer.from(compiled.data).equals(instruction.data)
    );
  });

/**
 * Probes the vault transaction at `vaultTransactionPda`: absent, holding
 * exactly `instructions` (landed - either ours or an identical one, which
 * amounts to the same), or holding something else (taken - another proposal
 * got the transaction index).
 */
export const probeSquadsVaultTransaction = async (
  connection: Connection,
  vaultTransactionPda: PublicKey,
  instructions: TransactionInstruction[],
): Promise<ProbeResult> => {
  const accountInfo = await connection.getAccountInfo(
    vaultTransactionPda,
    "confirmed",
  );
  if (!accountInfo) {
    return "absent";
  }
  const [vaultTransaction] =
    multisig.accounts.VaultTransaction.fromAccountInfo(accountInfo);
  return holdsInstructions(vaultTransaction.message, instructions)
    ? "landed"
    : "taken";
};
