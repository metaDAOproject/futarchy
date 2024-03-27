import {
  initializeProposal,
  daoTreasury,
  META,
  migrator,
  DEVNET_USDC,
} from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import * as token from "@solana/spl-token";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

// Sender
const oldTreasury = new PublicKey(
  "ADCCEAbH8eixGj5t73vb4sKecSKo7ndgDSuWGvER4Loy"
);
// Receiver
const newTreasury = new PublicKey(
  "BC1jThSN7Cgy5LfBZdCKCfMnhKcq155gMjhd9HPWzsCN"
);
// Define the mints
// const META = new PublicKey("METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr");
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
// const USDC = DEVNET_USDC;
const MNDE = new PublicKey("MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey");
const BOL = new PublicKey("CykVcgvNUvay5KsAaGx1G3BR4kbWDtJcerEaZeJetGLe");
// const BOL = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"); // devnet bol

async function getOrCreateATAForMint(mint, owner) {
  return await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    mint,
    owner,
    true
  );
}

async function main() {
  const oldTreasuryMetaATA = await getOrCreateATAForMint(META, oldTreasury);
  console.log("Old Treasury META ATA:", oldTreasuryMetaATA.address.toString());
  const oldTreasuryUsdcATA = await getOrCreateATAForMint(USDC, oldTreasury);
  console.log("Old Treasury USDC ATA:", oldTreasuryUsdcATA.address.toString());
  const oldTreasuryMndeATA = await getOrCreateATAForMint(MNDE, oldTreasury);
  console.log("Old Treasury MNDE ATA:", oldTreasuryMndeATA.address.toString());
  const oldTreasuryBolATA = await getOrCreateATAForMint(BOL, oldTreasury);
  console.log("Old Treasury BOL ATA:", oldTreasuryBolATA.address.toString());

  const newTreasuryMetaATA = await getOrCreateATAForMint(META, newTreasury);
  console.log("New Treasury META ATA:", newTreasuryMetaATA.address.toString());
  const newTreasuryUsdcATA = await getOrCreateATAForMint(USDC, newTreasury);
  console.log("New Treasury USDC ATA:", newTreasuryUsdcATA.address.toString());
  const newTreasuryMndeATA = await getOrCreateATAForMint(MNDE, newTreasury);
  console.log("New Treasury MNDE ATA:", newTreasuryMndeATA.address.toString());
  const newTreasuryBolATA = await getOrCreateATAForMint(BOL, newTreasury);
  console.log("New Treasury BOL ATA:", newTreasuryBolATA.address.toString());

  let migrateTransaction = await migrator.methods.multiTransfer4().accounts({
    authority: oldTreasury,
    from0: oldTreasuryMetaATA.address,
    to0: newTreasuryMetaATA.address,
    from1: oldTreasuryUsdcATA.address,
    to1: newTreasuryUsdcATA.address,
    from2: oldTreasuryMndeATA.address,
    to2: newTreasuryMndeATA.address,
    from3: oldTreasuryBolATA.address,
    to3: newTreasuryBolATA.address,
    lamportReceiver: newTreasury,
  });
  let migrateInstruction = await migrateTransaction.instruction();
  //   console.log(migrateInstruction);

  let { blockhash } = await provider.connection.getLatestBlockhash();
  const messageV0 = new anchor.web3.TransactionMessage({
    payerKey: provider.publicKey,
    recentBlockhash: blockhash,
    instructions: [migrateInstruction],
  }).compileToV0Message();
  const transaction = new anchor.web3.VersionedTransaction(messageV0);
  const simulationResult = await provider.connection.simulateTransaction(
    transaction,
    {
      sigVerify: false,
    }
  );
  if (simulationResult.value.err) {
    console.log("Simulation failed with an error:", simulationResult);
    return;
  } else {
    console.log("Simulation Succeeded");
    //   console.log("Simulation result:", simulationResult);
  }

  const ix = {
    programId: migrateInstruction.programId,
    accounts: migrateInstruction.keys,
    data: migrateInstruction.data,
  };

  await initializeProposal(ix, "https://hackmd.io/@HenryE/Bkvk6eG10");
}

main();
