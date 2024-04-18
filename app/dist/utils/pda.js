"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getATA = exports.getAmmAuthAddr = exports.getAmmPositionAddr = exports.getAmmAddr = exports.getProposalVaultAddr = exports.getProposalInstructionsAddr = exports.getProposalAddr = exports.getDaoTreasuryAddr = exports.getDaoAddr = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const numbers_1 = require("./numbers");
const spl_token_1 = require("@solana/spl-token");
const getDaoAddr = (programId) => {
    return web3_js_1.PublicKey.findProgramAddressSync([anchor_1.utils.bytes.utf8.encode("WWCACOTMICMIBMHAFTTWYGHMB")], programId);
};
exports.getDaoAddr = getDaoAddr;
const getDaoTreasuryAddr = (programId) => {
    let [dao] = (0, exports.getDaoAddr)(programId);
    return web3_js_1.PublicKey.findProgramAddressSync([anchor_1.utils.bytes.utf8.encode("dao_treasury"), dao.toBuffer()], programId);
};
exports.getDaoTreasuryAddr = getDaoTreasuryAddr;
const getProposalAddr = (programId, proposalNumber) => {
    return web3_js_1.PublicKey.findProgramAddressSync([anchor_1.utils.bytes.utf8.encode("proposal__"), (0, numbers_1.numToBytes64LE)(proposalNumber)], programId);
};
exports.getProposalAddr = getProposalAddr;
const getProposalInstructionsAddr = (programId, proposal) => {
    return web3_js_1.PublicKey.findProgramAddressSync([anchor_1.utils.bytes.utf8.encode("proposal_instructions"), proposal.toBuffer()], programId);
};
exports.getProposalInstructionsAddr = getProposalInstructionsAddr;
const getProposalVaultAddr = (programId, proposal) => {
    return web3_js_1.PublicKey.findProgramAddressSync([anchor_1.utils.bytes.utf8.encode("proposal_vault"), proposal.toBuffer()], programId);
};
exports.getProposalVaultAddr = getProposalVaultAddr;
const getAmmAddr = (programId, baseMint, quoteMint) => {
    return web3_js_1.PublicKey.findProgramAddressSync([
        anchor_1.utils.bytes.utf8.encode("amm__"),
        baseMint.toBuffer(),
        quoteMint.toBuffer(),
    ], programId);
};
exports.getAmmAddr = getAmmAddr;
const getAmmPositionAddr = (programId, amm, user) => {
    return web3_js_1.PublicKey.findProgramAddressSync([anchor_1.utils.bytes.utf8.encode("amm_position"), amm.toBuffer(), user.toBuffer()], programId);
};
exports.getAmmPositionAddr = getAmmPositionAddr;
const getAmmAuthAddr = (programId) => {
    return web3_js_1.PublicKey.findProgramAddressSync([anchor_1.utils.bytes.utf8.encode("amm_auth")], programId);
};
exports.getAmmAuthAddr = getAmmAuthAddr;
const getATA = (mint, owner) => {
    return web3_js_1.PublicKey.findProgramAddressSync([owner.toBuffer(), spl_token_1.TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID);
};
exports.getATA = getATA;
//# sourceMappingURL=pda.js.map