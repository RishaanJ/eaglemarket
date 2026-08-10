import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PicksClient, {
  type PickPosition,
  type RecentPick,
} from "./picks-client";

type PositionQueryRow = {
  market_id: number;
  yes_shares: number;
  no_shares: number;
  total_invested: number;
  updated_at: string;
  markets: {
    id: number;
    question: string;
    status: string;
    resolved_outcome: string | null;
    closes_at: string;
    pool_yes: number;
    pool_no: number;
    categories: { name: string; color: string };
  };
};

type TradeQueryRow = {
  id: number;
  outcome: string;
  token_amount: number;
  shares_received: number;
  average_price: number;
  created_at: string;
  markets: { question: string };
};

type PriceHistoryQueryRow = {
  market_id: number;
  probability_yes: number;
  created_at: string;
};

export default async function PicksPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/auth?next=/picks");

  const [walletResult, positionsResult, settlementsResult, tradesResult] = await Promise.all([
    supabase.from("wallets").select("balance").eq("user_id", authData.user.id).single(),
    supabase
      .from("positions")
      .select(
        "market_id, yes_shares, no_shares, total_invested, updated_at, markets!inner(id, question, status, resolved_outcome, closes_at, pool_yes, pool_no, categories!inner(name, color))",
      )
      .eq("user_id", authData.user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("market_settlements")
      .select("market_id, payout, winning_outcome, winning_shares, settled_at")
      .eq("user_id", authData.user.id),
    supabase
      .from("trades")
      .select(
        "id, outcome, token_amount, shares_received, average_price, created_at, markets!inner(question)",
      )
      .eq("user_id", authData.user.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const queryError =
    walletResult.error ??
    positionsResult.error ??
    settlementsResult.error ??
    tradesResult.error;

  if (queryError) {
    return (
      <main className="sync-state">
        <strong>We couldn’t load your picks.</strong>
        <span>Please refresh the page or try again in a moment.</span>
      </main>
    );
  }

  const settlements = new Map(
    (settlementsResult.data ?? []).map((settlement) => [settlement.market_id, settlement]),
  );

  const positionRows = (positionsResult.data ?? []) as unknown as PositionQueryRow[];
  const marketIds = positionRows.map((position) => position.market_id);
  const historyResult = marketIds.length
    ? await supabase
        .from("market_price_history")
        .select("market_id, probability_yes, created_at")
        .in("market_id", marketIds)
        .order("created_at", { ascending: true })
        .limit(500)
    : { data: [], error: null };

  if (historyResult.error) {
    return (
      <main className="sync-state">
        <strong>We couldn’t load your picks.</strong>
        <span>Please refresh the page or try again in a moment.</span>
      </main>
    );
  }

  const histories = new Map<number, PickPosition["history"]>();
  for (const point of (historyResult.data ?? []) as PriceHistoryQueryRow[]) {
    const yes = Math.round(Number(point.probability_yes) * 100);
    const history = histories.get(point.market_id) ?? [];
    history.push({
      timestamp: point.created_at,
      yes,
      no: 100 - yes,
    });
    histories.set(point.market_id, history);
  }

  const positions: PickPosition[] = positionRows.map((position) => {
    const market = position.markets;
    const settlement = settlements.get(position.market_id);
    const poolYes = Number(market.pool_yes);
    const poolNo = Number(market.pool_no);
    const probabilityYes = poolNo / (poolYes + poolNo);
    const currentValue =
      Number(position.yes_shares) * probabilityYes +
      Number(position.no_shares) * (1 - probabilityYes);

    return {
      marketId: position.market_id,
      question: market.question,
      category: market.categories.name,
      categoryColor: market.categories.color,
      status: market.status,
      resolvedOutcome: market.resolved_outcome as "yes" | "no" | null,
      closesAt: market.closes_at,
      probabilityYes,
      yesShares: Number(position.yes_shares),
      noShares: Number(position.no_shares),
      invested: Number(position.total_invested),
      currentValue,
      payout: settlement ? Number(settlement.payout) : null,
      history: histories.get(position.market_id) ?? [],
    };
  });

  const recentPicks: RecentPick[] = ((tradesResult.data ?? []) as unknown as TradeQueryRow[]).map(
    (trade) => ({
      id: trade.id,
      question: trade.markets.question,
      outcome: trade.outcome as "yes" | "no",
      amount: Number(trade.token_amount),
      shares: Number(trade.shares_received),
      averagePrice: Number(trade.average_price),
      createdAt: trade.created_at,
    }),
  );

  return (
    <PicksClient
      balance={Number(walletResult.data?.balance ?? 0)}
      positions={positions}
      recentPicks={recentPicks}
    />
  );
}
