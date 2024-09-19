import { AmmClient } from "@metadaoproject/futarchy/v0.4";
import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import { createMint, mintTo } from "spl-token-bankrun";
import * as anchor from "@coral-xyz/anchor";
import { advanceBySlots } from "../../utils.js";
import { BN } from "bn.js";

export default function suite() {
    let ammClient: AmmClient;
    let META: PublicKey;
    let USDC: PublicKey;
    let amm: PublicKey;

    beforeEach(async function () {
        ammClient = this.ammClient;
        META = await createMint(
            this.banksClient,
            this.payer,
            this.payer.publicKey,
            this.payer.publicKey,
            9
        );
        USDC = await createMint(
            this.banksClient,
            this.payer,
            this.payer.publicKey,
            this.payer.publicKey,
            6
        );

        await this.createTokenAccount(META, this.payer.publicKey);
        await this.createTokenAccount(USDC, this.payer.publicKey);

        await this.mintTo(META, this.payer.publicKey, this.payer, 100 * 10 ** 9);
        await this.mintTo(USDC, this.payer.publicKey, this.payer, 10_000 * 10 ** 6);

        let proposal = Keypair.generate().publicKey;
        amm = await ammClient.createAmm(proposal, META, USDC, 500);

        await ammClient
            .addLiquidityIx(
                amm,
                META,
                USDC,
                new BN(10_000 * 10 ** 6),
                new BN(10 * 10 ** 9),
                new BN(0)
            )
            .rpc();
    });

    it("updates oracle and sequence number when crankThatTwap is called", async function () {
        const initialAmm = await ammClient.getAmm(amm);
        const initialSeqNum = initialAmm.seqNum;
        const initialLastUpdatedSlot = initialAmm.oracle.lastUpdatedSlot;
        const initialAggregator = initialAmm.oracle.aggregator;

        // Advance slots to simulate time passing
        // this needs to be greater than 150 because the twap oracle 
        // only updates when the slot difference is greater than 150 (1 minute in slots)
        await advanceBySlots(this.context, 200n);

        // Call crankThatTwap
        await ammClient.crankThatTwap(amm);

        const updatedAmm = await ammClient.getAmm(amm);

        // Check if sequence number has increased
        assert.isTrue(
            updatedAmm.seqNum.gt(initialSeqNum),
            "Sequence number should increase after crankThatTwap"
        );

        // Check if lastUpdatedSlot has been updated
        assert.isTrue(
            updatedAmm.oracle.lastUpdatedSlot.gt(initialLastUpdatedSlot),
            "Last updated slot should increase after crankThatTwap"
        );


        // Check if aggregator has been updated
        assert.notDeepEqual(
            updatedAmm.oracle.aggregator,
            initialAggregator,
            "Aggregator should be updated after crankThatTwap"
        );

        // Verify that the TWAP is calculated correctly
        const expectedTwap = updatedAmm.oracle.aggregator.div(
            updatedAmm.oracle.lastUpdatedSlot.sub(updatedAmm.createdAtSlot)
        );
        const calculatedTwap = ammClient.getTwap(updatedAmm);
        assert.isTrue(
            calculatedTwap.eq(expectedTwap),
            "Calculated TWAP should match the expected value"
        );
    });

    it("updates oracle multiple times with consecutive crankThatTwap calls", async function () {
        const initialAmm = await ammClient.getAmm(amm);
        const initialSeqNum = initialAmm.seqNum;

        for (let i = 0; i < 3; i++) {
            await advanceBySlots(this.context, 151n);
            // to prevent a "this transaction has already been processed" error
            const previousAmm = await ammClient.getAmm(amm);
            await ammClient.crankThatTwapIx(amm).preInstructions([ComputeBudgetProgram.setComputeUnitLimit({
                units: 100_000 + i
            })]).rpc();

            const updatedAmm = await ammClient.getAmm(amm);

            // Check if lastObservation is increasing
            if (i > 0) {
                assert.isTrue(
                    updatedAmm.oracle.lastObservation.gt(previousAmm.oracle.lastObservation),
                    `Last observation should increase after crankThatTwap call ${i + 1}`
                );
            }

            // Check if oracle is getting updated
            assert.notEqual(
                updatedAmm.oracle.lastUpdatedSlot.toString(),
                initialAmm.oracle.lastUpdatedSlot.toString(),
                `Oracle should be updated after crankThatTwap call ${i + 1}`
            );


            assert.isTrue(
                updatedAmm.seqNum.gt(initialSeqNum.addn(i)),
                `Sequence number should increase after crankThatTwap call ${i + 1}`
            );
        }

        const finalAmm = await ammClient.getAmm(amm);
        assert.isTrue(
            finalAmm.seqNum.eq(initialSeqNum.addn(3)),
            "Sequence number should increase by 3 after 3 crankThatTwap calls"
        );
    });
}
