import * as anchor from "@coral-xyz/anchor";
import { AutocratClient } from "@metadaoproject/futarchy-ts";
import { DEAN_DEVNET, DEVNET_DARK, DEVNET_DRIFT, DEVNET_MUSDC, DEVNET_ORE, FUTURE_DEVNET, META } from "./consts";

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

async function main() {
  await autocratClient.initializeDao(
    DEVNET_DARK,
    0.20,
    10_000,
    2_500,
    DEVNET_MUSDC
  );
  await autocratClient.initializeDao(DEVNET_DRIFT, 1, 1000, 1000, DEVNET_MUSDC);
  await autocratClient.initializeDao(
    DEVNET_ORE,
    500,
    1,
    100,
    DEVNET_MUSDC
  );
}

main();
