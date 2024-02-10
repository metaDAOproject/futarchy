import * as anchor from "@coral-xyz/anchor";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import * as multisig from "@sqds/multisig";
import AmmImpl from "@mercurial-finance/dynamic-amm-sdk";
import { META, USDC } from "./main";
import { TokenInfo } from "@solana/spl-token-registry"

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

    console.log(multisigAccount);

    const metaPoolAddr = new PublicKey("6t2CdBC26q9tj6jBwPzzFZogtjX8mtmVHUmAFmjAhMSn");

    const tokenList = await fetch("https://token.jup.ag/all").then((res) =>
        res.json()
      ) as TokenInfo[];

    const cache = await fetch("https://cache.jup.ag/markets?v=3").then((res) => res.json());

    const USDC_TOKEN_INFO = tokenList.find(token => token.address == USDC.toString());
    const META_TOKEN_INFO = tokenList.find(token => token.address == META.toString());

    console.log(USDC_TOKEN_INFO);
    console.log(META_TOKEN_INFO);

    const metaPool = await AmmImpl.create(provider.connection, metaPoolAddr, META_TOKEN_INFO, USDC_TOKEN_INFO);

    const { poolTokenAmountOut, tokenAInAmount, tokenBInAmount } = metaPool.getDepositQuote(
        new anchor.BN(1_000 * 1_000_000_000),
        new anchor.BN(0),
        true,
        20
    );

    console.log(poolTokenAmountOut.toString());


    const depositIx = await metaPool.deposit(msVault, tokenAInAmount, tokenBInAmount, poolTokenAmountOut);

    console.log(depositIx);

    // console.log(metaPool);
}

main();
