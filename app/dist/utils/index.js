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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = exports.pubkeyToAccountInfo = exports.addPriorityFee = exports.addComputeUnits = exports.PriorityFeeTier = void 0;
__exportStar(require("./filters"), exports);
__exportStar(require("./pda"), exports);
__exportStar(require("./numbers"), exports);
const web3_js_1 = require("@solana/web3.js");
var PriorityFeeTier;
(function (PriorityFeeTier) {
    PriorityFeeTier[PriorityFeeTier["NORMAL"] = 35] = "NORMAL";
    PriorityFeeTier[PriorityFeeTier["HIGH"] = 3571] = "HIGH";
    PriorityFeeTier[PriorityFeeTier["TURBO"] = 357142] = "TURBO";
})(PriorityFeeTier = exports.PriorityFeeTier || (exports.PriorityFeeTier = {}));
const addComputeUnits = (num_units = 1_400_000) => web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
    units: num_units,
});
exports.addComputeUnits = addComputeUnits;
const addPriorityFee = (pf) => web3_js_1.ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: pf,
});
exports.addPriorityFee = addPriorityFee;
const pubkeyToAccountInfo = (pubkey, isWritable, isSigner = false) => {
    return {
        pubkey: pubkey,
        isSigner: isSigner,
        isWritable: isWritable,
    };
};
exports.pubkeyToAccountInfo = pubkeyToAccountInfo;
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
exports.sleep = sleep;
//# sourceMappingURL=index.js.map