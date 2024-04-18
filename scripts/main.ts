import * as anchor from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
const { BN, Program } = anchor;
import { MPL_TOKEN_METADATA_PROGRAM_ID as UMI_MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

import {
  OpenBookV2Client,
  PlaceOrderArgs,
  Side,
  OrderType,
  SelfTradeBehavior,
} from "@openbook-dex/openbook-v2";
import { toWeb3JsPublicKey } from "@metaplex-foundation/umi-web3js-adapters";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  fetchOnchainMetadataForMint,
  uploadOffchainMetadata,
} from "./uploadOffchainMetadata";
import { AutocratV0 } from "../target/types/autocrat_v0";
import {
  IDL as ConditionalVaultIDL,
  ConditionalVault,
} from "../target/types/conditional_vault";
import { OpenbookTwap } from "../tests/fixtures/openbook_twap";
import { AutocratMigrator } from "../target/types/autocrat_migrator";

const AutocratIDL: AutocratV0 = require("../target/idl/autocrat_v0.json");
const OpenbookTwapIDL: OpenbookTwap = require("../tests/fixtures/openbook_twap.json");
const AutocratMigratorIDL: AutocratMigrator = require("../target/idl/autocrat_migrator.json");

// DAO Tokens
// DeansList
export const DEAN_DEVNET = new PublicKey(
  "DEANPaCEAfW2SCJCdEtGvV1nT9bAShWrajnieSzUcWzh"
)
export const DEAN = new PublicKey(
  "Ds52CDgqdWbTWsua1hgT3AuSSy4FNx2Ezge1br3jQ14a"
)
// Future DAO
export const FUTURE_DEVNET = new PublicKey(
  "DUMm13RrZZoJAaqr1Tz7hv44xUcrYWXADw7SEBGAvbcK"
);
export const FUTURE = new PublicKey(
  "FUTURETnhzFApq2TiZiNbWLQDXMx4nWNpFtmvTf11pMy"
)
// MetaDAO for Mainnet and Devnet
export const META = new PublicKey(
  "METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr"
);
// Base Tokens
// Meta USDC (created for use in our contracts)
export const DEVNET_MUSDC = new PublicKey(
  "B9CZDrwg7d34MiPiWoUSmddriCtQB5eB2h9EUSDHt48b"
)
// Circle Devnet USDC (from faucet)
export const DEVNET_USDC = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
// Circle USDC Mainnet
export const USDC = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

// The various autocrat versions including the tokens utilized
// NOTE: starting at v0.3 the base token is defined at the DAO level
const AUTOCRAT_VERSIONS = [
  {
    version: 0,
    programId: new PublicKey("meta3cxKzFBmWYgCVozmvCQAS3y9b3fGxrG9HkHL7Wi"),
    mainnetBaseToken: META,
    mainnetQuoteToken: USDC,
    devnetBaseToken: META,
    devnetQuoteToken: DEVNET_MUSDC,
    dao: 'metadao'
  },{
    version: 1,
    programId: new PublicKey("metaX99LHn3A7Gr7VAcCfXhpfocvpMpqQ3eyp3PGUUq"),
    mainnetBaseToken: META,
    mainnetQuoteToken: USDC,
    devnetBaseToken: META,
    devnetQuoteToken: DEVNET_MUSDC,
    dao: 'metadao'
  },{
    version: 2,
    programId: new PublicKey("metaRK9dUBnrAdZN6uUDKvxBVKW5pyCbPVmLtUZwtBp"),
    mainnetBaseToken: META,
    mainnetQuoteToken: USDC,
    devnetBaseToken: META,
    devnetQuoteToken: DEVNET_MUSDC,
    dao: 'metadao'
  },{
    version: 2,
    programId: new PublicKey("fut5MzSUFcmxaEHMvo9qQThrAL4nAv5FQ52McqhniSt"),
    mainnetBaseToken: FUTURE,
    mainnetQuoteToken: USDC,
    devnetBaseToken: FUTURE_DEVNET,
    devnetQuoteToken: DEVNET_MUSDC,
    dao: 'futuredao'
  },{
    version: 3,
    programId: new PublicKey("FuTPR6ScKMPHtZFwacq9qrtf9VjscawNEFTb2wSYr1gY"),
    mainnetBaseToken: null,
    mainnetQuoteToken: USDC,
    devnetBaseToken: null,
    devnetQuoteToken: DEVNET_USDC,
    dao: 'multidao'
  }
];

