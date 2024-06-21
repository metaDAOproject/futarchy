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

const PROPOSAL = new PublicKey("6WyrCkZm3Ct3fpuYhAEanfGaSjTnyCyv6AkkiwQs1zjH");

async function main() {
  // const { dao } = await autocratClient.getProposal(PROPOSAL);
  const dao = new PublicKey("9TKh2yav4WpSNkFV2cLybrWZETBWZBkQ6WB6qV9Nt9dJ");

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
    await token.getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      passLp,
      payer.publicKey
    )
  ).amount;
  const failLpBalance = (
    await token.getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      failLp,
      payer.publicKey
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
    .mergeConditionalTokensIx(
      baseVault,
      storedDao.tokenMint,
      new BN(
        (
          await token.getAccount(
            provider.connection,
            token.getAssociatedTokenAddressSync(
              passBaseMint,
              payer.publicKey
            )
          )
        ).amount.toString()
      )
    )
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100 }),
      await vaultClient
        .mergeConditionalTokensIx(
          quoteVault,
          storedDao.usdcMint,
          new BN(
            (
              await token.getAccount(
                provider.connection,
                token.getAssociatedTokenAddressSync(
                  passQuoteMint,
                  payer.publicKey
                )
              )
            ).amount.toString()
          )
        )
        .instruction(),
    ])
    .rpc();
}

main();
