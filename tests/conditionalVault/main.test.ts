import initializeQuestion from "./unit/initializeQuestion.test";
import initializeConditionalVault from "./unit/initializeConditionalVault.test";
import resolveQuestion from "./unit/resolveQuestion.test";
import splitTokens from "./unit/splitTokens.test";
import mergeTokens from "./unit/mergeTokens.test";
import redeemTokens from "./unit/redeemTokens.test";
import test1 from "./integration/1.test";

export default function suite() {
    describe("#initialize_question", initializeQuestion);
    describe("#initialize_conditional_vault", initializeConditionalVault);
    describe("#resolve_question", resolveQuestion);
    describe("#split_tokens", splitTokens);
    describe("#merge_tokens", mergeTokens);
    describe("#redeem_tokens", redeemTokens);
    it("integration test 1", test1);
}