const DAOS = [
  {
    daoName: 'MetaDAO',
    icon: 'metaToken.png',
    devnetBaseToken: META,
    mainnetBaseToken: META,
    tokenSymbol: 'META',
    publicKey: new PublicKey("28vP9VJyGaKgFhGVfWrS3mK9GYhSSJuZZfoAVT7zPLr2"),
  },{
    daoName: 'FutureDAO',
    icon: 'futureToken.png',
    devnetBaseToken: FUTURE_DEVNET,
    mainnetBaseToken: FUTURE,
    tokenSymbol: 'FUTURE',
    publicKey: new PublicKey("8tanoHEyJEQgaasEkv1DxN6umYNWDotbaEpuzstcEufb"),
  },{
    daoName: 'DeansList',
    icon: 'deanToken.png',
    devnetBaseToken: DEAN_DEVNET,
    mainnetBaseToken: DEAN,
    tokenSymbol: 'DEAN',
    publicKey: new PublicKey("5rhzhBtevKSjuFMTL377M1AWRsiTF57p9J88TzptzUPp"),
  },
];

const CONDITIONAL_VAULT_VERSIONS = [
  {
    version: 0,
    programId: new PublicKey("vaU1tVLj8RFk7mNj1BxqgAsMKKaL8UvEUHvU3tdbZPe")
  },{
    version: 2,
    programId: new PublicKey("vAuLTQjV5AZx5f3UgE75wcnkxnQowWxThn1hGjfCVwP")
  },
];

const OPENBOOK_TWAP_VERSIONS = [
  {
    version: 0,
    programId: new PublicKey("TWAP7frdvD3ia7TWc8e9SxZMmrpd2Yf3ifSPAHS8VG3")
  },{
    version: 1,
    programId: new PublicKey("TWAPrdhADy2aTKN5iFZtNnkQYXERD9NvKjPFVPMSCNN")
  },{
    version: 2,
    programId: new PublicKey("twAP5sArq2vDS1mZCT7f4qRLwzTfHvf5Ay5R5Q5df1m")
  },
]

const AUTOCRAT_MIGRATOR_VERSIONS = [
  {
    version: 1,
    programId: new PublicKey("migkwAXrXFN34voCYQUhFQBXZJjHrWnpEXbSGTqZdB3")
  },{
    version: 2,
    programId: new PublicKey("MigRDW6uxyNMDBD8fX2njCRyJC4YZk2Rx9pDUZiAESt")
  },
]

// Used with setting for version
const useVersion = 3 // Which version you want to use scripts with
const useDao = 'deanslist'
const useNet = 'devnet'

