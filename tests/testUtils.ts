import { expect, assert } from "chai";
import { randomBytes } from "crypto";

import { ProgramFacade } from "./programFacade";

import { Program, PublicKey, Signer } from "./metaDAO";

export const expectError = (
  expectedErrorCode: string,
  message: string
): [() => void, (e: any) => void] => {
  return [
    () => assert.fail(message),
    (e) => {
      assert(
        e["error"] != undefined,
        `the program threw for a reason that we didn't expect. error: ${e}`
      );
      assert.equal(e.error.errorCode.code, expectedErrorCode);
    },
  ];
};

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

export const initializeSampleConditionalExpression = async (
  program: ProgramFacade,
  passOrFailFlag: boolean = true
): Promise<[PublicKey, PublicKey, PublicKey]> => {
  const [proposal, memberToAdd] = await initializeSampleProposal(program);

  const conditionalExpression = await program.initializeConditionalExpression(
    proposal,
    passOrFailFlag
  );

  return [conditionalExpression, proposal, memberToAdd];
};

export const initializeSampleConditionalVault = async (
  program: ProgramFacade,
  passOrFailFlag: boolean = true
): Promise<
  [
    PublicKey,
    PublicKey,
    PublicKey,
    PublicKey,
    Signer,
    PublicKey,
    PublicKey,
    PublicKey
  ]
> => {
  const [conditionalExpression, proposal, memberToAdd] =
    await initializeSampleConditionalExpression(program, passOrFailFlag);

  const [underlyingTokenMint, underlyingTokenMintAuthority] =
    await program.createMint();

  const [conditionalVault, conditionalTokenMint, vaultUnderlyingTokenAccount] =
    await program.initializeConditionalVault(
      conditionalExpression,
      underlyingTokenMint
    );

  return [
    conditionalVault,
    conditionalTokenMint,
    vaultUnderlyingTokenAccount,
    underlyingTokenMint,
    underlyingTokenMintAuthority,
    conditionalExpression,
    proposal,
    memberToAdd,
  ];
};
