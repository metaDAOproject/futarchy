import * as anchor from "@coral-xyz/anchor";
import { BN, Program, web3 } from "@coral-xyz/anchor";
const { PublicKey, Keypair } = web3;
import * as token from "@solana/spl-token";
import { BankrunProvider } from "anchor-bankrun";

import { assert } from "chai";

import { BanksClient, startAnchor } from "solana-bankrun";

import { expectError } from "./utils/utils";

import { ConditionalVault } from "../target/types/conditional_vault";

const ConditionalVaultIDL: ConditionalVault = require("../target/idl/conditional_vault.json");

import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "spl-token-bankrun";

export type VaultProgram = anchor.Program<ConditionalVault>;
export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

const CONDITIONAL_VAULT_PROGRAM_ID = new PublicKey(
  "vaU1tVLj8RFk7mNj1BxqgAsMKKaL8UvEUHvU3tdbZPe"
);

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
    nonce,
    alice,
    underlyingTokenMint,
    vault,
    vaultUnderlyingTokenAccount,
    conditionalOnFinalizeMint,
    conditionalOnRevertMint;

  before(async function () {
    context = await startAnchor("./", [], []);
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    vaultProgram = new Program<ConditionalVault>(
      ConditionalVaultIDL,
      CONDITIONAL_VAULT_PROGRAM_ID,
      provider
    );
    //vaultProgram = anchor.workspace.ConditionalVault as VaultProgram;
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

    nonce = new anchor.BN(10);

    [vault] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("conditional_vault"),
        settlementAuthority.publicKey.toBuffer(),
        underlyingTokenMint.toBuffer(),
        nonce.toBuffer("le", 8),
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
      let conditionalOnFinalizeTokenMintKeypair =
        anchor.web3.Keypair.generate();
      let conditionalOnRevertTokenMintKeypair = anchor.web3.Keypair.generate();

      await vaultProgram.methods
        .initializeConditionalVault(settlementAuthority.publicKey, nonce)
        .accounts({
          vault,
          underlyingTokenMint,
          vaultUnderlyingTokenAccount,
          conditionalOnFinalizeTokenMint:
            conditionalOnFinalizeTokenMintKeypair.publicKey,
          conditionalOnRevertTokenMint:
            conditionalOnRevertTokenMintKeypair.publicKey,
          payer: payer.publicKey,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([
          conditionalOnFinalizeTokenMintKeypair,
          conditionalOnRevertTokenMintKeypair,
        ])
        .rpc();

      const storedVault = await vaultProgram.account.conditionalVault.fetch(
        vault
      );
      assert.exists(storedVault.status.active);
      assert.ok(
        storedVault.settlementAuthority.equals(settlementAuthority.publicKey)
      );
      assert.ok(storedVault.underlyingTokenMint.equals(underlyingTokenMint));
      assert.ok(storedVault.nonce.eq(nonce));
      assert.ok(
        storedVault.underlyingTokenAccount.equals(vaultUnderlyingTokenAccount)
      );
      assert.ok(
        storedVault.conditionalOnFinalizeTokenMint.equals(
          conditionalOnFinalizeTokenMintKeypair.publicKey
        )
      );
      assert.ok(
        storedVault.conditionalOnRevertTokenMint.equals(
          conditionalOnRevertTokenMintKeypair.publicKey
        )
      );

      conditionalOnFinalizeMint =
        conditionalOnFinalizeTokenMintKeypair.publicKey;
      conditionalOnRevertMint = conditionalOnRevertTokenMintKeypair.publicKey;
    });
  });

  describe("#mint_conditional_tokens", async function () {
    // alice is available throughout the tests, bob is just for mint_conditional_tokens
    let bob: Keypair;
    let amount = 1000;
    let bobUnderlyingTokenAccount: PublicKey;
    let bobConditionalOnFinalizeTokenAccount: PublicKey;
    let bobConditionalOnRevertTokenAccount: PublicKey;

    beforeEach(async function () {
      bob = anchor.web3.Keypair.generate();

      bobUnderlyingTokenAccount = await createAssociatedTokenAccount(
        /* bobUnderlyingTokenAccount = await token.createAccount( */
        banksClient,
        payer,
        underlyingTokenMint,
        bob.publicKey
      );

      bobConditionalOnFinalizeTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        conditionalOnFinalizeMint,
        bob.publicKey
      );
      bobConditionalOnRevertTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        conditionalOnRevertMint,
        bob.publicKey
      );

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
        vault,
        banksClient
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
        vault,
        banksClient
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
        vault,
        banksClient,
        undefined,
        undefined,
        undefined,
        maliciousVaultUnderlyingTokenAccount
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
        vault,
        banksClient,
        nonOwnedUserUnderlyingAccount
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that `user_conditional_on_finalize_token_account` is owned by the user", async function () {
      const nonOwnedUserConditionalAccount = await createAccount(
        banksClient,
        payer,
        conditionalOnFinalizeMint,
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
        vault,
        banksClient,
        undefined,
        nonOwnedUserConditionalAccount
      ).then(callbacks[0], callbacks[1]);
    });

    it("checks that `user_conditional_on_revert_token_account` is owned by the user", async function () {
      const nonOwnedUserConditionalAccount = await createAccount(
        banksClient,
        payer,
        conditionalOnRevertMint,
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
        vault,
        banksClient,
        undefined,
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
        vault,
        banksClient,
        undefined,
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
        vault,
        banksClient,
        wrongMintBobUnderlyingAccount
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
        vault,
        banksClient,
        undefined,
        wrongMintBobConditionalTokenAccount,
        undefined,
        undefined,
        wrongConditionalTokenMint
      ).then(callbacks[0], callbacks[1]);
    });
  });

  describe("#settle_conditional_vault", async function () {
    it("allows vaults to be finalized", async function () {
      let [vault, _, settlementAuthority] = await generateRandomVault(
        vaultProgram,
        payer,
        banksClient
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
        vaultProgram,
        payer,
        banksClient
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
        vaultProgram,
        payer,
        banksClient
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
    let bob: Keypair;
    let amount = 1000;
    let bobUnderlyingTokenAccount: PublicKey;
    let bobConditionalOnFinalizeTokenAccount: PublicKey;
    let bobConditionalOnRevertTokenAccount: PublicKey;

    beforeEach(async function () {
      [vault, underlyingMintAuthority, settlementAuthority] =
        await generateRandomVault(vaultProgram, payer, banksClient);
      let storedVault = await vaultProgram.account.conditionalVault.fetch(
        vault
      );
      underlyingTokenMint = storedVault.underlyingTokenMint;
      conditionalOnFinalizeMint = storedVault.conditionalOnFinalizeTokenMint;
      conditionalOnRevertMint = storedVault.conditionalOnRevertTokenMint;
      vaultUnderlyingTokenAccount = storedVault.underlyingTokenAccount;

      bob = anchor.web3.Keypair.generate();

      bobUnderlyingTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        underlyingTokenMint,
        bob.publicKey
      );

      bobConditionalOnFinalizeTokenAccount = await createAssociatedTokenAccount(
        banksClient,
        payer,
        conditionalOnFinalizeMint,
        bob.publicKey
      );

      bobConditionalOnRevertTokenAccount = await createAccount(
        banksClient,
        payer,
        conditionalOnRevertMint,
        bob.publicKey
      );

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
        vault,
        banksClient
      );
    });

    it("allows users to redeem conditional-on-finalize tokens for underlying tokens when a vault has been finalized", async function () {
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
        bobConditionalOnFinalizeTokenAccount,
        bobConditionalOnRevertTokenAccount,
        conditionalOnFinalizeMint,
        conditionalOnRevertMint,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        banksClient
      );
    });

    it("allows user to redeeming conditional-on-revert tokens for underlying tokens when a vault is reverted", async function () {
      await vaultProgram.methods
        .settleConditionalVault({ reverted: {} })
        .accounts({
          settlementAuthority: settlementAuthority.publicKey,
          vault,
        })
        .signers([settlementAuthority])
        .rpc();

      await redeemConditionalTokens(
        vaultProgram,
        bob,
        bobConditionalOnFinalizeTokenAccount,
        bobConditionalOnRevertTokenAccount,
        conditionalOnFinalizeMint,
        conditionalOnRevertMint,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        banksClient
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
        bobConditionalOnFinalizeTokenAccount,
        bobConditionalOnRevertTokenAccount,
        conditionalOnFinalizeMint,
        conditionalOnRevertMint,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        banksClient
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
        bobConditionalOnRevertTokenAccount,
        wrongConditionalTokenMint,
        conditionalOnRevertMint,
        bobUnderlyingTokenAccount,
        vaultUnderlyingTokenAccount,
        vault,
        banksClient
      ).then(callbacks[0], callbacks[1]);
    });
  });
});

