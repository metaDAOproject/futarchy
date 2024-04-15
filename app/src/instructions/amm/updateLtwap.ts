import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import { InstructionHandler } from "../../InstructionHandler";
import { AmmClient } from "../../AmmClient";

export const updateLtwapHandler = async (
    client: AmmClient,
    ammAddr: PublicKey,
): Promise<InstructionHandler<typeof client.program, AmmClient>> => {
    let ix = await client.program.methods
        .updateLtwap(null)
        .accounts({
            user: client.provider.publicKey,
            amm: ammAddr,
            authPda: null,
        })
        .instruction()

    return new InstructionHandler([ix], [], client)
};
