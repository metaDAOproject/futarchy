import { PublicKey } from "@solana/web3.js";
import { InstructionHandler } from "../../InstructionHandler";
import BN from "bn.js";
import { AmmClient } from "../../AmmClient";
export declare const addLiquidityHandler: (client: AmmClient, ammAddr: PublicKey, ammPositionAddr: PublicKey, maxBaseAmount: BN, maxQuoteAmount: BN, minBaseAmount: BN, minQuoteAmount: BN) => Promise<InstructionHandler<import("@coral-xyz/anchor").Program<import("../../types/amm").Amm>, AmmClient>>;
