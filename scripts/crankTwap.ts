import * as anchor from "@coral-xyz/anchor";
import { AmmClient, AutocratClient } from "@metadaoproject/futarchy";
import * as token from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

const proposal1 = new PublicKey("Dssb1oTTqKjWJTe8QVrStFXxcMZfd7LTSpTRbuHuNdnW");
const proposal2 = new PublicKey("Ai1itdwDb5zY1yBmcrqyqNDzbogJKvwJM6XKRPxbiReX");
const proposal3 = new PublicKey("DEmJuXmAqpWVjSP67DfLKyyvM9W3zJg9WuaGdy24hdAR");
const amm = new PublicKey("2JoLmYrbJffVSqA5Cce6nA2yZcHSnsBHCvMbtZg8qX9h");

let ammClient: AmmClient = AmmClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

let autocratClient: AutocratClient = AutocratClient.createClient({
  provider: anchor.AnchorProvider.env(),
});

async function crankTwap() {
  await autocratClient.crankProposalMarkets(
    [new PublicKey("BgHv9GutbnsXZLZQHqPL8BbGWwtcaRDWx82aeRMNmJbG")],
    1
  );
}

crankTwap();
