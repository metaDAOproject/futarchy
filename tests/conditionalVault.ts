import * as anchor from "@project-serum/anchor";
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";

import { expect, assert } from "chai";

import { startAnchor } from "solana-bankrun";

import { expectError } from "./utils";

import { ConditionalVault } from "../target/types/conditional_vault";

import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "./bankrunUtils";

export type VaultProgram = anchor.Program<ConditionalVault>;
export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;

export enum VaultStatus {
  Active,
  Finalized,
  Reverted,
}

// this test file isn't 'clean' or DRY or whatever; sorry!

describe("conditional_vault", async function () {
  let provider,
    connection,
    vaultProgram,
    payer,
    context,
    banksClient,
    underlyingMintAuthority,
    settlementAuthority,
    alice,
    underlyingTokenMint,
    vault,
    vaultUnderlyingTokenAccount,
    conditionalTokenMint,
    depositSlip;

  before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    vaultProgram = anchor.workspace.ConditionalVault as VaultProgram;
    payer = vaultProgram.provider.wallet.payer;
    alice = anchor.web3.Keypair.generate();
    settlementAuthority = anchor.web3.Keypair.generate();
    underlyingMintAuthority = anchor.web3.Keypair.generate();

    underlyingTokenMint = await createMint(
      banksClient,
      payer,
      underlyingMintAuthority.publicKey,
      null,
      8
    );

    [vault] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("conditional_vault"),
        settlementAuthority.publicKey.toBuffer(),
        underlyingTokenMint.toBuffer(),
      ],
      vaultProgram.programId
    );

    vaultUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
      underlyingTokenMint,
      vault,
      true
    );
  });

  describe("#initialize_conditional_vault", async function () {
    it("initializes vaults", async function () {
      let conditionalTokenMintKeypair = anchor.web3.Keypair.generate();

      await vaultProgram.methods
        .initializeConditionalVault(settlementAuthority.publicKey)
        .accounts({
          vault,
          underlyingTokenMint,
          vaultUnderlyingTokenAccount,
          conditionalTokenMint: conditionalTokenMintKeypair.publicKey,
          payer: payer.publicKey,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([conditionalTokenMintKeypair])
        .rpc();

      conditionalTokenMint = conditionalTokenMintKeypair.publicKey;
    });
  });

  describe("#initialize_deposit_slip", async function () {
    it("initializes deposit slips", async function () {});
  });

  describe("#mint_conditional_tokens", async function () {
    // alice is available throughout the tests, bob is just for mint_conditional_tokens
    let bob: Signer;
    let amount = 1000;
    let bobUnderlyingTokenAccount: PublicKey;
    let bobConditionalTokenAccount: PublicKey;
    let bobDepositSlip: PublicKey;

    beforeEach(async function () {
      bob = anchor.web3.Keypair.generate();

      bobUnderlyingTokenAccount = await createAssociatedTokenAccount(
        /* bobUnderlyingTokenAccount = await token.createAccount( */
        banksClient,
        payer,
        underlyingTokenMint,
        bob.publicKey
      );

      /* bobConditionalTokenAccount = await token.createAccount( */
      /*   connection, */
      bobConditionalTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        conditionalTokenMint,
        bob.publicKey
      );

      [bobDepositSlip] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("deposit_slip"),
          vault.toBuffer(),
          bob.publicKey.toBuffer(),
        ],
        vaultProgram.programId
      );

      await vaultProgram.methods
        .initializeDepositSlip(bob.publicKey)
        .accounts({
          depositSlip: bobDepositSlip,
          vault,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      /* await token.mintTo( */
      /*   connection, */
      await mintTo(
        banksClient,
        payer,
        underlyingTokenMint,
        bobUnderlyingTokenAccount,
        underlyingMintAuthority,
        amount
      );
    });

    it("mints conditional tokens", async function () {
      await mintConditionalTokens(
        vaultProgram,
        amount,
        bob,
        bobDepositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        bobUnderlyingTokenAccount,
        conditionalTokenMint,
        bobConditionalTokenAccount
      );
    });

    it("blocks mints when the user doesn't have enough underlying tokens", async function () {
      const callbacks = expectError(
        vaultProgram,
        "InsufficientUnderlyingTokens",
        "mint suceeded despite user not having enough underlying tokens"
      );
      await mintConditionalTokens(
        vaultProgram,
        amount + 10,
        bob,
        bobDepositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        bobUnderlyingTokenAccount,
        conditionalTokenMint,
        bobConditionalTokenAccount
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that `vault_underlying_token_account` and `conditional_vault` match up", async function () {
      const maliciousVaultUnderlyingTokenAccount = await createAccount(
        banksClient,
        payer,
        underlyingTokenMint,
        anchor.web3.Keypair.generate().publicKey
      );

      const callbacks = expectError(
        vaultProgram,
        "InvalidVaultUnderlyingTokenAccount",
        "was able to mint conditional tokens while supplying an invalid vault underlying account"
      );
      await mintConditionalTokens(
        vaultProgram,
        amount,
        bob,
        bobDepositSlip,
        vault,
        maliciousVaultUnderlyingTokenAccount,
        bobUnderlyingTokenAccount,
        conditionalTokenMint,
        bobConditionalTokenAccount
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that `user_underlying_token_account` is owned by the user", async function () {
      const nonOwnedUserUnderlyingAccount = await createAccount(
        banksClient,
        payer,
        underlyingTokenMint,
        anchor.web3.Keypair.generate().publicKey
      );

      await mintTo(
        banksClient,
        payer,
        underlyingTokenMint,
        nonOwnedUserUnderlyingAccount,
        underlyingMintAuthority,
        amount
      );

      const callbacks = expectError(
        vaultProgram,
        "ConstraintTokenOwner",
        "mint suceeded despite `user_underlying_token_account` not being owned by the user"
      );

      await mintConditionalTokens(
        vaultProgram,
        amount,
        bob,
        bobDepositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        nonOwnedUserUnderlyingAccount,
        conditionalTokenMint,
        bobConditionalTokenAccount
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that `user_conditional_token_account` is owned by the user", async function () {
      const nonOwnedUserConditionalAccount = await createAccount(
        banksClient,
        payer,
        conditionalTokenMint,
        anchor.web3.Keypair.generate().publicKey
      );

      const callbacks = expectError(
        vaultProgram,
        "ConstraintTokenOwner",
        "mint suceeded despite `user_conditional_token_account` not being owned by the user"
      );

      await mintConditionalTokens(
        vaultProgram,
        amount,
        bob,
        bobDepositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        bobUnderlyingTokenAccount,
        conditionalTokenMint,
        nonOwnedUserConditionalAccount
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that `user_conditional_token_account` has `conditional_token_mint` as its mint", async function () {
      const wrongConditionalTokenMint = await createMint(
        banksClient,
        payer,
        vault,
        vault,
        8
      );
      const wrongMintBobConditionalTokenAccount = await createAccount(
        banksClient,
        payer,
        wrongConditionalTokenMint,
        bob.publicKey
      );

      const callbacks = expectError(
        vaultProgram,
        "ConstraintTokenMint",
        "mint suceeded despite `user_conditional_token_account` having a wrong mint"
      );

      await mintConditionalTokens(
        vaultProgram,
        amount,
        bob,
        bobDepositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        bobUnderlyingTokenAccount,
        conditionalTokenMint,
        wrongMintBobConditionalTokenAccount
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that `user_underlying_token_account` has the correct mint", async function () {
      const mintAuthority = anchor.web3.Keypair.generate();
      const randomMint = await createMint(
        banksClient,
        payer,
        mintAuthority.publicKey,
        mintAuthority.publicKey,
        8
      );
      const wrongMintBobUnderlyingAccount = await createAccount(
        banksClient,
        payer,
        randomMint,
        bob.publicKey
      );

      await mintTo(
        banksClient,
        payer,
        randomMint,
        wrongMintBobUnderlyingAccount,
        mintAuthority,
        amount
      );

      const callbacks = expectError(
        vaultProgram,
        "ConstraintTokenMint",
        "mint suceeded despite `user_underlying_token_account` having the wrong mint"
      );

      await mintConditionalTokens(
        vaultProgram,
        amount,
        bob,
        bobDepositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        wrongMintBobUnderlyingAccount,
        conditionalTokenMint,
        bobConditionalTokenAccount
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that `deposit_slip` was created for this conditional vault", async function () {
      const [secondConditionalVault] = await generateRandomVault(vaultProgram);

      const badDepositSlip = await initializeDepositSlip(
        vaultProgram,
        secondConditionalVault,
        bob
      );

      const callbacks = expectError(
        vaultProgram,
        "ConstraintHasOne",
        "mint suceeded despite `deposit_slip` having the wrong conditional vault"
      );

      await mintConditionalTokens(
        vaultProgram,
        amount,
        bob,
        badDepositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        bobUnderlyingTokenAccount,
        conditionalTokenMint,
        bobConditionalTokenAccount
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that `conditional_token_mint` is the one stored in the conditional vault", async function () {
      const wrongConditionalTokenMint = await createMint(
        banksClient,
        payer,
        vault,
        null,
        10
      );

      const wrongMintBobConditionalTokenAccount = await createAccount(
        banksClient,
        payer,
        wrongConditionalTokenMint,
        bob.publicKey
      );

      const callbacks = expectError(
        vaultProgram,
        "InvalidConditionalTokenMint",
        "mint suceeded despite `conditional_token_mint` not being the one stored in the conditional vault"
      );

      await mintConditionalTokens(
        vaultProgram,
        amount,
        bob,
        bobDepositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        bobUnderlyingTokenAccount,
        wrongConditionalTokenMint,
        wrongMintBobConditionalTokenAccount
      ).then(callbacks[0], callbacks[1]);
    });
  });

  describe("#settle_conditional_vault", async function () {
    it("allows vaults to be finalized", async function () {
      let [vault, _, settlementAuthority] = await generateRandomVault(
        vaultProgram
      );

      await vaultProgram.methods
        .settleConditionalVault({ finalized: {} })
        .accounts({
          settlementAuthority: settlementAuthority.publicKey,
          vault,
        })
        .signers([settlementAuthority])
        .rpc();
    });

    it("allows vaults to be reverted", async function () {
      let [vault, _, settlementAuthority] = await generateRandomVault(
        vaultProgram
      );

      await vaultProgram.methods
        .settleConditionalVault({ reverted: {} })
        .accounts({
          settlementAuthority: settlementAuthority.publicKey,
          vault,
        })
        .signers([settlementAuthority])
        .rpc();
    });

    it("disallows vaults from being finalized twice", async function () {
      let [vault, _, settlementAuthority] = await generateRandomVault(
        vaultProgram
      );

      await vaultProgram.methods
        .settleConditionalVault({ finalized: {} })
        .accounts({
          settlementAuthority: settlementAuthority.publicKey,
          vault,
        })
        .signers([settlementAuthority])
        .rpc();

      const callbacks = expectError(
        vaultProgram,
        "VaultAlreadySettled",
        "settle suceeded even though this vault had already been settled"
      );

      await vaultProgram.methods
        .settleConditionalVault({ reverted: {} })
        .accounts({
          settlementAuthority: settlementAuthority.publicKey,
          vault,
        })
        .signers([settlementAuthority])
        .rpc()
        .then(callbacks[0], callbacks[1]);
    });
  });

  describe("#redeem_conditional_tokens_for_underlying_tokens", async function () {
    let bob: Signer;
    let amount = 1000;
    let bobUnderlyingTokenAccount: PublicKey;
    let bobConditionalTokenAccount: PublicKey;
    let bobDepositSlip: PublicKey;

    beforeEach(async function () {
      [vault, underlyingMintAuthority, settlementAuthority] =
        await generateRandomVault(vaultProgram);
      let storedVault = await vaultProgram.account.conditionalVault.fetch(
        vault
      );
      underlyingTokenMint = storedVault.underlyingTokenMint;
      conditionalTokenMint = storedVault.conditionalTokenMint;
      vaultUnderlyingTokenAccount = storedVault.underlyingTokenAccount;
      bob = anchor.web3.Keypair.generate();

      bobUnderlyingTokenAccount = await createAccount(
        banksClient,
        payer,
        underlyingTokenMint,
        bob.publicKey
      );

      bobConditionalTokenAccount = await createAccount(
        banksClient,
        payer,
        conditionalTokenMint,
        bob.publicKey
      );

      bobDepositSlip = await initializeDepositSlip(vaultProgram, vault, bob);

      await mintTo(
        banksClient,
        payer,
        underlyingTokenMint,
        bobUnderlyingTokenAccount,
        underlyingMintAuthority,
        amount
      );

      await mintConditionalTokens(
        vaultProgram,
        amount,
        bob,
        bobDepositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        bobUnderlyingTokenAccount,
        conditionalTokenMint,
        bobConditionalTokenAccount
      );
    });

    it("allows users to redeem conditional tokens for underlying tokens when a vault has been finalized", async function () {
      await vaultProgram.methods
        .settleConditionalVault({ finalized: {} })
        .accounts({
          settlementAuthority: settlementAuthority.publicKey,
          vault,
        })
        .signers([settlementAuthority])
        .rpc();

      await redeemConditionalTokens(
        vaultProgram,
        bob,
        bobConditionalTokenAccount,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        conditionalTokenMint
      );
    });

    it("prevents users from redeeming conditional tokens while a vault is still active", async function () {
      const callbacks = expectError(
        vaultProgram,
        "CantRedeemConditionalTokens",
        "redemption suceeded even though this vault was still active"
      );
      await redeemConditionalTokens(
        vaultProgram,
        bob,
        bobConditionalTokenAccount,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        conditionalTokenMint
      ).then(callbacks[0], callbacks[1]);
    });

    it("prevents users from redeeming conditional tokens while a vault is reverted", async function () {
      await vaultProgram.methods
        .settleConditionalVault({ reverted: {} })
        .accounts({
          settlementAuthority: settlementAuthority.publicKey,
          vault,
        })
        .signers([settlementAuthority])
        .rpc();

      const callbacks = expectError(
        vaultProgram,
        "CantRedeemConditionalTokens",
        "redemption suceeded even though this vault was reverted"
      );
      await redeemConditionalTokens(
        vaultProgram,
        bob,
        bobConditionalTokenAccount,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        conditionalTokenMint
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that the user has provided the correct conditional token mint", async function () {
      const wrongConditionalTokenMint = await createMint(
        banksClient,
        payer,
        vault,
        null,
        10
      );

      const wrongMintBobConditionalTokenAccount = await createAccount(
        banksClient,
        payer,
        wrongConditionalTokenMint,
        bob.publicKey
      );

      const callbacks = expectError(
        vaultProgram,
        "InvalidConditionalTokenMint",
        "redemption suceeded despite `conditional_token_mint` not being the one stored in the conditional vault"
      );
      await redeemConditionalTokens(
        vaultProgram,
        bob,
        wrongMintBobConditionalTokenAccount,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        wrongConditionalTokenMint
      ).then(callbacks[0], callbacks[1]);
    });
  });

  describe("#redeem_deposit_slip_for_underlying_tokens", async function () {
    let bob: Signer;
    let amount = 1000;
    let bobUnderlyingTokenAccount: PublicKey;
    let bobConditionalTokenAccount: PublicKey;
    let bobDepositSlip: PublicKey;

    beforeEach(async function () {
      [vault, underlyingMintAuthority, settlementAuthority] =
        await generateRandomVault(vaultProgram);
      let storedVault = await vaultProgram.account.conditionalVault.fetch(
        vault
      );
      underlyingTokenMint = storedVault.underlyingTokenMint;
      conditionalTokenMint = storedVault.conditionalTokenMint;
      vaultUnderlyingTokenAccount = storedVault.underlyingTokenAccount;
      bob = anchor.web3.Keypair.generate();

      bobUnderlyingTokenAccount = await createAccount(
        banksClient,
        payer,
        underlyingTokenMint,
        bob.publicKey
      );

      bobConditionalTokenAccount = await createAccount(
        banksClient,
        payer,
        conditionalTokenMint,
        bob.publicKey
      );

      bobDepositSlip = await initializeDepositSlip(vaultProgram, vault, bob);

      await mintTo(
        banksClient,
        payer,
        underlyingTokenMint,
        bobUnderlyingTokenAccount,
        underlyingMintAuthority,
        amount
      );

      await mintConditionalTokens(
        vaultProgram,
        amount,
        bob,
        bobDepositSlip,
        vault,
        vaultUnderlyingTokenAccount,
        bobUnderlyingTokenAccount,
        conditionalTokenMint,
        bobConditionalTokenAccount
      );
    });

    it("allows users to redeem underlying tokens", async function () {
      await vaultProgram.methods
        .settleConditionalVault({ reverted: {} })
        .accounts({
          settlementAuthority: settlementAuthority.publicKey,
          vault,
        })
        .signers([settlementAuthority])
        .rpc();

      await redeemDepositSlip(
        vaultProgram,
        bob,
        bobDepositSlip,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault
      );
    });

    it("prevents users from redeeming when the vault is still active", async function () {
      const callbacks = expectError(
        vaultProgram,
        "CantRedeemDepositSlip",
        "redemption suceeded even though this vault was still active"
      );

      await redeemDepositSlip(
        vaultProgram,
        bob,
        bobDepositSlip,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault
      ).then(callbacks[0], callbacks[1]);
    });

    it("prevents users from redeeming if the vault is finalized", async function () {
      const callbacks = expectError(
        vaultProgram,
        "CantRedeemDepositSlip",
        "redemption suceeded even though this vault was finalized"
      );

      await vaultProgram.methods
        .settleConditionalVault({ finalized: {} })
        .accounts({
          settlementAuthority: settlementAuthority.publicKey,
          vault,
        })
        .signers([settlementAuthority])
        .rpc();

      await redeemDepositSlip(
        vaultProgram,
        bob,
        bobDepositSlip,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that the deposit slip is owned by the user", async function () {
      await vaultProgram.methods
        .settleConditionalVault({ reverted: {} })
        .accounts({
          settlementAuthority: settlementAuthority.publicKey,
          vault,
        })
        .signers([settlementAuthority])
        .rpc();

      let aliceDepositSlip = await initializeDepositSlip(
        vaultProgram,
        vault,
        alice
      );
      const callbacks = expectError(
        vaultProgram,
        "ConstraintHasOne",
        "redemption suceeded even though this deposit slip was owned by another user"
      );

      await redeemDepositSlip(
        vaultProgram,
        bob,
        aliceDepositSlip,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that the deposit slip is for this vault", async function () {
      await vaultProgram.methods
        .settleConditionalVault({ reverted: {} })
        .accounts({
          settlementAuthority: settlementAuthority.publicKey,
          vault,
        })
        .signers([settlementAuthority])
        .rpc();
      let [vault2, underlyingMintAuthority2, settlementAuthority2] =
        await generateRandomVault(vaultProgram);

      let wrongVaultDepositSlip = await initializeDepositSlip(
        vaultProgram,
        vault2,
        bob
      );
      const callbacks = expectError(
        vaultProgram,
        "ConstraintHasOne",
        "redemption suceeded even though this deposit slip was for another vault"
      );

      await redeemDepositSlip(
        vaultProgram,
        bob,
        wrongVaultDepositSlip,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault
      ).then(callbacks[0], callbacks[1]);
    });
  });
});

async function initializeDepositSlip(
  vaultProgram: VaultProgram,
  vault: PublicKey,
  authority: Keypair
): PublicKey {
  const payer = vaultProgram.provider.wallet.payer;
  const [depositSlip] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("deposit_slip"),
      vault.toBuffer(),
      authority.publicKey.toBuffer(),
    ],
    vaultProgram.programId
  );

  await vaultProgram.methods
    .initializeDepositSlip(authority.publicKey)
    .accounts({
      depositSlip,
      vault,
      payer: payer.publicKey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  return depositSlip;
}

async function generateRandomVault(
  vaultProgram: VaultProgram,
  settlementAuthority: Keypair = anchor.web3.Keypair.generate()
): [PublicKey, Keypair, Keypair] {
  const banksClient = vaultProgram.provider.connection.banksClient;
  /* const connection = vaultProgram.provider.connection; */
  const payer = vaultProgram.provider.wallet.payer;
  const underlyingMintAuthority = anchor.web3.Keypair.generate();

  const underlyingTokenMint = await createMint(
    banksClient,
    payer,
    underlyingMintAuthority.publicKey,
    null,
    8
  );

  const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("conditional_vault"),
      settlementAuthority.publicKey.toBuffer(),
      underlyingTokenMint.toBuffer(),
    ],
    vaultProgram.programId
  );

  const vaultUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
    underlyingTokenMint,
    vault,
    true
  );
  let conditionalTokenMintKeypair = anchor.web3.Keypair.generate();

  let result = await vaultProgram.methods
    .initializeConditionalVault(settlementAuthority.publicKey)
    .accounts({
      vault,
      underlyingTokenMint,
      vaultUnderlyingTokenAccount,
      conditionalTokenMint: conditionalTokenMintKeypair.publicKey,
      payer: payer.publicKey,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([conditionalTokenMintKeypair])
    .rpc();

  return [vault, underlyingMintAuthority, settlementAuthority];
}

async function mintConditionalTokens(
  program: VaultProgram,
  amount: number,
  user: Signer,
  depositSlip: PublicKey,
  vault: PublicKey,
  vaultUnderlyingTokenAccount: PublicKey,
  userUnderlyingTokenAccount: PublicKey,
  conditionalTokenMint: PublicKey,
  userConditionalTokenAccount: PublicKey
) {
  const banksClient = program.provider.connection.banksClient;
  const depositSlipBefore = await program.account.depositSlip.fetch(
    depositSlip
  );
  const vaultUnderlyingTokenAccountBefore = await getAccount(
    banksClient,
    vaultUnderlyingTokenAccount
  );
  const userUnderlyingTokenAccountBefore = await getAccount(
    banksClient,
    userUnderlyingTokenAccount
  );
  const userConditionalTokenAccountBefore = await getAccount(
    banksClient,
    userConditionalTokenAccount
  );

  const bnAmount = new anchor.BN(amount);
  /* try { */
  await program.methods
    .mintConditionalTokens(bnAmount)
    .accounts({
      authority: user.publicKey,
      depositSlip,
      vault,
      vaultUnderlyingTokenAccount,
      userUnderlyingTokenAccount,
      conditionalTokenMint,
      userConditionalTokenAccount,
      tokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .signers([user])
    .rpc();
  /* } catch (err) { */
  /*   console.log(program.idl.errors); */
  /*   console.log(err); */
  /* } */

  const depositSlipAfter = await program.account.depositSlip.fetch(depositSlip);
  const vaultUnderlyingTokenAccountAfter = await getAccount(
    banksClient,
    vaultUnderlyingTokenAccount
  );
  const userUnderlyingTokenAccountAfter = await getAccount(
    banksClient,
    userUnderlyingTokenAccount
  );
  const userConditionalTokenAccountAfter = await getAccount(
    banksClient,
    userConditionalTokenAccount
  );

  assert.ok(
    depositSlipAfter.depositedAmount.eq(
      depositSlipBefore.depositedAmount.add(bnAmount)
    )
  );
  assert.equal(
    vaultUnderlyingTokenAccountAfter.amount,
    vaultUnderlyingTokenAccountBefore.amount + BigInt(amount)
  );
  assert.equal(
    userUnderlyingTokenAccountAfter.amount,
    userUnderlyingTokenAccountBefore.amount - BigInt(amount)
  );
  assert.equal(
    userConditionalTokenAccountAfter.amount,
    userConditionalTokenAccountBefore.amount + BigInt(amount)
  );
}

async function redeemConditionalTokens(
  vaultProgram: VaultProgram,
  user: Signer,
  userConditionalTokenAccount: PublicKey,
  userUnderlyingTokenAccount: PublicKey,
  vaultUnderlyingTokenAccount: PublicKey,
  vault: PublicKey,
  conditionalTokenMint: PublicKey
) {
  /* const connection = vaultProgram.provider.connection; */
  const banksClient = vaultProgram.provider.connection.banksClient;
  const vaultUnderlyingTokenAccountBefore = await getAccount(
    banksClient,
    vaultUnderlyingTokenAccount
  );
  const userUnderlyingTokenAccountBefore = await getAccount(
    banksClient,
    userUnderlyingTokenAccount
  );
  const userConditionalTokenAccountBefore = await getAccount(
    banksClient,
    userConditionalTokenAccount
  );

  await vaultProgram.methods
    .redeemConditionalTokensForUnderlyingTokens()
    .accounts({
      authority: user.publicKey,
      userConditionalTokenAccount,
      userUnderlyingTokenAccount,
      vaultUnderlyingTokenAccount,
      vault,
      conditionalTokenMint,
      rogram: token.TOKEN_PROGRAM_ID,
    })
    .signers([user])
    .rpc();

  const vaultUnderlyingTokenAccountAfter = await getAccount(
    banksClient,
    vaultUnderlyingTokenAccount
  );
  const userUnderlyingTokenAccountAfter = await getAccount(
    banksClient,
    userUnderlyingTokenAccount
  );
  const userConditionalTokenAccountAfter = await getAccount(
    banksClient,
    userConditionalTokenAccount
  );

  assert.equal(
    vaultUnderlyingTokenAccountAfter.amount,
    vaultUnderlyingTokenAccountBefore.amount -
      BigInt(userConditionalTokenAccountBefore.amount)
  );
  assert.equal(
    userUnderlyingTokenAccountAfter.amount,
    userUnderlyingTokenAccountBefore.amount +
      BigInt(userConditionalTokenAccountBefore.amount)
  );
  assert.equal(userConditionalTokenAccountAfter.amount, BigInt(0));
}

async function redeemDepositSlip(
  vaultProgram: VaultProgram,
  user: Signer,
  depositSlip: PublicKey,
  userUnderlyingTokenAccount: PublicKey,
  vaultUnderlyingTokenAccount: PublicKey,
  vault: PublicKey
) {
  /* const connection = vaultProgram.provider.connection; */
  const banksClient = vaultProgram.provider.connection.banksClient;
  const vaultUnderlyingTokenAccountBefore = await getAccount(
    banksClient,
    vaultUnderlyingTokenAccount
  );
  const userUnderlyingTokenAccountBefore = await getAccount(
    banksClient,
    userUnderlyingTokenAccount
  );
  const depositSlipBefore = await vaultProgram.account.depositSlip.fetch(
    depositSlip
  );

  await vaultProgram.methods
    .redeemDepositSlipForUnderlyingTokens()
    .accounts({
      authority: user.publicKey,
      depositSlip,
      userUnderlyingTokenAccount,
      vaultUnderlyingTokenAccount,
      vault,
      tokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .signers([user])
    .rpc();

  const vaultUnderlyingTokenAccountAfter = await getAccount(
    banksClient,
    vaultUnderlyingTokenAccount
  );
  const userUnderlyingTokenAccountAfter = await getAccount(
    banksClient,
    userUnderlyingTokenAccount
  );

  assert.isNull(await banksClient.getAccount(depositSlip));

  assert.equal(
    vaultUnderlyingTokenAccountAfter.amount,
    vaultUnderlyingTokenAccountBefore.amount -
      BigInt(depositSlipBefore.depositedAmount)
  );
  assert.equal(
    userUnderlyingTokenAccountAfter.amount,
    userUnderlyingTokenAccountBefore.amount +
      BigInt(depositSlipBefore.depositedAmount)
  );
}
