import { PublicKey, SYSVAR_INSTRUCTIONS_PUBKEY } from "@solana/web3.js";
import { InstructionHandler } from "../../InstructionHandler";
import { getATA } from "../../utils";
import BN from "bn.js";
import { AmmClient } from "../../AmmClient";
import { MethodsBuilder } from "@coral-xyz/anchor/dist/cjs/program/namespace/methods";
import { Amm } from "../../types/amm";

export const swapHandler = (
  client: AmmClient,
  ammAddr: PublicKey,
  baseMint: PublicKey,
  quoteMint: PublicKey,
  isQuoteToBase: boolean,
  inputAmount: BN,
  outputAmountMin: BN
): MethodsBuilder<Amm, any> => {
  return client.program.methods
    .swap({
      swapType: isQuoteToBase ? { buy: {} } : { sell: {} },
      inputAmount,
      outputAmountMin
    })
    .accounts({
      user: client.provider.publicKey,
      amm: ammAddr,
      baseMint,
      quoteMint,
      userAtaBase: getATA(baseMint, client.provider.publicKey)[0],
      userAtaQuote: getATA(quoteMint, client.provider.publicKey)[0],
      vaultAtaBase: getATA(baseMint, ammAddr)[0],
      vaultAtaQuote: getATA(quoteMint, ammAddr)[0],
    });
};
