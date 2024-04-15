import BN from "bn.js";

const BN_TEN = new BN(10);
const PRICE_SCALE = BN_TEN.pow(new BN(12));

export class PriceMath {
  public static scalePrice(
    price: number,
    baseDecimals: number,
    quoteDecimals: number
  ): BN {
    let scaledPrice = new BN(price)
      .mul(PRICE_SCALE)
      .mul(BN_TEN.pow(new BN(baseDecimals - quoteDecimals)));

    return scaledPrice;
  }

  public static scalePrices(
    baseDecimals: number,
    quoteDecimals: number,
    ...prices: number[]
  ): BN[] {
    // Map through each price, scaling it using the scalePrice method
    return prices.map((price) =>
      this.scalePrice(price, baseDecimals, quoteDecimals)
    );
  }
}