// Setup for returning from our selection above
const AUTOCRAT = AUTOCRAT_VERSIONS.find((program) => program.version === useVersion && (program.version > 2 || program.dao === useDao))
// Filter through our DAOs for MultiDAO
export const DAO = DAOS.find((dao) => dao.daoName.toLowerCase() === useDao.toLowerCase())
// Setup for fetching baseToken given the version and network
let baseToken: PublicKey;
if (useNet === 'devnet') {
  baseToken = useVersion < 3 ? AUTOCRAT.devnetBaseToken : DAO.devnetBaseToken
} else {
  baseToken = useVersion < 3 ? AUTOCRAT.mainnetBaseToken: DAO.mainnetBaseToken
}
export const BASE_TOKEN = baseToken;
export const QUOTE_TOKEN = useNet === 'devnet' ? AUTOCRAT.devnetQuoteToken : AUTOCRAT.mainnetQuoteToken
// These programs don't always have upgrades, therefore you want to
// use the matching version or one version less.
// eg. v0.3 autocrat uses v0.2 twap version, or v0.1 uses v0 conditional vault
// NOTE: The only exception is the migrator, which extends one beyond
// eg. v0 autocrat uses v0.1 autocrat migrator
// TODO: We need some logic to loop through and find highest version number and then step back one
const CONDITIONAL_VAUT = CONDITIONAL_VAULT_VERSIONS.find(
  (program) => 
    // NOTE: This is a quick and dirty way
    program.version === useVersion || program.version === useVersion - 1 || program.version
)
const OPENBOOK_TWAP = OPENBOOK_TWAP_VERSIONS.find(
  (program) => 
    // NOTE: This is a quick and dirty way
    program.version === useVersion || program.version === useVersion - 1 || program.version
)
const AUTOCRAT_MIGRATOR = AUTOCRAT_MIGRATOR_VERSIONS.find(
  // TODO: Hack to get this to play nice...
  (program) => program.version === useVersion + 1 || program.version === useVersion - 1
)

// Programs for use in scripts, we afford multiple given the different versions which may be active
const AUTOCRAT_PROGRAM_ID = AUTOCRAT.programId
const CONDITIONAL_VAULT_PROGRAM_ID = CONDITIONAL_VAUT.programId
const OPENBOOK_TWAP_PROGRAM_ID = OPENBOOK_TWAP.programId
const AUTOCRAT_MIGRATOR_PROGRAM_ID = AUTOCRAT_MIGRATOR.programId

console.log(`Using program versions ${useVersion}`);
console.log(`Creating with DAO for ${useDao}`);
console.log(`Network ${useNet}`);

// Constant program ID for OpenBook
export const OPENBOOK_PROGRAM_ID = new PublicKey(
  "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb"
);

export const PROPH3t_PUBKEY = new PublicKey(
  "65U66fcYuNfqN12vzateJhZ4bgDuxFWN9gMwraeQKByg"
);

const MPL_TOKEN_METADATA_PROGRAM_ID = toWeb3JsPublicKey(
  UMI_MPL_TOKEN_METADATA_PROGRAM_ID
);

const findMetaplexMetadataPda = async (mint: PublicKey) => {
  const [publicKey] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("metadata"),
      MPL_TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    MPL_TOKEN_METADATA_PROGRAM_ID
  );

  return publicKey;
};

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

export const migrator = new anchor.Program<AutocratMigrator>(
  AutocratMigratorIDL,
  AUTOCRAT_MIGRATOR_PROGRAM_ID,
  provider
);

