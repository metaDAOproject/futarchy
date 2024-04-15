import { PublicKey } from "@solana/web3.js";
import { InstructionHandler } from "../../InstructionHandler";
import { AmmClient } from "../../AmmClient";
export declare const updateLtwapHandler: (client: AmmClient, ammAddr: PublicKey) => Promise<InstructionHandler<import("@coral-xyz/anchor").Program<import("../../types/amm").Amm>, AmmClient>>;
