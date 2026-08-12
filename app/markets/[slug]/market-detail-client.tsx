"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EagCoin } from "@/components/ui/eag-coin";
import { NotificationPanel } from "@/components/notification-panel";
import {
  calculateProbability,
  calculatePurchaseOutput,
  calculateSaleOutput,
  calculateSlippage,
} from "@/lib/amm";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";
import styles from "./market-detail.module.css";

export type MarketDetail = {
  id: number;
  question: string;
  note: string;
  resolutionCriteria: string;
  resolutionSourceUrl: string | null;
  status: string;
  resolvedOutcome: "yes" | "no" | null;
  opensAt: string;
  closesAt: string;
  poolYes: number;
  poolNo: number;
  totalVolume: number;
  categoryName: string;
  categorySlug: string;
  categoryColor: string;
};

export type HistoryPoint = { timestamp: string; yes: number; no: number };
export type PositionSummary = {
  yesShares: number;
  noShares: number;
  invested: number;
};

/**
 * How a status maps to the trading UI. Kept as one lookup so a new status —
 * `frozen` lands here next — changes the banner, the panel, and the disabled
 * state together instead of in three places that can disagree.
 */
function tradingState(market: MarketDetail): {
  canTrade: boolean;
  title: string | null;
  detail: string | null;
} {
  switch (market.status) {
    case "open":
      return { canTrade: true, title: null, detail: null };
    case "closed":
      return {
        canTrade: false,
        title: "Trading closed",
        detail:
          "This market is no longer accepting predictions. Existing positions are unaffected and pay out once an administrator resolves the outcome.",
      };
    case "resolved":
      return {
        canTrade: false,
        title: `Resolved ${market.resolvedOutcome?.toUpperCase() ?? ""}`.trim(),
        detail:
          "This market has settled. Winning contracts paid out 100 EAG each and are already in your balance.",
      };
    case "cancelled":
      return {
        canTrade: false,
        title: "Market cancelled",
        detail: "This market was cancelled and will not settle.",
      };
    default:
      return {
        canTrade: false,
        title: "Trading paused",
        detail: "This market is not currently accepting predictions.",
      };
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

export default function MarketDetailClient({
  market: initialMarket,
  history: initialHistory,
  balance: initialBalance,
  position: initialPosition,
}: {
  market: MarketDetail;
  history: HistoryPoint[];
  balance: number;
  position: PositionSummary | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [market, setMarket] = useState(initialMarket);
  const [history, setHistory] = useState(initialHistory);
  const [balance, setBalance] = useState(initialBalance);
  const [position, setPosition] = useState(initialPosition);
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [amountInput, setAmountInput] = useState("10");
  const [trading, setTrading] = useState(false);
  const [exitSide, setExitSide] = useState<"yes" | "no">("yes");
  const [exitInput, setExitInput] = useState("");
  const [selling, setSelling] = useState(false);
  const [sold, setSold] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const pendingTrade = useRef<{ fingerprint: string; key: string } | null>(null);
  const pendingSell = useRef<{ fingerprint: string; key: string } | null>(null);
  const soldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const probYes = Math.round(calculateProbability(market.poolYes, market.poolNo) * 100);
  const probNo = 100 - probYes;
  const state = tradingState(market);

  const amount = parseFloat(amountInput) || 0;
  const previewResult =
    amount > 0
      ? calculatePurchaseOutput(amount, market.poolYes, market.poolNo, side === "yes")
      : null;
  const potentialReturn = previewResult ? Math.floor(previewResult.sharesReceived) : 0;
  const priceImpact =
    amount > 0
      ? calculateSlippage(amount, market.poolYes, market.poolNo, side === "yes")
      : 0;

  const positionValue = position
    ? position.yesShares * (probYes / 100) + position.noShares * (probNo / 100)
    : 0;

  // Which sides can actually be exited. Holding both is possible, so the
  // toggle only appears when there is a genuine choice to make.
  const exitSides = useMemo(() => {
    const sides: Array<"yes" | "no"> = [];
    if ((position?.yesShares ?? 0) > 0) sides.push("yes");
    if ((position?.noShares ?? 0) > 0) sides.push("no");
    return sides;
  }, [position?.yesShares, position?.noShares]);

  // Derived rather than corrected in an effect: if the selected side is sold
  // out from under the toggle, fall through to whatever is still held.
  const effectiveExitSide = exitSides.includes(exitSide) ? exitSide : (exitSides[0] ?? "yes");

  const heldOnExitSide =
    effectiveExitSide === "yes" ? (position?.yesShares ?? 0) : (position?.noShares ?? 0);
  const exitShares = parseFloat(exitInput) || 0;
  // Selling the whole holding has to send the exact stored value, not a
  // rounded one: rounding up exceeds what is held and the database rejects it.
  const isClosingAll = heldOnExitSide > 0 && Math.abs(exitShares - heldOnExitSide) < 1e-8;
  const salePreview =
    exitShares > 0 && exitShares <= heldOnExitSide
      ? calculateSaleOutput(exitShares, market.poolYes, market.poolNo, effectiveExitSide === "yes")
      : null;

  const setExitFraction = useCallback(
    (fraction: number) => {
      if (heldOnExitSide <= 0) return;
      const target = fraction >= 1 ? heldOnExitSide : heldOnExitSide * fraction;
      setExitInput(String(Number(target.toFixed(8))));
    },
    [heldOnExitSide],
  );

  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      if (soldTimer.current) clearTimeout(soldTimer.current);
    },
    [],
  );

  // Realtime keeps the price, the balance, and the chart live. This rides a
  // websocket, which is why connect-src carries wss://*.supabase.co.
  useEffect(() => {
    const channel = supabase
      .channel(`market-detail-${market.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "markets",
          filter: `id=eq.${market.id}`,
        },
        (payload) => {
          const updated = payload.new as Tables<"markets">;
          setMarket((current) => ({
            ...current,
            status: updated.status,
            resolvedOutcome: updated.resolved_outcome as "yes" | "no" | null,
            poolYes: Number(updated.pool_yes),
            poolNo: Number(updated.pool_no),
            totalVolume: Number(updated.total_volume),
          }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "market_price_history",
          filter: `market_id=eq.${market.id}`,
        },
        (payload) => {
          const point = payload.new as Tables<"market_price_history">;
          const yes = Math.round(Number(point.probability_yes) * 100);
          setHistory((current) => [
            ...current.slice(-199),
            { timestamp: point.created_at, yes, no: 100 - yes },
          ]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [market.id, supabase]);

  const chartData = useMemo(() => {
    const opening = {
      day: new Date(market.opensAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      yes: history.length ? 50 : probYes,
      no: history.length ? 50 : probNo,
    };
    return [
      opening,
      ...history.map((point) => ({
        day: new Date(point.timestamp).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        yes: point.yes,
        no: point.no,
      })),
    ];
  }, [history, market.opensAt, probNo, probYes]);

  const submitTrade = useCallback(async () => {
    if (!state.canTrade || amount <= 0 || amount > balance) return;

    setTrading(true);
    setError(null);

    const fingerprint = `${market.id}:${amount}:${side}`;
    const idempotencyKey =
      pendingTrade.current?.fingerprint === fingerprint
        ? pendingTrade.current.key
        : crypto.randomUUID();
    pendingTrade.current = { fingerprint, key: idempotencyKey };

    try {
      const response = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          amount,
          outcome: side,
          idempotencyKey,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        balance?: number;
        pool_yes?: number;
        pool_no?: number;
        total_volume?: number;
        shares_received?: number;
      };

      if (!response.ok) {
        // A 5xx may or may not have committed, so the key is kept to make a
        // retry idempotent. Anything else definitively failed.
        if (response.status < 500) pendingTrade.current = null;
        setError(result.error ?? "The trade could not be completed.");
        return;
      }

      pendingTrade.current = null;
      setBalance(Number(result.balance));
      setMarket((current) => ({
        ...current,
        poolYes: Number(result.pool_yes),
        poolNo: Number(result.pool_no),
        totalVolume: Number(result.total_volume),
      }));
      setPosition((current) => {
        const shares = Number(result.shares_received ?? 0);
        const base = current ?? { yesShares: 0, noShares: 0, invested: 0 };
        return {
          yesShares: base.yesShares + (side === "yes" ? shares : 0),
          noShares: base.noShares + (side === "no" ? shares : 0),
          invested: base.invested + amount,
        };
      });

      setConfirmed(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmed(false), 3200);
    } catch {
      setError("The network request failed. Your balance was not changed twice; try again safely.");
    } finally {
      setTrading(false);
    }
  }, [amount, balance, market.id, side, state.canTrade]);

  const submitSell = useCallback(async () => {
    if (!state.canTrade || exitShares <= 0 || exitShares > heldOnExitSide) return;

    setSelling(true);
    setError(null);

    // Send the exact held amount when closing out, so a rounded value cannot
    // exceed the holding and be rejected.
    const sharesToSell = isClosingAll ? heldOnExitSide : exitShares;
    const fingerprint = `${market.id}:${sharesToSell}:${effectiveExitSide}`;
    const idempotencyKey =
      pendingSell.current?.fingerprint === fingerprint
        ? pendingSell.current.key
        : crypto.randomUUID();
    pendingSell.current = { fingerprint, key: idempotencyKey };

    // Floor the proceeds a little below the preview: the price can move
    // between quote and fill, and a silent worse fill is the thing to avoid.
    const minProceeds = salePreview
      ? Number((salePreview.proceeds * 0.98).toFixed(4))
      : undefined;

    try {
      const response = await fetch("/api/sells", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          shares: Number(sharesToSell.toFixed(8)),
          outcome: effectiveExitSide,
          idempotencyKey,
          minProceeds,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        balance?: number;
        pool_yes?: number;
        pool_no?: number;
        total_volume?: number;
        remaining_yes_shares?: number;
        remaining_no_shares?: number;
      };

      if (!response.ok) {
        if (response.status < 500) pendingSell.current = null;
        setError(result.error ?? "The sale could not be completed.");
        return;
      }

      pendingSell.current = null;
      setBalance(Number(result.balance));
      setMarket((current) => ({
        ...current,
        poolYes: Number(result.pool_yes),
        poolNo: Number(result.pool_no),
        totalVolume: Number(result.total_volume),
      }));
      setPosition((current) =>
        current
          ? {
              ...current,
              yesShares: Number(result.remaining_yes_shares ?? 0),
              noShares: Number(result.remaining_no_shares ?? 0),
            }
          : current,
      );
      setExitInput("");
      setSold(true);
      if (soldTimer.current) clearTimeout(soldTimer.current);
      soldTimer.current = setTimeout(() => setSold(false), 3200);
    } catch {
      setError("The network request failed. Your position was not sold twice; try again safely.");
    } finally {
      setSelling(false);
    }
  }, [
    effectiveExitSide,
    exitShares,
    heldOnExitSide,
    isClosingAll,
    market.id,
    salePreview,
    state.canTrade,
  ]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="wordmark" href="/">
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
        <div className="auth-actions">
          <button className="token-balance">
            <EagCoin size="sm" /> {balance.toLocaleString()} EAG
          </button>
          <NotificationPanel />
          <Link className="icon-button" href="/settings" aria-label="Settings">
            <Settings size={18} />
          </Link>
        </div>
      </header>

      <main className={styles.detailMain}>
        <Link className={styles.backLink} href="/markets">
          <ArrowLeft size={16} /> All markets
        </Link>

        {error && (
          <div className="sync-error" role="alert">
            {error}
          </div>
        )}

        {state.title && (
          <div className={styles.stateBanner} role="status">
            <LockKeyhole size={18} />
            <div>
              <strong>{state.title}</strong>
              <span>{state.detail}</span>
            </div>
          </div>
        )}

        <section className={styles.detailHeader}>
          <span
            className={styles.categoryChip}
            style={{ ["--category-color" as string]: market.categoryColor }}
          >
            {market.categoryName}
          </span>
          <h1>{market.question}</h1>
          <div className="market-stats">
            <span>
              <strong>{market.totalVolume.toLocaleString()} EAG</strong> volume
            </span>
            <span>
              <Clock3 size={15} />
              <strong>Closes {formatDateTime(market.closesAt)}</strong>
            </span>
          </div>
        </section>

        <div className={styles.detailGrid}>
          <div className={styles.detailPrimary}>
            <div className="outcome-summary">
              <div className={side === "yes" ? "outcome active" : "outcome"}>
                <span className="outcome-dot yes-dot" />
                <div>
                  <span>YES</span>
                  <strong>{probYes}%</strong>
                </div>
              </div>
              <div className={side === "no" ? "outcome active" : "outcome"}>
                <span className="outcome-dot no-dot" />
                <div>
                  <span>NO</span>
                  <strong>{probNo}%</strong>
                </div>
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
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 15, right: 8, bottom: 0, left: -6 }}>
                    <CartesianGrid stroke="oklch(0.83 0 0)" strokeDasharray="2 7" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "oklch(0.53 0.02 240)", fontSize: 11 }}
                      interval="preserveStartEnd"
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
                      type="stepAfter"
                      dataKey="no"
                      stroke="oklch(0.62 0.2 25)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, fill: "oklch(0.62 0.2 25)", strokeWidth: 0 }}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="yes"
                      stroke="oklch(0.58 0.18 255)"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4, fill: "oklch(0.58 0.18 255)", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <section className={styles.infoCard}>
              <h2>About this market</h2>
              <p>{market.note}</p>
            </section>

            <section className={styles.infoCard}>
              <h2>How this resolves</h2>
              <p>{market.resolutionCriteria}</p>
              {market.resolutionSourceUrl && (
                <a
                  className={styles.sourceLink}
                  href={market.resolutionSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                >
                  Resolution source <ExternalLink size={14} />
                </a>
              )}
              <dl className={styles.resolutionMeta}>
                <div>
                  <dt>Opened</dt>
                  <dd>{formatDateTime(market.opensAt)}</dd>
                </div>
                <div>
                  <dt>Closes</dt>
                  <dd>{formatDateTime(market.closesAt)}</dd>
                </div>
                <div>
                  <dt>Settlement</dt>
                  <dd>100 EAG per correct contract</dd>
                </div>
              </dl>
            </section>
          </div>

          <aside className={styles.detailAside}>
            {position && (position.yesShares > 0 || position.noShares > 0) && (
              <section className={styles.positionCard}>
                <h2>Your position</h2>
                <div className={styles.positionRows}>
                  {position.yesShares > 0 && (
                    <div>
                      <span>YES contracts</span>
                      <strong>{Math.floor(position.yesShares).toLocaleString()}</strong>
                    </div>
                  )}
                  {position.noShares > 0 && (
                    <div>
                      <span>NO contracts</span>
                      <strong>{Math.floor(position.noShares).toLocaleString()}</strong>
                    </div>
                  )}
                  <div>
                    <span>Invested</span>
                    <strong>{Math.round(position.invested).toLocaleString()} EAG</strong>
                  </div>
                  <div className={styles.positionValue}>
                    <span>Value at current price</span>
                    <strong>{Math.round(positionValue).toLocaleString()} EAG</strong>
                  </div>
                </div>

                {state.canTrade && (
                  <div className={styles.exitBlock}>
                    {exitSides.length > 1 && (
                      <div className={styles.exitSideToggle}>
                        {exitSides.map((exitOption) => (
                          <button
                            key={exitOption}
                            className={effectiveExitSide === exitOption ? styles.exitSideActive : ""}
                            onClick={() => setExitSide(exitOption)}
                          >
                            {exitOption.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    )}

                    <label className={styles.exitLabel} htmlFor="exit-shares">
                      Contracts to sell
                    </label>
                    <input
                      id="exit-shares"
                      className={styles.exitInput}
                      inputMode="decimal"
                      value={exitInput}
                      onChange={(event) => setExitInput(event.target.value)}
                      placeholder="0"
                    />
                    <div className={styles.exitQuick}>
                      <button onClick={() => setExitFraction(0.25)}>25%</button>
                      <button onClick={() => setExitFraction(0.5)}>50%</button>
                      <button onClick={() => setExitFraction(1)}>All</button>
                    </div>

                    {/* Preview uses the same curve the database will price
                        against, so the number shown is the number filled —
                        subject to the price moving, which minProceeds guards. */}
                    {salePreview && (
                      <div className={styles.exitPreview}>
                        <div>
                          <span>You receive</span>
                          <strong>{salePreview.proceeds.toFixed(2)} EAG</strong>
                        </div>
                        <div>
                          <span>Average price</span>
                          <strong>{Math.round(salePreview.avgPrice * 100)}c</strong>
                        </div>
                      </div>
                    )}

                    <button
                      className={styles.exitButton}
                      onClick={submitSell}
                      disabled={
                        selling ||
                        exitShares <= 0 ||
                        exitShares > heldOnExitSide ||
                        !salePreview
                      }
                    >
                      {selling ? (
                        <>
                          <LoaderCircle className="trade-spinner" size={16} /> Selling…
                        </>
                      ) : sold ? (
                        <>
                          <Check size={16} /> Sold
                        </>
                      ) : isClosingAll ? (
                        `Close position`
                      ) : (
                        `Sell ${effectiveExitSide.toUpperCase()}`
                      )}
                    </button>
                  </div>
                )}
              </section>
            )}

            <div className="order-panel">
              <div className="order-title">
                <span>Make a prediction</span>
                <span>Balance {balance.toLocaleString()} EAG</span>
              </div>
              <div className="side-toggle">
                <button
                  className={side === "yes" ? "active yes" : ""}
                  onClick={() => setSide("yes")}
                  disabled={!state.canTrade}
                >
                  Yes <span>{probYes}c</span>
                </button>
                <button
                  className={side === "no" ? "active no" : ""}
                  onClick={() => setSide("no")}
                  disabled={!state.canTrade}
                >
                  No <span>{probNo}c</span>
                </button>
              </div>
              <label className="amount-label" htmlFor="trade-amount">
                Tokens
              </label>
              <div className="amount-input">
                <EagCoin size="sm" />
                <input
                  id="trade-amount"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(event) => setAmountInput(event.target.value)}
                  placeholder="0"
                  disabled={!state.canTrade}
                />
              </div>
              <div className="quick-amounts">
                <button onClick={() => setAmountInput("10")} disabled={!state.canTrade}>
                  10
                </button>
                <button onClick={() => setAmountInput("25")} disabled={!state.canTrade}>
                  25
                </button>
                <button onClick={() => setAmountInput("50")} disabled={!state.canTrade}>
                  50
                </button>
                <button
                  onClick={() => setAmountInput(String(Math.floor(balance)))}
                  disabled={!state.canTrade}
                >
                  Max
                </button>
              </div>
              <div className="order-summary">
                <span>Potential return</span>
                <strong>{potentialReturn} EAG</strong>
              </div>
              {priceImpact > 0 && (
                <div className={styles.slippageNote}>
                  Price impact {(priceImpact * 100).toFixed(1)}%
                </div>
              )}
              <button
                className={`review-button${confirmed ? " confirmed" : ""}`}
                onClick={submitTrade}
                disabled={!state.canTrade || trading || amount <= 0 || amount > balance}
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
          </aside>
        </div>
      </main>
    </div>
  );
}
