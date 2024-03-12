import { initializeProposal, daoTreasury, META } from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import * as token from "@solana/spl-token";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

// DoctorSOL, Rar3, Dondraper
// BURN
// const DUTCH_AUCTION_LP_MULTISIG = new PublicKey("3LMRVapqnn1LEwKaD8PzYEs4i37whTgeVS41qKqyn1wi");

async function main() {
  const senderAcc = await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    META,
    daoTreasury,
    true
  );

  // const receiverAcc = await token.getOrCreateAssociatedTokenAccount(
  //   provider.connection,
  //   payer,
  //   META,
  //   DUTCH_AUCTION_LP_MULTISIG,
  //   true
  // );

  // const transferIx = token.createTransferInstruction(
  //   senderAcc.address,
  //   receiverAcc.address,
  //   daoTreasury,
  //   300545 * 10_000_000, // 3005.45 META
  // );

  
  const burnAmount = 979_000 * 1_000_000_000; // 979,000 tokens in smallest unit
  const burnIx = token.createBurnInstruction(
    senderAcc.address,
    META,
    daoTreasury,
    burnAmount
  );

  // const connection = provider.connection;
  // let blockhash = await connection
  //   .getLatestBlockhash()
  //   .then((res) => res.blockhash);
  // const instructions = [burnIx];
  // create v0 compatible message
  // const messageV0 = new anchor.web3.TransactionMessage({
  //   payerKey: provider.publicKey,
  //   recentBlockhash: blockhash,
  //   instructions,
  // }).compileToV0Message();
  // const transaction = new anchor.web3.VersionedTransaction(messageV0);
  // const serializedTransaction = transaction.serialize();
  // const simulationResult = await connection.simulateTransaction(transaction, {
  //   sigVerify: false,
  // });

  // console.log("Simulation result:", simulationResult);

  const ix = {
    programId: burnIx.programId,
    accounts: burnIx.keys,
    data: burnIx.data,
  };

  console.log(ix);
  return;

  // await initializeProposal(
  //   ix,
  //   "https://hackmd.io/@doctorsolana/HydnXDeT6"
  // );
}

main();
