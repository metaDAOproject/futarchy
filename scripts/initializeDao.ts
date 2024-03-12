import * as anchor from "@coral-xyz/anchor";
const { PublicKey } = anchor.web3;
const { Program } = anchor;
import { AutocratV0 } from "../target/types/autocrat_v0";
const AutocratIDL: AutocratV0 = require("../target/idl/autocrat_v0.json");

// NOTE: Change me for multiDAO
const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "MErTXfDBubnbJudhQCD7xN9WaCQySSPpPiHvkrX2Dh3" // Mertd
);

console.log("It's alive!");
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const USDC = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
// NOTE: Change me for multiDAO
const META = new PublicKey('DDRmuJ77t7d6pkBDXE47ZALjSZm3udVGJMgZjZBk41LH') // Mertd

const autocratProgram = new Program<AutocratV0>(
  AutocratIDL,
  AUTOCRAT_PROGRAM_ID,
  provider
);

const [dao] = PublicKey.findProgramAddressSync(
  [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
  autocratProgram.programId
);

async function main() {
  console.log(`Connected PublicKey: ${provider.wallet.publicKey.toString()}`);
  console.log(`USDC: ${USDC.toString()}`)
  console.log(`META: ${META.toString()}`)
  console.log(`Autocrat Program Id: ${AUTOCRAT_PROGRAM_ID.toString()}`)
  console.log(`DAO Program Id: ${dao.toString()}`)

  const ix = await autocratProgram.methods
    .initializeDao()
    .accounts({
      dao,
      metaMint: META,
      usdcMint: USDC,
    })
    .instruction();
  
  console.log('Instruction:')
  console.log(ix)
  console.log('Sleeping for 60 seconds, ctrl + c to cancel before execution')
  await new Promise(r => setTimeout(r, 60000));
  
  try {
    const signature = await autocratProgram.methods
      .initializeDao()
      .accounts({
        dao,
        metaMint: META,
        usdcMint: USDC,
      })
      .rpc();
    
    console.log(signature)
    console.log('Success! Well done!')
  } catch (err) {
    console.error('Error Processing')
    console.error(err)
  } finally {
    console.log('Process completed check above for details.')
  }
}

main();