let _dao: PublicKey;
if (useVersion < 3) {
  [_dao] = PublicKey.findProgramAddressSync(
    [anchor.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")],
    autocratProgram.programId
  );
} else {
  if (!DAO.publicKey){
    console.log('DAO not initialized, initialize DAO');
  } else {
    _dao = DAO.publicKey
  }
}

export const dao = _dao

let _daoTreausry: PublicKey;
if (dao) {
  [_daoTreausry] = PublicKey.findProgramAddressSync(
    [dao.toBuffer()],
    autocratProgram.programId
  );
} else {
  console.log('Unable to locate treasury due to DAO not being initialized')
}

export const daoTreasury = _daoTreausry

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

/**
 * note: we will skip attempting to upload off-chain metadata for tokens
 * - without associated metaplex metadata
 * - a symbol that is not USDC or META
 *
 * this is done so that the script will not fail when using localnet or devnet
 */
async function generateAddMetadataToConditionalTokensIx(
  mint: PublicKey,
  onFinalizeMint: PublicKey,
  onRevertMint: PublicKey,
  vault: PublicKey,
  nonce: anchor.BN
): Promise<TransactionInstruction | undefined> {
  const tokenMetadata = await fetchOnchainMetadataForMint(mint);
  if (!tokenMetadata) {
    console.warn(
      `no metadata found for token = ${mint.toBase58()}, conditional tokens will not have metadata`
    );
    return undefined;
  }

  const { metadata, key: metadataKey } = tokenMetadata;
  const conditionalOnFinalizeTokenMetadataKey = await findMetaplexMetadataPda(
    onFinalizeMint
  );
  const conditionalOnRevertTokenMetadataKey = await findMetaplexMetadataPda(
    onRevertMint
  );

  // pull off the least significant 32 bits representing the proposal count
  const proposalCount = nonce.and(new BN(1).shln(32).sub(new BN(1)));

  // create new json, take that and pipe into the instruction
  const uploadResult = await uploadOffchainMetadata(
    proposalCount,
    metadata.symbol
  );

  if (!uploadResult) return undefined;
  const { passTokenMetadataUri, failTokenMetadataUri } = uploadResult;
  if (!passTokenMetadataUri || !failTokenMetadataUri) {
    // an error here is likely transient, so we want to fail the script so that the caller can try again. otherwise, we will end up with a token with no linkable off-chain metadata.
    throw new Error(
      `required metadata is undefined, pass = ${passTokenMetadataUri}, fail = ${failTokenMetadataUri}. Please try again.`
    );
  }

  console.log(
    `[proposal = ${proposalCount.toNumber()}] pass token metadata uri: ${passTokenMetadataUri}, fail token metadata uri: ${failTokenMetadataUri}`
  );

  return vaultProgram.methods
    .addMetadataToConditionalTokens(
      proposalCount,
      passTokenMetadataUri,
      failTokenMetadataUri
    )
    .accounts({
      payer: payer.publicKey,
      vault,
      underlyingTokenMint: mint,
      underlyingTokenMetadata: metadataKey,
      conditionalOnFinalizeTokenMint: onFinalizeMint,
      conditionalOnRevertTokenMint: onRevertMint,
      conditionalOnFinalizeTokenMetadata: conditionalOnFinalizeTokenMetadataKey,
      conditionalOnRevertTokenMetadata: conditionalOnRevertTokenMetadataKey,
      tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();
}

async function initializeVault(
  settlementAuthority: any,
  underlyingTokenMint: any,
  nonce: anchor.BN
): Promise<any> {
  const [vault] = PublicKey.findProgramAddressSync(
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

  let conditionalOnFinalizeKP = Keypair.generate();
  let conditionalOnRevertKP = Keypair.generate();

  const addMetadataToConditionalTokensIx =
    await generateAddMetadataToConditionalTokensIx(
      underlyingTokenMint,
      conditionalOnFinalizeKP.publicKey,
      conditionalOnRevertKP.publicKey,
      vault,
      nonce
    );

  const initializeConditionalVaultBuilder = vaultProgram.methods
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
      systemProgram: SystemProgram.programId,
    })
    .signers([conditionalOnFinalizeKP, conditionalOnRevertKP])
    .preInstructions([
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 150_000,
      }),
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 100,
      }),
    ]);

  if (addMetadataToConditionalTokensIx) {
    console.log(
      "appending add metadata instruction for initialize vault transaction..."
    );
    initializeConditionalVaultBuilder.postInstructions([
      addMetadataToConditionalTokensIx,
    ]);
  } else {
    console.log(
      "skipping add metadata instruction for initialize vault transaction..."
    );
  }

  await initializeConditionalVaultBuilder.rpc();

  //const storedVault = await vaultProgram.account.conditionalVault.fetch(
  //  vault
  //);
  //console.log(storedVault);

  return vault;
}

export async function initializeDAO(
  baseToken: PublicKey,
  quotToken: PublicKey,
  baseLotSize: number,
  twapExpectedValue: number,
  daoKP: Keypair
) {
  const daoPublicKey = daoKP.publicKey
  try {
    console.log(daoPublicKey.toString())
    const transaction = await autocratProgram.methods
      .initializeDao(
        new BN(baseLotSize.toString()), // Base Lot Size Number 
        new BN(twapExpectedValue.toString()) // TWAP Expected Value
      )
      .accounts({
        dao: daoPublicKey,
        payer: payer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenMint: baseToken,
        usdcMint: quotToken,
      })
      .signers([daoKP])
      .rpc();
    
    console.log('DAO Successfully created');
    console.log(transaction);
    console.log(`Please update the configuration with this new DAO public key`)
    console.log(daoPublicKey.toString())
  } catch(err) {
    console.error('Error', err)
    throw new Error('Unable to initialize DAO!')
  }
}

