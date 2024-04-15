import {
    AddressLookupTableProgram,
    ComputeBudgetProgram,
    PublicKey,
    SystemProgram,
    SYSVAR_RENT_PUBKEY,
    TransactionMessage,
    VersionedTransaction
} from "@solana/web3.js";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {AutocratClient} from "../AutocratClient";
import { AUTOCRAT_LUTS, AUTOCRAT_PROGRAM_ID, META_MINT, USDC_MINT } from "../constants";
import { getDaoAddr, getDaoTreasuryAddr } from "./pda";

export async function createLookupTable(
    client: AutocratClient,
    print: boolean = false
): Promise<PublicKey> {
    const slot = await client.provider.connection.getSlot();

    let isNewLUT = false
    let lookupTableAddress = AUTOCRAT_LUTS[0]

    if (isNewLUT) {
        const lookupTableObj =
            AddressLookupTableProgram.createLookupTable({
                authority: client.provider.wallet.publicKey,
                payer: client.provider.wallet.publicKey,
                recentSlot: slot,
            });

        const lookupTableInst = lookupTableObj[0]
        lookupTableAddress = lookupTableObj[1]

        let latestBlockhash = await client.provider.connection.getLatestBlockhash()

        const messageLegacy = new TransactionMessage({
            payerKey: client.provider.wallet.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: [lookupTableInst],
        }).compileToLegacyMessage();

        let transaction = new VersionedTransaction(messageLegacy)
        transaction = await client.provider.wallet.signTransaction(transaction)

        let signature = await client.provider.connection.sendTransaction(transaction, {skipPreflight: true});
        await client.provider.connection.confirmTransaction({signature, ...latestBlockhash}, 'confirmed');
    }

    if (print) {
        console.log("lookup table: ", lookupTableAddress.toBase58())
    }

    let addresses = new Set<PublicKey>([
        ComputeBudgetProgram.programId,
        SystemProgram.programId,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
        SYSVAR_RENT_PUBKEY,
        AUTOCRAT_PROGRAM_ID,
        getDaoAddr(AUTOCRAT_PROGRAM_ID)[0],
        getDaoTreasuryAddr(AUTOCRAT_PROGRAM_ID)[0],
        META_MINT,
        USDC_MINT
    ])

    addresses.delete(PublicKey.default)

    const lookupTableAccount = await client.provider.connection
        .getAddressLookupTable(lookupTableAddress)
        .then((res) => res.value);

    for (let pk of addresses){
        if (pk.toBase58() === PublicKey.default.toBase58()){
            continue
        }

        let alreadyAdded = false
        for (let addr of lookupTableAccount?.state.addresses || []){
            if (addr.toBase58() === pk.toBase58()){
                if (print) {
                    console.log("already added", pk.toBase58())
                }
                alreadyAdded = true
                break
            }
        }

        if (alreadyAdded){
            continue
        }

        if (print) {
            console.log("adding [", pk.toBase58(), "] to lut")
        }

        try {
            const extendInstruction = AddressLookupTableProgram.extendLookupTable({
                payer: client.provider.wallet.publicKey,
                authority: client.provider.wallet.publicKey,
                lookupTable: lookupTableAddress,
                addresses: [pk],
            });

            let latestBlockhash = await client.provider.connection.getLatestBlockhash()

            const messageLegacy = new TransactionMessage({
                payerKey: client.provider.wallet.publicKey,
                recentBlockhash: latestBlockhash.blockhash,
                instructions: [extendInstruction],
            }).compileToLegacyMessage();

            // Create a new VersionedTransaction which supports legacy and v0
            let transaction = new VersionedTransaction(messageLegacy)
            transaction = await client.provider.wallet.signTransaction(transaction)

            let signature = await client.provider.connection.sendTransaction(transaction, {skipPreflight: true});
            await client.provider.connection.confirmTransaction({signature, ...latestBlockhash}, 'confirmed');
        } catch (e){
            console.log(e)
        }
    }

    return lookupTableAddress
}

