import * as anchor from "@coral-xyz/anchor";

import { expect, assert } from "chai";
import { randomBytes } from "crypto";

import { ProgramFacade } from "./programFacade";

import {
  Program,
  PublicKey,
  Signer,
  ProposalState,
  RedemptionType,
} from "./autocrat";

export const expectError = (
  expectedErrorCode: string,
  message: string
): [() => void, (e: any) => void] => {
  return [
    () => assert.fail(message),
    (e) => {
      console.log(e);
      assert(
        e["error"] != undefined,
        `the program threw for a reason that we didn't expect. error: ${e}`
      );
      assert.equal(e.error.errorCode.code, expectedErrorCode);
    },
  ];
};

export const randomMemberName = () => randomBytes(5).toString("hex");

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

export const initializeSampleVault = async (
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

  const [vault, conditionalTokenMint, vaultUnderlyingTokenAccount] =
    await program.initializeVault(conditionalExpression, underlyingTokenMint);

  return [
    vault,
    conditionalTokenMint,
    vaultUnderlyingTokenAccount,
    underlyingTokenMint,
    underlyingTokenMintAuthority,
    conditionalExpression,
    proposal,
    memberToAdd,
  ];
};

// have `minter` mint conditional tokens, then move them to `holder`
export const mintConditionalTokens = async (
  program: ProgramFacade,
  minter: Signer,
  holder: Signer,
  amount: number,
  vault: PublicKey,
  vaultUnderlyingTokenAccount: PublicKey,
  underlyingTokenMint: PublicKey,
  underlyingTokenMintAuthority: Signer,
  conditionalTokenMint: PublicKey
) => {
  let minterUnderlyingTokenAccount = await program.createTokenAccount(
    underlyingTokenMint,
    minter.publicKey
  );

  let holderUnderlyingTokenAccount = await program.createTokenAccount(
    underlyingTokenMint,
    holder.publicKey
  );

  let minterConditionalTokenAccount = await program.createTokenAccount(
    conditionalTokenMint,
    minter.publicKey
  );

  let holderConditionalTokenAccount = await program.createTokenAccount(
    conditionalTokenMint,
    holder.publicKey
  );

  let minterDepositSlip = await program.initializeDepositSlip(
    vault,
    minter.publicKey
  );

  let holderDepositSlip = await program.initializeDepositSlip(
    vault,
    holder.publicKey
  );

  await program.mintTo(
    underlyingTokenMint,
    minterUnderlyingTokenAccount,
    underlyingTokenMintAuthority,
    amount
  );

  await program.mintConditionalTokens(
    amount,
    minter,
    minterDepositSlip,
    vault,
    vaultUnderlyingTokenAccount,
    minterUnderlyingTokenAccount,
    conditionalTokenMint,
    minterConditionalTokenAccount
  );

  await program.transfer(
    minterConditionalTokenAccount,
    holderConditionalTokenAccount,
    amount,
    minter
  );

  return [
    minterUnderlyingTokenAccount,
    minterConditionalTokenAccount,
    minterDepositSlip,
    holderUnderlyingTokenAccount,
    holderConditionalTokenAccount,
    holderDepositSlip,
  ];
};

export const testRedemption = async (
  programFacade: ProgramFacade,
  passOrFailFlag: boolean,
  desiredProposalState: ProposalState,
  redemptionType: RedemptionType,
  shouldGoThrough: boolean
) => {
  const [
    vault,
    conditionalTokenMint,
    vaultUnderlyingTokenAccount,
    underlyingTokenMint,
    underlyingTokenMintAuthority,
    conditionalExpression,
    proposal,
    memberToAdd,
  ] = await initializeSampleVault(programFacade, passOrFailFlag);

  let minter = anchor.web3.Keypair.generate();
  let holder = anchor.web3.Keypair.generate();
  let amount = 1000;

  const [
    minterUnderlyingTokenAccount,
    minterConditionalTokenAccount,
    minterDepositSlip,
    holderUnderlyingTokenAccount,
    holderConditionalTokenAccount,
    holderDepositSlip,
  ] = await mintConditionalTokens(
    programFacade,
    minter,
    holder,
    amount,
    vault,
    vaultUnderlyingTokenAccount,
    underlyingTokenMint,
    underlyingTokenMintAuthority,
    conditionalTokenMint
  );

  if (desiredProposalState == ProposalState.Passed) {
    await executeSampleProposal(proposal, memberToAdd, programFacade);
  } else if (desiredProposalState == ProposalState.Failed) {
    await programFacade.failProposal(proposal);
  }

  let expectedErrorCode;
  if (desiredProposalState == ProposalState.Pending) {
    expectedErrorCode = "ConditionalExpressionNotEvaluatable";
  } else if (redemptionType == RedemptionType.ConditionalToken) {
    expectedErrorCode = "CantRedeemConditionalTokens";
  } else {
    expectedErrorCode = "CantRedeemDepositSlip";
  }

  let callbacks;
  if (shouldGoThrough) {
    callbacks = [() => {}, (e) => assert.fail(e)];
  } else {
    callbacks = expectError(
      expectedErrorCode,
      "a redemption should have failed but instead suceeded"
    );
  }

  if (redemptionType == RedemptionType.ConditionalToken) {
    await programFacade
      .redeemConditionalForUnderlyingTokens(
        holder,
        holderConditionalTokenAccount,
        holderUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        proposal,
        conditionalExpression,
        conditionalTokenMint
      )
      .then(callbacks[0], callbacks[1]);
  } else {
    await programFacade
      .redeemDepositSlipForUnderlyingTokens(
        minter,
        minterDepositSlip,
        minterUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        proposal,
        conditionalExpression
      )
      .then(callbacks[0], callbacks[1]);
  }
};
