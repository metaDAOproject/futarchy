import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import { AmmClient } from "../../AmmClient";
import { InstructionHandler } from "../../InstructionHandler";
import { getAmmPositionAddr } from '../../utils';

export const createAmmPositionHandler = async (
    client: AmmClient,
    amm: PublicKey,
): Promise<InstructionHandler<typeof client.program, AmmClient>> => {
    let ix = await client.program.methods
        .createPosition()
        .accounts({
            user: client.provider.publicKey,
            amm,
            ammPosition: getAmmPositionAddr(client.program.programId, amm, client.provider.publicKey)[0],
            authPda: null,
        })
        .instruction()

    return new InstructionHandler([ix], [], client)
};
