import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { LiquidityMath, METADATA_PROGRAM_ID, getPdaMetadataKey, getPdaTickArrayAddress, i32ToBytes } from "@raydium-io/raydium-sdk";
import { BankrunProvider } from "anchor-bankrun";
import {
  Clmm,
  TxVersion,
  SqrtPriceMath,
  MathUtil,
  MIN_SQRT_PRICE_X64,
  MIN_TICK,
  MAX_TICK,
  TickUtils,
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
  mintTo,
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

const AMM_CONFIG_INDEX = 3;
const TICK_SPACING = 100;

describe("raydium_twap", async function () {
  let provider,
    raydiumTwap,
    amm: Program<AmmV3>,
    payer: Keypair,
    context: ProgramTestContext,
    banksClient: BanksClient,
    USDC: PublicKey,
    META: PublicKey,
    usdcAccount: PublicKey,
    metaAccount: PublicKey,
    ammConfig: PublicKey;

  before(async function () {
    context = await startAnchor(
      "./",
      [
        {
          name: "raydium_amm_v3",
          programId: RAYDIUM_PROGRAM_ID,
        },
        {
          name: "mpl_token_metadata",
          programId: METADATA_PROGRAM_ID,
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

    usdcAccount = await createAssociatedTokenAccount(
      banksClient,
      payer,
      USDC,
      payer.publicKey
    );

    metaAccount = await createAssociatedTokenAccount(
      banksClient,
      payer,
      META,
      payer.publicKey
    );

    await mintTo(
      banksClient,
      payer,
      USDC,
      token.getAssociatedTokenAddressSync(USDC, payer.publicKey),
      payer,
      1_000_000 * 1_000_000
    );

    await mintTo(
      banksClient,
      payer,
      META,
      token.getAssociatedTokenAddressSync(META, payer.publicKey),
      payer,
      1_000 * 1_000_000_000
    );

    [ammConfig] = PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("amm_config"),
        new BN(AMM_CONFIG_INDEX).toBuffer("be", 2),
      ],
      RAYDIUM_PROGRAM_ID
    );

    await amm.methods
      .createAmmConfig(AMM_CONFIG_INDEX, TICK_SPACING, 100, 0, 0)
      .accounts({
        owner: payer.publicKey,
        ammConfig,
      })
      .rpc();
  });

  describe("#initialize_pool_twap", async function () {
    it("initializes pool TWAPs", async function () {
      const initialPrice = new Decimal(1000);

      const [token0, token1, token0Decimals, token1Decimals, initPrice] =
        new BN(USDC.toBuffer()).gt(new BN(META.toBuffer()))
          ? [META, USDC, 9, 6, initialPrice]
          : [USDC, META, 6, 9, new Decimal(1).div(initialPrice)];

      console.log("initial price", initPrice);

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

      const initialPriceX64 = SqrtPriceMath.priceToSqrtPriceX64(
        initPrice,
        token0Decimals,
        token1Decimals
      );
      console.log(MathUtil.x64ToDecimal(initialPriceX64));
      const observationStateKeypair = Keypair.generate();

      await amm.methods
        .createPool(initialPriceX64, new BN(0))
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
            observationStateKeypair
          ),
        ])
        .signers([observationStateKeypair])
        .rpc();

      const [usdcVault, metaVault] = token0.equals(USDC)
        ? [tokenVault0, tokenVault1]
        : [tokenVault1, tokenVault0];

      const [tokenAccount0, tokenAccount1] = token0.equals(USDC) ?
        [usdcAccount, metaAccount] :
        [metaAccount, usdcAccount];

      // const tickUpper = MAX_TICK - (MAX_TICK % 100);
      // const tickLower = -tickUpper;
      const tickUpper = 100;
      const tickLower = -tickUpper;

      const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
        tickLower,
        TICK_SPACING
      );
      const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
        tickUpper,
        TICK_SPACING
      );

      // const positionNftMint = await createMint(
      //   banksClient,
      //   payer,
      //   poolState,
      //   poolState,
      //   0
      // );

      const positionNftMintKP = Keypair.generate();
      const positionNftMint = positionNftMintKP.publicKey;

      const positionNftAccount = token.getAssociatedTokenAddressSync(positionNftMint, payer.publicKey);

      // const positionNftAccount = await createAssociatedTokenAccount(
      //   banksClient,
      //   payer,
      //   positionNftMint,
      //   payer.publicKey
      // );

      console.log(new BN(tickLower).toBuffer('be', 4));
      console.log(i32ToBytes(tickLower));

      const [protocolPosition] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("position"),
          poolState.toBuffer(),
          i32ToBytes(tickLower),
          i32ToBytes(tickUpper)
        ],
        RAYDIUM_PROGRAM_ID
      )

      // POSITION_SEED.as_bytes(),
      //       pool_state.key().as_ref(),
      //       &tick_lower_index.to_be_bytes(),
      //       &tick_upper_index.to_be_bytes(),

      // TICK_ARRAY_SEED.as_bytes(),
      //       pool_state.key().as_ref(),
      //       &tick_array_lower_start_index.to_be_bytes(),
      // const { publicKey: tickArrayLower } = getPdaTickArrayAddress(RAYDIUM_PROGRAM_ID, poolState, tickArrayLowerStartIndex);
      const [tickArrayLower] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("tick_array"),
          poolState.toBuffer(),
          i32ToBytes(tickArrayLowerStartIndex)
        ],
        RAYDIUM_PROGRAM_ID
      );

      const [tickArrayUpper] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("tick_array"),
          poolState.toBuffer(),
          i32ToBytes(tickArrayUpperStartIndex)
        ],
        RAYDIUM_PROGRAM_ID
      );

      const [personalPosition] = PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("position"),
          positionNftMint.toBuffer()
        ],
        RAYDIUM_PROGRAM_ID
      );

      const metadataAccountKP = Keypair.generate();

      // let clmmPool;
      // const things =  await Clmm.fetchMultiplePoolInfos({
      //   connection: provider.connection,
      //   poolKeys: [poolState],
      //   chainTime: new Date().getTime() / 1000,
      //   ownerInfo: {
      //     wallet: payer.publicKey,
      //     tokenAccounts: [],
      //   },
      // })

      // const { liquidity, ammountSlippageA, amount } = Clmm.getLiquidityAmountOutFromAmountIn({
      //   poolInfo: {}
      // })

      const sqrtPriceX64A = SqrtPriceMath.getSqrtPriceX64FromTick(tickLower)
      const sqrtPriceX64B = SqrtPriceMath.getSqrtPriceX64FromTick(tickUpper)
      // console.log(SqrtPriceMath.sqrtPriceX64ToPrice(sqrtPriceX64B, token0Decimals, token1Decimals));
      const token0In = new BN(10).mul(new BN(10).pow(new BN(token0Decimals)));
      let liquidity = LiquidityMath.getLiquidityFromTokenAmountA(sqrtPriceX64A, sqrtPriceX64B, token0In, true);
      console.log(liquidity.toString());
      Clmm.getLiquidityAmountOutFromAmountIn;

      console.log(tickArrayLowerStartIndex);
      console.log(tickArrayUpperStartIndex);

      const { publicKey: metadataAccount } = getPdaMetadataKey(positionNftMint)

      const thing = await amm.methods.openPosition(
        tickLower,
        tickUpper,
        tickArrayLowerStartIndex,
        tickArrayUpperStartIndex,
        token0In,
        new BN(1_000).mul(new BN(10).pow(new BN(token1Decimals))),
        liquidity
        ).accounts({
          positionNftOwner: payer.publicKey,
          positionNftMint,
          positionNftAccount,
          metadataAccount,
          poolState,
          protocolPosition,
          tickArrayLower,
          tickArrayUpper,
          personalPosition,
          tokenAccount0,
          tokenAccount1,
          tokenVault0,
          tokenVault1,
          metadataProgram: METADATA_PROGRAM_ID,
        })
        .signers([positionNftMintKP])
        .rpc();

      console.log(await getAccount(banksClient, tokenVault0));
      console.log(await getAccount(banksClient, usdcAccount));


      // console.log(thing);

      // await thing.rpc();
        // .signers([metadataAccountKP])
        // .rpc();
      Clmm.makeOpenPositionFromLiquidityInstructionSimple;

      // await amm.methods.swap(new BN(1000), new BN(1000), new BN(1000), false)
      //   .accounts({
      //     ammConfig,
      //     poolState,
      //     inputTokenAccount: token.getAssociatedTokenAddressSync(USDC, payer.publicKey),
      //     outputTokenAccount: token.getAssociatedTokenAddressSync(META, payer.publicKey),
      //     inputVault: usdcVault,
      //     outputVault: metaVault,
      //     observationState: observationStateKeypair.publicKey,
      //     tickArray
      //   })
      //   .rpc();
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
