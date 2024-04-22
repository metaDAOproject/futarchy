import { BN } from "bn.js";
import { Decimal } from "decimal.js";

export const numToBytes32LE = (num: number) => {
  let bytesU32 = Buffer.alloc(4);
  bytesU32.writeInt32LE(num);
  return bytesU32;
};

export const numToBytes64LE = (num: number) => {
  let bytesU64 = Buffer.alloc(8);
  bytesU64.writeBigUInt64LE(BigInt(num));
  return bytesU64;
};
