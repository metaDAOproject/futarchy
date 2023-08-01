import * as anchor from "@project-serum/anchor";
import * as token from "@solana/spl-token";

import { expect, assert } from "chai";

import { ConditionalVault } from "../target/types/conditional_vault";

export type VaultProgram = anchor.Program<ConditionalVault>;
export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;

describe("conditional_vault", async function () {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const connection = provider.connection;
  const payer = provider.wallet.payer;

  const vaultProgram = anchor.workspace.ConditionalVault as VaultProgram;

  let underlyingMintAuthority,
    settlementAuthority,
    alice,
    underlyingTokenMint,
    vault,
    vaultUnderlyingTokenAccount,
    conditionalTokenMint;

  before(async function () {
    underlyingMintAuthority = anchor.web3.Keypair.generate();
    settlementAuthority = anchor.web3.Keypair.generate();
    alice = anchor.web3.Keypair.generate();

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

    vaultUnderlyingTokenAccount = (await token.getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      underlyingTokenMint,
      vault,
      true
    )).address;

    conditionalTokenMint = await token.createMint(
      connection,
      payer,
      vault,
      vault,
      8
    );
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
      vaultProgram.methods
        .initializeConditionalVault(settlementAuthority.publicKey)
        .accounts({
          vault,
          underlyingTokenMint,
          vaultUnderlyingTokenAccount,
          conditionalTokenMint,
          payer: payer.publicKey,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    });
  });
});
