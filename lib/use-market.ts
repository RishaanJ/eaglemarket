"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  calculateProbability,
  calculatePurchaseOutput,
  calculateSlippage,
  createInitialPool,
  executeTrade,
  type MarketPool,
  type MarketState,
  type TradeDetails,
  type TradeResult,
} from "./amm";

export interface MarketItem extends MarketState {
  icon: LucideIcon;
  color: string;
  closes: string;
  move: string;
}

export interface ChartDataPoint {
  day: string;
  yes: number;
  no: number;
}

const initialHeroPool: MarketPool = createInitialPool(1000);

const initialHeroState: MarketState = {
  id: "hero-chem",
  title: "Will the next Chem Honors Liu test average be above 82%?",
  category: "Classes",
  pool: initialHeroPool,
  totalVolume: 18400,
};

const defaultChartData: ChartDataPoint[] = [
  { day: "Jul 14", yes: 50, no: 50 },
  { day: "Jul 18", yes: 50, no: 50 },
  { day: "Jul 22", yes: 50, no: 50 },
  { day: "Jul 26", yes: 50, no: 50 },
  { day: "Jul 30", yes: 50, no: 50 },
  { day: "Aug 3", yes: 50, no: 50 },
  { day: "Aug 6", yes: 50, no: 50 },
  { day: "Aug 10", yes: 50, no: 50 },
];

export function useHeroMarket() {
  const [heroMarket, setHeroMarket] = useState<MarketState>(initialHeroState);
  const [chartData, setChartData] = useState<ChartDataPoint[]>(defaultChartData);
  const [userBalance, setUserBalance] = useState<number>(2450);

  const probYes = Math.round(calculateProbability(heroMarket.pool.sharesYes, heroMarket.pool.sharesNo) * 100);
  const probNo = 100 - probYes;

  const preview = (amount: number, isBuyingYes: boolean) => {
    if (amount <= 0) return null;
    return calculatePurchaseOutput(
      amount,
      heroMarket.pool.sharesYes,
      heroMarket.pool.sharesNo,
      isBuyingYes
    );
  };

  const previewSlippage = (amount: number, isBuyingYes: boolean) => {
    return calculateSlippage(
      amount,
      heroMarket.pool.sharesYes,
      heroMarket.pool.sharesNo,
      isBuyingYes
    );
  };

  const trade = (details: TradeDetails): TradeResult | null => {
    if (details.investmentAmount <= 0 || details.investmentAmount > userBalance) {
      return null;
    }

    const result = executeTrade(heroMarket, details);

    setHeroMarket((prev) => ({
      ...prev,
      pool: result.updatedPool,
      totalVolume: Math.round(prev.totalVolume + details.investmentAmount),
    }));

    setUserBalance((prev) => prev - details.investmentAmount);

    const newYesPct = Math.round(result.newProbabilityYes * 100);
    const newNoPct = 100 - newYesPct;

    const todayStr = "Today";
    setChartData((prev) => [
      ...prev,
      { day: todayStr, yes: newYesPct, no: newNoPct },
    ]);

    return result;
  };

  return {
    heroMarket,
    probYes,
    probNo,
    userBalance,
    chartData,
    preview,
    previewSlippage,
    trade,
  };
}
