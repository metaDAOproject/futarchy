import { PublicKey } from "@solana/web3.js";
import { AmmClient } from "../../AmmClient";
import BN from "bn.js";
import { MethodsBuilder } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import { Amm } from "../../types/amm";
export declare const createAmmHandler: (client: AmmClient, baseMint: PublicKey, quoteMint: PublicKey, twapInitialObservation: BN, twapMaxObservationChangePerUpdate: BN) => MethodsBuilder<Amm, any>;
