import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import * as multisig from "@sqds/multisig";
import AmmImpl from "@mercurial-finance/dynamic-amm-sdk";
import { META, PROPH3t_PUBKEY, USDC } from "./main";
import { TokenInfo } from "@solana/spl-token-registry"
import { assert } from "console";
import { TransactionMessage } from "@solana/web3.js";

const { PublicKey, Keypair, SystemProgram } = anchor.web3;
const { BN, Program } = anchor;

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const payer = provider.wallet["payer"];

async function main() {
    // const connection = new anchor.web3.Connection("https://mainnet.helius-rpc.com/?api-key=3f6d553e-de08-4fb9-9212-5d87bbfd1328");
    // const createKey = new PublicKey("FpMnruqVCxh3o2oBFZ9uSQmshiyfMqzeJ3YfNQfP9tHy");

    const ms = new PublicKey("8T2Yp9AuiuH3qXymZadr7DiMtZqdRAr7Qm6DPDFsPohz");
    const msVault = new PublicKey("FpMnruqVCxh3o2oBFZ9uSQmshiyfMqzeJ3YfNQfP9tHy");

    const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(
        provider.connection,
        ms
    );

    const [vaultPda, vaultBump] = multisig.getVaultPda({
        multisigPda: ms,
        index: 0
    });

    assert(vaultPda == msVault);

    console.log(multisigAccount);

    const metaPoolAddr = new PublicKey("6t2CdBC26q9tj6jBwPzzFZogtjX8mtmVHUmAFmjAhMSn");
    // const metaPoolAddr = new PublicKey("53miVooS2uLfVpiKShXpMqh6PkZhmfDXiRAzs3tNhjwC");

    const tokenList = await fetch("https://token.jup.ag/all").then((res) =>
        res.json()
      ) as TokenInfo[];

    // const cache = await fetch("https://cache.jup.ag/markets?v=3").then((res) => res.json());

    const USDC_TOKEN_INFO = tokenList.find(token => token.address == USDC.toString());
    const META_TOKEN_INFO = tokenList.find(token => token.address == META.toString());

    // console.log(USDC_TOKEN_INFO);
    // console.log(META_TOKEN_INFO);

    const metaPool = await AmmImpl.create(provider.connection, metaPoolAddr, META_TOKEN_INFO, USDC_TOKEN_INFO);

    await metaPool.updateState();

    const { poolTokenAmountOut, tokenAInAmount, tokenBInAmount } = metaPool.getDepositQuote(
        // new anchor.BN(1_000 * 1_000_000_000),
        new anchor.BN(0),
        new anchor.BN(35_000 * 1_000_000),
        true,
        10
    );

    console.log(tokenAInAmount.toString());
    console.log(tokenBInAmount.toString());
    console.log(poolTokenAmountOut.toString());

    const depositTx = await metaPool.deposit(msVault, tokenAInAmount, tokenBInAmount, poolTokenAmountOut);

    // console.log(depositTx.instructions.length);

    const transactionMessage = new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: (await provider.connection.getLatestBlockhash()).blockhash,
        instructions: depositTx.instructions,
    });

    const transactionIndex = BigInt((multisigAccount.transactionIndex as anchor.BN).addn(1).toString());
    console.log(transactionIndex);

    // const sig1 = await multisig.rpc.vaultTransactionCreate({
    //     connection: provider.connection,
    //     feePayer: payer,
    //     multisigPda: ms,
    //     transactionIndex: transactionIndex,
    //     creator: PROPH3t_PUBKEY,
    //     vaultIndex: 0,
    //     ephemeralSigners: 0,
    //     transactionMessage
    // });

    // console.log(sig1);

    const sig2 = await multisig.rpc.proposalCreate({
        connection: provider.connection,
        feePayer: payer,
        creator: payer,
        multisigPda: ms,
        transactionIndex: 17n,
    });

    console.log(sig2);

    // console.log(depositIx);

    // console.log(metaPool);
}

main();
