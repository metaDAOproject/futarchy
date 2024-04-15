"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAmmHandler = void 0;
const utils_1 = require("../../utils");
const createAmmHandler = (client, baseMint, quoteMint, twapInitialObservation, twapMaxObservationChangePerUpdate) => {
    let [ammAddr] = (0, utils_1.getAmmAddr)(client.program.programId, baseMint, quoteMint);
    let [vaultAtaBase] = (0, utils_1.getATA)(baseMint, ammAddr);
    let [vaultAtaQuote] = (0, utils_1.getATA)(quoteMint, ammAddr);
    return client.program.methods
        .createAmm({
        twapInitialObservation,
        twapMaxObservationChangePerUpdate,
    })
        .accounts({
        user: client.provider.publicKey,
        amm: ammAddr,
        baseMint,
        quoteMint,
        vaultAtaBase,
        vaultAtaQuote,
    });
};
exports.createAmmHandler = createAmmHandler;
//# sourceMappingURL=createAmm.js.map