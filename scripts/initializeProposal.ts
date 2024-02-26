import { initializeProposal, daoTreasury, META } from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import * as token from "@solana/spl-token";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

// Durden setup Squads
const DUTCH_AUCTION_LP_MULTISIG = new PublicKey("3LMRVapqnn1LEwKaD8PzYEs4i37whTgeVS41qKqyn1wi");

async function main() {
  const senderAcc = await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    META,
    daoTreasury,
    true
  );

  const receiverAcc = await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    META,
    DUTCH_AUCTION_LP_MULTISIG,
    true
  );

  const transferIx = token.createTransferInstruction(
    senderAcc.address,
    receiverAcc.address,
    daoTreasury,
    300545 * 10_000_000, // 3005.45 META
  );

  const ix = {
    programId: transferIx.programId,
    accounts: transferIx.keys,
    data: transferIx.data,
  };

  await initializeProposal(
    ix,
    "https://hackmd.io/@Durden/Increase-META-Liquidity"
  );
}

main();
