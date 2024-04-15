import { PublicKey } from "@solana/web3.js";
import { AmmClient } from "../../AmmClient";
import { InstructionHandler } from "../../InstructionHandler";
import { getATA, getAmmAddr } from '../../utils';
import BN from "bn.js";

export const createAmmHandler = async (
    client: AmmClient,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    swapFeeBps: number,
    permissionedCaller: PublicKey,
    ltwapDecimals: number,
): Promise<InstructionHandler<typeof client.program, AmmClient>> => {
    let [ammAddr] = getAmmAddr(
        client.program.programId,
        baseMint,
        quoteMint,
        swapFeeBps,
        permissionedCaller
    )

    let [vaultAtaBase] = getATA(baseMint, ammAddr)
    let [vaultAtaQuote] = getATA(quoteMint, ammAddr)

    let ix = await client.program.methods
        .createAmm({
            permissionedCaller,
            swapFeeBps: new BN(swapFeeBps),
            ltwapDecimals
        })
        .accounts({
            user: client.provider.publicKey,
            amm: ammAddr,
            baseMint,
            quoteMint,
            vaultAtaBase,
            vaultAtaQuote,
            authPda: null
        })
        .instruction()

    return new InstructionHandler([ix], [], client)
};
