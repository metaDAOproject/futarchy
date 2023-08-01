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

  describe("#initialize_conditional_expression", async function () {
    it("initializes conditional expressions", async function () {
      const [proposal] = await initializeSampleProposal(autocratFacade);

      await autocratFacade.initializeConditionalExpression(proposal, true);
      await autocratFacade.initializeConditionalExpression(proposal, false);
    });
  });

  describe("#initialize_vault", async function () {
    it("initializes vaults", async function () {
      await initializeSampleVault(autocratFacade);
    });
  });

  describe("#initialize_deposit_slip", async function () {
    it("initializes deposit slips", async function () {
      const [vault] = await initializeSampleVault(autocratFacade);
      await autocratFacade.initializeDepositSlip(
        vault,
        anchor.web3.Keypair.generate().publicKey
      );
    });
  });

  describe("#mint_conditional_tokens", async function () {
    let vault: PublicKey;
    let conditionalTokenMint: PublicKey;
    let vaultUnderlyingTokenAccount: PublicKey;
    let underlyingTokenMint: PublicKey;
    let underlyingTokenMintAuthority: Signer;

    let user: Signer;
    let amount: number;
    let userUnderlyingTokenAccount: PublicKey;
    let userConditionalTokenAccount: PublicKey;
    let depositSlip: PublicKey;

    before(async function () {
      [
        vault,
        conditionalTokenMint,
        vaultUnderlyingTokenAccount,
        underlyingTokenMint,
        underlyingTokenMintAuthority,
      ] = await initializeSampleVault(autocratFacade);
    });

    beforeEach(async function () {
      user = anchor.web3.Keypair.generate();
      amount = 1000;

      userUnderlyingTokenAccount = await autocratFacade.createTokenAccount(
        underlyingTokenMint,
        user.publicKey
      );

      userConditionalTokenAccount = await autocratFacade.createTokenAccount(
        conditionalTokenMint,
        user.publicKey
      );

      depositSlip = await autocratFacade.initializeDepositSlip(
        vault,
        user.publicKey
      );

      await autocratFacade.mintTo(
        underlyingTokenMint,
        userUnderlyingTokenAccount,
        underlyingTokenMintAuthority,
        amount
      );
    });

    it("mints conditional tokens", async function () {
      await autocratFacade.mintConditionalTokens(
        amount,
        user,
        depositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        userUnderlyingTokenAccount,
        conditionalTokenMint,
        userConditionalTokenAccount
      );
    });

    it("blocks mints when the user doesn't have enough underlying tokens", async function () {
      const callbacks = expectError(
        "InsufficientUnderlyingTokens",
        "mint suceeded despite user not having enough underlying tokens"
      );
      await autocratFacade
        .mintConditionalTokens(
          amount + 10,
          user,
          depositSlip,
          vault,
          vaultUnderlyingTokenAccount,
          userUnderlyingTokenAccount,
          conditionalTokenMint,
          userConditionalTokenAccount
        )
        .then(callbacks[0], callbacks[1]);
    });

    it("checks that `vault_underlying_token_account` and `conditional_vault` match up", async function () {
      const maliciousVaultUnderlyingTokenAccount =
        await autocratFacade.createTokenAccount(
          underlyingTokenMint,
          anchor.web3.Keypair.generate().publicKey
        );

      const callbacks = expectError(
        "InvalidVaultUnderlyingTokenAccount",
        "was able to mint conditional tokens while supplying an invalid vault underlying account"
      );
      await autocratFacade
        .mintConditionalTokens(
          amount,
          user,
          depositSlip,
          vault,
          maliciousVaultUnderlyingTokenAccount,
          userUnderlyingTokenAccount,
          conditionalTokenMint,
          userConditionalTokenAccount
        )
        .then(callbacks[0], callbacks[1]);
    });

    it("checks that `user_underlying_token_account` is owned by the user", async function () {
      const nonOwnedUserUnderlyingAccount =
        await autocratFacade.createTokenAccount(
          underlyingTokenMint,
          anchor.web3.Keypair.generate().publicKey
        );

      await autocratFacade.mintTo(
        underlyingTokenMint,
        nonOwnedUserUnderlyingAccount,
        underlyingTokenMintAuthority,
        amount
      );

      const callbacks = expectError(
        "ConstraintTokenOwner",
        "mint suceeded despite `user_underlying_token_account` not being owned by the user"
      );

      await autocratFacade
        .mintConditionalTokens(
          amount,
          user,
          depositSlip,
          vault,
          vaultUnderlyingTokenAccount,
          nonOwnedUserUnderlyingAccount,
          conditionalTokenMint,
          userConditionalTokenAccount
        )
        .then(callbacks[0], callbacks[1]);
    });

    it("checks that `user_conditional_token_account` is owned by the user", async function () {
      const nonOwnedUserConditionalAccount =
        await autocratFacade.createTokenAccount(
          conditionalTokenMint,
          anchor.web3.Keypair.generate().publicKey
        );

      const callbacks = expectError(
        "ConstraintTokenOwner",
        "mint suceeded despite `user_conditional_token_account` not being owned by the user"
      );

      await autocratFacade
        .mintConditionalTokens(
          amount,
          user,
          depositSlip,
          vault,
          vaultUnderlyingTokenAccount,
          userUnderlyingTokenAccount,
          conditionalTokenMint,
          nonOwnedUserConditionalAccount
        )
        .then(callbacks[0], callbacks[1]);
    });

    it("checks that `user_conditional_token_account` has `conditional_token_mint` as its mint", async function () {
      const [wrongConditionalTokenMint] = await autocratFacade.createMint(
        undefined,
        vault
      );
      const wrongMintUserConditionalTokenAccount =
        await autocratFacade.createTokenAccount(
          wrongConditionalTokenMint,
          user.publicKey
        );

      const callbacks = expectError(
        "ConstraintTokenMint",
        "mint suceeded despite `user_conditional_token_account` having a wrong mint"
      );

      await autocratFacade
        .mintConditionalTokens(
          amount,
          user,
          depositSlip,
          vault,
          vaultUnderlyingTokenAccount,
          userUnderlyingTokenAccount,
          conditionalTokenMint,
          wrongMintUserConditionalTokenAccount
        )
        .then(callbacks[0], callbacks[1]);
    });

    it("checks that `user_underlying_token_account` has the correct mint", async function () {
      const [randomMint, mintAuthority] = await autocratFacade.createMint();
      const wrongMintUserUnderlyingAccount =
        await autocratFacade.createTokenAccount(randomMint, user.publicKey);

      await autocratFacade.mintTo(
        randomMint,
        wrongMintUserUnderlyingAccount,
        mintAuthority,
        amount
      );

      const callbacks = expectError(
        "ConstraintTokenMint",
        "mint suceeded despite `user_underlying_token_account` having the wrong mint"
      );

      await autocratFacade
        .mintConditionalTokens(
          amount,
          user,
          depositSlip,
          vault,
          vaultUnderlyingTokenAccount,
          wrongMintUserUnderlyingAccount,
          conditionalTokenMint,
          userConditionalTokenAccount
        )
        .then(callbacks[0], callbacks[1]);
    });

    it("checks that `deposit_slip` was created for this conditional vault", async function () {
      const [secondConditionalVault] = await initializeSampleVault(
        autocratFacade
      );

      const badDepositSlip = await autocratFacade.initializeDepositSlip(
        secondConditionalVault,
        user.publicKey
      );

      const callbacks = expectError(
        "ConstraintHasOne",
        "mint suceeded despite `deposit_slip` having the wrong conditional vault"
      );

      await autocratFacade
        .mintConditionalTokens(
          amount,
          user,
          badDepositSlip,
          vault,
          vaultUnderlyingTokenAccount,
          userUnderlyingTokenAccount,
          conditionalTokenMint,
          userConditionalTokenAccount
        )
        .then(callbacks[0], callbacks[1]);
    });

    it("checks that `conditional_token_mint` is the one stored in the conditional vault", async function () {
      const [wrongConditionalTokenMint] = await autocratFacade.createMint(
        undefined,
        vault
      );

      const wrongMintUserConditionalTokenAccount =
        await autocratFacade.createTokenAccount(
          wrongConditionalTokenMint,
          user.publicKey
        );

      const callbacks = expectError(
        "InvalidConditionalTokenMint",
        "mint suceeded despite `conditional_token_mint` not being the one stored in the conditional vault"
      );

      await autocratFacade
        .mintConditionalTokens(
          amount,
          user,
          depositSlip,
          vault,
          vaultUnderlyingTokenAccount,
          userUnderlyingTokenAccount,
          wrongConditionalTokenMint,
          wrongMintUserConditionalTokenAccount
        )
        .then(callbacks[0], callbacks[1]);
    });
  });

  describe("#redeem_conditional_tokens_for_underlying_tokens", async function () {
    const testRedemption = async (
      passOrFailFlag: boolean,
      desiredProposalState: ProposalState,
      shouldGoThrough: boolean
    ) => {
      await _testRedemption(
        autocratFacade,
        passOrFailFlag,
        desiredProposalState,
        RedemptionType.ConditionalToken,
        shouldGoThrough
      );
    };

    it("allows users to redeem conditional tokens for underlying tokens when `pass_or_fail_flag` is set to true and the proposal has passed", async function () {
      await testRedemption(true, ProposalState.Passed, true);
    });

    it("allows users to redeem conditional tokens for underlying tokens when `pass_or_fail_flag` is set to false and the proposal has failed", async function () {
      await testRedemption(false, ProposalState.Failed, true);
    });

    it("prevents users from redeeming conditional tokens for underlying tokens when `pass_or_fail_flag` is set to true and the proposal has failed", async function () {
      await testRedemption(true, ProposalState.Failed, false);
    });

    it("prevents users from redeeming conditional tokens for underlying tokens when `pass_or_fail_flag` is set to false and the proposal has passed", async function () {
      await testRedemption(false, ProposalState.Passed, false);
    });

    it("prevents users from redeeming conditional tokens while a proposal is still pending", async function () {
      await testRedemption(true, ProposalState.Pending, false);
    });
  });

  describe("#redeem_deposit_slip_for_underlying_tokens", async function () {
    const testRedemption = async (
      passOrFailFlag: boolean,
      desiredProposalState: ProposalState,
      shouldGoThrough: boolean
    ) => {
      await _testRedemption(
        autocratFacade,
        passOrFailFlag,
        desiredProposalState,
        RedemptionType.DepositSlip,
        shouldGoThrough
      );
    };

    it("allows users to redeem deposit slips when `pass_or_fail_flag` is set to true and a proposal fails", async function () {
      await testRedemption(true, ProposalState.Failed, true);
    });

    it("allows users to redeem deposit slips when `pass_or_fail_flag` is set to false and a proposal passes", async function () {
      await testRedemption(false, ProposalState.Passed, true);
    });

    it("prevents users from redeeming deposit slips when `pass_or_fail_flag` is set to true and a proposal passes", async function () {
      await testRedemption(true, ProposalState.Passed, false);
    });

    it("prevents users from redeeming deposit slips when `pass_or_fail_flag` is set to false and a proposal fails", async function () {
      await testRedemption(false, ProposalState.Failed, false);
    });

    it("prevents users from redeeming deposit slips while the proposal is pending", async function () {
      await testRedemption(true, ProposalState.Pending, false);
    });
  });
});
