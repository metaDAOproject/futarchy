import { randomBytes } from "crypto";

import { AccountInitializer } from "./accountInitializer";

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

export const initializeSampleProposal = async (
  initializer: AccountInitializer
): Promise<[PublicKey, PublicKey]> => {
  const memberToAdd = await initializer.initializeMember(randomMemberName());
  const metaDAO = await initializer.getOrCreateMetaDAO();

  const [proposalAccounts, proposalInstructions] =
    sampleProposalAccountsAndInstructions(
      initializer.program,
      metaDAO,
      memberToAdd
    );
  const proposal = await initializer.initializeProposal(
    metaDAO,
    proposalInstructions,
    proposalAccounts
  );

  return [proposal, memberToAdd];
};

export const executeSampleProposal = async (
  sampleProposal: PublicKey,
  memberToAdd: PublicKey,
  initializer: AccountInitializer
) => {
  const metaDAO = await initializer.getOrCreateMetaDAO();
  const program = initializer.program;

  let accountInfos = program.instruction.addMember
    .accounts({ metaDao: metaDAO, member: memberToAdd })
    .map((accountInfo) =>
      accountInfo.pubkey.equals(metaDAO)
        ? { ...accountInfo, isSigner: false }
        : accountInfo
    )
    .concat({
      pubkey: program.programId,
      isWritable: false,
      isSigner: false,
    });

  await program.methods
    .executeProposal()
    .accounts({
      proposal: sampleProposal,
    })
    .remainingAccounts(accountInfos)
    .rpc();
};
