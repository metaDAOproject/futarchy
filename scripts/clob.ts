import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

import { IDL as ClobIDL, Clob } from "../target/types/clob";

const CLOB_PROGRAM_ID = new PublicKey(
  "8BnUecJAvKB7zCcwqhMiVWoqKWcw5S6PDCxWWEM2oxWA"
);

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const clobProgram = new Program<Clob>(
  ClobIDL,
  CLOB_PROGRAM_ID,
  provider
);

async function main() {
  console.log(clobProgram);
  console.log(provider.wallet.publicKey);
  await initializeGlobalState(provider.wallet.publicKey);
}

async function initializeGlobalState(
  admin: any
) {
  const [globalState] = PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
    clobProgram.programId
  );

  await clobProgram.methods
    .initializeGlobalState(admin)
    .accounts({
      globalState,
    })
    .rpc();
}

main();
