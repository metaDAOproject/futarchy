import * as anchor from "@project-serum/anchor";

import { expect, assert } from "chai";

import {
  randomMemberName,
  sampleProposalAccountsAndInstructions,
  initializeSampleProposal,
  executeSampleProposal,
} from "./testUtils";

import { MetaDao as MetaDAO } from "../target/types/meta_dao";
import { AccountInitializer } from "./accountInitializer";
import { PDAGenerator } from "./pdaGenerator";

export type Program = anchor.Program<MetaDAO>;
export type PublicKey = anchor.web3.PublicKey;

describe("meta_dao", async function () {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MetaDao as Program;

  let initializer: AccountInitializer;
  let metaDAO: PublicKey;
  before(async function () {
    initializer = new AccountInitializer(program);
    metaDAO = await initializer.getOrCreateMetaDAO();
  });

  describe("#initialize_member", async function () {
    it("initializes members", async function () {
      await initializer.initializeMember(randomMemberName());
    });
  });

  describe("#initialize_meta_dao", async function () {
    it("initializes the Meta-DAO", async function () {
      assert.isNotNull(metaDAO);
    });
  });

  describe("#initialize_proposal", async function () {
    it("initializes proposals", async function () {
      await initializeSampleProposal(initializer);
    });

    it("rejects proposals that have non-members as signers", async function () {
      const [proposalAccounts, proposalInstructions] =
        sampleProposalAccountsAndInstructions(
          program,
          metaDAO,
          await initializer.initializeMember(randomMemberName())
        );

      proposalInstructions[0]["signer"] = {
        kind: { member: {} },
        pubkey: await initializer.initializeMember(randomMemberName()),
        pdaBump: 200,
      };
      await initializer
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
          program,
          metaDAO,
          await initializer.initializeMember(randomMemberName())
        );

      proposalInstructions[0]["signer"] = {
        kind: { metaDao: {} },
        pubkey: await initializer.initializeMember(randomMemberName()),
        pdaBump: 255,
      };
      await initializer
        .initializeProposal(metaDAO, proposalInstructions, proposalAccounts)
        .then(
          () =>
            assert.fail(
              "proposal failed to throw when there was an invalid Meta-DAO signer"
            ),
          (e) => assert.equal(e.error.errorCode.code, "InvalidMetaDAOSigner")
        );
    });

    it("", async function () {});
  });

  describe("#execute_proposal", async function () {
    it("executes proposals", async function () {
      const [proposal, memberToAdd] = await initializeSampleProposal(
        initializer
      );

      await executeSampleProposal(proposal, memberToAdd, initializer);
    });

    it("", async function () {});

    it("", async function () {});
  });

  describe("#initialize_conditional_expression", async function () {
    it("", async function () {});

    it("", async function () {});

    it("", async function () {});
  });

  describe("#initialize_conditional_vault", async function () {
    it("", async function () {});

    it("", async function () {});

    it("", async function () {});
  });

  describe("#initialize_deposit_slip", async function () {
    it("", async function () {});

    it("", async function () {});

    it("", async function () {});
  });

  describe("#mint_conditional_tokens", async function () {
    it("", async function () {});

    it("", async function () {});

    it("", async function () {});
  });

  describe("#redeem_conditional_tokens_for_underlying_tokens", async function () {
    it("", async function () {});

    it("", async function () {});

    it("", async function () {});
  });

  describe("#redeem_deposit_slip_for_underlying_tokens", async function () {
    it("", async function () {});

    it("", async function () {});

    it("", async function () {});
  });

  describe("#", async function () {
    it("", async function () {});

    it("", async function () {});

    it("", async function () {});
  });
});
