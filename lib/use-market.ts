"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateProbability, calculatePurchaseOutput, calculateSlippage } from "./amm";
import { createClient } from "./supabase/client";
import type { Tables } from "./database.types";

type MarketRow = Tables<"markets">;
type CategoryRow = Tables<"categories">;
type WalletRow = Tables<"wallets">;
type PriceHistoryRow = Tables<"market_price_history">;

export interface SyncedMarket extends MarketRow {
  category: Pick<CategoryRow, "name" | "slug" | "color" | "icon_key">;
}

export interface ChartDataPoint {
  day: string;
  yes: number;
  no: number;
}

interface MarketWithCategory extends MarketRow {
  categories: Pick<CategoryRow, "name" | "slug" | "color" | "icon_key">;
}

/**
 * `focusMarketId` selects which market the chart and price-history subscription follow.
 * Omitted (the markets index) it falls back to the first market, matching the old behaviour.
 */
export function useMarketData(focusMarketId?: number) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [markets, setMarkets] = useState<SyncedMarket[]>([]);
  const [userBalance, setUserBalance] = useState(0);
  // Tagged with its market so a pending fetch can never paint the previous market's chart.
  const [chart, setChart] = useState<{ marketId: number | null; points: ChartDataPoint[] }>({
    marketId: null,
    points: [],
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [trading, setTrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingTrade = useRef<{ fingerprint: string; key: string } | null>(null);
  const heroMarketId = focusMarketId ?? markets[0]?.id;

  const load = useCallback(async () => {
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      // The stored token can outlive the account it points at — an expired
      // session, or a user removed from auth.users. Showing a message and
      // stopping leaves the stale cookie in place, so every reload lands on the
      // same dead page. Clearing it and sending them to sign-in is what
      // actually unsticks the browser.
      await supabase.auth.signOut();
      router.push("/auth");
      return;
    }
    setUserId(authData.user.id);

    const [walletResult, marketsResult] = await Promise.all([
      supabase.from("wallets").select("balance").eq("user_id", authData.user.id).single(),
      supabase
        .from("markets")
        .select("*, categories!inner(name, slug, color, icon_key)")
        .eq("status", "open")
        .order("created_at", { ascending: true }),
    ]);

    if (walletResult.error) {
      setError(walletResult.error.message);
      setLoading(false);
      return;
    }

    if (marketsResult.error) {
      setError(marketsResult.error.message);
      setLoading(false);
      return;
    }

    const syncedMarkets = (marketsResult.data as MarketWithCategory[]).map(
      ({ categories, ...market }) => ({ ...market, category: categories }),
    );

    setUserBalance(Number(walletResult.data.balance));
    setMarkets(syncedMarkets);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  // Chart history is per-market, so it reloads whenever the focused market changes.
  useEffect(() => {
    const focused = markets.find((market) => market.id === heroMarketId);
    if (!focused) return;

    let cancelled = false;
    void (async () => {
      const { data: history, error: historyError } = await supabase
        .from("market_price_history")
        .select("created_at, probability_yes")
        .eq("market_id", focused.id)
        .order("created_at", { ascending: true })
        .limit(100);
      if (cancelled) return;

      if (historyError) {
        setError(historyError.message);
        return;
      }

      const initialYes = Math.round(
        calculateProbability(Number(focused.pool_yes), Number(focused.pool_no)) * 100,
      );
      setChart({
        marketId: focused.id,
        points: [
          {
            day: new Date(focused.opens_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
            yes: history?.length ? 50 : initialYes,
            no: history?.length ? 50 : 100 - initialYes,
          },
          ...(history ?? []).map((point) => {
            const yes = Math.round(Number(point.probability_yes) * 100);
            return {
              day: new Date(point.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              }),
              yes,
              no: 100 - yes,
            };
          }),
        ],
      });
    })();

    return () => { cancelled = true; };
    // Only the identity of the focused market should retrigger a history fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroMarketId, markets.length, supabase]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`eaglemarket-sync-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "markets" },
        (payload) => {
          const updated = payload.new as MarketRow;
          if (updated.status !== "open") {
            setMarkets((current) => current.filter((market) => market.id !== updated.id));
            if (updated.id === heroMarketId) void load();
            return;
          }
          setMarkets((current) =>
            current.map((market) =>
              market.id === updated.id
                ? { ...market, ...updated, category: market.category }
                : market,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as WalletRow;
          if (updated.user_id === userId) setUserBalance(Number(updated.balance));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "market_price_history" },
        (payload) => {
          const point = payload.new as PriceHistoryRow;
          if (point.market_id !== heroMarketId) return;
          const yes = Math.round(Number(point.probability_yes) * 100);
          const nextPoint = {
            day: new Date(point.created_at).toLocaleDateString(undefined, {
              month: "short" as const,
              day: "numeric" as const,
            }),
            yes,
            no: 100 - yes,
          };
          setChart((current) =>
            current.marketId === point.market_id
              ? { ...current, points: [...current.points.slice(-99), nextPoint] }
              : current,
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [heroMarketId, load, supabase, userId]);

  const executeTrade = useCallback(
    async (marketId: number, amount: number, outcome: "yes" | "no") => {
      setTrading(true);
      setError(null);
      const fingerprint = `${marketId}:${amount}:${outcome}`;
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
            marketId,
            amount,
            outcome,
            idempotencyKey,
          }),
        });
        const result = (await response.json()) as {
          error?: string;
          balance?: number;
          market_id?: number;
          pool_yes?: number;
          pool_no?: number;
          total_volume?: number;
        };

        if (!response.ok) {
          if (response.status < 500) pendingTrade.current = null;
          setError(result.error ?? "The trade could not be completed.");
          return false;
        }

        pendingTrade.current = null;
        setUserBalance(Number(result.balance));
        setMarkets((current) =>
          current.map((market) =>
            market.id === result.market_id
              ? {
                  ...market,
                  pool_yes: Number(result.pool_yes),
                  pool_no: Number(result.pool_no),
                  total_volume: Number(result.total_volume),
                }
              : market,
          ),
        );
        return true;
      } catch {
        setError("The network request failed. Your balance was not changed twice; try again safely.");
        return false;
      } finally {
        setTrading(false);
      }
    },
    [],
  );

  const heroMarket = markets.find((market) => market.id === heroMarketId) ?? null;
  const chartData = chart.marketId === heroMarketId ? chart.points : [];
  const marketMissing =
    focusMarketId !== undefined && !loading && !markets.some((m) => m.id === focusMarketId);
  const probYes = heroMarket
    ? Math.round(
        calculateProbability(Number(heroMarket.pool_yes), Number(heroMarket.pool_no)) * 100,
      )
    : 50;
  const probNo = 100 - probYes;

  const preview = (amount: number, isBuyingYes: boolean) => {
    if (!heroMarket || amount <= 0) return null;
    return calculatePurchaseOutput(
      amount,
      Number(heroMarket.pool_yes),
      Number(heroMarket.pool_no),
      isBuyingYes,
    );
  };

  const previewSlippage = (amount: number, isBuyingYes: boolean) => {
    if (!heroMarket) return 0;
    return calculateSlippage(
      amount,
      Number(heroMarket.pool_yes),
      Number(heroMarket.pool_no),
      isBuyingYes,
    );
  };

  return {
    markets,
    heroMarket,
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
    refresh: load,
  };
}
