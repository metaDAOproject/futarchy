import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

import {
  OpenBookV2Client,
  PlaceOrderArgs,
  Side,
  OrderType,
  SelfTradeBehavior,
} from "@openbook-dex/openbook-v2";

import { AutocratV0 } from "../target/types/autocrat_v0";

import {
  IDL as ConditionalVaultIDL,
  ConditionalVault,
} from "../target/types/conditional_vault";

import { OpenbookTwap } from "../tests/fixtures/openbook_twap";

const AutocratIDL: AutocratV0 = require("../target/idl/autocrat_v0.json");
const OpenbookTwapIDL: OpenbookTwap = require("../tests/fixtures/openbook_twap.json");

const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "meta3cxKzFBmWYgCVozmvCQAS3y9b3fGxrG9HkHL7Wi"
);
const CONDITIONAL_VAULT_PROGRAM_ID = new PublicKey(
  "vaU1tVLj8RFk7mNj1BxqgAsMKKaL8UvEUHvU3tdbZPe"
);
const OPENBOOK_TWAP_PROGRAM_ID = new PublicKey(
  "TWAPrdhADy2aTKN5iFZtNnkQYXERD9NvKjPFVPMSCNN"
);
const OPENBOOK_PROGRAM_ID = new PublicKey(
  "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb"
);

export const META = new PublicKey("METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr");
export const PROPH3t_PUBKEY = new PublicKey("65U66fcYuNfqN12vzateJhZ4bgDuxFWN9gMwraeQKByg");

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const payer = provider.wallet["payer"];

export const autocratProgram = new Program<AutocratV0>(
  AutocratIDL,
  AUTOCRAT_PROGRAM_ID,
  provider
);

export const vaultProgram = new Program<ConditionalVault>(
  ConditionalVaultIDL,
  CONDITIONAL_VAULT_PROGRAM_ID,
  provider
);

export const openbook = new OpenBookV2Client(provider);
export const openbookTwap = new Program<OpenbookTwap>(
  OpenbookTwapIDL,
  OPENBOOK_TWAP_PROGRAM_ID,
  provider
);

