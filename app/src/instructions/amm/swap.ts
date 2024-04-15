import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import { InstructionHandler } from "../../InstructionHandler";
import { getATA } from '../../utils';
import BN from "bn.js";
import { AmmClient } from "../../AmmClient";

export const swapHandler = async (
    client: AmmClient,
    ammAddr: PublicKey,
    isQuoteToBase: boolean,
    inputAmount: BN,
    minOutputAmount: BN,
): Promise<InstructionHandler<typeof client.program, AmmClient>> => {
    const amm = await client.program.account.amm.fetch(ammAddr);

    let ix = await client.program.methods
        .swap(
            isQuoteToBase,
            inputAmount,
            minOutputAmount,
        )
        .accounts({
            user: client.provider.publicKey,
            amm: ammAddr,
            baseMint: amm.baseMint,
            quoteMint: amm.quoteMint,
            userAtaBase: getATA(amm.baseMint, client.provider.publicKey)[0],
            userAtaQuote: getATA(amm.quoteMint, client.provider.publicKey)[0],
            vaultAtaBase: getATA(amm.baseMint, ammAddr)[0],
            vaultAtaQuote: getATA(amm.quoteMint, ammAddr)[0],
            authPda: null,
        })
        .instruction()

    return new InstructionHandler([ix], [], client)
};
