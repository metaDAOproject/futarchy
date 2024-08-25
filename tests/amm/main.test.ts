import initializeAmm from "./unit/initializeAmm.test";
import addLiquidity from "./unit/addLiquidity.test";
import swap from "./unit/swap.test";
import removeLiquidity from "./unit/removeLiquidity.test";
import ammLifecycle from "./integration/ammLifecycle.test";

export default function suite() {
  describe("#initialize_amm", initializeAmm);
  describe("#add_liquidity", addLiquidity);
  describe("#swap", swap);
  describe("#remove_liquidity", removeLiquidity);
  it("AMM lifecycle", ammLifecycle);
}
