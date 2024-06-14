import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import * as token from "@solana/spl-token";
import { ComputeBudgetProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  AmmClient,
  AutocratClient,
  ConditionalVaultClient,
} from "@metadaoproject/futarchy";
import { InstructionUtils } from "@metadaoproject/futarchy";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

let ammClient: AmmClient = AmmClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

let vaultClient: ConditionalVaultClient = ConditionalVaultClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

const payer = provider.wallet["payer"];

const PROPOSAL = new PublicKey("MW1dKeDYgewceWuaSmDytdpwNzZDwABf1FuwJix923C");

async function main() {
  const DAO = new PublicKey("ofvb3CPvEyRfD5az8PAqW6ATpPqVBeiB5zBnpPR5cgm");

  const storedDao = await autocratClient.getDao(DAO);
  console.log(storedDao);

  const {
    passAmm,
    failAmm,
    baseVault,
    quoteVault,
    passBaseMint,
    passQuoteMint,
    failBaseMint,
    failQuoteMint,
    passLp,
    failLp,
  } = autocratClient.getProposalPdas(
    PROPOSAL,
    storedDao.tokenMint,
    storedDao.usdcMint,
    DAO
  );

  const basePassBalance = (await token.getOrCreateAssociatedTokenAccount(provider.connection, payer, passBaseMint, payer.publicKey)).amount;
  const quotePassBalance = (await token.getOrCreateAssociatedTokenAccount(provider.connection, payer, passQuoteMint, payer.publicKey)).amount;

  await vaultClient.mergeConditionalTokensIx(baseVault, storedDao.tokenMint, new BN(basePassBalance.toString()))
    .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100 }),
        await vaultClient.mergeConditionalTokensIx(quoteVault, storedDao.usdcMint, new BN(quotePassBalance.toString())).instruction(),
    ])
    .rpc();
}

main();
