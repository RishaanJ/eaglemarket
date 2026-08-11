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
  Flag,
  FlaskConical,
  Footprints,
  Lock,
  Menu,
  Mic2,
  Search,
  Thermometer,
  Trophy,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DitherCardFrame } from "@/components/ui/hero-dithering";
import { EagCoin } from "@/components/ui/eag-coin";
import {
  calculateProbability,
  createInitialPool,
  executeTrade,
  type MarketPool,
} from "@/lib/amm";
import { useHeroMarket } from "@/lib/use-market";
import {
  getAllFallMarkets,
  type ExtendedMarket,
  type MarketStatus,
} from "@/lib/markets-data";

// ---------------------------------------------------------------------------
// Icon resolver: maps string icon names from market data to lucide components
// ---------------------------------------------------------------------------
const ICON_MAP: Record<string, any> = {
  Trophy,
  Flag,
  Footprints,
  Waves,
  Thermometer,
  FlaskConical,
  CalendarDays,
  Mic2,
};

function resolveIcon(iconName: string) {
  return ICON_MAP[iconName] || Trophy;
}

// ---------------------------------------------------------------------------
// ListMarket now carries a status field for locked-state enforcement
// ---------------------------------------------------------------------------
interface ListMarket {
  id: string;
  icon: any;
  category: string;
  subcategory?: string;
  title: string;
  volume: string;
  move: string;
  color: string;
  closes: string;
  pool: MarketPool;
  status: MarketStatus;
}

// ---------------------------------------------------------------------------
// Convert ExtendedMarket to the ListMarket shape used by the grid
// ---------------------------------------------------------------------------
function extendedToListMarket(m: ExtendedMarket): ListMarket {
  return {
    id: m.id,
    icon: resolveIcon(m.icon),
    category: m.category,
    subcategory: m.subcategory,
    title: m.title,
    volume: m.totalVolume > 0 ? `${(m.totalVolume / 1000).toFixed(1)}k EAG` : "0 EAG",
    move: "--",
    color: m.color,
    closes: m.closes,
    pool: m.pool,
    status: m.status,
  };
}

// ---------------------------------------------------------------------------
// Original "core" markets (existing ones from before)
// ---------------------------------------------------------------------------
const coreMarkets: ListMarket[] = [
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
    status: "OPEN",
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
    status: "OPEN",
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
    status: "OPEN",
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
    status: "OPEN",
  },
];

// ---------------------------------------------------------------------------
// Categories (expanded with Weather)
// ---------------------------------------------------------------------------
const categories = [
  "Trending",
  "Classes",
  "Campus",
  "SPW",
  "Sports",
  "Clubs",
  "Teachers",
  "Seniors",
  "Weather",
];

// ---------------------------------------------------------------------------
// Sub-categories for sports filtering
// ---------------------------------------------------------------------------
const sportSubcategories = [
  "All Sports",
  "Football",
  "Girls Flag Football",
  "Cross Country",
  "Girls Volleyball",
  "Girls Tennis",
  "Girls Golf",
  "Boys Water Polo",
  "Girls Water Polo",
];

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function EagleMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function LockedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{
        background: "oklch(0.92 0.02 240)",
        color: "oklch(0.45 0.03 240)",
      }}
    >
      <Lock size={10} />
      Locked
    </span>
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
  const isLocked = market.status === "LOCKED";
  const probYes = Math.round(
    calculateProbability(market.pool.sharesYes, market.pool.sharesNo) * 100
  );
  const probNo = 100 - probYes;

  const handleTrade = (chosenSide: "yes" | "no") => {
    if (isLocked) return;
    setSide(chosenSide);
    onTrade(market.id, chosenSide === "yes");
  };

  const card = (
    <article className={`market-card${isLocked ? " market-card-locked" : ""}`}>
      <div className="market-card-top">
        <span className="category-label">
          {market.subcategory || market.category}
        </span>
        <div className="flex items-center gap-2">
          {isLocked && <LockedBadge />}
          <button className="watch-button" aria-label={`Watch ${market.title}`}>
            <Bell size={16} />
          </button>
        </div>
      </div>
      <h3>{market.title}</h3>
      <div className="probability-row">
        <div>
          <strong>{probYes}%</strong>
          <span>chance</span>
        </div>
        {!isLocked && (
          <span className={market.move.startsWith("+") ? "move-up" : "move-down"}>
            {market.move} today
          </span>
        )}
      </div>
      <div className="trade-row">
        <button
          className={side === "yes" ? "yes selected" : "yes"}
          onClick={() => handleTrade("yes")}
          disabled={isLocked}
          title={isLocked ? "This market is locked and not yet open for trading" : undefined}
        >
          Yes <span>{probYes}c</span>
        </button>
        <button
          className={side === "no" ? "no selected" : "no"}
          onClick={() => handleTrade("no")}
          disabled={isLocked}
          title={isLocked ? "This market is locked and not yet open for trading" : undefined}
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Trending");
  const [activeSportSub, setActiveSportSub] = useState("All Sports");
  const [orderSide, setOrderSide] = useState<"yes" | "no">("yes");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [amountInput, setAmountInput] = useState<string>("10");

  // Merge core markets with generated fall markets
  const fallMarkets = useMemo(() => getAllFallMarkets().map(extendedToListMarket), []);
  const [gridMarkets, setGridMarkets] = useState<ListMarket[]>([
    ...coreMarkets,
    ...fallMarkets,
  ]);

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
        // Reject trades on locked markets
        if (m.status === "LOCKED") return m;
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

  // Filter logic: category + sport subcategory + search query
  const visibleMarkets = gridMarkets.filter((market) => {
    const matchesQuery = market.title.toLowerCase().includes(query.toLowerCase());
    const matchesCategory =
      activeCategory === "Trending" || market.category === activeCategory;
    const matchesSportSub =
      activeCategory !== "Sports" ||
      activeSportSub === "All Sports" ||
      market.subcategory === activeSportSub;
    return matchesQuery && matchesCategory && matchesSportSub;
  });

  // Count locked vs open for display
  const lockedCount = visibleMarkets.filter((m) => m.status === "LOCKED").length;
  const openCount = visibleMarkets.filter((m) => m.status === "OPEN").length;

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
              onClick={() => {
                setActiveCategory(category);
                if (category !== "Sports") setActiveSportSub("All Sports");
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {activeCategory === "Sports" && (
        <div className="category-bar" style={{ borderTop: "none", paddingTop: 0 }}>
          <div className="category-scroll">
            {sportSubcategories.map((sub) => (
              <button
                key={sub}
                className={activeSportSub === sub ? "active" : ""}
                onClick={() => setActiveSportSub(sub)}
                style={{ fontSize: "0.8rem" }}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      )}

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
              <p>
                {openCount > 0 && `${openCount} open`}
                {openCount > 0 && lockedCount > 0 && " / "}
                {lockedCount > 0 && `${lockedCount} locked`}
                {openCount === 0 && lockedCount === 0 && "What Eagles are predicting today"}
              </p>
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
