import { initializeProposal, payer, provider } from "./main";
import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { TransactionInstruction } from "@solana/web3.js"


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

const sleep = async(ms: number): Promise<void> => {
    return new Promise(
        (resolve) => setTimeout(resolve, ms));
}

import { openbookTwap, autocratProgram, openbook, OPENBOOK_PROGRAM_ID } from "./main";

const PROPOSAL_NUMBER = 11;

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

    console.log(userPassQuoteAccount);

    const userFailQuoteAccount = await token.getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        storedFailMarket.quoteMint,
        payer.publicKey
    );
    console.log('FAIL QUOTE ACCOUNT');
    console.log(userFailQuoteAccount);

    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ 
      microLamports: 1000
    });
    
    // let passMarketOpenOrdersAccount = await openbook.createOpenOrders(
    //   payer,
    //   passMarket,
    //   "oo"
    // );

    let passOpenOrdersIndexer = openbook.findOpenOrdersIndexer(payer.publicKey)
    let passAccountIndex = new BN(1);
    let addCreatePass = false
    try {
      const storedIndexer = await openbook.deserializeOpenOrdersIndexerAccount(
        passOpenOrdersIndexer
      )
      if (storedIndexer == null){
        console.log('error');
        addCreatePass = true
      } else {
        passAccountIndex = new BN(storedIndexer.createdCounter + 1);
      }
    } catch {
      console.log('error');
      addCreatePass = true
    }

    const passMarketOpenOrdersAccount = openbook.findOpenOrderAtIndex(payer.publicKey, passAccountIndex)
    console.log(passMarketOpenOrdersAccount)
    console.log(passOpenOrdersIndexer)
    console.log(passAccountIndex.toNumber())
    console.log(passMarket)
    try {
      if (addCreatePass) {
        await openbook.program.methods
          .createOpenOrdersAccount("oo")
          .accounts({
            openOrdersIndexer: passOpenOrdersIndexer,
            openOrdersAccount: passMarketOpenOrdersAccount,
            market: passMarket,
            owner: payer.publicKey,
            delegateAccount: null
          })
          .preInstructions([
            addPriorityFee,
            await openbook.createOpenOrdersIndexerIx(passOpenOrdersIndexer, payer.publicKey)
          ])
          .rpc()
       } else {
        await openbook.program.methods
          .createOpenOrdersAccount("oo")
          .accounts({
            openOrdersIndexer: passOpenOrdersIndexer,
            openOrdersAccount: passMarketOpenOrdersAccount,
            market: passMarket,
            owner: payer.publicKey,
            delegateAccount: null
          })
          .preInstructions([
            addPriorityFee
          ])
          .rpc()
      }
    } catch (err) {
      console.error(err);
      return
    }


    // let failMarketOpenOrdersAccount = await openbook.createOpenOrders(
    //   payer,
    //   failMarket,
    //   "oo"
    // );
    // console.log('FAIL OPEN ORDERS ACCOUNT');
    // console.log(failMarketOpenOrdersAccount);

    let failOpenOrdersIndexer = openbook.findOpenOrdersIndexer(payer.publicKey)
    let failAccountIndex = new BN(1);
    let addCreateFail = false
    try {
      const storedIndexer = await openbook.deserializeOpenOrdersIndexerAccount(
        failOpenOrdersIndexer
      )
      if (storedIndexer == null){
        console.log('error');
        addCreateFail = true
      } else {
        failAccountIndex = new BN(storedIndexer.createdCounter + 1);
      }
    } catch {
      console.log('error');
      addCreateFail = true
    }

    const failMarketOpenOrdersAccount = openbook.findOpenOrderAtIndex(payer.publicKey, failAccountIndex)
    console.log(failMarketOpenOrdersAccount)
    console.log(failOpenOrdersIndexer)
    console.log(failAccountIndex.toNumber())
    console.log(failMarket)
    try {
      if (addCreateFail) {
        await openbook.program.methods
          .createOpenOrdersAccount("oo")
          .accounts({
            openOrdersIndexer: failOpenOrdersIndexer,
            openOrdersAccount: failMarketOpenOrdersAccount,
            market: failMarket,
            owner: payer.publicKey,
            delegateAccount: null
          })
          .preInstructions([
            addPriorityFee,
            await openbook.createOpenOrdersIndexerIx(failOpenOrdersIndexer, payer.publicKey)
          ])
          .rpc()
       } else {
        await openbook.program.methods
          .createOpenOrdersAccount("oo")
          .accounts({
            openOrdersIndexer: failOpenOrdersIndexer,
            openOrdersAccount: failMarketOpenOrdersAccount,
            market: failMarket,
            owner: payer.publicKey,
            delegateAccount: null
          })
          .preInstructions([
            addPriorityFee
          ])
          .rpc()
      }
    } catch (err) {
      console.error(err);
      return
    }

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

    for (let i = 0; i < 10_000; i++) {
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
            console.log(err);
        } finally {
            await sleep(600);
        }
    }
}

crankTwap();
