"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  Clock3,
  FlaskConical,
  Menu,
  Mic2,
  Search,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DitherCardFrame } from "@/components/ui/hero-dithering";
import { EagCoin } from "@/components/ui/eag-coin";
import { calculateProbability, createInitialPool, executeTrade, type MarketPool } from "@/lib/amm";
import { useHeroMarket } from "@/lib/use-market";

interface ListMarket {
  id: string;
  icon: any;
  category: string;
  title: string;
  volume: string;
  move: string;
  color: string;
  closes: string;
  pool: MarketPool;
}

const initialGridMarkets: ListMarket[] = [
  {
    id: "m1",
    icon: FlaskConical,
    category: "Classes",
    title: "Will the Carel test happen next week?",
    volume: "18.4k EAG",
    move: "+7%",
    color: "#0b84bb",
    closes: "Closes in 3 days",
    pool: createInitialPool(1000),
  },
  {
    id: "m2",
    icon: CalendarDays,
    category: "Campus",
    title: "Will CO29 place above 3rd Place at SPW?",
    volume: "24.9k EAG",
    move: "+3%",
    color: "#a264d8",
    closes: "Closes Apr 18",
    pool: createInitialPool(1000),
  },
  {
    id: "m3",
    icon: Mic2,
    category: "Clubs",
    title: "Will Buggin Art Mag drop next week?",
    volume: "8.7k EAG",
    move: "-2%",
    color: "#e76d45",
    closes: "Closes Friday",
    pool: createInitialPool(1000),
  },
  {
    id: "m4",
    icon: Trophy,
    category: "Sports",
    title: "Will Women's varsity volleyball win Friday's home match?",
    volume: "12.1k EAG",
    move: "+5%",
    color: "#2d9a70",
    closes: "Closes in 8 hours",
    pool: createInitialPool(1000),
  },
];

const categories = [
  "Trending",
  "Classes",
  "Campus",
  "SPW",
  "Sports",
  "Clubs",
  "Teachers",
  "Seniors",
];

function EagleMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function MarketCard({
  market,
  onTrade,
}: {
  market: ListMarket;
  onTrade: (id: string, isBuyingYes: boolean) => void;
}) {
  const [side, setSide] = useState<"yes" | "no" | null>(null);
  const Icon = market.icon;
  const probYes = Math.round(
    calculateProbability(market.pool.sharesYes, market.pool.sharesNo) * 100
  );
  const probNo = 100 - probYes;

  const handleTrade = (chosenSide: "yes" | "no") => {
    setSide(chosenSide);
    onTrade(market.id, chosenSide === "yes");
  };

  const card = (
    <article className="market-card">
      <div className="market-card-top">
        <span className="category-label">{market.category}</span>
        <button className="watch-button" aria-label={`Watch ${market.title}`}>
          <Bell size={16} />
        </button>
      </div>
      <h3>{market.title}</h3>
      <div className="probability-row">
        <div>
          <strong>{probYes}%</strong>
          <span>chance</span>
        </div>
        <span className={market.move.startsWith("+") ? "move-up" : "move-down"}>
          {market.move} today
        </span>
      </div>
      <div className="trade-row">
        <button
          className={side === "yes" ? "yes selected" : "yes"}
          onClick={() => handleTrade("yes")}
        >
          Yes <span>{probYes}c</span>
        </button>
        <button
          className={side === "no" ? "no selected" : "no"}
          onClick={() => handleTrade("no")}
        >
          No <span>{probNo}c</span>
        </button>
      </div>
      <div className="card-foot">
        <span>{market.volume} traded</span>
        <span>
          <Clock3 size={12} />
          {market.closes}
        </span>
      </div>
    </article>
  );
  return (
    <DitherCardFrame icon={Icon} color={market.color}>
      {card}
    </DitherCardFrame>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Trending");
  const [orderSide, setOrderSide] = useState<"yes" | "no">("yes");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [amountInput, setAmountInput] = useState<string>("10");
  const [gridMarkets, setGridMarkets] = useState<ListMarket[]>(initialGridMarkets);

  const {
    heroMarket,
    probYes,
    probNo,
    userBalance,
    chartData,
    preview,
    previewSlippage,
    trade,
  } = useHeroMarket();

  const numericAmount = parseFloat(amountInput) || 0;
  const previewResult = preview(numericAmount, orderSide === "yes");
  const potentialReturn = previewResult ? Math.floor(previewResult.sharesReceived) : 0;
  const priceImpact = previewSlippage(numericAmount, orderSide === "yes");

  const handleHeroTrade = () => {
    if (numericAmount <= 0) return;
    trade({ investmentAmount: numericAmount, isBuyingYes: orderSide === "yes" });
  };

  const handleGridMarketTrade = (id: string, isBuyingYes: boolean) => {
    const tradeAmount = 10;
    if (userBalance < tradeAmount) return;

    setGridMarkets((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const result = executeTrade(
          {
            id: m.id,
            title: m.title,
            category: m.category,
            pool: m.pool,
            totalVolume: 0,
          },
          { investmentAmount: tradeAmount, isBuyingYes }
        );
        return {
          ...m,
          pool: result.updatedPool,
        };
      })
    );
  };

  const visibleMarkets = gridMarkets.filter(
    (market) =>
      market.title.toLowerCase().includes(query.toLowerCase()) &&
      (activeCategory === "Trending" || market.category === activeCategory)
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="wordmark" href="/">
          <EagleMark />
          <span>EagleMarket</span>
        </Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          <a className="active" href="#markets">
            Markets
          </a>
          <a href="#portfolio">My picks</a>
          <a href="#rankings">Rankings</a>
        </nav>
        <label className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets"
          />
          <kbd>Cmd K</kbd>
        </label>
        <div className="auth-actions">
          <button className="token-balance">
            <EagCoin size="sm" /> {userBalance.toLocaleString()} EAG
          </button>
          <button className="signup">Profile</button>
        </div>
        <button
          className="mobile-menu"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <Menu />
        </button>
      </header>

      {mobileOpen && (
        <nav className="mobile-nav">
          <a href="#markets">Markets</a>
          <a href="#live">Live</a>
          <a href="#portfolio">My picks</a>
          <button>Profile</button>
        </nav>
      )}

      <div className="category-bar">
        <div className="category-scroll">
          {categories.map((category) => (
            <button
              key={category}
              className={activeCategory === category ? "active" : ""}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <main>
        <section className="hero-market" id="markets">
          <div className="hero-copy">
            <h1>Will the next Chem Honors Liu test average be above 82%?</h1>
            <p className="hero-description">
              Resolves Yes if the official class average posted by Ms. Liu is
              82.1% or higher. Retakes are not included.
            </p>

            <div className="outcome-summary">
              <div className={orderSide === "yes" ? "outcome active" : "outcome"}>
                <span className="outcome-dot yes-dot" />
                <div>
                  <span>YES</span>
                  <strong>{probYes}%</strong>
                </div>
              </div>
              <div className={orderSide === "no" ? "outcome active" : "outcome"}>
                <span className="outcome-dot no-dot" />
                <div>
                  <span>NO</span>
                  <strong>{probNo}%</strong>
                </div>
              </div>
            </div>
            <div className="market-stats">
              <span>
                <strong>{heroMarket.totalVolume.toLocaleString()} EAG</strong> volume
              </span>
              <span>
                <strong>286</strong> predictors
              </span>
              <span>
                <Clock3 size={15} />
                <strong>3 days</strong> left
              </span>
            </div>
          </div>

          <div className="chart-panel" aria-label="Market probability chart">
            <div className="chart-header">
              <div className="chart-legend">
                <span>
                  <i className="legend-dot yes-line" />
                  Yes <strong>{probYes}%</strong>
                </span>
                <span>
                  <i className="legend-dot no-line" />
                  No <strong>{probNo}%</strong>
                </span>
              </div>
              <div className="range-tabs">
                <button>1D</button>
                <button>1W</button>
                <button className="active">1M</button>
                <button>ALL</button>
              </div>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 15, right: 8, bottom: 0, left: -6 }}
                >
                  <CartesianGrid
                    stroke="oklch(0.83 0 0)"
                    strokeDasharray="2 7"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "oklch(0.53 0.02 240)", fontSize: 11 }}
                    interval={1}
                  />
                  <YAxis
                    orientation="right"
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickLine={false}
                    axisLine={false}
                    width={38}
                    tick={{ fill: "oklch(0.53 0.02 240)", fontSize: 11 }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "none",
                      borderRadius: 8,
                      boxShadow: "0 3px 8px oklch(0.2 0.03 240 / .14)",
                      fontSize: 12,
                    }}
                    formatter={(value, name) => [
                      `${value}%`,
                      name === "yes" ? "Yes" : "No",
                    ]}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="no"
                    stroke="oklch(0.62 0.2 25)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: "oklch(0.62 0.2 25)",
                      strokeWidth: 0,
                    }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="yes"
                    stroke="oklch(0.58 0.18 255)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: "oklch(0.58 0.18 255)",
                      strokeWidth: 0,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <aside className="order-panel">
            <div className="order-title">
              <span>Make a prediction</span>
              <span>Balance {userBalance.toLocaleString()} EAG</span>
            </div>
            <div className="side-toggle">
              <button
                className={orderSide === "yes" ? "active yes" : ""}
                onClick={() => setOrderSide("yes")}
              >
                Yes <span>{probYes}c</span>
              </button>
              <button
                className={orderSide === "no" ? "active no" : ""}
                onClick={() => setOrderSide("no")}
              >
                No <span>{probNo}c</span>
              </button>
            </div>
            <label className="amount-label">Play tokens</label>
            <div className="amount-input">
              <EagCoin size="sm" />
              <input
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0"
              />
              <button>
                EAG <ChevronDown size={14} />
              </button>
            </div>
            <div className="quick-amounts">
              <button onClick={() => setAmountInput("10")}>10</button>
              <button onClick={() => setAmountInput("25")}>25</button>
              <button onClick={() => setAmountInput("50")}>50</button>
              <button onClick={() => setAmountInput(userBalance.toString())}>
                Max
              </button>
            </div>
            <div className="order-summary">
              <span>Potential return</span>
              <strong>{potentialReturn} EAG</strong>
            </div>
            {priceImpact > 0 && (
              <div className="text-xs text-slate-500 mt-1">
                Slippage impact: {(priceImpact * 100).toFixed(1)}%
              </div>
            )}
            <button
              className="review-button"
              onClick={handleHeroTrade}
              disabled={numericAmount <= 0 || numericAmount > userBalance}
            >
              Confirm prediction <ArrowRight size={17} />
            </button>
            <p>
              EAG are free play tokens with no cash value. Correct picks settle at
              100 EAG per contract.
            </p>
          </aside>
        </section>

        <section className="market-section mt-12">
          <div className="section-heading">
            <div>
              <h2>Markets moving at school</h2>
              <p>What Eagles are predicting today</p>
            </div>
            <button>
              View all markets <ArrowRight size={17} />
            </button>
          </div>
          <div className="market-grid">
            {visibleMarkets.length ? (
              visibleMarkets.map((market) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  onTrade={handleGridMarketTrade}
                />
              ))
            ) : (
              <div className="empty-state">No markets match this search yet.</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
