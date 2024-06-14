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

const PROPOSAL = new PublicKey("BMZbX7z2zgLuq266yskeHF5BFZoaX9j3tvsZfVQ7RUY6");

async function main() {
  const { dao } = await autocratClient.getProposal(PROPOSAL);

  const storedDao = await autocratClient.getDao(dao);
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
    dao
  );

  const passLpBalance = (
    await token.getAccount(
      provider.connection,
      token.getAssociatedTokenAddressSync(passLp, payer.publicKey)
    )
  ).amount;
  const failLpBalance = (
    await token.getAccount(
      provider.connection,
      token.getAssociatedTokenAddressSync(failLp, payer.publicKey)
    )
  ).amount;

  if (passLpBalance > 0) {
    await ammClient
      .removeLiquidityIx(
        passAmm,
        passBaseMint,
        passQuoteMint,
        new BN(passLpBalance.toString()),
        new BN(0),
        new BN(0)
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100 }),
      ])
      .rpc();
  }

  if (failLpBalance > 0) {
    await ammClient
      .removeLiquidityIx(
        failAmm,
        failBaseMint,
        failQuoteMint,
        new BN(failLpBalance.toString()),
        new BN(0),
        new BN(0)
      )
      .preInstructions([
        ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100 }),
      ])
      .rpc();
  }

  await vaultClient
    .redeemConditionalTokensIx(baseVault, storedDao.tokenMint)
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100 }),
      await vaultClient
        .redeemConditionalTokensIx(quoteVault, storedDao.usdcMint)
        .instruction(),
    ])
    .rpc();
}

main();
