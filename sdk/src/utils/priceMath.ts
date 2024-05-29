import BN from "bn.js";

const BN_TEN = new BN(10);
const PRICE_SCALE = BN_TEN.pow(new BN(12));
const PRICE_SCALE_NUMBER = 1e12;

export class PriceMath {
  public static getAmmPriceFromReserves(
    baseReserves: BN,
    quoteReserves: BN
  ): BN {
    return quoteReserves.mul(PRICE_SCALE).div(baseReserves);
  }

  public static getChainAmount(humanAmount: number, decimals: number): BN {
    // you have to do it this weird way because BN can't be constructed with
    // numbers larger than 2**50
    const [integerPart, fractionalPart = ""] = humanAmount
      .toString()
      .split(".");
    return new BN(integerPart + fractionalPart)
      .mul(new BN(10).pow(new BN(decimals)))
      .div(new BN(10).pow(new BN(fractionalPart.length)));
  }

  public static getHumanAmount(chainAmount: BN, decimals: number): number {
    return chainAmount.toNumber() / 10 ** decimals;
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
    let price1e12 = new BN(humanPrice * PRICE_SCALE_NUMBER);

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

  public static addSlippage(chainAmount: BN, slippageBps: BN): BN {
    return chainAmount.mul(slippageBps.addn(10_000)).divn(10_000);
  }

  public static subtractSlippage(chainAmount: BN, slippageBps: BN): BN {
    return chainAmount.mul(new BN(10_000).sub(slippageBps)).divn(10_000);
  }
}
