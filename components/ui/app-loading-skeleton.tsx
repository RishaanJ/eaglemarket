import { Skeleton } from "@/components/ui/skeleton";

function SkeletonTopbar() {
  return (
    <header className="skeleton-topbar">
      <div className="skeleton-brand"><Skeleton /><Skeleton /></div>
      <nav><Skeleton /><Skeleton /><Skeleton /></nav>
      <Skeleton className="skeleton-search" />
      <Skeleton className="skeleton-balance" />
    </header>
  );
}

function MarketsSkeleton() {
  return (
    <>
      <div className="skeleton-category-bar">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} />)}</div>
      <main className="skeleton-main">
        <section className="skeleton-market-hero">
          <div><Skeleton className="skeleton-title-lg" /><Skeleton className="skeleton-copy" /><Skeleton className="skeleton-copy-short" /><div className="skeleton-pair"><Skeleton /><Skeleton /></div></div>
          <div><Skeleton className="skeleton-chart" /></div>
          <div><Skeleton className="skeleton-control" /><Skeleton className="skeleton-control" /><Skeleton className="skeleton-control-lg" /><Skeleton className="skeleton-button" /></div>
        </section>
        <div className="skeleton-section-title"><Skeleton /><Skeleton /></div>
        <div className="skeleton-card-grid">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="skeleton-market-card" />)}</div>
      </main>
    </>
  );
}

function DashboardSkeleton({ kind }: { kind: "picks" | "rankings" | "admin" }) {
  return (
    <main className="skeleton-main skeleton-dashboard-main">
      <div className="skeleton-page-heading"><div><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /></div><Skeleton className="skeleton-heading-action" /></div>
      {kind === "admin" && <div className="skeleton-stat-grid">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} />)}</div>}
      <div className={kind === "rankings" ? "skeleton-rank-overview" : "skeleton-dashboard-grid"}>
        <Skeleton /><Skeleton />
      </div>
      <div className="skeleton-section-title"><Skeleton /><Skeleton /></div>
      <div className="skeleton-list">{Array.from({ length: kind === "rankings" ? 6 : 4 }, (_, index) => <Skeleton key={index} />)}</div>
    </main>
  );
}

function SettingsSkeleton() {
  return (
    <main className="skeleton-main skeleton-settings-main">
      <div className="skeleton-page-heading"><div><Skeleton className="skeleton-title" /><Skeleton className="skeleton-copy" /></div></div>
      <Skeleton className="skeleton-identity" />
      <Skeleton className="skeleton-settings-card" />
      <Skeleton className="skeleton-settings-card skeleton-settings-card-short" />
    </main>
  );
}

export function AppLoadingSkeleton({ kind }: { kind: "markets" | "picks" | "rankings" | "settings" | "admin" }) {
  return (
    <div className="app-shell skeleton-shell" aria-label="Loading page" aria-busy="true">
      <SkeletonTopbar />
      {kind === "markets" ? <MarketsSkeleton /> : kind === "settings" ? <SettingsSkeleton /> : <DashboardSkeleton kind={kind} />}
    </div>
  );
}
