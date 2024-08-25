import initializeQuestion from "./unit/initializeQuestion.test";
import initializeConditionalVault from "./unit/initializeConditionalVault.test";
import resolveQuestion from "./unit/resolveQuestion.test";
import splitTokens from "./unit/splitTokens.test";
import mergeTokens from "./unit/mergeTokens.test";
import redeemTokens from "./unit/redeemTokens.test";
import binaryPredictionMarket from "./integration/binaryPredictionMarket.test";
import scalarGrantMarket from "./integration/scalarGrantMarket.test";

export default function suite() {
  it("binary prediction market", binaryPredictionMarket);
  it("scalar grant market", scalarGrantMarket);
  describe("#initialize_question", initializeQuestion);
  describe("#initialize_conditional_vault", initializeConditionalVault);
  describe("#resolve_question", resolveQuestion);
  describe("#split_tokens", splitTokens);
  describe("#merge_tokens", mergeTokens);
  describe("#redeem_tokens", redeemTokens);
}
