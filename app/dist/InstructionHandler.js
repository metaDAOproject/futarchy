"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstructionHandler = void 0;
const web3_js_1 = require("@solana/web3.js");
const utils_1 = require("./utils");
class InstructionHandler {
    instructions;
    signers;
    client;
    computeUnits = 200_000;
    microLamportsPerComputeUnit = 0;
    preInstructions;
    postInstructions;
    constructor(instructions, signers, client) {
        this.instructions = instructions;
        this.signers = new Set();
        signers.forEach((s) => this.signers.add(s));
        this.client = client;
        this.preInstructions = [];
        this.postInstructions = [];
    }
    addPreInstructions(instructions, signers = []) {
        this.preInstructions = [...instructions, ...this.preInstructions];
        signers.forEach((s) => this.signers.add(s));
        return this;
    }
    addPostInstructions(instructions, signers = []) {
        this.postInstructions = [...instructions, ...this.postInstructions];
        signers.forEach((s) => this.signers.add(s));
        return this;
    }
    async getVersionedTransaction(blockhash) {
        this.instructions = [
            ...this.preInstructions,
            ...this.instructions,
            ...this.postInstructions,
        ];
        if (this.microLamportsPerComputeUnit != 0) {
            this.instructions = [
                (0, utils_1.addPriorityFee)(this.microLamportsPerComputeUnit),
                ...this.instructions,
            ];
        }
        if (this.computeUnits != 200_000) {
            this.instructions = [
                (0, utils_1.addComputeUnits)(this.computeUnits),
                ...this.instructions,
            ];
        }
        const message = new web3_js_1.TransactionMessage({
            payerKey: this.client.provider.wallet.publicKey,
            recentBlockhash: blockhash,
            instructions: this.instructions,
        }).compileToV0Message(this.client.luts);
        let tx = new web3_js_1.VersionedTransaction(message);
        let signersArray = Array.from(this.signers);
        if (this.signers.size) {
            tx.sign(signersArray);
        }
        return tx;
    }
    setComputeUnits(computeUnits) {
        this.computeUnits = computeUnits;
        return this;
    }
    setPriorityFee(microLamportsPerComputeUnit) {
        this.microLamportsPerComputeUnit = microLamportsPerComputeUnit;
        return this;
    }
    async bankrun(banksClient) {
        try {
            let [blockhash] = (await banksClient.getLatestBlockhash());
            const tx = await this.getVersionedTransaction(blockhash);
            return await banksClient.processTransaction(tx);
        }
        catch (e) {
            console.log(e);
            throw e;
        }
    }
    async rpc(opts = { skipPreflight: true }) {
        try {
            let blockhash = (await this.client.provider.connection.getLatestBlockhash()).blockhash;
            let tx = await this.getVersionedTransaction(blockhash);
            tx = await this.client.provider.wallet.signTransaction(tx);
            return await this.client.provider.connection.sendRawTransaction(tx.serialize(), opts);
        }
        catch (e) {
            console.log(e);
            throw e;
        }
    }
}
exports.InstructionHandler = InstructionHandler;
//# sourceMappingURL=InstructionHandler.js.map