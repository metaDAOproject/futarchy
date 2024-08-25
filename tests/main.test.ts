import conditionalVault from "./conditionalVault/main.test";
import amm from "./amm/main.test";
import autocrat from "./autocrat/autocrat";

import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import * as anchor from "@coral-xyz/anchor";
import {
  AmmClient,
  AutocratClient,
  ConditionalVaultClient,
} from "@metadaoproject/futarchy";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  createAssociatedTokenAccount,
  createMint,
  mintTo,
  getAccount,
  transfer,
} from "spl-token-bankrun";
import * as token from "@solana/spl-token";
import { assert } from "chai";

before(async function () {
  this.context = await startAnchor(
    "./",
    [],
    //   [
    //     // even though the program is loaded into the test validator, we need
    //     // to tell banks test client to load it as well
    //     {
    //       name: "mpl_token_metadata",
    //       programId: MPL_TOKEN_METADATA_PROGRAM_ID,
    //     },
    //   ],
    []
  );
  this.banksClient = this.context.banksClient;
  let provider = new BankrunProvider(this.context);
  anchor.setProvider(provider);

  // umi = createUmi(anchor.AnchorProvider.env().connection);

  // vaultProgram = new Program<ConditionalVault>(
  //   ConditionalVaultIDL,
  //   CONDITIONAL_VAULT_PROGRAM_ID,
  //   provider
  // );

  this.vaultClient = ConditionalVaultClient.createClient({
    provider: provider as any,
  });
  this.autocratClient = AutocratClient.createClient({
    provider: provider as any,
  });
  this.ammClient = AmmClient.createClient({ provider: provider as any });
  this.payer = provider.wallet.payer;

  this.createTokenAccount = async (mint: PublicKey, owner: PublicKey) => {
    return await createAssociatedTokenAccount(
      this.banksClient,
      this.payer,
      mint,
      owner
    );
  };

  this.createMint = async (mintAuthority: PublicKey, decimals: number) => {
    return await createMint(
      this.banksClient,
      this.payer,
      mintAuthority,
      null,
      decimals
    );
  };

  this.mintTo = async (
    mint: PublicKey,
    to: PublicKey,
    mintAuthority: Keypair,
    amount: number
  ) => {
    const tokenAccount = token.getAssociatedTokenAddressSync(mint, to, true);
    return await mintTo(
      this.banksClient,
      this.payer,
      mint,
      tokenAccount,
      mintAuthority,
      amount
    );
  };

  this.assertBalance = async (
    mint: PublicKey,
    owner: PublicKey,
    amount: number
  ) => {
    const tokenAccount = token.getAssociatedTokenAddressSync(mint, owner, true);
    const storedTokenAccount = await getAccount(this.banksClient, tokenAccount);
    assert.equal(storedTokenAccount.amount.toString(), amount.toString());
  };

  this.transfer = async (
    mint: PublicKey,
    from: Keypair,
    to: PublicKey,
    amount: number
  ) => {
    return await transfer(
      this.banksClient,
      this.payer,
      token.getAssociatedTokenAddressSync(mint, from.publicKey, true),
      token.getAssociatedTokenAddressSync(mint, to, true),
      from,
      amount
    );
  };
});

describe("conditional_vault", conditionalVault);
describe("amm", amm);
describe("autocrat", autocrat);
