export interface MarketPool {
  sharesYes: number;
  sharesNo: number;
  liquidity: number;
}

export interface TradeDetails {
  investmentAmount: number;
  isBuyingYes: boolean;
}

export interface TradeResult {
  sharesAcquired: number;
  newProbabilityYes: number;
  newProbabilityNo: number;
  updatedPool: MarketPool;
  priceImpact: number;
  avgPrice: number;
}

export interface MarketState {
  id: string;
  title: string;
  category: string;
  pool: MarketPool;
  totalVolume: number;
}

/**
 * Clean floating point arithmetic rounding.
 */
function safeRound(value: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Determines the current implied probability (0 to 1) based on pool reserves.
 * Under CPMM, P(YES) = sharesNo / (sharesYes + sharesNo)
 */
export function calculateProbability(sharesYes: number, sharesNo: number): number {
  if (sharesYes <= 0 && sharesNo <= 0) return 0.5;
  const total = sharesYes + sharesNo;
  if (total === 0) return 0.5;
  return safeRound(sharesNo / total, 4);
}

/**
 * Calculates the exact number of shares a user receives for a given investment amount
 * and the resulting pool state using Constant Product Market Maker (CPMM).
 */
export function calculatePurchaseOutput(
  investmentAmount: number,
  poolYes: number,
  poolNo: number,
  isBuyingYes: boolean
): { sharesReceived: number; newPoolYes: number; newPoolNo: number } {
  if (investmentAmount <= 0 || poolYes <= 0 || poolNo <= 0) {
    return { sharesReceived: 0, newPoolYes: poolYes, newPoolNo: poolNo };
  }

  const k = poolYes * poolNo;

  if (isBuyingYes) {
    const newPoolNo = poolNo + investmentAmount;
    const newPoolYes = k / newPoolNo;
    const sharesReceived = investmentAmount + (poolYes - newPoolYes);
    return {
      sharesReceived: safeRound(sharesReceived, 4),
      newPoolYes: safeRound(newPoolYes, 4),
      newPoolNo: safeRound(newPoolNo, 4),
    };
  } else {
    const newPoolYes = poolYes + investmentAmount;
    const newPoolNo = k / newPoolYes;
    const sharesReceived = investmentAmount + (poolNo - newPoolNo);
    return {
      sharesReceived: safeRound(sharesReceived, 4),
      newPoolYes: safeRound(newPoolYes, 4),
      newPoolNo: safeRound(newPoolNo, 4),
    };
  }
}

/**
 * Proceeds from selling shares back into the pool — the mirror of
 * calculatePurchaseOutput, and the client-side twin of submit_sell.
 *
 * Selling `sharesToSell` returns `r` tokens, chosen so the constant product
 * survives: (poolYes + s - r)(poolNo - r) = k when selling YES. That is a
 * quadratic in r whose smaller root always lies strictly inside (0, poolNo),
 * so both pools stay positive.
 *
 * Intentionally not rounded to four decimals the way the buy helpers are:
 * positions carry eight, and rounding a holding up would make it impossible
 * to close a position. Round for display only.
 */
export function calculateSaleOutput(
  sharesToSell: number,
  poolYes: number,
  poolNo: number,
  isSellingYes: boolean
): { proceeds: number; newPoolYes: number; newPoolNo: number; avgPrice: number } {
  const unchanged = {
    proceeds: 0,
    newPoolYes: poolYes,
    newPoolNo: poolNo,
    avgPrice: 0,
  };

  if (sharesToSell <= 0 || poolYes <= 0 || poolNo <= 0) return unchanged;

  const sum = poolYes + poolNo + sharesToSell;
  const discriminant =
    sum * sum - 4 * sharesToSell * (isSellingYes ? poolNo : poolYes);
  if (discriminant < 0) return unchanged;

  const proceeds = (sum - Math.sqrt(discriminant)) / 2;

  const newPoolYes = isSellingYes
    ? poolYes + sharesToSell - proceeds
    : poolYes - proceeds;
  const newPoolNo = isSellingYes
    ? poolNo - proceeds
    : poolNo + sharesToSell - proceeds;

  if (proceeds <= 0 || newPoolYes <= 0 || newPoolNo <= 0) return unchanged;

  return { proceeds, newPoolYes, newPoolNo, avgPrice: proceeds / sharesToSell };
}

/**
 * Determines the price impact (slippage percentage) of the trade to display to the user.
 */
export function calculateSlippage(
  investmentAmount: number,
  poolYes: number,
  poolNo: number,
  isBuyingYes: boolean = true
): number {
  if (investmentAmount <= 0 || poolYes <= 0 || poolNo <= 0) return 0;

  const currentProb = isBuyingYes
    ? calculateProbability(poolYes, poolNo)
    : 1 - calculateProbability(poolYes, poolNo);

  const { sharesReceived } = calculatePurchaseOutput(
    investmentAmount,
    poolYes,
    poolNo,
    isBuyingYes
  );

  if (sharesReceived <= 0) return 0;

  const avgPrice = investmentAmount / sharesReceived;
  if (currentProb === 0) return 0;

  const priceImpact = Math.max(0, (avgPrice - currentProb) / currentProb);
  return safeRound(priceImpact, 4);
}

/**
 * A pure function that applies the AMM math to the current market state and returns trade results.
 */
export function executeTrade(
  marketState: MarketState,
  tradeDetails: TradeDetails
): TradeResult {
  const { investmentAmount, isBuyingYes } = tradeDetails;
  const { sharesYes, sharesNo } = marketState.pool;

  const { sharesReceived, newPoolYes, newPoolNo } = calculatePurchaseOutput(
    investmentAmount,
    sharesYes,
    sharesNo,
    isBuyingYes
  );

  const newProbabilityYes = calculateProbability(newPoolYes, newPoolNo);
  const newProbabilityNo = safeRound(1 - newProbabilityYes, 4);
  const priceImpact = calculateSlippage(
    investmentAmount,
    sharesYes,
    sharesNo,
    isBuyingYes
  );

  const avgPrice = sharesReceived > 0 ? safeRound(investmentAmount / sharesReceived, 4) : 0;

  const updatedPool: MarketPool = {
    sharesYes: newPoolYes,
    sharesNo: newPoolNo,
    liquidity: safeRound(newPoolYes * newPoolNo, 4),
  };

  return {
    sharesAcquired: sharesReceived,
    newProbabilityYes,
    newProbabilityNo,
    updatedPool,
    priceImpact,
    avgPrice,
  };
}

/**
 * Utility to create a new market pool with initial 50/50 liquidity.
 */
export function createInitialPool(initialLiquidityPerSide: number = 1000): MarketPool {
  return {
    sharesYes: initialLiquidityPerSide,
    sharesNo: initialLiquidityPerSide,
    liquidity: initialLiquidityPerSide * initialLiquidityPerSide,
  };
}
