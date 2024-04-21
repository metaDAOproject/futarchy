import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import { InstructionHandler } from "../../InstructionHandler";
import { getATA, getAmmLpMintAddr } from "../../utils";
import BN from "bn.js";
import { AmmClient } from "../../AmmClient";
import { MethodsBuilder } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import { Amm } from "../../types/amm";

export const removeLiquidityHandler = (
  client: AmmClient,
  ammAddr: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  removeBps: BN
): MethodsBuilder<Amm, any> => {
  const [lpMint] = getAmmLpMintAddr(client.program.programId, ammAddr);

  return client.program.methods
    .removeLiquidity({
      lpTokensToBurn: new BN(0),
      minBaseAmount: new BN(0),
      minQuoteAmount: new BN(0),
    })
    .accounts({
      user: client.provider.publicKey,
      amm: ammAddr,
      lpMint,
      baseMint,
      quoteMint,
      userAtaLp: getATA(lpMint, client.provider.publicKey)[0],
      userAtaBase: getATA(baseMint, client.provider.publicKey)[0],
      userAtaQuote: getATA(quoteMint, client.provider.publicKey)[0],
      vaultAtaBase: getATA(baseMint, ammAddr)[0],
      vaultAtaQuote: getATA(quoteMint, ammAddr)[0],
    });
};
