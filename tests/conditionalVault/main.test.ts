import initializeQuestion from "./unit/initializeQuestion.test";
import initializeConditionalVault from "./unit/initializeConditionalVault.test";
import test1 from "./integration/1.test";

export default function suite() {
    describe("#initialize_question", initializeQuestion);
    describe("#initialize_conditional_vault", initializeConditionalVault);
    it("integration test 1", test1);
}