export async function fetchDao() {
  return autocratProgram.account.dao.fetch(dao);
}

export async function finalizeProposal(proposal: anchor.web3.PublicKey) {
  const storedProposal = await autocratProgram.account.proposal.fetch(proposal);
  const startSlot = storedProposal.slotEnqueued.toNumber()
  // TODO: Fix this for different times...
  const endSlot = startSlot + 1_080_000
  console.log(storedProposal)

  // TODO: Add in check for current slot compared to end slot

  const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ 
    microLamports: 1000
  });

  const accounts = storedProposal.instruction.accounts
  const program = storedProposal.instruction.programId

  // Set this up for certain actions with the treasury such that the 
  // second signer isn't really a signer..
  try {
    accounts[2].isSigner = false
  } catch (e) {
    console.error('Error:', e)
  }

  const _program: anchor.web3.AccountMeta = {
    pubkey: program,
    isSigner: false,
    isWritable: false,
  }

  accounts.push(_program)

  let tx = await autocratProgram.methods
    .finalizeProposal()
    .accounts({
      proposal,
      openbookTwapPassMarket: storedProposal.openbookTwapPassMarket,
      openbookTwapFailMarket: storedProposal.openbookTwapFailMarket,
      dao,
      baseVault: storedProposal.baseVault,
      quoteVault: storedProposal.quoteVault,
      vaultProgram: vaultProgram.programId,
      daoTreasury,
    })
    .remainingAccounts(accounts)
    .preInstructions([
      addPriorityFee
    ])
    .rpc()

    console.log("Proposal finalized", tx);
}

