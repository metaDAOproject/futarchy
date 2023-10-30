import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

import {
  IDL as ConditionalVaultIDL,
  ConditionalVault,
} from "../target/types/conditional_vault";

const CONDITIONAL_VAULT_PROGRAM_ID = new PublicKey(
  "4nCk4qKJSJf8pzJadMnr9LubA6Y7Zw3EacsVqH1TwVXH"
);

console.log("hello, world");
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const vaultProgram = new Program<ConditionalVault>(
  ConditionalVaultIDL,
  CONDITIONAL_VAULT_PROGRAM_ID,
  provider
);

async function main() {
  //console.log(vaultProgram);
  console.log(provider.wallet.publicKey);
  const settlementAuthority = provider.wallet.publicKey;

  const payer = provider.wallet["payer"];

  const underlyingTokenMint = await token.createMint(
    provider.connection,
    payer,
    settlementAuthority,
    settlementAuthority,
    8
  );

  const nonce = new BN(1337);

  const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("conditional_vault"),
      settlementAuthority.toBuffer(),
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

  let conditionalTokenMintKeypair = anchor.web3.Keypair.generate();

  await vaultProgram.methods
    .initializeConditionalVault(settlementAuthority, nonce)
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

  const storedVault = await vaultProgram.account.conditionalVault.fetch(vault);
  console.log(storedVault);

  //await vaultProgram.methods.initializeConditionalVault
}

main();

//vaultProgram.methods.initializeVault
