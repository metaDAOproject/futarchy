import "./main";
import { autocratProgram, openbook, openbookTwap } from "./main";
import * as anchor from "@coral-xyz/anchor";
const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;
const { execSync } = require("child_process");

import {
  OpenBookV2Client,
  PlaceOrderArgs,
  Side,
  OrderType,
  SelfTradeBehavior,
} from "@openbook-dex/openbook-v2";

const twapMarketList = [
  "7TXCqw4iJ8mD9vMAkjEiDTuZLETW9DuBM48J2kPkoVoR",
  "AwMimsGw2ShWXTeC6JkMguGoT73vky44Z1DaP1fpBxQY",
];

let twapMarketPks = twapMarketList.map(
  (twapMarket) => new PublicKey(twapMarket)
);

async function crank(twapMarkets: anchor.web3.PublicKey[]) {
  let markets = [];
  for (let twapMarket of twapMarkets) {
    markets.push(
      (await openbookTwap.account.twapMarket.fetch(twapMarket)).market
    );
  }

  let storedMarkets = [];
  for (let market of markets) {
    await storedMarkets.push(openbook.getMarketAccount(market));
  }

  while (true) {
    for (let i in markets) {
      let accountsToConsume = await openbook.getAccountsToConsume(
        storedMarkets[i]
      );
      console.log(accountsToConsume);

      if (accountsToConsume.length > 0) {
        await openbook.consumeEvents(
          markets[i],
          storedMarkets[i],
          new BN(5),
          accountsToConsume
        );
      }

      execSync("sleep 10");
    }
  }
}

crank(twapMarketPks);
