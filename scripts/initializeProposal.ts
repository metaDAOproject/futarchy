import { initializeProposal, daoTreasury, META } from "./main";
import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import * as token from "@solana/spl-token";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

const PANTERA_PUBKEY = new PublicKey("BtNPTBX1XkFCwazDJ6ZkK3hcUsomm1RPcfmtUrP6wd2K");

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
    PANTERA_PUBKEY,
    true
  );

  const transferIx = token.createTransferInstruction(
    senderAcc.address,
    receiverAcc.address,
    daoTreasury,
    1_000 * 1_000_000_000, // 1,000 META
  );

  const ix = {
    programId: transferIx.programId,
    accounts: transferIx.keys,
    data: transferIx.data,
  };

  await initializeProposal(
    ix,
    "https://hackmd.io/@0xNallok/Hy2WJ46op"
  );
}

main();
