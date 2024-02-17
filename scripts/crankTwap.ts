import { initializeProposal, payer, provider } from "./main";
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


import { openbookTwap, autocratProgram, openbook, OPENBOOK_PROGRAM_ID } from "./main";

const PROPOSAL_NUMBER = 7;

// crank the TWAPs of a proposal's markets by passing in a bunch of empty orders
async function crankTwap() {
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
    
    let passMarketOpenOrdersAccount = await openbook.createOpenOrders(
      payer,
      passMarket,
      "oo"
    );

    let failMarketOpenOrdersAccount = await openbook.createOpenOrders(
      payer,
      failMarket,
      "oo"
    );

    // openbook.findOpenOrdersForMarket()

    // return;

    // TODO: have this done programmatically
    // let passMarketOpenOrdersAccount = await openbook.findOpenOrdersForMarket(
    //     payer.publicKey,
    //     passMarket,
    // )[0];

    // let failMarketOpenOrdersAccount = await openbook.findOpenOrdersForMarket(
    //     payer.publicKey,
    //     failMarket,
    // )[0];

    // console.log(passMarketOpenOrdersAccount);
    // return;


    // const indexer = openbook.findOpenOrdersIndexer(payer.publicKey);

    // console.log(await openbook.getOpenOrdersIndexer(indexer));

    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ 
        microLamports: 1 
    });

    for (let i = 0; i < 500; i++) {
        try {
            let tx = await openbookTwap.methods
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
                .preInstructions([
                    addPriorityFee,
                    await openbookTwap.methods
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
                        .instruction()
                ])
                .rpc();

            console.log(tx);
        } catch (err) {
            console.log("error");
        }
    }
}

crankTwap();
