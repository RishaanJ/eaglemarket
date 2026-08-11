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
  ArrowLeft,
  ArrowRight,
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
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppLoadingSkeleton } from "@/components/ui/app-loading-skeleton";
import { DitherCardFrame } from "@/components/ui/hero-dithering";
import { EagCoin } from "@/components/ui/eag-coin";
import { MotionReveal } from "@/components/ui/motion-reveal";
import { NotificationPanel } from "@/components/notification-panel";
import { calculateProbability } from "@/lib/amm";
import { marketIdFromSlug, marketSlug } from "@/lib/slug";
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

function SidebarMarket({ market }: { market: SyncedMarket }) {
  const Icon = categoryIcons[market.category.slug] ?? CalendarDays;
  const probYes = Math.round(
    calculateProbability(Number(market.pool_yes), Number(market.pool_no)) * 100,
  );

  return (
    <DitherCardFrame className="related-dither" icon={Icon} color={market.category.color}>
      <Link className="related-card" href={`/markets/${marketSlug(market)}`}>
        <span className="category-label">{market.category.name}</span>
        <h3>{market.question}</h3>
        <div className="related-meter">
          <i style={{ width: `${probYes}%`, background: market.category.color }} />
        </div>
        <div className="related-foot">
          <strong>{probYes}% yes</strong>
          <span>{Number(market.total_volume).toLocaleString()} EAG</span>
        </div>
      </Link>
    </DitherCardFrame>
  );
}

