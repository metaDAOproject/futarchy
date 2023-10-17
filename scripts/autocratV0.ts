import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

import { IDL as AutocratIDL, AutocratV0 } from "../target/types/autocrat_v0";

const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "Ctt7cFZM6K7phtRo5NvjycpQju7X6QTSuqNen2ebXiuc"
);

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet['payer'];

const autocratProgram = new Program<AutocratV0>(
  AutocratIDL,
  AUTOCRAT_PROGRAM_ID,
  provider
);

const [dao] = PublicKey.findProgramAddressSync(
  [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
  autocratProgram.programId
);

const [daoTreasury] = PublicKey.findProgramAddressSync(
  [dao.toBuffer()],
  autocratProgram.programId
);

async function createMint(
  mintAuthority: any,
  freezeAuthority: any,
  decimals: number,
): Promise<any> {
  return await token.createMint(
    provider.connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals
  );
}

async function initializeDAO(mint: any) {
  await autocratProgram.methods
    .initializeDao()
    .accounts({
      dao,
      token: mint,
    })
    .rpc()
}


async function main() {
}

main();
