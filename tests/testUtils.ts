import { randomBytes } from "crypto";

import { ProgramFacade } from "./programFacade";

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
  program: ProgramFacade
): Promise<[PublicKey, PublicKey]> => {
  const memberToAdd = await program.initializeMember(randomMemberName());
  const metaDAO = await program.getOrCreateMetaDAO();

  const [proposalAccounts, proposalInstructions] =
    sampleProposalAccountsAndInstructions(
      program.program,
      metaDAO,
      memberToAdd
    );
  const proposal = await program.initializeProposal(
    metaDAO,
    proposalInstructions,
    proposalAccounts
  );

  return [proposal, memberToAdd];
};

export const executeSampleProposal = async (
  sampleProposal: PublicKey,
  memberToAdd: PublicKey,
  programFacade: ProgramFacade
) => {
  const metaDAO = await programFacade.getOrCreateMetaDAO();
  const program = programFacade.program;

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
  
  await programFacade.executeProposal(sampleProposal, accountInfos);
};
