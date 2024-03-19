import { initializeProposal, daoTreasury, META } from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import * as token from "@solana/spl-token";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

const COLOSSEUM_SQUADS_MULTISIG = new PublicKey("FhJHnsCGm9JDAe2JuEvqr67WE8mD2PiJMUsmCTD1fDPZ");

const COST_DEPLOY = 4 * LAMPORTS_PER_SOL

async function main() {
  console.log('Initializing with PublicKey');
  console.log(payer.publicKey.toString());

  const payerBalance = await provider.connection.getBalance(payer.publicKey);
  console.log('Account SOL balance');
  console.log(payerBalance / LAMPORTS_PER_SOL);
  if (payerBalance < COST_DEPLOY){
    const diff = COST_DEPLOY - payerBalance;
    console.error(`Payer doesn't have enough balance ${payerBalance / LAMPORTS_PER_SOL} to initialize proposal ${COST_DEPLOY / LAMPORTS_PER_SOL}`);
    console.error(`Add ${diff / LAMPORTS_PER_SOL} more SOL`);
    return
  }

  console.log('Account has enough SOL to continue')

  const senderAcc = await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    META,
    daoTreasury,
    true
  );

  console.log('Transfer from');
  console.log(senderAcc.address.toString());
  console.log(`Transfer token ${META.toString()}`);
  console.log('Balance of token');
  const accountBalance = (await provider.connection.getTokenAccountBalance(senderAcc.address)).value
  console.log(accountBalance.uiAmountString);

  const receiverAcc = await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    META,
    COLOSSEUM_SQUADS_MULTISIG,
    true
  );

  console.log('Transfer to');
  console.log(receiverAcc.address.toString());

  const transferAmount = 2060 * 1_000_000_000; // 2060 META
  
  if (transferAmount > Number(accountBalance.amount)){
    console.error(`Account does not have enough balance to transfer ${transferAmount}`);
    console.error(`Account's balance is ${accountBalance.amount}`);
    return;
  }

  console.log(`Transfer amount ${transferAmount / (10 ** accountBalance.decimals)}`);

  const transferIx = token.createTransferInstruction(
    senderAcc.address,
    receiverAcc.address,
    daoTreasury,
    transferAmount,
  );

  console.log('Transfer instructions');
  console.log(transferIx);
  
  const ix = {
    programId: transferIx.programId,
    accounts: transferIx.keys,
    data: transferIx.data,
  };

  console.log('Proposal instruction');
  console.log(ix);
  console.log('Sleeping for 60s, press ctrl + c to cancel');
  await new Promise(f => setTimeout(f, 100));

  await initializeProposal(
    ix,
    "https://hackmd.io/@mattytay/proposal13"
  );
}

main();