const [dao] = PublicKey.findProgramAddressSync(
  [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
  autocratProgram.programId
);

const [daoTreasury] = PublicKey.findProgramAddressSync(
  [dao.toBuffer()],
  autocratProgram.programId
);

async function createMint(
  mintAuthority: any,
  freezeAuthority: any,
  decimals: number,
  keypair = Keypair.generate()
): Promise<any> {
  return await token.createMint(
    provider.connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals,
    keypair
  );
}

async function initializeVault(
  settlementAuthority: any,
  underlyingTokenMint: any,
  nonce: any
): Promise<any> {
  const [vault] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("conditional_vault"),
      settlementAuthority.toBuffer(),
      underlyingTokenMint.toBuffer(),
      nonce.toBuffer("le", 8),
    ],
    vaultProgram.programId
  );

  if (
    (await vaultProgram.account.conditionalVault.fetchNullable(vault)) != null
  ) {
    return vault;
  }

  const vaultUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
    underlyingTokenMint,
    vault,
    true
  );

  let conditionalOnFinalizeKP = anchor.web3.Keypair.generate();
  let conditionalOnRevertKP = anchor.web3.Keypair.generate();

  await vaultProgram.methods
    .initializeConditionalVault(settlementAuthority, nonce)
    .accounts({
      vault,
      underlyingTokenMint,
      vaultUnderlyingTokenAccount,
      conditionalOnFinalizeTokenMint: conditionalOnFinalizeKP.publicKey,
      conditionalOnRevertTokenMint: conditionalOnRevertKP.publicKey,
      payer: payer.publicKey,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([conditionalOnFinalizeKP, conditionalOnRevertKP])
    .rpc();

  //const storedVault = await vaultProgram.account.conditionalVault.fetch(
  //  vault
  //);
  //console.log(storedVault);

  return vault;
}

async function initializeDAO(META: any, USDC: any) {
  await autocratProgram.methods
    .initializeDao()
    .accounts({
      dao,
      metaMint: META,
      usdcMint: USDC,
    })
    .rpc();
}

async function initializeProposal() {
  const senderAcc = await token.getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        META,
        daoTreasury,
        true
    );

  const receiverAcc = await token.getOrCreateAssociatedTokenAccount(
        provider.connection,
        payer,
        META,
        PROPH3t_PUBKEY
    );

  const transferIx = token.createTransferInstruction(
    senderAcc.address,
    receiverAcc.address,
    daoTreasury,
    1000 * 1_000_000_000, // 1,000 META
  );

  const programId = transferIx.programId;
  const accounts = transferIx.keys;
  const data = transferIx.data;

  const instruction = {
    programId,
    accounts,
    data,
  };

  const proposalKeypair = Keypair.generate();

  const storedDAO = await autocratProgram.account.dao.fetch(dao);
  console.log(storedDAO);

  // least signficant 32 bits of nonce are proposal number
  // most significant bit of nonce is 0 for base and 1 for quote

  let baseNonce = new BN(storedDAO.proposalCount);

  const baseVault = await initializeVault(
    storedDAO.treasury,
    storedDAO.metaMint,
    baseNonce
  );

  const quoteVault = await initializeVault(
    storedDAO.treasury,
    storedDAO.usdcMint,
    baseNonce.or(new BN(1).shln(63))
  );

  const passBaseMint = (
    await vaultProgram.account.conditionalVault.fetch(baseVault)
  ).conditionalOnFinalizeTokenMint;
  const passQuoteMint = (
    await vaultProgram.account.conditionalVault.fetch(quoteVault)
  ).conditionalOnFinalizeTokenMint;

  const failBaseMint = (
    await vaultProgram.account.conditionalVault.fetch(baseVault)
  ).conditionalOnRevertTokenMint;
  const failQuoteMint = (
    await vaultProgram.account.conditionalVault.fetch(quoteVault)
  ).conditionalOnRevertTokenMint;

  let openbookPassMarketKP = Keypair.generate();

  let [openbookTwapPassMarket] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("twap_market"),
      openbookPassMarketKP.publicKey.toBuffer(),
    ],
    openbookTwap.programId
  );

  let openbookPassMarket = await openbook.createMarket(
    payer,
    "pMETA/pUSDC",
    passQuoteMint,
    passBaseMint,
    new BN(100),
    new BN(1e9),
    new BN(0),
    new BN(0),
    new BN(0),
    null,
    null,
    openbookTwapPassMarket,
    null,
    openbookTwapPassMarket,
    { confFilter: 0.1, maxStalenessSlots: 100 },
    openbookPassMarketKP
  );

  await openbookTwap.methods
    .createTwapMarket(new BN(1_000))
    .accounts({
      market: openbookPassMarket,
      twapMarket: openbookTwapPassMarket,
    })
    .rpc();

  let openbookFailMarketKP = Keypair.generate();

  let [openbookTwapFailMarket] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("twap_market"),
      openbookFailMarketKP.publicKey.toBuffer(),
    ],
    openbookTwap.programId
  );

  let openbookFailMarket = await openbook.createMarket(
    payer,
    "fMETA/fUSDC",
    failQuoteMint,
    failBaseMint,
    new BN(100),
    new BN(1e9),
    new BN(0),
    new BN(0),
    new BN(0),
    null,
    null,
    openbookTwapFailMarket,
    null,
    openbookTwapFailMarket,
    { confFilter: 0.1, maxStalenessSlots: 100 },
    openbookFailMarketKP
  );
  await openbookTwap.methods
    .createTwapMarket(new BN(1_000))
    .accounts({
      market: openbookFailMarket,
      twapMarket: openbookTwapFailMarket,
    })
    .rpc();

  const proposalURL = "https://hackmd.io/ammvq88QRtayu7c9VLnHOA?view";

  await autocratProgram.methods
    .initializeProposal(proposalURL, instruction)
    .preInstructions([
      await autocratProgram.account.proposal.createInstruction(
        proposalKeypair,
        1500
      ),
    ])
    .accounts({
      proposal: proposalKeypair.publicKey,
      dao,
      daoTreasury,
      quoteVault,
      baseVault,
      openbookPassMarket,
      openbookFailMarket,
      openbookTwapPassMarket,
      openbookTwapFailMarket,
      proposer: payer.publicKey,
    })
    .signers([proposalKeypair])
    .rpc();
}

