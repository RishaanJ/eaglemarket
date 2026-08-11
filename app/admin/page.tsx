import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminClient, { type AdminCategory, type AdminMarket } from "./admin-client";
import { type AdminAnnouncement } from "./announcements-panel";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/auth?next=/admin");

  const [profileResult, walletResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, role, account_status")
      .eq("user_id", authData.user.id)
      .single(),
    supabase.from("wallets").select("balance").eq("user_id", authData.user.id).single(),
  ]);

  if (profileResult.error || walletResult.error) {
    return <main className="sync-state"><strong>We couldn’t load the admin workspace.</strong></main>;
  }

  if (profileResult.data.role !== "admin" || profileResult.data.account_status !== "active") {
    return (
      <main className="admin-denied">
        <strong>Administrator access required</strong>
        <span>Your account does not have permission to manage markets.</span>
        <Link href="/markets">Return to markets</Link>
      </main>
    );
  }

  const [marketsResult, categoriesResult, announcementsResult] = await Promise.all([
    supabase.rpc("admin_list_markets"),
    supabase
      .from("categories")
      .select("id, name, color")
      .eq("is_active", true)
      .order("sort_order"),
    supabase.rpc("admin_list_announcements"),
  ]);

  if (marketsResult.error || categoriesResult.error || announcementsResult.error) {
    return (
      <main className="sync-state">
        <strong>We couldn’t load market operations.</strong>
        <span>Apply the latest Supabase migration and refresh.</span>
      </main>
    );
  }

  const markets: AdminMarket[] = (marketsResult.data ?? []).map((market) => ({
    id: Number(market.id),
    categoryId: Number(market.category_id),
    categoryName: market.category_name,
    categoryColor: market.category_color,
    question: market.question,
    description: market.description,
    resolutionCriteria: market.resolution_criteria,
    resolutionSourceUrl: market.resolution_source_url,
    status: market.status,
    resolvedOutcome: market.resolved_outcome,
    opensAt: market.opens_at,
    closesAt: market.closes_at,
    totalVolume: Number(market.total_volume),
    poolYes: Number(market.pool_yes),
    poolNo: Number(market.pool_no),
    createdAt: market.created_at,
    tradeCount: Number(market.trade_count),
    positionCount: Number(market.position_count),
  }));

  const categories: AdminCategory[] = (categoriesResult.data ?? []).map((category) => ({
    id: Number(category.id),
    name: category.name,
    color: category.color,
  }));

  const announcements: AdminAnnouncement[] = (announcementsResult.data ?? []).map((row) => ({
    id: Number(row.id),
    message: row.message,
    severity: row.severity,
    isActive: row.is_active,
    endsAt: row.ends_at,
    isLive: row.is_live,
    updatedAt: row.updated_at,
  }));

  return (
    <AdminClient
      balance={Number(walletResult.data.balance)}
      displayName={profileResult.data.display_name}
      markets={markets}
      categories={categories}
      announcements={announcements}
    />
  );
}
