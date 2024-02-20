import "./main";
import { autocratProgram } from "./main";

import {
  OpenBookV2Client,
  PlaceOrderArgs,
  Side,
  OrderType,
  SelfTradeBehavior,
} from "@openbook-dex/openbook-v2";

// Put your own proposal number here
const PROPOSAL_NUMBER = 7;
// If false, it will do the fail market obviously.
const PASS_MARKET = true;

async function placeOrder() {
  let proposals = await autocratProgram.account.proposal.all();

  let proposal = proposals.filter(
    (proposal) => proposal.account.number == PROPOSAL_NUMBER
  )[0].account;

  let twapMarket = PASS_MARKET
    ? proposal.openbookTwapPassMarket
    : proposal.openbookTwapFailMarket;
  let market = PASS_MARKET
    ? proposal.openbookPassMarket
    : proposal.openbookFailMarket;

  // let market = (await openbookTwap.account.twapMarket.fetch(twapMarket)).market;

  let buyArgs: PlaceOrderArgs = {
    side: Side.Bid,
    priceLots: new BN(9_000), // 1 USDC for 1 META
    maxBaseLots: new BN(10),
    maxQuoteLotsIncludingFees: new BN(10 * 1000_000), // 10 USDC
    clientOrderId: new BN(1),
    orderType: OrderType.Limit,
    expiryTimestamp: new BN(0),
    selfTradeBehavior: SelfTradeBehavior.DecrementTake,
    limit: 255,
  };

  let sellArgs: PlaceOrderArgs = {
    side: Side.Ask,
    priceLots: new BN(12_000), // 1.2 USDC for 1 META
    maxBaseLots: new BN(10),
    maxQuoteLotsIncludingFees: new BN(10 * 12_000),
    clientOrderId: new BN(2),
    orderType: OrderType.Limit,
    expiryTimestamp: new BN(0),
    selfTradeBehavior: SelfTradeBehavior.DecrementTake,
    limit: 255,
  };

  const storedMarket = await openbook.getMarketAccount(market);
  let openOrdersAccount = new anchor.web3.PublicKey(
    "CxDQ5RSYebF6mRLDrXYn1An7bawe6S3iyaU5rZBjz4Xs"
  );
  // let openOrdersAccount = await openbook.createOpenOrders(
  //   payer,
  //   market,
  //   new BN(1),
  //   "oo"
  // );
  // console.log(openOrdersAccount);
  // let openOrdersAccount = await openbook.createOpenOrders(market, new BN(4), "oo2");

  const userBaseAccount = await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    storedMarket.baseMint,
    payer.publicKey
  );
  const userQuoteAccount = await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    storedMarket.quoteMint,
    payer.publicKey
  );

  await openbookTwap.methods
    .placeOrder(buyArgs)
    .accounts({
      asks: storedMarket.asks,
      bids: storedMarket.bids,
      marketVault: storedMarket.marketQuoteVault,
      eventHeap: storedMarket.eventHeap,
      market,
      openOrdersAccount,
      userTokenAccount: userQuoteAccount.address,
      twapMarket,
      openbookProgram: OPENBOOK_PROGRAM_ID,
    })
    .rpc();

  await openbookTwap.methods
    .placeOrder(sellArgs)
    .accounts({
      asks: storedMarket.asks,
      bids: storedMarket.bids,
      marketVault: storedMarket.marketBaseVault,
      eventHeap: storedMarket.eventHeap,
      market,
      openOrdersAccount,
      userTokenAccount: userBaseAccount.address,
      twapMarket,
      openbookProgram: OPENBOOK_PROGRAM_ID,
    })
    .rpc();
}

placeOrder();
