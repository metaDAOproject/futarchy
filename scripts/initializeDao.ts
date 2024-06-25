import * as anchor from "@coral-xyz/anchor";
import { AutocratClient, PriceMath } from "@metadaoproject/futarchy";
import {
  DEAN_DEVNET,
  DEVNET_DARK,
  DEVNET_DRIFT,
  DEVNET_MUSDC,
  DEVNET_ORE,
  DRIFT,
  FUTURE_DEVNET,
  META,
} from "./consts";
let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

async function main() {
  const testDao = await autocratClient.initializeDao(DRIFT, 0.5, 1, 1);
  console.log(testDao.toString());
  // await autocratClient.initializeDao(META, 500, 5, 2500, DEVNET_MUSDC);
  // await autocratClient.initializeDao(
  //   DEAN_DEVNET,
  //   0.001,
  //   1_000_000,
  //   500,
  //   DEVNET_MUSDC
  // );
  // await autocratClient.initializeDao(
  //   DEVNET_DARK,
  //   0.2,
  //   10_000,
  //   2_500,
  //   DEVNET_MUSDC
  // );
  // await autocratClient.initializeDao(DEVNET_DRIFT, 1, 1000, 1000, DEVNET_MUSDC);
  // await autocratClient.initializeDao(DEVNET_ORE, 500, 1, 100, DEVNET_MUSDC);
}

main();
