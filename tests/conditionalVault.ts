import * as anchor from "@project-serum/anchor";
import * as token from "@solana/spl-token";

import { expect, assert } from "chai";

import { expectError } from "./utils";

import { ConditionalVault } from "../target/types/conditional_vault";

export type VaultProgram = anchor.Program<ConditionalVault>;
export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;

describe("conditional_vault", async function () {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;

  const vaultProgram = anchor.workspace.ConditionalVault as VaultProgram;
  const payer = vaultProgram.provider.wallet.payer;

  let underlyingMintAuthority,
    settlementAuthority,
    alice,
    underlyingTokenMint,
    vault,
    vaultUnderlyingTokenAccount,
    conditionalTokenMint,
    depositSlip;

  before(async function () {
    alice = anchor.web3.Keypair.generate();
    settlementAuthority = anchor.web3.Keypair.generate();
    underlyingMintAuthority = anchor.web3.Keypair.generate();

    underlyingTokenMint = await token.createMint(
      connection,
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

    /*     vaultUnderlyingTokenAccount = (await token.getOrCreateAssociatedTokenAccount( */
    /*       connection, */
    /*       payer, */
    /*       underlyingTokenMint, */
    /*       vault, */
    /*       true */
    /*     )).address; */
  });

  /* const underlyingToken */
  /* async createTokenAccount( */
  /*   mint: PublicKey, */
  /*   owner: PublicKey */
  /* ): Promise<PublicKey> { */
  /*   return await token.createAccount(this.connection, this.payer, mint, owner); */
  /* } */

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

  describe.skip("#initialize_deposit_slip", async function () {
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

      bobUnderlyingTokenAccount = await token.createAccount(
        connection,
        payer,
        underlyingTokenMint,
        bob.publicKey
      );

      bobConditionalTokenAccount = await token.createAccount(
        connection,
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

      await token.mintTo(
        connection,
        payer,
        underlyingTokenMint,
        bobUnderlyingTokenAccount,
        underlyingMintAuthority,
        amount
      );
    });

    it.skip("mints conditional tokens", async function () {
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

    it.skip("blocks mints when the user doesn't have enough underlying tokens", async function () {
      const callbacks = expectError(
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

    it.skip("checks that `vault_underlying_token_account` and `conditional_vault` match up", async function () {
      const maliciousVaultUnderlyingTokenAccount = await token.createAccount(
        connection,
        payer,
        underlyingTokenMint,
        anchor.web3.Keypair.generate().publicKey
      );

      const callbacks = expectError(
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

    it.skip("checks that `user_underlying_token_account` is owned by the user", async function () {
      const nonOwnedUserUnderlyingAccount = await token.createAccount(
        connection,
        payer,
        underlyingTokenMint,
        anchor.web3.Keypair.generate().publicKey
      );

      await token.mintTo(
        connection,
        payer,
        underlyingTokenMint,
        nonOwnedUserUnderlyingAccount,
        underlyingMintAuthority,
        amount
      );

      const callbacks = expectError(
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

    it.skip("checks that `user_conditional_token_account` is owned by the user", async function () {
      const nonOwnedUserConditionalAccount = await token.createAccount(
        connection,
        payer,
        conditionalTokenMint,
        anchor.web3.Keypair.generate().publicKey
      );

      const callbacks = expectError(
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

    it.skip("checks that `user_conditional_token_account` has `conditional_token_mint` as its mint", async function () {
      const wrongConditionalTokenMint = await token.createMint(
        connection,
        payer,
        vault,
        vault,
        8
      );
      const wrongMintBobConditionalTokenAccount = await token.createAccount(
        connection,
        payer,
        wrongConditionalTokenMint,
        bob.publicKey
      );

      const callbacks = expectError(
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

    it.skip("checks that `user_underlying_token_account` has the correct mint", async function () {
      const mintAuthority = anchor.web3.Keypair.generate();
      const randomMint = await token.createMint(
        connection,
        payer,
        mintAuthority.publicKey,
        mintAuthority.publicKey,
        8
      );
      const wrongMintBobUnderlyingAccount = await token.createAccount(
        connection,
        payer,
        randomMint,
        bob.publicKey
      );

      await token.mintTo(
        connection,
        payer,
        randomMint,
        wrongMintBobUnderlyingAccount,
        mintAuthority,
        amount
      );

      const callbacks = expectError(
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

    it.skip("checks that `deposit_slip` was created for this conditional vault", async function () {
      const [secondConditionalVault] = await generateRandomVault(vaultProgram);

      const badDepositSlip = await initializeDepositSlip(
        vaultProgram,
        secondConditionalVault,
        bob
      );

      const callbacks = expectError(
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

    it.skip("checks that `conditional_token_mint` is the one stored in the conditional vault", async function () {
      const wrongConditionalTokenMint = await token.createMint(
        connection,
        payer,
        vault,
        null,
        10
      );

      const wrongMintBobConditionalTokenAccount = await token.createAccount(
        connection,
        payer,
        wrongConditionalTokenMint,
        bob.publicKey
      );

      const callbacks = expectError(
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
  const connection = vaultProgram.provider.connection;
  const payer = vaultProgram.provider.wallet.payer;
  const underlyingMintAuthority = anchor.web3.Keypair.generate();

  const underlyingTokenMint = await token.createMint(
    connection,
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
  const connection = program.provider.connection;
  const depositSlipBefore = await program.account.depositSlip.fetch(
    depositSlip
  );
  const vaultUnderlyingTokenAccountBefore = await token.getAccount(
    connection,
    vaultUnderlyingTokenAccount
  );
  const userUnderlyingTokenAccountBefore = await token.getAccount(
    connection,
    userUnderlyingTokenAccount
  );
  const userConditionalTokenAccountBefore = await token.getAccount(
    connection,
    userConditionalTokenAccount
  );

  const bnAmount = new anchor.BN(amount);
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

  const depositSlipAfter = await program.account.depositSlip.fetch(depositSlip);
  const vaultUnderlyingTokenAccountAfter = await token.getAccount(
    connection,
    vaultUnderlyingTokenAccount
  );
  const userUnderlyingTokenAccountAfter = await token.getAccount(
    connection,
    userUnderlyingTokenAccount
  );
  const userConditionalTokenAccountAfter = await token.getAccount(
    connection,
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
