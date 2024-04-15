import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
    AddressLookupTableAccount,
    PublicKey,
} from "@solana/web3.js";

import { Amm as AmmIDLType, IDL as AmmIDL } from './types/amm';

import * as ixs from "./instructions/amm";
import BN from "bn.js";
import { AMM_PROGRAM_ID } from "./constants";
import { Amm, AmmPositionWrapper, AmmWrapper } from "./types";
import { filterPositionsByUser, filterPositionsByAmm } from "./utils";

export type CreateAmmClientParams = {
    provider: AnchorProvider,
    programId?: PublicKey,
}

export class AmmClient {
    public readonly provider: AnchorProvider;
    public readonly program: Program<AmmIDLType>;
    public readonly luts: AddressLookupTableAccount[];

    constructor(
        provider: AnchorProvider,
        ammProgramId: PublicKey,
        luts: AddressLookupTableAccount[],
    ) {
        this.provider = provider
        this.program = new Program<AmmIDLType>(AmmIDL, ammProgramId, provider)
        this.luts = luts
    }

    public static async createClient(createAutocratClientParams: CreateAmmClientParams): Promise<AmmClient> {
        let { provider, programId } = createAutocratClientParams;

        const luts: AddressLookupTableAccount[] = []

        return new AmmClient(
            provider,
            programId || AMM_PROGRAM_ID,
            luts,
        )
    }

    async createAmm(
        baseMint: PublicKey,
        quoteMint: PublicKey,
        swapFeeBps: number,
        permissionedCaller: PublicKey = PublicKey.default,
        ltwapDecimals = 9
    ) {
        return ixs.createAmmHandler(
            this,
            baseMint,
            quoteMint,
            swapFeeBps,
            permissionedCaller,
            ltwapDecimals
        )
    }

    async createAmmPosition(
        amm: PublicKey
    ) {
        return ixs.createAmmPositionHandler(
            this,
            amm
        )
    }

    async addLiquidity(
        ammAddr: PublicKey,
        ammPositionAddr: PublicKey,
        maxBaseAmount: BN,
        maxQuoteAmount: BN,
        minBaseAmount: BN,
        minQuoteAmount: BN,
    ) {
        return ixs.addLiquidityHandler(
            this,
            ammAddr,
            ammPositionAddr,
            maxBaseAmount,
            maxQuoteAmount,
            minBaseAmount,
            minQuoteAmount,
        )
    }

    async removeLiquidity(
        ammAddr: PublicKey,
        ammPositionAddr: PublicKey,
        removeBps: BN,
    ) {
        return ixs.removeLiquidityHandler(
            this,
            ammAddr,
            ammPositionAddr,
            removeBps
        )
    }

    async swap(
        ammAddr: PublicKey,
        isQuoteToBase: boolean,
        inputAmount: BN,
        minOutputAmount: BN,
    ) {
        return ixs.swapHandler(
            this,
            ammAddr,
            isQuoteToBase,
            inputAmount,
            minOutputAmount,
        )
    }

    async updateLTWAP(
        ammAddr: PublicKey,
    ) {
        return ixs.updateLtwapHandler(
            this,
            ammAddr,
        )
    }

    // getter functions

    async getLTWAP(
        ammAddr: PublicKey,
    ): Promise<number> {
        const amm = await this.program.account.amm.fetch(ammAddr);
        return amm.ltwapLatest.toNumber() / 10 ** amm.ltwapDecimals
    }

    async getAmm(
        ammAddr: PublicKey,
    ): Promise<Amm> {
        return await this.program.account.amm.fetch(ammAddr);
    }

    async getAllAmms(): Promise<AmmWrapper[]> {
        return await this.program.account.amm.all();
    }

    async getAllUserPositions(): Promise<AmmPositionWrapper[]> {
        try {
            return await this.program.account.ammPosition.all([
                filterPositionsByUser(this.provider.wallet.publicKey)
            ])
        } catch (e) {
            return []
        }
    }

    async getUserPositionForAmm(ammAddr: PublicKey): Promise<AmmPositionWrapper | undefined> {
        try {
            return (await this.program.account.ammPosition.all([
                filterPositionsByUser(this.provider.wallet.publicKey),
                filterPositionsByAmm(ammAddr)
            ]))[0]
        } catch (e) {
            return undefined
        }
    }

    getSwapPreview(
        amm: Amm,
        inputAmount: BN,
        isBuyBase: boolean
    ): SwapPreview {
        let quoteAmount = amm.quoteAmount
        let baseAmount = amm.baseAmount

        let startPrice = (quoteAmount.toNumber() / 10 ** amm.quoteMintDecimals) /
            (baseAmount.toNumber() / 10 ** amm.baseMintDecimals)

        let k = quoteAmount.mul(baseAmount)

        let inputMinusFee = inputAmount
            .mul(new BN(10_000).sub(amm.swapFeeBps))
            .div(new BN(10_000))

        if (isBuyBase) {
            let tempQuoteAmount = quoteAmount.add(inputMinusFee)
            let tempBaseAmount = k.div(tempQuoteAmount)

            let finalPrice = (tempQuoteAmount.toNumber() / 10 ** amm.quoteMintDecimals) /
                (tempBaseAmount.toNumber() / 10 ** amm.baseMintDecimals)

            let outputAmountBase = baseAmount.sub(tempBaseAmount)

            let inputUnits = inputAmount.toNumber() / 10 ** amm.quoteMintDecimals
            let outputUnits = outputAmountBase.toNumber() / 10 ** amm.baseMintDecimals

            let priceImpact = Math.abs(finalPrice - startPrice) / startPrice

            return {
                isBuyBase,
                inputAmount,
                outputAmount: outputAmountBase,
                inputUnits,
                outputUnits,
                startPrice,
                finalPrice,
                avgSwapPrice: inputUnits / outputUnits,
                priceImpact
            }
        } else {
            let tempBaseAmount = baseAmount.add(inputMinusFee)
            let tempQuoteAmount = k.div(tempBaseAmount)

            let finalPrice = (tempQuoteAmount.toNumber() / 10 ** amm.quoteMintDecimals) /
                (tempBaseAmount.toNumber() / 10 ** amm.baseMintDecimals)

            let outputAmountQuote = quoteAmount.sub(tempQuoteAmount)

            let inputUnits = inputAmount.toNumber() / 10 ** amm.baseMintDecimals
            let outputUnits = outputAmountQuote.toNumber() / 10 ** amm.quoteMintDecimals

            let priceImpact = Math.abs(finalPrice - startPrice) / startPrice

            return {
                isBuyBase,
                inputAmount,
                outputAmount: outputAmountQuote,
                inputUnits,
                outputUnits,
                startPrice,
                finalPrice,
                avgSwapPrice: outputUnits / inputUnits,
                priceImpact
            }
        }
    }
}

export type SwapPreview = {
    isBuyBase: boolean,
    inputAmount: BN,
    outputAmount: BN,
    inputUnits: number,
    outputUnits: number,
    startPrice: number,
    finalPrice: number,
    avgSwapPrice: number,
    priceImpact: number
}