async function generateRandomVault(
  vaultProgram: VaultProgram,
  payer: Keypair,
  banksClient: BanksClient,
  settlementAuthority: Keypair = anchor.web3.Keypair.generate()
): Promise<[PublicKey, Keypair, Keypair]> {
  const underlyingMintAuthority = anchor.web3.Keypair.generate();

  const underlyingTokenMint = await createMint(
    banksClient,
    payer,
    underlyingMintAuthority.publicKey,
    null,
    8
  );

  const nonce = new BN(1003239);

  const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("conditional_vault"),
      settlementAuthority.publicKey.toBuffer(),
      underlyingTokenMint.toBuffer(),
      nonce.toBuffer("le", 8),
    ],
    vaultProgram.programId
  );

  const vaultUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
    underlyingTokenMint,
    vault,
    true
  );
  let conditionalOnFinalizeTokenMintKeypair = anchor.web3.Keypair.generate();
  let conditionalOnRevertTokenMintKeypair = anchor.web3.Keypair.generate();

  let result = await vaultProgram.methods
    .initializeConditionalVault(settlementAuthority.publicKey, nonce)
    .accounts({
      vault,
      underlyingTokenMint,
      vaultUnderlyingTokenAccount,
      conditionalOnFinalizeTokenMint:
        conditionalOnFinalizeTokenMintKeypair.publicKey,
      conditionalOnRevertTokenMint:
        conditionalOnRevertTokenMintKeypair.publicKey,
      payer: payer.publicKey,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([
      conditionalOnFinalizeTokenMintKeypair,
      conditionalOnRevertTokenMintKeypair,
    ])
    .rpc();

  return [vault, underlyingMintAuthority, settlementAuthority];
}

export async function mintConditionalTokens(
  program: VaultProgram,
  amount: number,
  user: Signer,
  vault: PublicKey,
  banksClient: BanksClient,
  userUnderlyingTokenAccount?: PublicKey,
  userConditionalOnFinalizeTokenAccount?: PublicKey,
  userConditionalOnRevertTokenAccount?: PublicKey,
  vaultUnderlyingTokenAccount?: PublicKey,
  conditionalOnFinalizeTokenMint?: PublicKey
) {
  const storedVault = await program.account.conditionalVault.fetch(vault);
  if (!userUnderlyingTokenAccount) {
    userUnderlyingTokenAccount = token.getAssociatedTokenAddressSync(
      storedVault.underlyingTokenMint,
      user.publicKey
    );
  }
  if (!userConditionalOnFinalizeTokenAccount) {
    userConditionalOnFinalizeTokenAccount = token.getAssociatedTokenAddressSync(
      storedVault.conditionalOnFinalizeTokenMint,
      user.publicKey
    );
  }
  if (!userConditionalOnRevertTokenAccount) {
    userConditionalOnRevertTokenAccount = token.getAssociatedTokenAddressSync(
      storedVault.conditionalOnRevertTokenMint,
      user.publicKey
    );
  }
  if (!vaultUnderlyingTokenAccount) {
    vaultUnderlyingTokenAccount = storedVault.underlyingTokenAccount;
  }
  if (!conditionalOnFinalizeTokenMint) {
    conditionalOnFinalizeTokenMint = storedVault.conditionalOnFinalizeTokenMint;
  }

  const vaultUnderlyingTokenAccountBefore = await getAccount(
    banksClient,
    vaultUnderlyingTokenAccount
  );
  const userUnderlyingTokenAccountBefore = await getAccount(
    banksClient,
    userUnderlyingTokenAccount
  );
  const userConditionalOnFinalizeTokenAccountBefore = await getAccount(
    banksClient,
    userConditionalOnFinalizeTokenAccount
  );
  const userConditionalOnRevertTokenAccountBefore = await getAccount(
    banksClient,
    userConditionalOnRevertTokenAccount
  );

  const bnAmount = new anchor.BN(amount);
  /* try { */
  await program.methods
    .mintConditionalTokens(bnAmount)
    .accounts({
      authority: user.publicKey,
      vault,
      vaultUnderlyingTokenAccount,
      userUnderlyingTokenAccount,
      conditionalOnFinalizeTokenMint,
      userConditionalOnFinalizeTokenAccount,
      conditionalOnRevertTokenMint: storedVault.conditionalOnRevertTokenMint,
      userConditionalOnRevertTokenAccount,
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
  const userConditionalOnFinalizeTokenAccountAfter = await getAccount(
    banksClient,
    userConditionalOnFinalizeTokenAccount
  );
  const userConditionalOnRevertTokenAccountAfter = await getAccount(
    banksClient,
    userConditionalOnRevertTokenAccount
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
    userConditionalOnFinalizeTokenAccountAfter.amount,
    userConditionalOnFinalizeTokenAccountBefore.amount + BigInt(amount)
  );
  assert.equal(
    userConditionalOnRevertTokenAccountAfter.amount,
    userConditionalOnRevertTokenAccountBefore.amount + BigInt(amount)
  );
}

export async function redeemConditionalTokens(
  vaultProgram: VaultProgram,
  user: Signer,
  userConditionalOnFinalizeTokenAccount: PublicKey,
  userConditionalOnRevertTokenAccount: PublicKey,
  conditionalOnFinalizeTokenMint: PublicKey,
  conditionalOnRevertTokenMint: PublicKey,
  userUnderlyingTokenAccount: PublicKey,
  vaultUnderlyingTokenAccount: PublicKey,
  vault: PublicKey,
  banksClient: BanksClient
) {
  const vaultUnderlyingTokenAccountBefore = await getAccount(
    banksClient,
    vaultUnderlyingTokenAccount
  );
  const userUnderlyingTokenAccountBefore = await getAccount(
    banksClient,
    userUnderlyingTokenAccount
  );
  const userConditionalOnFinalizeTokenAccountBefore = await getAccount(
    banksClient,
    userConditionalOnFinalizeTokenAccount
  );
  const userConditionalOnRevertTokenAccountBefore = await getAccount(
    banksClient,
    userConditionalOnRevertTokenAccount
  );

  await vaultProgram.methods
    .redeemConditionalTokensForUnderlyingTokens()
    .accounts({
      authority: user.publicKey,
      userConditionalOnFinalizeTokenAccount,
      userConditionalOnRevertTokenAccount,
      userUnderlyingTokenAccount,
      vaultUnderlyingTokenAccount,
      vault,
      conditionalOnFinalizeTokenMint,
      conditionalOnRevertTokenMint,
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
  const userConditionalOnFinalizeTokenAccountAfter = await getAccount(
    banksClient,
    userConditionalOnFinalizeTokenAccount
  );
  const userConditionalOnRevertTokenAccountAfter = await getAccount(
    banksClient,
    userConditionalOnRevertTokenAccount
  );

  let storedVault = await vaultProgram.account.conditionalVault.fetch(vault);

  let amount;
  if (storedVault.status.finalized) {
    amount = userConditionalOnFinalizeTokenAccountBefore.amount;
  } else {
    amount = userConditionalOnRevertTokenAccountBefore.amount;
  }

  assert.equal(
    vaultUnderlyingTokenAccountAfter.amount,
    vaultUnderlyingTokenAccountBefore.amount - BigInt(amount)
  );
  assert.equal(
    userUnderlyingTokenAccountAfter.amount,
    userUnderlyingTokenAccountBefore.amount + BigInt(amount)
  );
  assert.equal(userConditionalOnFinalizeTokenAccountAfter.amount, BigInt(0));
  assert.equal(userConditionalOnRevertTokenAccountAfter.amount, BigInt(0));
}
