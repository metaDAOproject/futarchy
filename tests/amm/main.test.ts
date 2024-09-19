import initializeAmm from "./unit/initializeAmm.test.js";
import addLiquidity from "./unit/addLiquidity.test.js";
import swap from "./unit/swap.test.js";
import removeLiquidity from "./unit/removeLiquidity.test.js";
import ammLifecycle from "./integration/ammLifecycle.test.js";
import crankThatTwap from "./unit/crankThatTwap.test.js";

export default function suite() {
  describe("#initialize_amm", initializeAmm);
  describe("#add_liquidity", addLiquidity);
  describe("#swap", swap);
  describe("#crank_that_twap", crankThatTwap);
  describe("#remove_liquidity", removeLiquidity);
  it("AMM lifecycle", ammLifecycle);
}
