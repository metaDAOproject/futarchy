"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLiquidityHandler = void 0;
const InstructionHandler_1 = require("../../InstructionHandler");
const utils_1 = require("../../utils");
const addLiquidityHandler = async (client, ammAddr, ammPositionAddr, maxBaseAmount, maxQuoteAmount, minBaseAmount, minQuoteAmount) => {
    const amm = await client.program.account.amm.fetch(ammAddr);
    let ix = await client.program.methods
        .addLiquidity(maxBaseAmount, maxQuoteAmount, minBaseAmount, minQuoteAmount)
        .accounts({
        user: client.provider.publicKey,
        amm: ammAddr,
        ammPosition: ammPositionAddr,
        baseMint: amm.baseMint,
        quoteMint: amm.quoteMint,
        userAtaBase: (0, utils_1.getATA)(amm.baseMint, client.provider.publicKey)[0],
        userAtaQuote: (0, utils_1.getATA)(amm.quoteMint, client.provider.publicKey)[0],
        vaultAtaBase: (0, utils_1.getATA)(amm.baseMint, ammAddr)[0],
        vaultAtaQuote: (0, utils_1.getATA)(amm.quoteMint, ammAddr)[0],
    })
        .instruction();
    return new InstructionHandler_1.InstructionHandler([ix], [], client);
};
exports.addLiquidityHandler = addLiquidityHandler;
//# sourceMappingURL=addLiquidity.js.map