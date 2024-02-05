import * as anchor from "@coral-xyz/anchor";
import {Wallet} from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import dotenv from 'dotenv';
import {readFileSync} from "fs";
import {OpenBookV2Client,} from "@openbook-dex/openbook-v2";
import {AutocratV0} from "../target/types/autocrat_v0";
import {ConditionalVault, IDL as ConditionalVaultIDL,} from "../target/types/conditional_vault";
import {OpenbookTwap} from "../tests/fixtures/openbook_twap";
import {
    AddressLookupTableAccount,
    Signer,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction
} from "@solana/web3.js";

const { PublicKey, Keypair, Connection, ComputeBudgetProgram } = anchor.web3;
const { BN, Program } = anchor;
const AutocratIDL: AutocratV0 = require("../target/idl/autocrat_v0.json");
const OpenbookTwapIDL: OpenbookTwap = require("../tests/fixtures/openbook_twap.json");

const AUTOCRAT_PROGRAM_ID = new PublicKey(
    "metaX99LHn3A7Gr7VAcCfXhpfocvpMpqQ3eyp3PGUUq"
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

const META = new PublicKey("METADDFL6wWMWEoKTFJwcThTbUmtarRJZjRpzUvkxhr");

// this LUT holds: system_program, token_program, meta_mint, usdc_mint, autocrat_program, openbook_program...  maybe others
const LOOKUP_TABLE_ACCOUNT = new PublicKey("9bH5FUptHLYJSmq5HaEJPbkYP2XaaJFZUd6pAXUswdQL")

async function main() {
    const rpc = "https://mainnet.helius-rpc.com/?api-key=xyz"
    const proposalURL = "https://hackmd.io/@futard/plus_ev_proposal";
    const envPath = "/Users/Futard/meta-dao/.env"; // KEYPAIR_PATH=/Users/Futard/fUtarD9281kdLLvhac2cajEYVzw925321e.json
    const metaToTransfer = 100

    // generate these private keys before running this script, so that the script can be re-run if a step fails, and all the related accounts will stay the same.
    // that way you are less likely to waste sol rent on openbook markets that can't be used
    const proposalKeypair = Keypair.fromSecretKey(new Uint8Array(
        [
            104,  50,   9, 192,  19, 141, 248, 192,  75,  85,  79,
            131,  18, 189, 206, 227,  34,  96, 155, 251, 240,  58,
            153, 223, 139, 135,  62, 246,  25, 149,  64,  59, 167,
            16,  48, 207,  89,  55, 218,   8, 242, 247, 213, 102,
            40, 211, 251,  42, 175,  93,  13, 140, 164, 162,   3,
            247, 216,  53, 178, 163, 157,  55,  43,  11
        ]));

    const openbookPassMarketKP = Keypair.fromSecretKey(new Uint8Array(
        [
            157,  75, 131,  41,  64, 109, 113, 220,  73,   5,  27,
            189, 146, 242, 168,  35, 239,  39,  87, 209, 108,  85,
            54, 178, 129, 133, 235, 187, 224, 246, 117, 154,  59,
            187,  40,   8,  30, 178,  54,  41, 248,  96,  28,  78,
            206, 184, 104,   1,   8, 245, 148, 175, 126, 170, 232,
            77, 234,  18,  56,  61,  73, 125, 221, 113
        ]));

    const openbookFailMarketKP = Keypair.fromSecretKey(new Uint8Array(
        [
            189, 195, 115,  68, 146, 152, 221, 127, 222,  85, 245,
            132, 151, 137,  38, 102, 200, 121, 149, 158, 125, 242,
            107, 188, 207,  86, 233,  92, 249, 177, 192,   4, 120,
            128,  88,  87, 174, 171, 166, 108,   3,   3,  97,  27,
            85,  48, 164, 225, 123, 185, 181,  44, 132,   2, 143,
            99,  45, 199, 206, 188, 246,  32, 236, 181
        ]));

    dotenv.config({path: envPath});
    let keypairPath = process.env.KEYPAIR_PATH || ""
    const bytes = JSON.parse(readFileSync(keypairPath, 'utf-8'))
    const keypair = Keypair.fromSecretKey(new Uint8Array(bytes));
    const wallet = new Wallet(keypair);
    const proposerPubKey = wallet.publicKey;

    const connection = new Connection(rpc, {commitment: 'confirmed'});
    const provider = new anchor.AnchorProvider(connection, wallet, anchor.AnchorProvider.defaultOptions());

    const payer = provider.wallet["payer"]

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

    const openbook = new OpenBookV2Client(provider, OPENBOOK_PROGRAM_ID, {
        prioritizationFee: 357142,
        txConfirmationCommitment: "processed"
    });
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

    enum PriorityFeeTier {
        NORMAL = 0,
        HIGH = 3571,
        TURBO = 357142,
    }

    const addComputeUnits = (num_units: number = 1_400_000) => ComputeBudgetProgram.setComputeUnitLimit({
        units: num_units
    });

    const addPriorityFee = (pft: PriorityFeeTier) => ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: pft
    });

    async function processV0Transaction(ixs: TransactionInstruction[], signers: Signer[], lut: any) {
        try {
            const lookupTableAccounts = [
                await provider.connection
                    .getAddressLookupTable(lut)
                    .then((res) => res.value as AddressLookupTableAccount)
            ]

            let latestBlockhash = await provider.connection.getLatestBlockhash()

            const message = new TransactionMessage({
                payerKey: provider.wallet.publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: ixs,
            }).compileToV0Message(lookupTableAccounts);

            // Create a new VersionedTransaction which supports legacy and v0
            let tx = new VersionedTransaction(message)
            tx = await provider.wallet.signTransaction(tx)
            for (let signer of signers) {
                const w = new Wallet(Keypair.fromSecretKey(signer.secretKey));
                tx = await w.signTransaction(tx)
            }

            return provider.connection.sendRawTransaction(tx.serialize(), {skipPreflight: true})
        } catch (e) {
            console.log(e)
        }
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

        return vault;
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
            proposerPubKey
        );

        const transferIx = token.createTransferInstruction(
            senderAcc.address,
            receiverAcc.address,
            daoTreasury,
            metaToTransfer * 1_000_000_000,
        );

        const programId = transferIx.programId;
        const accounts = transferIx.keys;
        const data = transferIx.data;

        const instruction = {
            programId,
            accounts,
            data,
        };

        const storedDAO = await autocratProgram.account.dao.fetch(dao);

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

        let [openbookTwapPassMarket] = PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("twap_market"),
                openbookPassMarketKP.publicKey.toBuffer(),
            ],
            openbookTwap.programId
        );

        let openbookPassMarketIx = await openbook.createMarketIx(
            payer.publicKey,
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
            openbookPassMarketKP,
            storedDAO.treasury
        );

        let [openbookTwapFailMarket] = PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("twap_market"),
                openbookFailMarketKP.publicKey.toBuffer(),
            ],
            openbookTwap.programId
        );

        let openbookFailMarketIx = await openbook.createMarketIx(
            payer.publicKey,
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
            openbookFailMarketKP,
            storedDAO.treasury
        );

        let passTwapIx = await openbookTwap.methods
            .createTwapMarket(new BN(10_000))
            .accounts({
                market: openbookPassMarketKP.publicKey,
                twapMarket: openbookTwapPassMarket,
            })
            .instruction()

        let failTwapIx = await openbookTwap.methods
            .createTwapMarket(new BN(10_000))
            .accounts({
                market: openbookFailMarketKP.publicKey,
                twapMarket: openbookTwapFailMarket,
            })
            .instruction()

        let proposalIx = await autocratProgram.methods
            .initializeProposal(proposalURL, instruction)
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
            .instruction()

        let ix1: TransactionInstruction[] = []
        ix1.push(addPriorityFee(PriorityFeeTier.TURBO))
        ix1.push(addComputeUnits(1_400_000))
        ix1.push(...openbookPassMarketIx[0])

        let ix2: TransactionInstruction[] = []
        ix2.push(addPriorityFee(PriorityFeeTier.TURBO))
        ix2.push(addComputeUnits(1_400_000))
        ix2.push(...openbookFailMarketIx[0])

        let ix3: TransactionInstruction[] = []
        ix3.push(addPriorityFee(PriorityFeeTier.TURBO))
        ix3.push(addComputeUnits(1_400_000))
        ix3.push(passTwapIx)
        ix3.push(failTwapIx)
        ix3.push(
            await autocratProgram.account.proposal.createInstruction(
                proposalKeypair,
                1500
            )
        )
        ix3.push(proposalIx)


        type MySigner = Signer | anchor.web3.Keypair

        let signers1: MySigner[] = [openbookPassMarketKP]
        signers1.push(...openbookPassMarketIx[1])

        let signers2: MySigner[] = [openbookFailMarketKP]
        signers2.push(...openbookFailMarketIx[1])

        let signers3: MySigner[] = [proposalKeypair]


        let sig1 = await processV0Transaction(ix1, signers1, LOOKUP_TABLE_ACCOUNT)
        console.log(sig1)

        let sig2 = await processV0Transaction(ix2, signers2, LOOKUP_TABLE_ACCOUNT)
        console.log(sig2)

        await sleep(5 * 1000)

        let sig3 = await processV0Transaction(ix3, signers3, LOOKUP_TABLE_ACCOUNT)
        console.log(sig3)
    }

    await initializeProposal();
}

export async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}


main();
