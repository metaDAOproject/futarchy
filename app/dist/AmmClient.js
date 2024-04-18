"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AmmClient = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const amm_1 = require("./types/amm");
const ixs = __importStar(require("./instructions/amm"));
const bn_js_1 = __importDefault(require("bn.js"));
const constants_1 = require("./constants");
const utils_1 = require("./utils");
class AmmClient {
    provider;
    program;
    luts;
    constructor(provider, ammProgramId, luts) {
        this.provider = provider;
        this.program = new anchor_1.Program(amm_1.IDL, ammProgramId, provider);
        this.luts = luts;
    }
    static async createClient(createAutocratClientParams) {
        let { provider, programId } = createAutocratClientParams;
        const luts = [];
        return new AmmClient(provider, programId || constants_1.AMM_PROGRAM_ID, luts);
    }
    // both twap values need to be scaled beforehand
    createAmm(baseMint, quoteMint, twapInitialObservation, twapMaxObservationChangePerUpdate) {
        return ixs.createAmmHandler(this, baseMint, quoteMint, twapInitialObservation, twapMaxObservationChangePerUpdate);
    }
    async createAmmPosition(amm) {
        return ixs.createAmmPositionHandler(this, amm);
    }
    async addLiquidity(ammAddr, ammPositionAddr, maxBaseAmount, maxQuoteAmount, minBaseAmount, minQuoteAmount) {
        return ixs.addLiquidityHandler(this, ammAddr, ammPositionAddr, maxBaseAmount, maxQuoteAmount, minBaseAmount, minQuoteAmount);
    }
    async removeLiquidity(ammAddr, ammPositionAddr, removeBps) {
        return ixs.removeLiquidityHandler(this, ammAddr, ammPositionAddr, removeBps);
    }
    async swap(ammAddr, isQuoteToBase, inputAmount, minOutputAmount) {
        return ixs.swapHandler(this, ammAddr, isQuoteToBase, inputAmount, minOutputAmount);
    }
    async updateLTWAP(ammAddr) {
        return ixs.updateLtwapHandler(this, ammAddr);
    }
    // getter functions
    // async getLTWAP(ammAddr: PublicKey): Promise<number> {
    //   const amm = await this.program.account.amm.fetch(ammAddr);
    //   return amm.twapLastObservationUq64X32
    //     .div(new BN(2).pow(new BN(32)))
    //     .toNumber();
    // }
    async getAmm(ammAddr) {
        return await this.program.account.amm.fetch(ammAddr);
    }
    async getAllAmms() {
        return await this.program.account.amm.all();
    }
    async getAllUserPositions() {
        try {
            return await this.program.account.ammPosition.all([
                (0, utils_1.filterPositionsByUser)(this.provider.wallet.publicKey),
            ]);
        }
        catch (e) {
            return [];
        }
    }
    async getUserPositionForAmm(ammAddr) {
        try {
            return (await this.program.account.ammPosition.all([
                (0, utils_1.filterPositionsByUser)(this.provider.wallet.publicKey),
                (0, utils_1.filterPositionsByAmm)(ammAddr),
            ]))[0];
        }
        catch (e) {
            return undefined;
        }
    }
    getSwapPreview(amm, inputAmount, isBuyBase) {
        let quoteAmount = amm.quoteAmount;
        let baseAmount = amm.baseAmount;
        let startPrice = quoteAmount.toNumber() /
            10 ** amm.quoteMintDecimals /
            (baseAmount.toNumber() / 10 ** amm.baseMintDecimals);
        let k = quoteAmount.mul(baseAmount);
        let inputMinusFee = inputAmount
            .mul(new bn_js_1.default(10_000).subn(100))
            .div(new bn_js_1.default(10_000));
        if (isBuyBase) {
            let tempQuoteAmount = quoteAmount.add(inputMinusFee);
            let tempBaseAmount = k.div(tempQuoteAmount);
            let finalPrice = tempQuoteAmount.toNumber() /
                10 ** amm.quoteMintDecimals /
                (tempBaseAmount.toNumber() / 10 ** amm.baseMintDecimals);
            let outputAmountBase = baseAmount.sub(tempBaseAmount);
            let inputUnits = inputAmount.toNumber() / 10 ** amm.quoteMintDecimals;
            let outputUnits = outputAmountBase.toNumber() / 10 ** amm.baseMintDecimals;
            let priceImpact = Math.abs(finalPrice - startPrice) / startPrice;
            return {
                isBuyBase,
                inputAmount,
                outputAmount: outputAmountBase,
                inputUnits,
                outputUnits,
                startPrice,
                finalPrice,
                avgSwapPrice: inputUnits / outputUnits,
                priceImpact,
            };
        }
        else {
            let tempBaseAmount = baseAmount.add(inputMinusFee);
            let tempQuoteAmount = k.div(tempBaseAmount);
            let finalPrice = tempQuoteAmount.toNumber() /
                10 ** amm.quoteMintDecimals /
                (tempBaseAmount.toNumber() / 10 ** amm.baseMintDecimals);
            let outputAmountQuote = quoteAmount.sub(tempQuoteAmount);
            let inputUnits = inputAmount.toNumber() / 10 ** amm.baseMintDecimals;
            let outputUnits = outputAmountQuote.toNumber() / 10 ** amm.quoteMintDecimals;
            let priceImpact = Math.abs(finalPrice - startPrice) / startPrice;
            return {
                isBuyBase,
                inputAmount,
                outputAmount: outputAmountQuote,
                inputUnits,
                outputUnits,
                startPrice,
                finalPrice,
                avgSwapPrice: outputUnits / inputUnits,
                priceImpact,
            };
        }
    }
}
exports.AmmClient = AmmClient;
//# sourceMappingURL=AmmClient.js.map