export default function MarketDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const marketId = useMemo(() => marketIdFromSlug(params?.slug ?? ""), [params?.slug]);

  const [orderSide, setOrderSide] = useState<"yes" | "no">("yes");
  const [amountInput, setAmountInput] = useState("10");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const {
    markets,
    heroMarket: market,
    marketMissing,
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
  } = useMarketData(marketId ?? undefined);

  const numericAmount = parseFloat(amountInput) || 0;
  const previewResult = preview(numericAmount, orderSide === "yes");
  const potentialReturn = previewResult ? Math.floor(previewResult.sharesReceived) : 0;
  const priceImpact = previewSlippage(numericAmount, orderSide === "yes");
  const related = markets.filter((item) => item.id !== marketId).slice(0, 6);

  const placeTrade = async () => {
    if (!market || numericAmount <= 0) return;
    const succeeded = await executeTrade(market.id, numericAmount, orderSide);
    if (succeeded) {
      setConfirmed(true);
      setTimeout(() => setConfirmed(false), 2600);
    }
  };

  const topbar = (
    <>
      <header className="topbar">
        <Link className="wordmark" href="/markets">
          <EagleMark />
          <span>EagleMarket</span>
        </Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link href="/markets">Markets</Link>
          <Link href="/picks">My picks</Link>
          <Link href="/rankings">Rankings</Link>
        </nav>
        <label className="search-box">
          <Search size={18} />
          <input readOnly placeholder="Search markets" onFocus={() => router.push("/markets")} />
          <kbd>Cmd K</kbd>
        </label>
        <div className="auth-actions">
          <NotificationPanel />
          <button className="token-balance">
            <EagCoin size="sm" /> {userBalance.toLocaleString()} EAG
          </button>
          <Link className="icon-button" href="/settings" aria-label="Settings">
            <Settings size={18} />
          </Link>
        </div>
        <button
          className="mobile-menu"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label="Toggle menu"
        >
          <Menu />
        </button>
      </header>
      {mobileOpen && (
        <nav className="mobile-nav">
          <Link href="/markets">Markets</Link>
          <Link href="/picks">My picks</Link>
          <Link href="/rankings">Rankings</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      )}
    </>
  );

  if (loading) return <AppLoadingSkeleton kind="markets" />;

  if (!market) {
    return (
      <div className="app-shell">
        {topbar}
        <main className="market-detail-main">
          <div className="detail-empty">
            <strong>This market isn&apos;t available</strong>
            <p>
              {marketId === null
                ? "That link doesn't point at a market."
                : marketMissing
                  ? "It may have closed or been resolved since the link was shared."
                  : (error ?? "It may have closed or been resolved.")}
            </p>
            <Link className="detail-back-cta" href="/markets">
              <ArrowLeft size={15} /> Back to all markets
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const Icon = categoryIcons[market.category.slug] ?? CalendarDays;

  return (
    <div className="app-shell">
      {topbar}

      <main className="market-detail-main">
        <Link className="detail-back" href="/markets">
          <ArrowLeft size={14} /> All markets
        </Link>

        {error && <div className="sync-error">{error}</div>}

        <div className="market-detail-layout">
          <div className="detail-primary">
            <MotionReveal>
              <DitherCardFrame
                className="detail-head-dither"
                icon={Icon}
                color={market.category.color}
              >
              <section className="detail-head">
                <div className="detail-meta">
                  <span className="category-label">{market.category.name}</span>
                  <span className="open-label">
                    <span /> {market.status}
                  </span>
                </div>
                <h1>{market.question}</h1>
                <div className="market-stats">
                  <span>
                    <strong>{Number(market.total_volume).toLocaleString()} EAG</strong> volume
                  </span>
                  <span>
                    <Clock3 size={15} />
                    <strong>{closeLabel(market.closes_at)}</strong>
                  </span>
                </div>
              </section>
              </DitherCardFrame>
            </MotionReveal>

            <MotionReveal delay={0.05}>
              <section className="detail-chart-card" aria-label="Market probability chart">
                <div className="chart-header">
                  <div className="detail-price">
                    <strong>{probYes}%</strong>
                    <span>chance of yes</span>
                  </div>
                  <div className="chart-legend">
                    <span>
                      <i className="legend-dot yes-line" /> Yes <strong>{probYes}%</strong>
                    </span>
                    <span>
                      <i className="legend-dot no-line" /> No <strong>{probNo}%</strong>
                    </span>
                  </div>
                </div>
                <div className="detail-chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 15, right: 8, bottom: 0, left: -6 }}>
                      <CartesianGrid stroke="oklch(0.83 0 0)" strokeDasharray="2 7" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "oklch(0.53 0.02 240)", fontSize: 11 }}
                        interval="preserveStartEnd"
                        minTickGap={28}
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
                        formatter={(value, name) => [`${value}%`, name === "yes" ? "Yes" : "No"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="no"
                        stroke="oklch(0.62 0.2 25)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, fill: "oklch(0.62 0.2 25)", strokeWidth: 0 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="yes"
                        stroke="oklch(0.58 0.18 255)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, fill: "oklch(0.58 0.18 255)", strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </MotionReveal>

            <MotionReveal delay={0.1}>
              <div className="detail-rules">
                <h2>How this resolves</h2>
                <p>{market.resolution_criteria}</p>
                {market.description && <p className="detail-rules-note">{market.description}</p>}
                {market.resolution_source_url && (
                  <a
                    className="detail-source"
                    href={market.resolution_source_url}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Resolution source <ArrowRight size={13} />
                  </a>
                )}
              </div>
            </MotionReveal>
          </div>

          <aside className="detail-sidebar">
            <div className="order-panel detail-order-panel">
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
                  onChange={(event) => setAmountInput(event.target.value)}
                  placeholder="0"
                />
                <button type="button">
                  EAG <ChevronDown size={14} />
                </button>
                </div>
                <div className="quick-amounts">
                <button onClick={() => setAmountInput("10")}>10</button>
                <button onClick={() => setAmountInput("25")}>25</button>
                <button onClick={() => setAmountInput("50")}>50</button>
                <button onClick={() => setAmountInput(String(userBalance))}>Max</button>
                </div>
                <div className="order-summary">
                <span>Potential return</span>
                <strong>{potentialReturn} EAG</strong>
                </div>
                {priceImpact > 0 && (
                <div className="detail-impact">
                  Price impact {(priceImpact * 100).toFixed(1)}%
                </div>
                )}
                <button
                className={confirmed ? "review-button confirmed" : "review-button"}
                onClick={placeTrade}
                disabled={trading || numericAmount <= 0 || numericAmount > userBalance}
                >
                {trading ? (
                  <>
                    <LoaderCircle className="trade-spinner" size={17} /> Confirming…
                  </>
                ) : confirmed ? (
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
                EAG are free tokens with no cash value. Correct picks settle at 100 EAG per
                contract.
                </p>
            </div>

            <div className="detail-sidebar-head" id="more-markets">
              <h2>More markets</h2>
              <Link href="/markets">
                View all <ArrowRight size={13} />
              </Link>
            </div>
            {related.length ? (
              related.map((item) => <SidebarMarket key={item.id} market={item} />)
            ) : (
              <p className="detail-sidebar-empty">No other markets are open right now.</p>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
