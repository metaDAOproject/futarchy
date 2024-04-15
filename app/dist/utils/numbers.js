"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.numToBytes64LE = exports.numToBytes32LE = void 0;
const numToBytes32LE = (num) => {
    let bytesU32 = Buffer.alloc(4);
    bytesU32.writeInt32LE(num);
    return bytesU32;
};
exports.numToBytes32LE = numToBytes32LE;
const numToBytes64LE = (num) => {
    let bytesU64 = Buffer.alloc(8);
    bytesU64.writeBigUInt64LE(BigInt(num));
    return bytesU64;
};
exports.numToBytes64LE = numToBytes64LE;
//# sourceMappingURL=numbers.js.map