async function placeOrdersOnBothSides(twapMarket: any) {
  let market = (await openbookTwap.account.twapMarket.fetch(twapMarket)).market;

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
  let openOrdersAccount = new anchor.web3.PublicKey("CxDQ5RSYebF6mRLDrXYn1An7bawe6S3iyaU5rZBjz4Xs");
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

async function placeTakeOrder(twapMarket: any) {
  let market = (await openbookTwap.account.twapMarket.fetch(twapMarket)).market;
  const storedMarket = await openbook.getMarketAccount(market);

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

  let buyArgs: PlaceOrderArgs = {
    side: Side.Bid,
    priceLots: new BN(13_000), // 1 USDC for 1 META
    maxBaseLots: new BN(10000),
    maxQuoteLotsIncludingFees: new BN(1 * 13_000), // 10 USDC
    clientOrderId: new BN(1),
    orderType: OrderType.Market,
    expiryTimestamp: new BN(0),
    selfTradeBehavior: SelfTradeBehavior.DecrementTake,
    limit: 255,
  };

  console.log(
    "base balance before:",
    (await token.getAccount(provider.connection, userBaseAccount.address))
      .amount
  );
  console.log(
    "quote balance before",
    (await token.getAccount(provider.connection, userQuoteAccount.address))
      .amount
  );

  let tx = await openbookTwap.methods
    .placeTakeOrder(buyArgs)
    .accounts({
      asks: storedMarket.asks,
      bids: storedMarket.bids,
      eventHeap: storedMarket.eventHeap,
      market,
      marketAuthority: storedMarket.marketAuthority,
      marketBaseVault: storedMarket.marketBaseVault,
      marketQuoteVault: storedMarket.marketQuoteVault,
      userQuoteAccount: userQuoteAccount.address,
      userBaseAccount: userBaseAccount.address,
      twapMarket,
      openbookProgram: OPENBOOK_PROGRAM_ID,
    })
    .transaction();

  tx.feePayer = payer.publicKey;

  const sim = await provider.connection.simulateTransaction(tx, undefined, [
    userBaseAccount.address,
    userQuoteAccount.address,
  ]);
  // console.log(sim.value.accounts[0])
  const data = sim.value.accounts[0].data;
  const buf = Buffer.from(data[0], data[1] as BufferEncoding);

  console.log(
    token.unpackAccount(userBaseAccount.address, {
      data: Buffer.from(
        Buffer.from(
          sim.value.accounts[0].data[0],
          sim.value.accounts[0].data[1] as BufferEncoding
        )
      ),
      executable: false,
      lamports: 0,
      owner: token.TOKEN_PROGRAM_ID,
    }).amount
  );

  console.log(
    token.unpackAccount(userQuoteAccount.address, {
      data: Buffer.from(
        Buffer.from(
          sim.value.accounts[1].data[0],
          sim.value.accounts[1].data[1] as BufferEncoding
        )
      ),
      executable: false,
      lamports: 0,
      owner: token.TOKEN_PROGRAM_ID,
    }).amount
  );
}

export async function mintConditionalTokens(
  amount: number,
  vault: anchor.web3.PublicKey,
) {
  const storedVault = await vaultProgram.account.conditionalVault.fetch(vault);


  // Setting default values for optional parameters
  const userUnderlyingTokenAccount = await getOrCreateAccount(storedVault.underlyingTokenMint);
  const userConditionalOnFinalizeTokenAccount = await getOrCreateAccount(storedVault.conditionalOnFinalizeTokenMint);
  const userConditionalOnRevertTokenAccount = await getOrCreateAccount(storedVault.conditionalOnRevertTokenMint);
  const vaultUnderlyingTokenAccount = storedVault.underlyingTokenAccount;

  const bnAmount = new anchor.BN(amount);

  // Mint conditional tokens
  await vaultProgram.methods
    .mintConditionalTokens(bnAmount)
    .accounts({
      authority: payer.publicKey,
      vault,
      vaultUnderlyingTokenAccount,
      userUnderlyingTokenAccount,
      userConditionalOnFinalizeTokenAccount,
      userConditionalOnRevertTokenAccount,
      conditionalOnFinalizeTokenMint: storedVault.conditionalOnFinalizeTokenMint,
      conditionalOnRevertTokenMint: storedVault.conditionalOnRevertTokenMint,
    })
    .signers([payer])
    .rpc();
}

async function getOrCreateAccount(mint: anchor.web3.PublicKey) {
  return (await token.getOrCreateAssociatedTokenAccount(
    provider.connection,
    payer,
    mint,
    payer.publicKey
  )).address;
}
