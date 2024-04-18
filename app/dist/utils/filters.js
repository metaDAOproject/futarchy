"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterPositionsByAmm = exports.filterPositionsByUser = void 0;
const filterPositionsByUser = (userAddr) => ({
    memcmp: {
        offset: 8,
        bytes: userAddr.toBase58(),
    },
});
exports.filterPositionsByUser = filterPositionsByUser;
const filterPositionsByAmm = (ammAddr) => ({
    memcmp: {
        offset: 8 + // discriminator
            32,
        bytes: ammAddr.toBase58(),
    },
});
exports.filterPositionsByAmm = filterPositionsByAmm;
//# sourceMappingURL=filters.js.map