import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
const { PublicKey, Keypair } = anchor.web3;
const { BN, Program } = anchor;

import { AutocratV0 } from "../target/types/autocrat_v0";

import { IDL as ConditionalVaultIDL, ConditionalVault } from "../target/types/conditional_vault";
import { IDL as ClobIDL, Clob } from "../target/types/clob";

type PublicKey = anchor.web3.PublicKey

const AutocratIDL: AutocratV0 = require("../target/idl/autocrat_v0.json");

const WSOL = new PublicKey("So11111111111111111111111111111111111111112");

const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "Ctt7cFZM6K7phtRo5NvjycpQju7X6QTSuqNen2ebXiuc"
);
const CONDITIONAL_VAULT_PROGRAM_ID = new PublicKey(
  "4nCk4qKJSJf8pzJadMnr9LubA6Y7Zw3EacsVqH1TwVXH"
);
const CLOB_PROGRAM_ID = new PublicKey(
  "8BnUecJAvKB7zCcwqhMiVWoqKWcw5S6PDCxWWEM2oxWA"
);

// We will create a civilization of the Mind in Cyberspace. May it be
// more humane and fair than the world your governments have made before.
//  - John Perry Barlow, A Declaration of the Independence of Cyberspace
const DAO_KEY = PublicKey.decodeUnchecked(Buffer.from(anchor.utils.sha256.hash("WWCACOTMICMIBMHAFTTWYGHMB")));

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

const [dao] = PublicKey.findProgramAddressSync(
  [DAO_KEY.toBuffer()],
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
  mintAuthority: PublicKey,
  freezeAuthority: PublicKey,
  decimals: number,
): Promise<PublicKey> {
  return await token.createMint(
    provider.connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals
  );
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

async function initializeDAO(mint: any) {
  await autocratProgram.methods
    .initializeDao(DAO_KEY)
    .accounts({
      dao,
      token: mint,
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
    storedDAO.token,
    baseNonce,
  );

  const quotePassVault = await initializeVault(
    storedDAO.treasury,
    WSOL,
    baseNonce.or(new BN(1).shln(63)),
  );

  const baseFailVault = await initializeVault(
    storedDAO.treasury,
    storedDAO.token,
    baseNonce.or(new BN(1).shln(62)),
  );

  const quoteFailVault = await initializeVault(
    storedDAO.treasury,
    WSOL,
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

  const passMarket = await initializeOrderBook(passBaseMint, passQuoteMint);
  const failMarket = await initializeOrderBook(failBaseMint, failQuoteMint);

  const daoBefore = await autocratProgram.account.dao.fetch(dao);

  const dummyURL = "https://www.eff.org/cyberspace-independence";

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
      passMarket,
      failMarket,
      proposer: payer.publicKey,
    })
    .signers([proposalKeypair])
    .rpc();

  //await initializeProposal(
  //  autocrat,
  //  instruction,
  //  vaultProgram,
  //  dao,
  //  clobProgram,
  //  context,
  //  payer
  //);
}


async function main() {
  let tokenMint = await createMint(provider.publicKey, provider.publicKey, 9)
  let proposals = await autocratProgram.account.proposal.all();
  console.log(proposals);
  await initializeDAO(tokenMint);
  await initializeProposal();
  proposals = await autocratProgram.account.proposal.all();
  console.log(proposals);
}

main();
