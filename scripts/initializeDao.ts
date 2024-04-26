import * as anchor from "@coral-xyz/anchor";
import { AutocratClient } from "../app/src/AutocratClient";
import { DEAN_DEVNET, DEVNET_MUSDC, FUTURE_DEVNET, META } from "./consts";

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

async function main() {
  await autocratClient.initializeDao(
    DEAN_DEVNET,
    0.0009,
    100_000,
    100,
    DEVNET_MUSDC
  );
  await autocratClient.initializeDao(META, 500, 5, 2500, DEVNET_MUSDC);
  await autocratClient.initializeDao(
    FUTURE_DEVNET,
    0.0007,
    500_000,
    500,
    DEVNET_MUSDC
  );
}

main();
