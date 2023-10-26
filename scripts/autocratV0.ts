import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

import {
  OpenBookV2Client,
} from "@openbook-dex/openbook-v2";

import { AutocratV0 } from "../target/types/autocrat_v0";

import { IDL as ConditionalVaultIDL, ConditionalVault } from "../target/types/conditional_vault";
import { IDL as ClobIDL, Clob } from "../target/types/clob";

import { OpenbookTwap, IDL as OpenbookTwapIDL } from "../tests/fixtures/openbook_twap";

const AutocratIDL: AutocratV0 = require("../target/idl/autocrat_v0.json");

const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "Euvur4akYaqT5djixEkf8J9Jb8SUrKZt8BZeSNnB5jYU"
);
const CONDITIONAL_VAULT_PROGRAM_ID = new PublicKey(
  "4nCk4qKJSJf8pzJadMnr9LubA6Y7Zw3EacsVqH1TwVXH"
);
const CLOB_PROGRAM_ID = new PublicKey(
  "8BnUecJAvKB7zCcwqhMiVWoqKWcw5S6PDCxWWEM2oxWA"
);
const OPENBOOK_TWAP_PROGRAM_ID = new PublicKey(
  "4dchEcc6TTC4QVyZQUWgQgcdAsXrUBxsdxpu572BY3Y2"
);
const OPENBOOK_PROGRAM_ID = new PublicKey(
  "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb"
);

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet['payer'];

const autocratProgram = new Program<AutocratV0>(
  AutocratIDL,
  AUTOCRAT_PROGRAM_ID,
  provider
);

const vaultProgram = new Program<ConditionalVault>(
  ConditionalVaultIDL,
  CONDITIONAL_VAULT_PROGRAM_ID,
  provider
);
const clobProgram = new Program<Clob>(
  ClobIDL,
  CLOB_PROGRAM_ID,
  provider
);

