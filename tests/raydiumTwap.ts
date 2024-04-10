import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { BankrunProvider } from "anchor-bankrun";
import {
  Clmm,
  TxVersion,
  SqrtPriceMath,
  MIN_SQRT_PRICE_X64,
} from "@raydium-io/raydium-sdk";
import { assert } from "chai";
import {
  startAnchor,
  Clock,
  BanksClient,
  ProgramTestContext,
} from "solana-bankrun";
import {
  createMint,
  createAccount,
  createAssociatedTokenAccount,
  mintToOverride,
  getMint,
  getAccount,
} from "spl-token-bankrun";
import Decimal from "decimal.js";

import { RaydiumTwap } from "../target/types/raydium_twap";
import { AmmV3 } from "./fixtures/amm_v3";

const { PublicKey, Keypair } = anchor.web3;

const RaydiumTwapIDL: RaydiumTwap = require("../target/idl/raydium_twap.json");
const AmmV3IDL: AmmV3 = require("./fixtures/amm_v3.json");

export type PublicKey = anchor.web3.PublicKey;
export type Signer = anchor.web3.Signer;
export type Keypair = anchor.web3.Keypair;

const RAYDIUM_TWAP_PROGRAM_ID = new PublicKey(
  "8D57r6T9RaBTeDFezQzzoHRxywk1bMqYmbprsmx6Y8XV"
);

const RAYDIUM_PROGRAM_ID = new PublicKey(
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"
);

describe("raydium_twap", async function () {
  let provider,
    raydiumTwap,
    amm: Program<AmmV3>,
    payer: Keypair,
    context: ProgramTestContext,
    banksClient: BanksClient,
    USDC: PublicKey,
    META: PublicKey,
    ammConfig: PublicKey;

  before(async function () {
    context = await startAnchor(
      "./",
      [
        {
          name: "raydium_amm_v3",
          programId: RAYDIUM_PROGRAM_ID,
        },
      ],
      []
    );
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    anchor.setProvider(provider);

    raydiumTwap = new anchor.Program<RaydiumTwap>(
      RaydiumTwapIDL,
      RAYDIUM_TWAP_PROGRAM_ID,
      provider
    );

    amm = new anchor.Program<AmmV3>(AmmV3IDL, RAYDIUM_PROGRAM_ID, provider);

    payer = provider.wallet.payer;

    USDC = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );

    META = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      payer.publicKey,
      9
    );

    const AMM_CONFIG_INDEX = 3;
    [ammConfig] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("amm_config"),
          new BN(AMM_CONFIG_INDEX).toBuffer("be", 2),
        ],
        RAYDIUM_PROGRAM_ID
    );

    await amm.methods
      .createAmmConfig(AMM_CONFIG_INDEX, 100, 100, 0, 0)
      .accounts({
        owner: payer.publicKey,
        ammConfig,
      })
      .rpc();
  });

  describe("#initialize_pool_twap", async function () {
    it("initializes pool TWAPs", async function () {
      let token0: PublicKey, token1: PublicKey;
      if (META.toBuffer().readBigUint64BE(0) > USDC.toBuffer().readBigUint64BE(0)) {
        token0 = USDC;
        token1 = META;
      } else {
        token0 = META;
        token1 = USDC;
      }

      const [poolState] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("pool"),
          ammConfig.toBuffer(),
          token0.toBuffer(),
          token1.toBuffer(),
        ],
        RAYDIUM_PROGRAM_ID
      );

      const [tokenVault0] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("pool_vault"),
          poolState.toBuffer(),
          token0.toBuffer(),
        ],
        RAYDIUM_PROGRAM_ID
      );

      const [tokenVault1] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("pool_vault"),
          poolState.toBuffer(),
          token1.toBuffer(),
        ],
        RAYDIUM_PROGRAM_ID
      );

      const [tickArrayBitmap] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("pool_tick_array_bitmap_extension"),
          poolState.toBuffer(),
        ],
        RAYDIUM_PROGRAM_ID
      );

      // const initialPriceX64 = SqrtPriceMath.priceToSqrtPriceX64(initPrice, mintA.decimals, mintB.decimals)
      const observationStateKeypair = Keypair.generate();

      await amm.methods
        .createPool(MIN_SQRT_PRICE_X64, new BN(0))
        .accounts({
          poolCreator: payer.publicKey,
          ammConfig,
          poolState,
          tokenMint0: token0,
          tokenMint1: token1,
          tokenVault0,
          tokenVault1,
          observationState: observationStateKeypair.publicKey,
          tickArrayBitmap,
          tokenProgram0: token.TOKEN_PROGRAM_ID,
          tokenProgram1: token.TOKEN_PROGRAM_ID,
        })
        .preInstructions([
          await amm.account.observationState.createInstruction(
            observationStateKeypair,
            52121
          ),
        ])
        .signers([observationStateKeypair])
        .rpc();
      // Clmm.makeCreatePoolInstructionSimple({
      //   connection: provider.connection as anchor.web3.Connection,
      //   ammConfig: RAYDIUM_PROGRAM_ID,
      //   programId: RAYDIUM_PROGRAM_ID,
      //   owner: payer.publicKey,
      //   mint1: USDC,
      //   mint2: META,
      //   initialPrice: Decimal(1),
      //   startTime: new BN(Math.floor(new Date().getTime() / 1000)),
      //   makeTxVersion: TxVersion.V0,
      //   payer: payer.publicKey,
      // })
      //  const _ammConfig = (await formatClmmConfigs(PROGRAMIDS.CLMM.toString()))[input.clmmConfigId]
      //  const ammConfig: ClmmConfigInfo = { ..._ammConfig, id: new PublicKey(_ammConfig.id) }

      //  // -------- step 1: make create pool instructions --------
      //  const makeCreatePoolInstruction = await Clmm.makeCreatePoolInstructionSimple({
      //    connection,
      //    programId: PROGRAMIDS.CLMM,
      //    owner: input.wallet.publicKey,
      //    mint1: input.baseToken,
      //    mint2: input.quoteToken,
      //    ammConfig,
      //    initialPrice: input.startPoolPrice,
      //    startTime: input.startTime,
      //    makeTxVersion,
      //    payer: wallet.publicKey,
      //  })
    });
  });

  describe("#crank", async function () {
    it("cranks - test #1");

    it("cranks - test #2");

    it("cranks - test #3");
  });
});
