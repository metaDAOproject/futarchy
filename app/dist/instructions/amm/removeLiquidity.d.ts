import { PublicKey } from "@solana/web3.js";
import { InstructionHandler } from "../../InstructionHandler";
import BN from "bn.js";
import { AmmClient } from "../../AmmClient";
export declare const removeLiquidityHandler: (client: AmmClient, ammAddr: PublicKey, ammPositionAddr: PublicKey, removeBps: BN) => Promise<InstructionHandler<import("@coral-xyz/anchor").Program<import("../../types/amm").Amm>, AmmClient>>;