const openbook = new OpenBookV2Client(provider);
const openbookTwap = new Program<OpenbookTwap>(
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

const [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
  [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
  clobProgram.programId
);


async function createMint(
  mintAuthority: any,
  freezeAuthority: any,
  decimals: number,
): Promise<any> {
  return await token.createMint(
    provider.connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals
  );
}

async function initializeGlobalState(
  admin: any
) {
  await clobProgram.methods
    .initializeGlobalState(admin)
    .accounts({
      globalState,
    })
    .rpc();
}

async function initializeVault(
  settlementAuthority: any,
  underlyingTokenMint: any,
  nonce: any,
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

  if (await vaultProgram.account.conditionalVault.fetchNullable(vault) != null) {
    return vault;
  }

  const vaultUnderlyingTokenAccount = await token.getAssociatedTokenAddress(
    underlyingTokenMint,
    vault,
    true
  );

  let conditionalTokenMintKeypair = anchor.web3.Keypair.generate();

  await vaultProgram.methods
    .initializeConditionalVault(settlementAuthority, nonce)
    .accounts({
      vault,
      underlyingTokenMint,
      vaultUnderlyingTokenAccount,
      conditionalTokenMint: conditionalTokenMintKeypair.publicKey,
      payer: payer.publicKey,
      tokenProgram: token.TOKEN_PROGRAM_ID,
      associatedTokenProgram: token.ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([conditionalTokenMintKeypair])
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
    .rpc()
}

async function initializeProposal() {
  const accounts = [
    {
      pubkey: dao,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: daoTreasury,
      isSigner: true,
      isWritable: false,
    },
  ];
  const data = autocratProgram.coder.instruction.encode("set_pass_threshold_bps", {
    passThresholdBps: 1000,
  });
  const instruction = {
    programId: autocratProgram.programId,
    accounts,
    data,
  };

  const proposalKeypair = Keypair.generate();

  const storedDAO = await autocratProgram.account.dao.fetch(dao);
  console.log(storedDAO);

  // least signficant 32 bits of nonce are proposal number
  // most significant bit of nonce is 0 for pass and 1 for fail
  // second most significant bit of nonce is 0 for base and 1 for quote

  let baseNonce = new BN(storedDAO.proposalCount);

  const basePassVault = await initializeVault(
    storedDAO.treasury,
    storedDAO.metaMint,
    baseNonce,
  );

  const quotePassVault = await initializeVault(
    storedDAO.treasury,
    storedDAO.usdcMint,
    baseNonce.or(new BN(1).shln(63)),
  );

  const baseFailVault = await initializeVault(
    storedDAO.treasury,
    storedDAO.metaMint,
    baseNonce.or(new BN(1).shln(62)),
  );

  const quoteFailVault = await initializeVault(
    storedDAO.treasury,
    storedDAO.usdcMint,
    baseNonce.or(new BN(3).shln(62)),
  );

  const passBaseMint = (
    await vaultProgram.account.conditionalVault.fetch(basePassVault)
  ).conditionalTokenMint;
  const passQuoteMint = (
    await vaultProgram.account.conditionalVault.fetch(quotePassVault)
  ).conditionalTokenMint;
  const failBaseMint = (
    await vaultProgram.account.conditionalVault.fetch(baseFailVault)
  ).conditionalTokenMint;
  const failQuoteMint = (
    await vaultProgram.account.conditionalVault.fetch(quoteFailVault)
  ).conditionalTokenMint;

  let openbookPassMarketKP = Keypair.generate();

    let [openbookTwapPassMarket] = PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("twap_market"), openbookPassMarketKP.publicKey.toBuffer()],
      openbookTwap.programId
    );

    let openbookPassMarket = await openbook.createMarket(
      payer,
      "test",
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

    await openbookTwap.methods.createTwapMarket()
      .accounts({
        market: openbookPassMarket,
        twapMarket: openbookTwapPassMarket,
      })
      .rpc();

    let openbookFailMarketKP = Keypair.generate();

    let [openbookTwapFailMarket] = PublicKey.findProgramAddressSync(
      [anchor.utils.bytes.utf8.encode("twap_market"), openbookFailMarketKP.publicKey.toBuffer()],
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
    await openbookTwap.methods.createTwapMarket()
      .accounts({
        market: openbookFailMarket,
        twapMarket: openbookTwapFailMarket,
      })
      .rpc();

  const daoBefore = await autocratProgram.account.dao.fetch(dao);

  const dummyURL = "https://www.eff.org/cyberspace-independence";

  const passMarket = await initializeOrderBook(passBaseMint, passQuoteMint);
  const failMarket = await initializeOrderBook(failBaseMint, failQuoteMint);

  await autocratProgram.methods
    .initializeProposal(dummyURL, instruction)
    .preInstructions([
      await autocratProgram.account.proposal.createInstruction(proposalKeypair, 1500),
    ])
    .accounts({
      proposal: proposalKeypair.publicKey,
      dao,
      daoTreasury,
      quotePassVault,
      quoteFailVault,
      basePassVault,
      baseFailVault,
      openbookPassMarket,
      openbookFailMarket,
      openbookTwapPassMarket,
      openbookTwapFailMarket,
      passMarket,
      failMarket,
      proposer: payer.publicKey,
    })
    .signers([proposalKeypair])
    .rpc();
}

async function initializeOrderBook(
  base: anchor.web3.PublicKey,
  quote: anchor.web3.PublicKey,
): Promise<anchor.web3.PublicKey> {
  const [orderBook] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("order_book"),
      base.toBuffer(),
      quote.toBuffer(),
    ],
    clobProgram.programId
  );

  if (await clobProgram.account.orderBook.fetchNullable(orderBook) != null) {
    return orderBook;
  }

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

  await clobProgram.methods
    .initializeOrderBook()
    .accounts({
      orderBook,
      globalState,
      base,
      quote,
      baseVault,
      quoteVault,
    })
    .rpc();

  return orderBook;
}


async function main() {
  // let USDC = await createMint(provider.publicKey, provider.publicKey, 6);
  // let META = await createMint(provider.publicKey, provider.publicKey, 9);
  // await initializeDAO(META, USDC);

  // await initializeGlobalState(provider.wallet.publicKey);
  await initializeProposal();

  // let proposals = await autocratProgram.account.proposal.all();
  // console.log(proposals[0]);
  //await initializeProposal();
}

main();
