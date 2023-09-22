import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";

import { Program } from "@coral-xyz/anchor";
import { Clob } from "../target/types/clob";

import { assert } from "chai";

describe("clob", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const payer = provider.wallet.payer;
  const connection = provider.connection;

  const program = anchor.workspace.Clob as Program<Clob>;

  it("Passes tests", async () => {
    const [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
      program.programId
    );
    const admin = anchor.web3.Keypair.generate();

    await program.methods
      .initializeGlobalState(admin.publicKey)
      .accounts({
        globalState,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .updateGlobalState(null, 11, new anchor.BN(2_000_000_000), 300, 150)
      .accounts({
        globalState,
        admin: admin.publicKey
      })
      .signers([admin])
      .rpc();

    const storedGlobalState = await program.account.globalState.fetch(globalState);

    assert.ok(storedGlobalState.admin.equals(admin.publicKey));
    assert.equal(storedGlobalState.takerFeeInBps, 11);
    assert.ok(storedGlobalState.marketMakerBurnInLamports.eq(new anchor.BN(2_000_000_000)));
    assert.equal(storedGlobalState.defaultMaxObservationChangePerUpdateBps, 300);
    assert.equal(storedGlobalState.defaultMaxObservationChangePerSlotBps, 150);

    const mintAuthority = anchor.web3.Keypair.generate();
    const quote = await token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      mintAuthority.publicKey,
      8
    );
    const base = await token.createMint(
      provider.connection,
      payer,
      mintAuthority.publicKey,
      mintAuthority.publicKey,
      8
    );

    const [orderBook] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("order_book"),
        base.toBuffer(),
        quote.toBuffer(),
      ],
      program.programId
    );

    const baseVault = await token.getAssociatedTokenAddress(
      base,
      orderBook,
      true
    );

    const quoteVault = await token.getAssociatedTokenAddress(
      quote,
      orderBook,
      true
    );

    await program.methods
      .initializeOrderBook()
      .accounts({
        orderBook,
        globalState,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        base,
        quote,
        baseVault,
        quoteVault,
      })
      .rpc();

    const [mm0, mm0Base, mm0Quote] = await generateMarketMaker(
      0, // reside at 0th index
      program,
      connection,
      payer,
      globalState,
      orderBook,
      baseVault,
      quoteVault,
      base,
      quote,
      mintAuthority,
      admin
    );

    const [mm1, mm1Base, mm1Quote] = await generateMarketMaker(
      1, // reside at 1st index
      program,
      connection,
      payer,
      globalState,
      orderBook,
      baseVault,
      quoteVault,
      base,
      quote,
      mintAuthority,
      admin
    );

    let mm0BalsBefore = await program.methods
      .getMarketMakerBalances(mm0.publicKey)
      .accounts({
        orderBook,
      })
      .view();

    await program.methods
      .submitLimitOrder(
        { buy: {} },
        new anchor.BN(100), // amount
        new anchor.BN(1e9), // price
        12, // ref id
        0 // mm index
      )
      .accounts({
        authority: mm0.publicKey,
        orderBook,
      })
      .signers([mm0])
      .rpc();

    let mm0BalsAfter = await program.methods
      .getMarketMakerBalances(mm0.publicKey)
      .accounts({
        orderBook,
      })
      .view();

    assert(
      mm0BalsAfter.quoteBalance.eq(
        mm0BalsBefore.quoteBalance.sub(new anchor.BN(100))
      )
    );

    await program.methods
      .submitLimitOrder(
        { buy: {} },
        new anchor.BN(101), // amount
        new anchor.BN(1e9 + 2), // price
        13, // ref id
        1 // mm index
      )
      .accounts({
        authority: mm1.publicKey,
        orderBook,
      })
      .signers([mm1])
      .rpc();

    await program.methods
      .submitLimitOrder(
        { buy: {} },
        new anchor.BN(102), // amount
        new anchor.BN(1e9 + 1), // price
        14, // ref id
        1 // mm index
      )
      .accounts({
        authority: mm1.publicKey,
        orderBook,
      })
      .signers([mm1])
      .rpc();

    let buys = await program.methods
      .getBestOrders({ buy: {} })
      .accounts({
        orderBook,
      })
      .view();

    // buys should be ascending price
    assert(buys[0].amount.eq(new anchor.BN(101)));
    assert(buys[1].amount.eq(new anchor.BN(102)));
    assert(buys[2].amount.eq(new anchor.BN(100)));

    let orderIndex = await program.methods
      .getOrderIndex({ buy: {} }, 12, 0)
      .accounts({
        orderBook,
      })
      .view();

    await program.methods
      .cancelLimitOrder({ buy: {} }, orderIndex, 0)
      .accounts({
        orderBook,
        authority: mm0.publicKey,
      })
      .signers([mm0])
      .rpc();

    mm0BalsAfter = await program.methods
      .getMarketMakerBalances(mm0.publicKey)
      .accounts({
        orderBook,
      })
      .view();

    // should get their tokens back
    assert(mm0BalsAfter.quoteBalance.eq(mm0BalsBefore.quoteBalance));

    await program.methods
      .submitLimitOrder(
        { sell: {} },
        new anchor.BN(300), // amount
        new anchor.BN(2e9), // price
        15, // ref id
        0 // mm index
      )
      .accounts({
        authority: mm0.publicKey,
        orderBook,
      })
      .signers([mm0])
      .rpc();

    let sells = await program.methods
      .getBestOrders({ sell: {} })
      .accounts({
        orderBook,
      })
      .view();
    assert.equal(sells.length, 1);
    assert(sells[0].amount.eq(new anchor.BN(300)));
    assert(sells[0].price.eq(new anchor.BN(2e9)));

    mm0BalsAfter = await program.methods
      .getMarketMakerBalances(mm0.publicKey)
      .accounts({
        orderBook,
      })
      .view();

    assert(
      mm0BalsAfter.baseBalance.eq(
        mm0BalsBefore.baseBalance.sub(new anchor.BN(300))
      )
    );

    let mm1BaseTokenBalanceBefore = (
      await token.getAccount(connection, mm1Base)
    ).amount;
    let mm1QuoteTokenBalanceBefore = (
      await token.getAccount(connection, mm1Quote)
    ).amount;
    let quoteVaultBalanceBefore = (
      await token.getAccount(connection, quoteVault)
    ).amount;

    let mm0BalsBeforeTake = await program.methods
      .getMarketMakerBalances(mm0.publicKey)
      .accounts({
        orderBook,
      })
      .view();

    // the limit order is for 300 at a price of 2, therefore 50 should cost 100
    await program.methods
      .submitTakeOrder(
        { buy: {} },
        new anchor.BN(100),
        new anchor.BN(49) // allow round down to 49 bcuz taker fees
      )
      .accounts({
        globalState,
        userBaseAccount: mm1Base,
        userQuoteAccount: mm1Quote,
        baseVault,
        quoteVault,
        authority: mm1.publicKey,
        orderBook,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .signers([mm1])
      .rpc();

    let mm0BalsAfterTake = await program.methods
      .getMarketMakerBalances(mm0.publicKey)
      .accounts({
        orderBook,
      })
      .view();
      
    let mm1BalsAfterTake = await program.methods
      .getMarketMakerBalances(mm1.publicKey)
      .accounts({
        orderBook,
      })
      .view();

    console.log(mm0BalsAfterTake);
    console.log(mm1BalsAfterTake);

    let mm1BaseTokenBalanceAfter = (await token.getAccount(connection, mm1Base))
      .amount;
    assert.isAtLeast(
      Number(mm1BaseTokenBalanceAfter),
      Number(mm1BaseTokenBalanceBefore) + 49
    );

    let mm1QuoteTokenBalanceAfter = (
      await token.getAccount(connection, mm1Quote)
    ).amount;
    assert.equal(
      Number(mm1QuoteTokenBalanceAfter),
      Number(mm1QuoteTokenBalanceBefore) - 100
    );

    let quoteVaultBalanceAfter = (
      await token.getAccount(connection, quoteVault)
    ).amount;
    assert.equal(
      Number(quoteVaultBalanceAfter),
      Number(quoteVaultBalanceBefore) + 100
    );

    assert(mm0BalsAfterTake.baseBalance.eq(mm0BalsBeforeTake.baseBalance));
    assert(
      mm0BalsAfterTake.quoteBalance.eq(
        mm0BalsBeforeTake.quoteBalance.add(new anchor.BN(99)) // taker fee of 1
      )
    );

    let ob = await program.account.orderBook.fetch(orderBook);
    assert(ob.inv.quoteFeesSweepable.eq(new anchor.BN(1)));

    buys = await program.methods
      .getBestOrders({ buy: {} })
      .accounts({
        orderBook,
      })
      .view();
    assert.equal(buys.length, 2);

    sells = await program.methods
      .getBestOrders({ sell: {} })
      .accounts({
        orderBook,
      })
      .view();
    assert.equal(sells.length, 1);
    assert(sells[0].amount.eq(new anchor.BN(251)));
    assert(sells[0].price.eq(new anchor.BN(2e9)));

    let twap = await program.methods
      .getTwap()
      .accounts({
        orderBook,
      })
      .view();

    let startingSlot = twap.lastUpdatedSlot;
    let startingLastObservation = twap.lastObservation;
    let startingObservationAggregator = twap.observationAggregator;

    for (let i = 0; i < 5; i++) {
      await program.methods
        .submitLimitOrder(
          { sell: {} },
          new anchor.BN(1000), // amount
          new anchor.BN(3e9), // this price shouldn't affect anything
          50 + i, // ref id
          0 // mm index
        )
        .accounts({
          authority: mm0.publicKey,
          orderBook,
        })
        .signers([mm0])
        .rpc();
    }

    twap = await program.methods
      .getTwap()
      .accounts({
        orderBook,
      })
      .view();

    let endingSlot = twap.lastUpdatedSlot;
    let endingLastObservation = twap.lastObservation;
    let endingObservationAggregator = twap.observationAggregator;

    assert(endingLastObservation.eq(startingLastObservation));
    assert(endingSlot.gt(startingSlot));

    let slotsPassed = endingSlot.sub(startingSlot);

    assert(slotsPassed.eqn(5));

    let aggregatorDifference = endingObservationAggregator.sub(
      startingObservationAggregator
    );

    let twapPrice = aggregatorDifference.div(slotsPassed);

    let expectedPrice = new anchor.BN((1e9 + 2e9) / 2 + 1); // add the 1 bcuz it rounds up

    assert(twapPrice.eq(expectedPrice));

    const adminBase = await token.createAccount(
      connection,
      payer,
      base,
      admin.publicKey
    );

    const adminQuote = await token.createAccount(
      connection,
      payer,
      quote,
      admin.publicKey
    );

    await program.methods
      .sweepFees()
      .accounts({
        globalState,
        admin: admin.publicKey,
        orderBook,
        baseTo: adminBase,
        quoteTo: adminQuote,
        baseVault,
        quoteVault,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();

    let quoteFeesSwept = (await token.getAccount(connection, adminQuote))
      .amount;
    assert.equal(1, Number(quoteFeesSwept));

    await program.methods
      .withdrawBalance(
        0,
        new anchor.BN(10),
        new anchor.BN(10)
      )
      .accounts({
        orderBook,
        authority: mm0.publicKey,
        baseTo: mm0Base,
        quoteTo: mm0Quote,
        baseVault,
        quoteVault,
        tokenProgram: token.TOKEN_PROGRAM_ID,
      })
      .signers([mm0])
      .rpc();

    await program.methods
      .submitLimitOrder(
        { buy: {} },
        new anchor.BN(101), // amount
        new anchor.BN(2e9 - 100), // price
        13, // ref id
        1 // mm index
      )
      .accounts({
        authority: mm1.publicKey,
        orderBook,
      })
      .signers([mm1])
      .rpc();

    // this is a twap test that makes the tests longer to run, uncomment it
    // if you wish

    // this should fill up the book
    /* for (let i = 0; i < 122; i++) { */
    /*   await program.methods */
    /*     .submitLimitOrder( */
    /*       { sell: {} }, */
    /*       new anchor.BN(1000), // amount */
    /*       new anchor.BN(3e9), // this price shouldn't affect anything */
    /*       60 + i, // ref id */
    /*       0 // mm index */
    /*     ) */
    /*     .accounts({ */
    /*       authority: mm0.publicKey, */
    /*       orderBook, */
    /*     }) */
    /*     .signers([mm0]) */
    /*     .rpc(); */
    /* } */

    /* twap = await program.methods */
    /*   .getTwap() */
    /*   .accounts({ */
    /*     orderBook, */
    /*   }) */
    /*   .view(); */

    /* slotsPassed = twap.lastUpdatedSlot.sub(endingSlot); */

    /* assert(slotsPassed.gtn(100)); */
    /* assert(slotsPassed.ltn(200)); */

    /* aggregatorDifference = twap.observationAggregator.sub( */
    /*   endingObservationAggregator */
    /* ); */

    /* twapPrice = aggregatorDifference.div(slotsPassed); */

    /* let minPrice = new anchor.BN(2e9 - 1e8); // 1.9 */
    /* let maxPrice = new anchor.BN(2e9); */

    /* assert(twapPrice.gt(minPrice)); */
    /* assert(twapPrice.lt(maxPrice)); */
  });
});

const BASE_AMOUNT = 1_000_000_000;
const QUOTE_AMOUNT = 1_000_000_000;

export async function generateMarketMaker(
  index: number,
  program: Program<Clob>,
  connection: anchor.Connection,
  payer: anchor.web3.Keypair,
  globalState: anchor.web3.PublicKey,
  orderBook: anchor.web3.PublicKey,
  baseVault: anchor.web3.PublicKey,
  quoteVault: anchor.web3.PublicKey,
  base: anchor.web3.PublicKey,
  quote: anchor.web3.PublicKey,
  mintAuthority: anchor.web3.Keypair,
  admin: anchor.web3.Keypair
): [anchor.web3.Keypair, anchor.web3.PublicKey, anchor.web3.PublicKey] {
  const mm = anchor.web3.Keypair.generate();

  const mmBase = await token.createAccount(
    connection,
    payer,
    base,
    mm.publicKey
  );

  const mmQuote = await token.createAccount(
    connection,
    payer,
    quote,
    mm.publicKey
  );

  await token.mintTo(
    connection,
    payer,
    base,
    mmBase,
    mintAuthority,
    BASE_AMOUNT * 2
  );

  await token.mintTo(
    connection,
    payer,
    quote,
    mmQuote,
    mintAuthority,
    QUOTE_AMOUNT * 2
  );

  await program.methods
    .addMarketMaker(mm.publicKey, index)
    .accounts({
      orderBook,
      payer: payer.publicKey,
      globalState,
      admin: admin.publicKey,
    })
    .rpc();

  await program.methods
    .topUpBalance(
      index,
      new anchor.BN(BASE_AMOUNT),
      new anchor.BN(QUOTE_AMOUNT)
    )
    .accounts({
      orderBook,
      authority: mm.publicKey,
      baseFrom: mmBase,
      quoteFrom: mmQuote,
      baseVault,
      quoteVault,
      tokenProgram: token.TOKEN_PROGRAM_ID,
    })
    .signers([mm])
    .rpc();

  return [mm, mmBase, mmQuote];
}
