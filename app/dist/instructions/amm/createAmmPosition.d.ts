import { PublicKey } from "@solana/web3.js";
import { AmmClient } from "../../AmmClient";
import { InstructionHandler } from "../../InstructionHandler";
export declare const createAmmPositionHandler: (client: AmmClient, amm: PublicKey) => Promise<InstructionHandler<import("@coral-xyz/anchor").Program<import("../../types/amm").Amm>, AmmClient>>;
