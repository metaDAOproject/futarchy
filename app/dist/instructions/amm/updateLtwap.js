"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLtwapHandler = void 0;
const InstructionHandler_1 = require("../../InstructionHandler");
const updateLtwapHandler = async (client, ammAddr) => {
    let ix = await client.program.methods
        .updateLtwap()
        .accounts({
        user: client.provider.publicKey,
        amm: ammAddr,
    })
        .instruction();
    return new InstructionHandler_1.InstructionHandler([ix], [], client);
};
exports.updateLtwapHandler = updateLtwapHandler;
//# sourceMappingURL=updateLtwap.js.map