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
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  FlaskConical,
  LoaderCircle,
  Menu,
  Mic2,
  Search,
  Settings,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { AppLoadingSkeleton } from "@/components/ui/app-loading-skeleton";
import { DitherCardFrame } from "@/components/ui/hero-dithering";
import { EagCoin } from "@/components/ui/eag-coin";
import { MotionReveal } from "@/components/ui/motion-reveal";
import { NotificationPanel } from "@/components/notification-panel";
import { calculateProbability } from "@/lib/amm";
import { marketSlug } from "@/lib/slug";
import { useMarketData, type SyncedMarket } from "@/lib/use-market";

const categoryIcons: Record<string, LucideIcon> = {
  classes: FlaskConical,
  campus: CalendarDays,
  spw: Trophy,
  sports: Trophy,
  clubs: Mic2,
};

function closeLabel(closesAt: string) {
  return `Closes ${new Date(closesAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
}

function EagleMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

type TradeFeedback = {
  id: number;
  side: "yes" | "no";
  amount: number;
  question: string;
};

const celebrationParticles = Array.from({ length: 16 }, (_, index) => ({
  left: 8 + ((index * 29) % 84),
  delay: (index % 4) * 28,
  drift: -34 + ((index * 17) % 68),
  rotation: 120 + ((index * 47) % 240),
}));

function TradeConfirmation({ feedback }: { feedback: TradeFeedback }) {
  return (
    <div className="trade-confirmation" role="status" aria-live="polite">
      <div className="confirmation-burst" aria-hidden="true">
        {celebrationParticles.map((particle, index) => (
          <i
            key={`${feedback.id}-${index}`}
            style={
              {
                left: `${particle.left}%`,
                "--particle-delay": `${particle.delay}ms`,
                "--particle-drift": `${particle.drift}px`,
                "--particle-rotation": `${particle.rotation}deg`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <span className="confirmation-check" aria-hidden="true">
        <Check size={16} strokeWidth={2.5} />
      </span>
      <div>
        <strong>Prediction confirmed</strong>
        <span>
          {feedback.amount.toLocaleString()} EAG on {feedback.side.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function MarketCard({
  market,
  onTrade,
}: {
  market: SyncedMarket;
  onTrade: (id: number, isBuyingYes: boolean) => Promise<void>;
}) {
  const [side, setSide] = useState<"yes" | "no" | null>(null);
  const reducedMotion = useReducedMotion();
  const Icon = categoryIcons[market.category.slug] ?? CalendarDays;
  const probYes = Math.round(
    calculateProbability(Number(market.pool_yes), Number(market.pool_no)) * 100
  );
  const probNo = 100 - probYes;

  const handleTrade = (chosenSide: "yes" | "no") => {
    setSide(chosenSide);
    void onTrade(market.id, chosenSide === "yes");
  };

  const card = (
    <article className="market-card">
      <Link
        className="market-card-link"
        href={`/markets/${marketSlug(market)}`}
        aria-label={`Open market: ${market.question}`}
      />
      <div className="market-card-top">
        <span className="category-label">{market.category.name}</span>
        <button className="watch-button" aria-label={`Watch ${market.question}`}>
          <Bell size={16} />
        </button>
      </div>
      <h3>{market.question}</h3>
      <div className="probability-row">
        <div>
          <strong>{probYes}%</strong>
          <span>chance</span>
        </div>
        <span className="move-up">Live</span>
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
        <span>{Number(market.total_volume).toLocaleString()} EAG traded</span>
        <span>
          <Clock3 size={12} />
          {closeLabel(market.closes_at)}
        </span>
      </div>
    </article>
  );
  return (
    <motion.div
      className="market-card-motion"
      layout
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: .99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: .99 }}
      transition={{ duration: reducedMotion ? 0 : .24, ease: [0.16, 1, 0.3, 1] }}
    >
      <DitherCardFrame icon={Icon} color={market.category.color}>
        {card}
      </DitherCardFrame>
    </motion.div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Trending");
  const [orderSide, setOrderSide] = useState<"yes" | "no">("yes");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [amountInput, setAmountInput] = useState<string>("10");
  const [tradeFeedback, setTradeFeedback] = useState<TradeFeedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    markets,
    heroMarket,
    probYes,
    probNo,
    userBalance,
    chartData,
    loading,
    trading,
    error,
    preview,
    previewSlippage,
    executeTrade,
  } = useMarketData();

  const numericAmount = parseFloat(amountInput) || 0;
  const previewResult = preview(numericAmount, orderSide === "yes");
  const potentialReturn = previewResult ? Math.floor(previewResult.sharesReceived) : 0;
  const priceImpact = previewSlippage(numericAmount, orderSide === "yes");

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  const showTradeConfirmation = (
    side: "yes" | "no",
    amount: number,
    question: string,
  ) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setTradeFeedback({ id: Date.now(), side, amount, question });
    feedbackTimer.current = setTimeout(() => setTradeFeedback(null), 3600);
  };

  const handleHeroTrade = async () => {
    if (!heroMarket || numericAmount <= 0) return;
    setTradeFeedback(null);
    const succeeded = await executeTrade(heroMarket.id, numericAmount, orderSide);
    if (succeeded) {
      showTradeConfirmation(orderSide, numericAmount, heroMarket.question);
    }
  };

  const handleGridMarketTrade = async (id: number, isBuyingYes: boolean) => {
    const tradeAmount = 10;
    if (userBalance < tradeAmount) return;
    const market = markets.find((item) => item.id === id);
    const side = isBuyingYes ? "yes" : "no";
    const succeeded = await executeTrade(id, tradeAmount, side);
    if (succeeded && market) showTradeConfirmation(side, tradeAmount, market.question);
  };

  const categories = [
    "Trending",
    ...Array.from(new Set(markets.map((market) => market.category.name))),
  ];

  const categoryMarkets = activeCategory === "Trending" ? markets.slice(1) : markets;
  const visibleMarkets = categoryMarkets.filter(
    (market) =>
      market.question.toLowerCase().includes(query.toLowerCase()) &&
      (activeCategory === "Trending" || market.category.name === activeCategory)
  );

  if (loading) {
    return <AppLoadingSkeleton kind="markets" />;
  }

  if (!heroMarket) {
    return (
      <main className="sync-state">
        <strong>No markets are available.</strong>
        <span>{error ?? "Ask an administrator to publish the first market."}</span>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="wordmark" href="/markets">
          <EagleMark />
          <span>EagleMarket</span>
        </Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link className="active" href="/markets">
            Markets
          </Link>
          <Link href="/picks">My picks</Link>
          <Link href="/rankings">Rankings</Link>
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
          <NotificationPanel />
          <Link className="icon-button" href="/settings" aria-label="Settings"><Settings size={18} /></Link>
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
          <Link href="/rankings">Rankings</Link>
          <Link href="/picks">My picks</Link>
          <Link className="mobile-settings-link" href="/settings">Settings</Link>
        </nav>
      )}

      <AnnouncementBanner />

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
        {error && <div className="sync-error" role="alert">{error}</div>}
        {activeCategory === "Trending" && (
        <MotionReveal>
        <section className="hero-market" id="markets">
          <div className="hero-copy">
            <h1>
              <Link className="hero-title-link" href={`/markets/${marketSlug(heroMarket)}`}>
                {heroMarket.question}
              </Link>
            </h1>
            <p className="hero-description">
              {heroMarket.resolution_criteria}
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
                <strong>{Number(heroMarket.total_volume).toLocaleString()} EAG</strong> volume
              </span>
              <span>
                <strong>{heroMarket.status}</strong> market
              </span>
              <span>
                <Clock3 size={15} />
                <strong>{closeLabel(heroMarket.closes_at)}</strong>
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
            <label className="amount-label">Tokens</label>
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
              className={`review-button${tradeFeedback?.question === heroMarket.question ? " confirmed" : ""}`}
              onClick={handleHeroTrade}
              disabled={trading || numericAmount <= 0 || numericAmount > userBalance}
            >
              {trading ? (
                <>
                  <LoaderCircle className="trade-spinner" size={17} /> Confirming…
                </>
              ) : tradeFeedback?.question === heroMarket.question ? (
                <>
                  <Check size={17} /> Prediction confirmed
                </>
              ) : (
                <>
                  Confirm prediction <ArrowRight size={17} />
                </>
              )}
            </button>
            <p>
              EAG are free tokens with no cash value. Correct picks settle at
              100 EAG per contract.
            </p>
          </aside>
        </section>
        </MotionReveal>
        )}

        <MotionReveal delay={0.08}>
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
          <motion.div className="market-grid" layout>
            {visibleMarkets.length ? (
              <AnimatePresence mode="popLayout" initial={false}>
              {visibleMarkets.map((market) => (
                <MarketCard
                  key={market.id}
                  market={market}
                  onTrade={handleGridMarketTrade}
                />
              ))}
              </AnimatePresence>
            ) : (
              <div className="empty-state">No markets match this search yet.</div>
            )}
          </motion.div>
        </section>
        </MotionReveal>

        <div className="request-market">
          <a
            href="https://tally.so/r/D4OkgR"
            target="_blank"
            rel="noreferrer noopener"
          >
            Request a Market <ArrowUpRight size={15} />
          </a>
        </div>
      </main>
      {tradeFeedback && <TradeConfirmation key={tradeFeedback.id} feedback={tradeFeedback} />}
    </div>
  );
}
