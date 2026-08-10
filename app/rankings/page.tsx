import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RankingsClient, { type RankingEntry } from "./rankings-client";

export default async function RankingsPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/auth?next=/rankings");

  const [walletResult, rankingsResult] = await Promise.all([
    supabase.from("wallets").select("balance").eq("user_id", authData.user.id).single(),
    supabase.rpc("get_rankings", { result_limit: 100 }),
  ]);

  if (walletResult.error || rankingsResult.error) {
    return (
      <main className="sync-state">
        <strong>We couldn’t load the rankings.</strong>
        <span>Make sure the latest database migration is applied, then refresh.</span>
      </main>
    );
  }

  const rankings: RankingEntry[] = (rankingsResult.data ?? []).map((entry) => ({
    rank: Number(entry.rank),
    userId: entry.user_id,
    displayName: entry.display_name,
    avatarUrl: entry.avatar_url,
    graduationYear: entry.graduation_year,
    portfolioValue: Number(entry.portfolio_value),
    openPositions: Number(entry.open_positions),
    totalPicks: Number(entry.total_picks),
    wins: Number(entry.wins),
    resolvedPicks: Number(entry.resolved_picks),
  }));

  return (
    <RankingsClient
      balance={Number(walletResult.data.balance)}
      currentUserId={authData.user.id}
      rankings={rankings}
    />
  );
}