export async function initializeProposal(
  instruction: any,
  proposalURL: string
) {
  const proposalKeypair = Keypair.generate();

  const storedDAO = await autocratProgram.account.dao.fetch(dao);
  console.log(storedDAO);

  // least signficant 32 bits of nonce are proposal number
  // most significant bit of nonce is 0 for base and 1 for quote

  let baseNonce = new BN(storedDAO.proposalCount);

  const baseVault = await initializeVault(daoTreasury, META, baseNonce);

  const quoteVault = await initializeVault(
    daoTreasury,
    USDC,
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
  // let openbookPassMarket = new PublicKey("HspxPoqFhAmurNGA1FxdeaUbRcZrv8FoR2vAsyYs3EGA");

  let [openbookTwapPassMarket] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("twap_market"),
      openbookPassMarketKP.publicKey.toBuffer(),
    ],
    openbookTwap.programId
  );

  const currentTimeInSeconds = Math.floor(Date.now() / 1000);
  const elevenDaysInSeconds = 11 * 24 * 60 * 60;
  const expiryTime = new BN(currentTimeInSeconds + elevenDaysInSeconds);
  const quoteLotSize = new BN(100);
  const baseLotSize = new BN(1e8);
  const maxObservationChangePerUpdateLots = new BN(5_000);

  let [passMarketInstructions, passMarketSigners] =
    await openbook.createMarketIx(
      payer.publicKey,
      `${baseNonce}pMETA/pUSDC`,
      passQuoteMint,
      passBaseMint,
      quoteLotSize,
      baseLotSize,
      new BN(0),
      new BN(0),
      expiryTime,
      null,
      null,
      openbookTwapPassMarket,
      null,
      openbookTwapPassMarket,
      { confFilter: 0.1, maxStalenessSlots: 100 },
      openbookPassMarketKP,
      daoTreasury
    );

  const cuPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 100,
  });
  const cuLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 150_000,
  });

  let tx1 = new Transaction();
  tx1.add(...passMarketInstructions);
  tx1.add(cuPriceIx);
  tx1.add(cuLimitIx);

  let blockhash = await provider.connection.getLatestBlockhash();
  tx1.recentBlockhash = blockhash.blockhash;

  tx1.sign(payer);

  const sig1 = await provider.sendAndConfirm(tx1, passMarketSigners);
  console.log("First market created:\n", sig1);

  let openbookFailMarketKP = Keypair.generate();

  let [openbookTwapFailMarket] = PublicKey.findProgramAddressSync(
    [
      anchor.utils.bytes.utf8.encode("twap_market"),
      openbookFailMarketKP.publicKey.toBuffer(),
    ],
    openbookTwap.programId
  );

  let openbookFailMarketIx = await openbook.createMarketIx(
    payer.publicKey,
    `${baseNonce}fMETA/fUSDC`,
    failQuoteMint,
    failBaseMint,
    quoteLotSize,
    baseLotSize,
    new BN(0),
    new BN(0),
    expiryTime,
    null,
    null,
    openbookTwapFailMarket,
    null,
    openbookTwapFailMarket,
    { confFilter: 0.1, maxStalenessSlots: 100 },
    openbookFailMarketKP,
    daoTreasury
  );

  let tx = new Transaction();
  tx.add(...openbookFailMarketIx[0]);
  tx.add(cuPriceIx);
  tx.add(cuLimitIx);

  blockhash = await provider.connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash.blockhash;

  const marketSig2 = await provider.sendAndConfirm(tx, openbookFailMarketIx[1]);
  console.log("Second market created:\n", marketSig2);

  await autocratProgram.methods
    .initializeProposal(proposalURL, instruction)
    .preInstructions([
      await autocratProgram.account.proposal.createInstruction(
        proposalKeypair,
        1000
      ),
      await openbookTwap.methods
        .createTwapMarket(new BN(10_000), maxObservationChangePerUpdateLots)
        .accounts({
          market: openbookPassMarketKP.publicKey,
          twapMarket: openbookTwapPassMarket,
        })
        .instruction(),
      await openbookTwap.methods
        .createTwapMarket(new BN(10_000), maxObservationChangePerUpdateLots)
        .accounts({
          market: openbookFailMarketKP.publicKey,
          twapMarket: openbookTwapFailMarket,
        })
        .instruction(),
      cuPriceIx,
      cuLimitIx,
    ])
    .accounts({
      proposal: proposalKeypair.publicKey,
      dao,
      daoTreasury,
      quoteVault,
      baseVault,
      openbookPassMarket: openbookPassMarketKP.publicKey,
      openbookFailMarket: openbookFailMarketKP.publicKey,
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

  const storedMarket = await openbook.deserializeMarketAccount(market);
  let openOrdersAccount = new PublicKey(
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

async function placeTakeOrder(twapMarket: any) {
  let market = (await openbookTwap.account.twapMarket.fetch(twapMarket)).market;
  const storedMarket = await openbook.deserializeMarketAccount(market);

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

export async function mintConditionalTokens(amount: number, vault: PublicKey) {
  const storedVault = await vaultProgram.account.conditionalVault.fetch(vault);

  // Setting default values for optional parameters
  const userUnderlyingTokenAccount = await getOrCreateAccount(
    storedVault.underlyingTokenMint
  );
  const userConditionalOnFinalizeTokenAccount = await getOrCreateAccount(
    storedVault.conditionalOnFinalizeTokenMint
  );
  const userConditionalOnRevertTokenAccount = await getOrCreateAccount(
    storedVault.conditionalOnRevertTokenMint
  );
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
      conditionalOnFinalizeTokenMint:
        storedVault.conditionalOnFinalizeTokenMint,
      conditionalOnRevertTokenMint: storedVault.conditionalOnRevertTokenMint,
    })
    .signers([payer])
    .rpc();
}

async function getOrCreateAccount(mint: PublicKey) {
  return (
    await token.getOrCreateAssociatedTokenAccount(
      provider.connection,
      payer,
      mint,
      payer.publicKey
    )
  ).address;
}
