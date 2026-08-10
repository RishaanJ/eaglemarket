"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  FlaskConical,
  Menu,
  Mic2,
  Search,
  Settings,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { EagCoin } from "@/components/ui/eag-coin";
import { BlurFade } from "@/components/ui/blur-fade";
import { BorderBeam } from "@/components/ui/border-beam";
import { DitherCardFrame } from "@/components/ui/hero-dithering";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PortfolioGrainGradient } from "@/components/ui/portfolio-grain-gradient";

const positionChartConfig = {
  yes: { label: "Yes", color: "oklch(0.58 0.18 255)" },
  no: { label: "No", color: "oklch(0.62 0.2 25)" },
} satisfies ChartConfig;

const categoryIcons: Record<string, LucideIcon> = {
  classes: FlaskConical,
  campus: CalendarDays,
  spw: Trophy,
  sports: Trophy,
  clubs: Mic2,
};

export type PickPosition = {
  marketId: number;
  question: string;
  category: string;
  categoryColor: string;
  status: string;
  resolvedOutcome: "yes" | "no" | null;
  closesAt: string;
  probabilityYes: number;
  yesShares: number;
  noShares: number;
  invested: number;
  currentValue: number;
  payout: number | null;
  history: Array<{
    timestamp: string;
    yes: number;
    no: number;
  }>;
};

export type RecentPick = {
  id: number;
  question: string;
  outcome: "yes" | "no";
  amount: number;
  shares: number;
  averagePrice: number;
  createdAt: string;
};

type Filter = "all" | "open" | "resolved";

function EagleMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function formatEag(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export default function PicksClient({
  balance,
  positions,
  recentPicks,
}: {
  balance: number;
  positions: PickPosition[];
  recentPicks: RecentPick[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedMarketId, setSelectedMarketId] = useState<number | null>(
    positions[0]?.marketId ?? null,
  );

  const openPositions = positions.filter((position) => position.status === "open");
  const activeValue = openPositions.reduce((total, position) => total + position.currentValue, 0);
  const activeInvested = openPositions.reduce((total, position) => total + position.invested, 0);
  const unrealized = activeValue - activeInvested;
  const deployedPercent = Math.min(
    100,
    (activeInvested / Math.max(balance + activeInvested, 1)) * 100,
  );

  const visiblePositions = useMemo(() => {
    const filtered =
      filter === "open"
        ? positions.filter((position) => position.status === "open")
        : filter === "resolved"
          ? positions.filter((position) =>
              ["closed", "resolved", "cancelled"].includes(position.status),
            )
          : positions;
    return filtered.filter((position) =>
      position.question.toLowerCase().includes(query.trim().toLowerCase()),
    );
  }, [filter, positions, query]);
  const selectedPosition =
    visiblePositions.find((position) => position.marketId === selectedMarketId) ??
    visiblePositions[0] ??
    null;
  const selectedResult = selectedPosition
    ? (selectedPosition.status === "open"
        ? selectedPosition.currentValue
        : selectedPosition.payout ?? 0) - selectedPosition.invested
    : 0;
  const selectedPrimarySide = selectedPosition
    ? selectedPosition.yesShares >= selectedPosition.noShares ? "yes" : "no"
    : "yes";
  const selectedShares = selectedPosition
    ? selectedPrimarySide === "yes" ? selectedPosition.yesShares : selectedPosition.noShares
    : 0;

  return (
    <div className="app-shell picks-shell">
      <header className="topbar picks-topbar">
        <Link className="wordmark" href="/markets">
          <EagleMark />
          <span>EagleMarket</span>
        </Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link href="/markets">Markets</Link>
          <Link className="active" href="/picks">My picks</Link>
          <Link href="/rankings">Rankings</Link>
        </nav>
        <label className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your picks"
          />
          <kbd>Cmd K</kbd>
        </label>
        <div className="auth-actions">
          <button className="token-balance">
            <EagCoin size="sm" /> {balance.toLocaleString()} EAG
          </button>
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
          <Link href="/markets">Markets</Link>
          <Link href="/picks">My picks</Link>
          <Link href="/rankings">Rankings</Link>
          <Link className="mobile-settings-link" href="/settings">Settings</Link>
        </nav>
      )}

      <main className="picks-main">
        <BlurFade duration={0.28} blur="4px">
          <div className="picks-intro">
            <div>
              <h1>My picks</h1>
              <p>Your positions, resolved predictions, and recent activity.</p>
            </div>
            <Link className="browse-markets-link" href="/markets">
              Browse markets <ArrowRight size={16} />
            </Link>
          </div>
        </BlurFade>

        <BlurFade duration={0.3} delay={0.04} blur="3px">
        <section className="picks-showcase" aria-label="Portfolio overview">
          <div className="featured-positions-area">
            <div className="featured-positions-heading">
              <div>
                <span>{openPositions.length} active {openPositions.length === 1 ? "pick" : "picks"}</span>
                <h2>Your positions</h2>
              </div>
              <div className="position-filters" aria-label="Filter positions">
                {(["all", "open", "resolved"] as Filter[]).map((option) => (
                  <button
                    key={option}
                    className={filter === option ? "active" : ""}
                    onClick={() => setFilter(option)}
                    aria-pressed={filter === option}
                  >
                    {option[0].toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {visiblePositions.length ? (
              <div className="featured-position-grid">
                {visiblePositions.slice(0, 3).map((position) => {
                  const result =
                    (position.status === "open" ? position.currentValue : position.payout ?? 0) -
                    position.invested;
                  const primarySide = position.yesShares >= position.noShares ? "yes" : "no";
                  const sideProbability = Math.round(
                    (primarySide === "yes" ? position.probabilityYes : 1 - position.probabilityYes) *
                      100,
                  );
                  const CategoryIcon = categoryIcons[position.category.toLowerCase()] ?? CalendarDays;
                  return (
                    <DitherCardFrame
                      key={position.marketId}
                      className="featured-position-dither"
                      icon={CategoryIcon}
                      color={position.categoryColor}
                    >
                      <button
                        className={`featured-position-card${selectedPosition?.marketId === position.marketId ? " selected" : ""}`}
                        onClick={() => setSelectedMarketId(position.marketId)}
                        aria-pressed={selectedPosition?.marketId === position.marketId}
                      >
                        <div className="featured-card-top">
                          <div className="featured-card-meta">
                            <span className="category-label">{position.category}</span>
                            {position.status !== "open" && (
                              <span className="position-status-badge">
                                {position.status === "cancelled" ? "Cancelled" : "Closed"}
                              </span>
                            )}
                          </div>
                          <ArrowRight size={15} />
                        </div>
                        <h3>{position.question}</h3>
                        <span className={`featured-position-label ${primarySide}`}>
                          {primarySide.toUpperCase()} position
                        </span>
                        <div className="featured-probability">
                          <span>Current chance</span>
                          <strong>{sideProbability}%</strong>
                        </div>
                        <div className="featured-probability-track" aria-hidden="true">
                          <i style={{ width: `${sideProbability}%`, background: position.categoryColor }} />
                        </div>
                        <div className="featured-card-foot">
                          <span>{formatEag(position.invested)} EAG invested</span>
                          <strong className={result >= 0 ? "value-positive" : "value-negative"}>
                            {result >= 0 ? "+" : ""}{formatEag(result)} EAG
                          </strong>
                        </div>
                      </button>
                    </DitherCardFrame>
                  );
                })}
              </div>
            ) : (
              <div className="featured-empty">No picks match this view.</div>
            )}
          </div>

          <aside className="portfolio-spotlight">
            <PortfolioGrainGradient className="portfolio-grain-gradient" />
            <BorderBeam
              size={110}
              duration={10}
              colorFrom="oklch(0.58 0.18 230)"
              colorTo="oklch(0.63 0.16 153)"
            />
            <div className="spotlight-top"><EagleMark /><span>Portfolio</span></div>
            <h2>Ready for your next call.</h2>
            <p>Your free EAG balance and open positions, kept in one place.</p>
            <div className="spotlight-balance"><span>Available</span><strong>{formatEag(balance)} <small>EAG</small></strong></div>
            <div className="spotlight-stats">
              <div><span>Open value</span><strong>{formatEag(activeValue)}</strong></div>
              <div><span>Unrealized</span><strong className={unrealized >= 0 ? "value-positive" : "value-negative"}>{unrealized >= 0 ? "+" : ""}{formatEag(unrealized)}</strong></div>
            </div>
            <Link href="/markets">Browse markets <ArrowRight size={15} /></Link>
          </aside>
        </section>
        </BlurFade>

        {selectedPosition ? (
          <BlurFade inView duration={0.3} blur="3px">
          <section className="active-position-panel">
            <div className="active-position-toolbar">
              <span>Your active position</span>
              <small>Updated from live market pricing</small>
            </div>
            <div className="active-position-main">
              <div className="active-position-copy">
                <div className="active-position-meta">
                  <span
                    className="active-position-category-dot"
                    style={{ background: selectedPosition.categoryColor }}
                  />
                  {selectedPosition.category}
                  {selectedPosition.status !== "open" && (
                    <span className="position-status-badge">
                      {selectedPosition.status === "cancelled" ? "Cancelled" : "Closed"}
                    </span>
                  )}
                </div>
                <h2>{selectedPosition.question}</h2>
                <p>{selectedPosition.status === "open" ? `Closes ${new Date(selectedPosition.closesAt).toLocaleDateString()}` : `Resolved ${selectedPosition.resolvedOutcome?.toUpperCase() ?? "—"}`}</p>
                <div className="active-position-value">
                  <span>{selectedPosition.status === "open" ? "Current position value" : "Final payout"}</span>
                  <strong>{formatEag(selectedPosition.status === "open" ? selectedPosition.currentValue : selectedPosition.payout ?? 0)} <small>EAG</small></strong>
                </div>
                <div className="active-position-actions">
                  <span className={`position-side-chip ${selectedPrimarySide}`}>{selectedPrimarySide.toUpperCase()} position</span>
                  <Link href="/markets">View market <ArrowRight size={14} /></Link>
                </div>
              </div>

              <div className="position-chart-card">
                <div className="position-chart-header">
                  <div>
                    <span>Market probability</span>
                    <strong>{Math.round(selectedPosition.probabilityYes * 100)}% Yes</strong>
                  </div>
                  <div className="position-chart-legend" aria-label="Chart legend">
                    <span><i className="yes" />Yes</span>
                    <span><i className="no" />No</span>
                  </div>
                </div>
                <ChartContainer
                  config={positionChartConfig}
                  className="position-history-chart"
                  initialDimension={{ width: 520, height: 230 }}
                >
                  <AreaChart
                    accessibilityLayer
                    data={
                      selectedPosition.history.length
                        ? selectedPosition.history
                        : [{
                            timestamp: selectedPosition.closesAt,
                            yes: Math.round(selectedPosition.probabilityYes * 100),
                            no: 100 - Math.round(selectedPosition.probabilityYes * 100),
                          }]
                    }
                    margin={{ top: 18, right: 8, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="position-fill-yes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-yes)" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="var(--color-yes)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="position-fill-no" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-no)" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="var(--color-no)" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="2 7" />
                    <XAxis
                      dataKey="timestamp"
                      axisLine={false}
                      tickLine={false}
                      minTickGap={34}
                      tickFormatter={(value: string) =>
                        new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                      }
                    />
                    <YAxis
                      orientation="right"
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      tickFormatter={(value: number) => `${value}%`}
                    />
                    <ChartTooltip
                      cursor={{ stroke: "oklch(0.78 0.02 240)", strokeDasharray: "3 4" }}
                      content={
                        <ChartTooltipContent
                          indicator="line"
                          labelFormatter={(_, payload) => {
                            const timestamp = payload[0]?.payload?.timestamp as string | undefined;
                            return timestamp
                              ? new Date(timestamp).toLocaleString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                })
                              : "";
                          }}
                        />
                      }
                    />
                    <Area
                      type="stepAfter"
                      dataKey="no"
                      stroke="var(--color-no)"
                      strokeWidth={2}
                      fill="url(#position-fill-no)"
                      dot={selectedPosition.history.length <= 1}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                    <Area
                      type="stepAfter"
                      dataKey="yes"
                      stroke="var(--color-yes)"
                      strokeWidth={2}
                      fill="url(#position-fill-yes)"
                      dot={selectedPosition.history.length <= 1}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>

            <div className="active-position-metrics">
              <div><span>Invested</span><strong>{formatEag(selectedPosition.invested)} EAG</strong></div>
              <div><span>{selectedPrimarySide.toUpperCase()} shares</span><strong>{formatEag(selectedShares)}</strong></div>
              <div><span>Buying power</span><strong>{Math.round(100 - deployedPercent)}%</strong></div>
              <div><span>Position result</span><strong className={selectedResult >= 0 ? "value-positive" : "value-negative"}>{selectedResult >= 0 ? "+" : ""}{formatEag(selectedResult)} EAG</strong></div>
            </div>
          </section>
          </BlurFade>
        ) : (
          <div className="picks-empty">
            <EagCoin size="lg" />
            <h3>Make your first prediction</h3>
            <p>Choose Yes or No on any school market and it will appear here.</p>
            <Link href="/markets">Explore markets <ArrowRight size={15} /></Link>
          </div>
        )}

        {recentPicks.length > 0 && (
          <BlurFade inView duration={0.28} blur="3px">
          <section className="recent-picks">
            <div className="positions-heading">
              <div><h2>Recent activity</h2><span>Latest predictions</span></div>
            </div>
            <div className="activity-list">
              {recentPicks.map((pick) => (
                <div className="activity-row" key={pick.id}>
                  <span className={`activity-side ${pick.outcome}`}>{pick.outcome.toUpperCase()}</span>
                  <div><strong>{pick.question}</strong><span>{new Date(pick.createdAt).toLocaleString()}</span></div>
                  <div><strong>{formatEag(pick.amount)} EAG</strong><span>{formatEag(pick.shares)} shares at {Math.round(pick.averagePrice * 100)}c</span></div>
                </div>
              ))}
            </div>
          </section>
          </BlurFade>
        )}
      </main>
    </div>
  );
}
