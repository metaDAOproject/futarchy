import {
  AmmClient,
  getAmmAddr,
  getAmmLpMintAddr,
  PriceMath,
} from "@metadaoproject/futarchy";
import { Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint } from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import { expectError } from "../../utils";

export default function suite() {
  let ammClient: AmmClient;
  let META: PublicKey;
  let USDC: PublicKey;

  before(async function () {
    ammClient = this.ammClient;
    META = await createMint(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      this.payer.publicKey,
      9
    );
    USDC = await createMint(
      this.banksClient,
      this.payer,
      this.payer.publicKey,
      this.payer.publicKey,
      6
    );
  });

  it("creates an amm", async function () {
    let expectedInitialObservation = new anchor.BN(500_000_000_000);
    let expectedMaxObservationChangePerUpdate = new anchor.BN(10_000_000_000);

    let bump: number;
    let amm: PublicKey;
    [amm, bump] = getAmmAddr(ammClient.program.programId, META, USDC);

    await ammClient.createAmm(Keypair.generate().publicKey, META, USDC, 500);

    const ammAcc = await ammClient.getAmm(amm);

    assert.equal(ammAcc.bump, bump);
    assert.isTrue(ammAcc.createdAtSlot.eq(ammAcc.oracle.lastUpdatedSlot));
    assert.equal(ammAcc.baseMint.toBase58(), META.toBase58());
    assert.equal(ammAcc.quoteMint.toBase58(), USDC.toBase58());
    assert.equal(ammAcc.baseMintDecimals, 9);
    assert.equal(ammAcc.quoteMintDecimals, 6);
    assert.isTrue(ammAcc.baseAmount.eqn(0));
    assert.isTrue(ammAcc.quoteAmount.eqn(0));
    assert.isTrue(ammAcc.oracle.lastObservation.eq(expectedInitialObservation));
    assert.isTrue(ammAcc.oracle.aggregator.eqn(0));
    assert.isTrue(
      ammAcc.oracle.maxObservationChangePerUpdate.eq(
        expectedMaxObservationChangePerUpdate
      )
    );
    assert.isTrue(
      ammAcc.oracle.initialObservation.eq(expectedInitialObservation)
    );
  });

  it("fails to create an amm with two identical mints", async function () {
    let [twapFirstObservationScaled, twapMaxObservationChangePerUpdateScaled] =
      PriceMath.getAmmPrices(9, 9, 100, 1);

    const callbacks = expectError(
      "SameTokenMints",
      "create AMM succeeded despite same token mints"
    );

    let proposal = Keypair.generate().publicKey;

    await ammClient
      .createAmmIx(
        META,
        META,
        twapFirstObservationScaled,
        twapMaxObservationChangePerUpdateScaled
      )
      .rpc()
      .then(callbacks[0], callbacks[1]);
  });
}
