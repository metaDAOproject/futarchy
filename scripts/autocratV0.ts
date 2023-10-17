import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

import { AutocratV0 } from "../target/types/autocrat_v0";

const AutocratIDL: AutocratV0 = require("../target/idl/autocrat_v0.json");

const AUTOCRAT_PROGRAM_ID = new PublicKey(
  "Ctt7cFZM6K7phtRo5NvjycpQju7X6QTSuqNen2ebXiuc"
);

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet['payer'];

const autocratProgram = new Program<AutocratV0>(
  AutocratIDL,
  AUTOCRAT_PROGRAM_ID,
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
): Promise<any> {
  return await token.createMint(
    provider.connection,
    payer,
    mintAuthority,
    freezeAuthority,
    decimals
  );
}

async function initializeDAO(mint: any) {
  await autocratProgram.methods
    .initializeDao()
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


  // least signficant 32 bits of nonce are proposal number
  // most significant bit of nonce is 0 for pass and 1 for fail
  // second most significant bit of nonce is 0 for base and 1 for quote

  //let baseNonce = new BN(storedDAO.proposalCount);

  //const basePassVault = await initializeVault(
  //  vaultProgram,
  //  storedDAO.treasury,
  //  storedDAO.token,
  //  baseNonce,
  //  payer
  //);

  //const quotePassVault = await initializeVault(
  //  vaultProgram,
  //  storedDAO.treasury,
  //  WSOL,
  //  baseNonce.or(new BN(1).shln(63)),
  //  payer
  //);

  //const baseFailVault = await initializeVault(
  //  vaultProgram,
  //  storedDAO.treasury,
  //  storedDAO.token,
  //  baseNonce.or(new BN(1).shln(62)),
  //  payer
  //);

  //const quoteFailVault = await initializeVault(
  //  vaultProgram,
  //  storedDAO.treasury,
  //  WSOL,
  //  baseNonce.or(new BN(3).shln(62)),
  //  payer
  //);

  //const passBaseMint = (
  //  await vaultProgram.account.conditionalVault.fetch(basePassVault)
  //).conditionalTokenMint;
  //const passQuoteMint = (
  //  await vaultProgram.account.conditionalVault.fetch(quotePassVault)
  //).conditionalTokenMint;
  //const failBaseMint = (
  //  await vaultProgram.account.conditionalVault.fetch(baseFailVault)
  //).conditionalTokenMint;
  //const failQuoteMint = (
  //  await vaultProgram.account.conditionalVault.fetch(quoteFailVault)
  //).conditionalTokenMint;

  //const [passMarket] = anchor.web3.PublicKey.findProgramAddressSync(
  //  [
  //    anchor.utils.bytes.utf8.encode("order_book"),
  //    passBaseMint.toBuffer(),
  //    passQuoteMint.toBuffer(),
  //  ],
  //  clobProgram.programId
  //);

  //const [failMarket] = anchor.web3.PublicKey.findProgramAddressSync(
  //  [
  //    anchor.utils.bytes.utf8.encode("order_book"),
  //    failBaseMint.toBuffer(),
  //    failQuoteMint.toBuffer(),
  //  ],
  //  clobProgram.programId
  //);

  //const passBaseVault = await token.getAssociatedTokenAddress(
  //  passBaseMint,
  //  passMarket,
  //  true
  //);

  //const passQuoteVault = await token.getAssociatedTokenAddress(
  //  passQuoteMint,
  //  passMarket,
  //  true
  //);

  //const failBaseVault = await token.getAssociatedTokenAddress(
  //  failBaseMint,
  //  failMarket,
  //  true
  //);

  //const failQuoteVault = await token.getAssociatedTokenAddress(
  //  failQuoteMint,
  //  failMarket,
  //  true
  //);

  //const [globalState] = anchor.web3.PublicKey.findProgramAddressSync(
  //  [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
  //  clobProgram.programId
  //);

  //await clobProgram.methods
  //  .initializeOrderBook()
  //  .accounts({
  //    orderBook: passMarket,
  //    globalState,
  //    payer: payer.publicKey,
  //    systemProgram: anchor.web3.SystemProgram.programId,
  //    base: passBaseMint,
  //    quote: passQuoteMint,
  //    baseVault: passBaseVault,
  //    quoteVault: passQuoteVault,
  //  })
  //  .rpc();

  //await clobProgram.methods
  //  .initializeOrderBook()
  //  .accounts({
  //    orderBook: failMarket,
  //    globalState,
  //    payer: payer.publicKey,
  //    systemProgram: anchor.web3.SystemProgram.programId,
  //    base: failBaseMint,
  //    quote: failQuoteMint,
  //    baseVault: failBaseVault,
  //    quoteVault: failQuoteVault,
  //  })
  //  .rpc();

  //const [daoTreasury] = PublicKey.findProgramAddressSync(
  //  [dao.toBuffer()],
  //  autocrat.programId
  //);

  //const daoBefore = await autocrat.account.dao.fetch(dao);

  //const dummyURL = "https://www.eff.org/cyberspace-independence";

  //await autocrat.methods
  //  .initializeProposal(dummyURL, ix)
  //  .preInstructions([
  //    await autocrat.account.proposal.createInstruction(proposalKeypair, 1500),
  //  ])
  //  .accounts({
  //    proposal: proposalKeypair.publicKey,
  //    dao,
  //    daoTreasury,
  //    quotePassVault,
  //    quoteFailVault,
  //    basePassVault,
  //    baseFailVault,
  //    passMarket,
  //    failMarket,
  //    proposer: payer.publicKey,
  //    systemProgram: anchor.web3.SystemProgram.programId,
  //  })
  //  .signers([proposalKeypair])
  //  .rpc()
  //  .then(
  //    () => {},
  //    (err) => console.error(err)
  //  );

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
  //await initializeProposal();
  const storedDAO = await autocratProgram.account.dao.fetch(dao);
  console.log(storedDAO);
}

main();
