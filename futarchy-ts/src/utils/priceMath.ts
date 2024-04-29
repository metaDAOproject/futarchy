import BN from "bn.js";

const BN_TEN = new BN(10);
const PRICE_SCALE = BN_TEN.pow(new BN(12));

export class PriceMath {
  public static getAmmPriceFromReserves(
    baseReserves: BN,
    quoteReserves: BN
  ): BN {
    return quoteReserves.mul(PRICE_SCALE).div(baseReserves);
  }

  public static getHumanPrice(
    ammPrice: BN,
    baseDecimals: number,
    quoteDecimals: number
  ): number {
    let decimalScalar = BN_TEN.pow(new BN(quoteDecimals - baseDecimals).abs());

    let price1e12 =
      quoteDecimals > baseDecimals
        ? ammPrice.div(decimalScalar)
        : ammPrice.mul(decimalScalar);

    return price1e12.toNumber() / 1e12;
  }

  public static getAmmPrice(
    humanPrice: number,
    baseDecimals: number,
    quoteDecimals: number
  ): BN {
    let price1e12 = PRICE_SCALE.muln(humanPrice);

    let decimalScalar = BN_TEN.pow(new BN(quoteDecimals - baseDecimals).abs());

    let scaledPrice =
      quoteDecimals > baseDecimals
        ? price1e12.mul(decimalScalar)
        : price1e12.div(decimalScalar);

    return scaledPrice;
  }

  public static getAmmPrices(
    baseDecimals: number,
    quoteDecimals: number,
    ...prices: number[]
  ): BN[] {
    // Map through each price, scaling it using the scalePrice method
    return prices.map((price) =>
      this.getAmmPrice(price, baseDecimals, quoteDecimals)
    );
  }

  public static scale(number: number, decimals: number): BN {
    return new BN(number * 10 ** decimals);
    // return new BN(number).mul(new BN(10).pow(new BN(decimals)));
  }
}
