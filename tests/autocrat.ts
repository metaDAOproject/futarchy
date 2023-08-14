import * as anchor from "@project-serum/anchor";
import clobIDL from "./clob.json";

import { expect, assert } from "chai";

import {
  randomMemberName,
  sampleProposalAccountsAndInstructions,
  initializeSampleProposal,
  executeSampleProposal,
  initializeSampleConditionalExpression,
  initializeSampleVault,
  expectError,
  mintConditionalTokens,
  testRedemption as _testRedemption,
} from "./testUtils";

import { Autocrat } from "../target/types/autocrat";
import { ProgramFacade } from "./programFacade";

export type Program = anchor.Program<Autocrat>;
export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;

export enum ProposalState {
  Passed,
  Failed,
  Pending,
}

export enum RedemptionType {
  ConditionalToken,
  DepositSlip,
}

describe("autocrat", async function () {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const autocrat = anchor.workspace.Autocrat as Program;
  const clob = new anchor.Program(
    clobIDL,
    "22Y43yTVxuUkoRKdm9thyRhQ3SdgQS7c7kB6UNCiaczD"
  );

  let autocratFacade: ProgramFacade;
  let metaDAO: PublicKey;
  before(async function () {
    autocratFacade = new ProgramFacade(autocrat);
    metaDAO = await autocratFacade.getOrCreateMetaDAO();
  });

  describe("#initialize_member", async function () {
    it("initializes members", async function () {
      await autocratFacade.initializeMember(randomMemberName());
    });
  });

  describe("#initialize_meta_dao", async function () {
    it("initializes the Meta-DAO", async function () {
      assert.isNotNull(metaDAO);
    });
  });

  describe("#initialize_proposal", async function () {
    it("initializes proposals", async function () {
      await initializeSampleProposal(autocratFacade);
    });

    it("rejects proposals that have non-members as signers", async function () {
      const [proposalAccounts, proposalInstructions] =
        sampleProposalAccountsAndInstructions(
          autocrat,
          metaDAO,
          await autocratFacade.initializeMember(randomMemberName())
        );

      proposalInstructions[0]["signer"] = {
        kind: { member: {} },
        pubkey: await autocratFacade.initializeMember(randomMemberName()),
        pdaBump: 200,
      };
      await autocratFacade
        .initializeProposal(metaDAO, proposalInstructions, proposalAccounts)
        .then(
          () =>
            assert.fail(
              "proposal failed to throw when there was a non-member signer"
            ),
          (e) => assert.equal(e.error.errorCode.code, "InactiveMember")
        );
    });

    it("rejects proposals that mis-configure Meta-DAO signer objects", async function () {
      const [proposalAccounts, proposalInstructions] =
        sampleProposalAccountsAndInstructions(
          autocrat,
          metaDAO,
          await autocratFacade.initializeMember(randomMemberName())
        );

      proposalInstructions[0]["signer"] = {
        kind: { metaDao: {} },
        pubkey: await autocratFacade.initializeMember(randomMemberName()),
        pdaBump: 255,
      };
      await autocratFacade
        .initializeProposal(metaDAO, proposalInstructions, proposalAccounts)
        .then(
          () =>
            assert.fail(
              "proposal failed to throw when there was an invalid Meta-DAO signer"
            ),
          (e) => assert.equal(e.error.errorCode.code, "InvalidMetaDAOSigner")
        );
    });
  });

  describe("#execute_proposal", async function () {
    it("executes proposals", async function () {
      const [proposal, memberToAdd] = await initializeSampleProposal(
        autocratFacade
      );

      await executeSampleProposal(proposal, memberToAdd, autocratFacade);
    });
  });

  /* describe("#initialize_conditional_expression", async function () { */
  /*   it("initializes conditional expressions", async function () { */
  /*     const [proposal] = await initializeSampleProposal(autocratFacade); */

  /*     await autocratFacade.initializeConditionalExpression(proposal, true); */
  /*     await autocratFacade.initializeConditionalExpression(proposal, false); */
  /*   }); */
  /* }); */
});
