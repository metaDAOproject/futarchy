import { provider, DAO, initializeDAO, BASE_TOKEN, QUOTE_TOKEN } from "./main";
import * as anchor from "@coral-xyz/anchor";
// @ts-ignore
import * as token from "@solana/spl-token";

const { Keypair } = anchor.web3;

const TOKEN = BASE_TOKEN;
const USDC = QUOTE_TOKEN;

async function main() {
  console.log('Initializing Futarchic DAO')
  console.log(`Base Token ${BASE_TOKEN.toString()}`)
  console.log(`Quote Token ${QUOTE_TOKEN.toString()}`)
  if(DAO.publicKey) {
    console.log("ALREADY INITIALIZED DAO WITH THIS NAME!!")
    return;
  }
  // Generate KP for use with DAO
  const daoKP = Keypair.generate();

  // Fetch data about our token...
  const tokenData = await token.getMint(provider.connection, TOKEN);
  const decimals = tokenData.decimals;
  console.log(`Fetched Token Decimals: ${decimals}`)

  // TODO: Query JUP for swap amount to get value
  const tokenPrice = 0.0008 // Rounded to nearest

  // Get a price between 0 and 10 whole value
  // Example: 1 META @ $400 would be 0.01 as that's $4
  // Example: 1 DEAN @ $0.000795 would be 10_000 as that's $7.81
  const lotOfToken = 10_000 // This is token quantity to get between $0-$10
  const twapExpectedDollar = tokenPrice * lotOfToken
  if (twapExpectedDollar > 10) {
    console.log(`Check your numbers, as $${twapExpectedDollar} is larger than $10`)
    return;
  }
  
  const baseLotSize = lotOfToken * (10 ** decimals);
  // Take the whole dollar value * 10_000
  const twapExpectedValue = (twapExpectedDollar) * 10_000; // 10_000 is hundredths of pennies

  console.log('DAO Parameters')
  console.log(`Token Price: $${tokenPrice}`)
  console.log(`Quantity of Token to Trade Between 0 and 10: ${lotOfToken}`)
  console.log(`Base Lot Size: ${baseLotSize}`)
  console.log(`TWAP Expected in Dollars: $${twapExpectedDollar}`)
  console.log(`TWAP Expected Value: ${twapExpectedValue} in hundrendths of pennies`)
  // Sleep for review
  console.log('Sleeping for 60s, press ctrl + c to cancel');
  await new Promise(f => setTimeout(f, 60000));

  await initializeDAO(TOKEN, USDC, baseLotSize, twapExpectedValue, daoKP);
}

main();
