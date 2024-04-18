"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAmmPositionHandler = void 0;
const InstructionHandler_1 = require("../../InstructionHandler");
const utils_1 = require("../../utils");
const createAmmPositionHandler = async (client, amm) => {
    let ix = await client.program.methods
        .createPosition()
        .accounts({
        user: client.provider.publicKey,
        amm,
        ammPosition: (0, utils_1.getAmmPositionAddr)(client.program.programId, amm, client.provider.publicKey)[0],
    })
        .instruction();
    return new InstructionHandler_1.InstructionHandler([ix], [], client);
};
exports.createAmmPositionHandler = createAmmPositionHandler;
//# sourceMappingURL=createAmmPosition.js.map