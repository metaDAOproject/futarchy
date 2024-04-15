import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { AddressLookupTableAccount, PublicKey } from "@solana/web3.js";
import { Amm as AmmIDLType } from "./types/amm";
import BN from "bn.js";
import { Amm, AmmPositionWrapper, AmmWrapper } from "./types";
export type CreateAmmClientParams = {
    provider: AnchorProvider;
    programId?: PublicKey;
};
export declare class AmmClient {
    readonly provider: AnchorProvider;
    readonly program: Program<AmmIDLType>;
    readonly luts: AddressLookupTableAccount[];
    constructor(provider: AnchorProvider, ammProgramId: PublicKey, luts: AddressLookupTableAccount[]);
    static createClient(createAutocratClientParams: CreateAmmClientParams): Promise<AmmClient>;
    createAmm(baseMint: PublicKey, quoteMint: PublicKey, twapInitialObservation: BN, twapMaxObservationChangePerUpdate: BN): import("@coral-xyz/anchor/dist/cjs/program/namespace/methods").MethodsBuilder<AmmIDLType, any>;
    createAmmPosition(amm: PublicKey): Promise<import("./InstructionHandler").InstructionHandler<Program<AmmIDLType>, AmmClient>>;
    addLiquidity(ammAddr: PublicKey, ammPositionAddr: PublicKey, maxBaseAmount: BN, maxQuoteAmount: BN, minBaseAmount: BN, minQuoteAmount: BN): Promise<import("./InstructionHandler").InstructionHandler<Program<AmmIDLType>, AmmClient>>;
    removeLiquidity(ammAddr: PublicKey, ammPositionAddr: PublicKey, removeBps: BN): Promise<import("./InstructionHandler").InstructionHandler<Program<AmmIDLType>, AmmClient>>;
    swap(ammAddr: PublicKey, isQuoteToBase: boolean, inputAmount: BN, minOutputAmount: BN): Promise<import("./InstructionHandler").InstructionHandler<Program<AmmIDLType>, AmmClient>>;
    updateLTWAP(ammAddr: PublicKey): Promise<import("./InstructionHandler").InstructionHandler<Program<AmmIDLType>, AmmClient>>;
    getAmm(ammAddr: PublicKey): Promise<Amm>;
    getAllAmms(): Promise<AmmWrapper[]>;
    getAllUserPositions(): Promise<AmmPositionWrapper[]>;
    getUserPositionForAmm(ammAddr: PublicKey): Promise<AmmPositionWrapper | undefined>;
    getSwapPreview(amm: Amm, inputAmount: BN, isBuyBase: boolean): SwapPreview;
}
export type SwapPreview = {
    isBuyBase: boolean;
    inputAmount: BN;
    outputAmount: BN;
    inputUnits: number;
    outputUnits: number;
    startPrice: number;
    finalPrice: number;
    avgSwapPrice: number;
    priceImpact: number;
};
