import { notFound, redirect } from "next/navigation";
import { safeHttpUrl } from "@/lib/security/safe-url";
import { createClient } from "@/lib/supabase/server";
import MarketDetailClient, { type MarketDetail } from "./market-detail-client";

type MarketQueryRow = {
  id: number;
  question: string;
  description: string | null;
  resolution_criteria: string;
  resolution_source_url: string | null;
  status: string;
  resolved_outcome: string | null;
  opens_at: string;
  closes_at: string;
  pool_yes: number;
  pool_no: number;
  total_volume: number;
  categories: { name: string; slug: string; color: string };
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Every market gets a plain-language note, not just the ones an admin wrote a
 * description for. When `description` is empty we synthesise one from facts we
 * always have, so the section never renders blank or disappears on some
 * markets and not others.
 */
function marketNote(market: MarketQueryRow) {
  const description = market.description?.trim();
  if (description) return description;

  return (
    `This is a ${market.categories.name.toLowerCase()} market. It opened on ` +
    `${formatDate(market.opens_at)} and stops accepting predictions on ` +
    `${formatDate(market.closes_at)}, at which point the outcome is checked ` +
    `against the resolution rules below and every correct contract pays out ` +
    `100 EAG.`
  );
}

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Reject anything that is not a plain positive integer before it reaches the
  // database, so `/markets/abc` is a 404 rather than a query error.
  if (!/^\d+$/.test(id)) notFound();
  const marketId = Number(id);
  if (!Number.isSafeInteger(marketId) || marketId <= 0) notFound();

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) redirect(`/auth?next=/markets/${marketId}`);

  const [marketResult, historyResult, walletResult, positionResult] = await Promise.all([
    supabase
      .from("markets")
      .select(
        "id, question, description, resolution_criteria, resolution_source_url, status, resolved_outcome, opens_at, closes_at, pool_yes, pool_no, total_volume, categories!inner(name, slug, color)",
      )
      .eq("id", marketId)
      .maybeSingle(),
    supabase
      .from("market_price_history")
      .select("probability_yes, created_at")
      .eq("market_id", marketId)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase.from("wallets").select("balance").eq("user_id", authData.user.id).single(),
    supabase
      .from("positions")
      .select("yes_shares, no_shares, total_invested")
      .eq("user_id", authData.user.id)
      .eq("market_id", marketId)
      .maybeSingle(),
  ]);

  // RLS hides draft markets, so an unpublished market arrives here as null and
  // correctly becomes a 404 rather than leaking its existence.
  if (marketResult.error || !marketResult.data) notFound();

  if (historyResult.error || walletResult.error || positionResult.error) {
    return (
      <main className="sync-state">
        <strong>We couldn’t load this market.</strong>
        <span>Please refresh the page or try again in a moment.</span>
      </main>
    );
  }

  const row = marketResult.data as unknown as MarketQueryRow;

  const market: MarketDetail = {
    id: row.id,
    question: row.question,
    note: marketNote(row),
    resolutionCriteria: row.resolution_criteria,
    // Admin-supplied and stored unvalidated: anything that is not http(s) is
    // dropped rather than rendered as a link.
    resolutionSourceUrl: safeHttpUrl(row.resolution_source_url),
    status: row.status,
    resolvedOutcome: row.resolved_outcome as "yes" | "no" | null,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    poolYes: Number(row.pool_yes),
    poolNo: Number(row.pool_no),
    totalVolume: Number(row.total_volume),
    categoryName: row.categories.name,
    categorySlug: row.categories.slug,
    categoryColor: row.categories.color,
  };

  const history = (historyResult.data ?? []).map((point) => {
    const yes = Math.round(Number(point.probability_yes) * 100);
    return { timestamp: point.created_at, yes, no: 100 - yes };
  });

  return (
    <MarketDetailClient
      market={market}
      history={history}
      balance={Number(walletResult.data?.balance ?? 0)}
      position={
        positionResult.data
          ? {
              yesShares: Number(positionResult.data.yes_shares),
              noShares: Number(positionResult.data.no_shares),
              invested: Number(positionResult.data.total_invested),
            }
          : null
      }
    />
  );
}
