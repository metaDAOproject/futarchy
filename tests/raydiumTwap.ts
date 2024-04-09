import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import * as token from "@solana/spl-token";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { BankrunProvider } from "anchor-bankrun";
import { Clmm, TxVersion } from "@raydium-io/raydium-sdk";
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
import Decimal from 'decimal.js';

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
    amm,
    payer,
    context: ProgramTestContext,
    banksClient: BanksClient,
    USDC,
    META;

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

    amm = new anchor.Program<AmmV3>(
      AmmV3IDL,
      RAYDIUM_PROGRAM_ID,
      provider
    );

    payer = provider.wallet.payer;

    USDC = await createMint(
      banksClient,
      payer,
      payer.publicKey,
      payer.publicKey,
      6
    );

    META = await createMint(banksClient, payer, payer.publicKey, payer.publicKey, 9);
  });

  describe("#initialize_pool_twap", async function () {
    it("initializes pool TWAPs", async function () {
      const ammConfigIndex = 3;
      const [ammConfig] = PublicKey.findProgramAddressSync([
        anchor.utils.bytes.utf8.encode("amm_config"),
        new BN(0).toBuffer("be", 2)
      ],
      RAYDIUM_PROGRAM_ID)
      // console.log(provider.connection);
      await amm.methods.createAmmConfig(0, 100, 100, 0, 0)
        .accounts({
          owner: payer.publicKey,
          ammConfig,
        })
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
      // Clmm.makeCreatePoolInstructionSimple()
    });
  });

  describe("#crank", async function () {
    it("cranks - test #1");

    it("cranks - test #2");

    it("cranks - test #3");
  });
});
 