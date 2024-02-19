import { initializeProposal, payer, provider } from "./main";
import { PAYER_PUBKEY } from "@clockwork-xyz/sdk";
import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";

const { PublicKey, Keypair, SystemProgram, ComputeBudgetProgram } = anchor.web3;
const { BN, Program } = anchor;

import {
  OpenBookV2Client,
  PlaceOrderArgs,
  Side,
  OrderType,
  SelfTradeBehavior,
} from "@openbook-dex/openbook-v2";

import { AutocratV0 } from "../target/types/autocrat_v0";


import { openbookTwap, autocratProgram, clockwork, openbook, OPENBOOK_PROGRAM_ID } from "./main";
import { Transaction } from "@solana/web3.js";

const PROPOSAL_NUMBER = 7;

// crank the TWAPs of a proposal's markets by passing in a bunch of empty orders
async function clockworkTwap() {
    const proposals = await autocratProgram.account.proposal.all();
    console.log(proposals);
    const storedProposal = proposals.find(proposal => proposal.account.number == PROPOSAL_NUMBER).account;

    const passMarketTwap = storedProposal.openbookTwapPassMarket;
    const passMarket = storedProposal.openbookPassMarket;
    const storedPassMarket = await openbook.deserializeMarketAccount(passMarket);

    const failMarketTwap = storedProposal.openbookTwapFailMarket;
    const failMarket = storedProposal.openbookFailMarket;
    const storedFailMarket = await openbook.deserializeMarketAccount(failMarket);

    console.log(await openbookTwap.account.twapMarket.fetch(passMarketTwap));
    console.log(await openbookTwap.account.twapMarket.fetch(failMarketTwap));
    
    let emptyBuyArgs: PlaceOrderArgs = {
        side: Side.Bid,
        priceLots: new BN(10_000), // 1 USDC for 1 META
        maxBaseLots: new BN(1),
        maxQuoteLotsIncludingFees: new BN(1 * 10_000),
        clientOrderId: new BN(1),
        orderType: OrderType.Market,
        expiryTimestamp: new BN(0),
        selfTradeBehavior: SelfTradeBehavior.DecrementTake,
        limit: 255,
    };

    const userPassQuoteAccount = await token.getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        storedPassMarket.quoteMint,
        payer.publicKey
    );

    const userFailQuoteAccount = await token.getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        storedFailMarket.quoteMint,
        payer.publicKey
    );
    
    // TODO Hardcode pubkeys, if open orders account already exists
    let passMarketOpenOrdersAccount = new PublicKey("BTVx1LQajppoeE61gisqCJdJmTexZyxk68eXQApqawHm");
    // let passMarketOpenOrdersAccount = await openbook.createOpenOrders(
    //   payer,
    //   passMarket,
    //   "oo"
    // );

    // TODO Hardcode pubkeys, if open orders account already exists
    let failMarketOpenOrdersAccount = new PublicKey("4hGCJuV3bcDQ4Y9pYAutyrCphVKLUVS3WuXX8QJYqkjc");
    // let failMarketOpenOrdersAccount = await openbook.createOpenOrders(
    //   payer,
    //   failMarket,
    //   "oo"
    // );

    const pass_crank = await openbookTwap.methods
                .placeOrder(emptyBuyArgs)
                .accounts({
                    asks: storedPassMarket.asks,
                    bids: storedPassMarket.bids,
                    eventHeap: storedPassMarket.eventHeap,
                    market: passMarket,
                    openOrdersAccount: passMarketOpenOrdersAccount,
                    userTokenAccount: userPassQuoteAccount.address,
                    marketVault: storedPassMarket.marketQuoteVault,
                    twapMarket: passMarketTwap,
                    openbookProgram: OPENBOOK_PROGRAM_ID,
                })
                .instruction();
    const fail_crank = await openbookTwap.methods
                .placeOrder(emptyBuyArgs)
                .accounts({
                    asks: storedFailMarket.asks,
                    bids: storedFailMarket.bids,
                    eventHeap: storedFailMarket.eventHeap,
                    market: failMarket,
                    openOrdersAccount: failMarketOpenOrdersAccount,
                    userTokenAccount: userFailQuoteAccount.address,
                    marketVault: storedFailMarket.marketQuoteVault,
                    twapMarket: failMarketTwap,
                    openbookProgram: OPENBOOK_PROGRAM_ID,
                })
                .instruction();
    
    const threadId = failMarket.toString().substring(0, 8);
    const [threadAddress] = clockwork.getThreadPDA(payer.publicKey, threadId);
    const trigger = {
        cron: {
            schedule: "*/10 * * * * * *",
            skippable: true,
        },
    };

    const ix = await clockwork.threadCreate(
          payer.publicKey,            // authority
          threadId,                   // id
          [pass_crank, fail_crank],   // instructions
          trigger,                    // trigger
          10000,                      // amount to fund the thread with (lamports)
      );

    // const ix = await clockwork.threadPause(payer.publicKey, threadPubkey);
    // const ix = await clockwork.threadResume(payer.publicKey, threadPubkey);
    // const ix = await clockwork.threadReset(payer.publicKey, threadPubkey);
    // const ix = await clockwork.threadDelete(payer.publicKey, threadAddress);

    const tx = new Transaction().add(ix);
    const sig = await clockwork.anchorProvider.connection.sendTransaction(tx, [payer], { skipPreflight: true });
    console.log(`Tx: ${sig}`);
    console.log(`Thread: https://explorer.solana.com/${threadAddress}\n`);
}

clockworkTwap();

