import { randomBytes } from "crypto";

import { Program, PublicKey } from "./metaDAO";

export const randomMemberName = () => randomBytes(5).toString("hex");

export const sampleProposalAccountsAndInstructions = (
  program: Program,
  metaDAO: PublicKey,
  memberToAdd: PublicKey
) => {
  const proposalPid = program.programId;
  const proposalAccounts = [
    {
      pubkey: metaDAO,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: memberToAdd,
      isSigner: false,
      isWritable: false,
    },
  ];
  const proposalData = program.coder.instruction.encode("add_member", {});
  const proposalInstructions = [
    {
      signer: {
        kind: { metaDao: {} },
        pubkey: metaDAO,
        pdaBump: 255,
      },
      programId: proposalPid,
      accountIndexes: Buffer.from([0, 1]),
      data: proposalData,
    },
  ];

  return [proposalAccounts, proposalInstructions];
};
