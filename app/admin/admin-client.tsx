"use client";

import {
  ArrowRight,
  Check,
  CircleAlert,
  Clock3,
  LoaderCircle,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { EagCoin } from "@/components/ui/eag-coin";
import { MotionReveal } from "@/components/ui/motion-reveal";
import { createClient } from "@/lib/supabase/client";
import { AnnouncementsPanel, type AdminAnnouncement } from "./announcements-panel";
import { NotificationPanel } from "@/components/notification-panel";

export type AdminCategory = { id: number; name: string; color: string };

export type AdminMarket = {
  id: number;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  question: string;
  description: string | null;
  resolutionCriteria: string;
  resolutionSourceUrl: string | null;
  status: string;
  resolvedOutcome: string | null;
  opensAt: string;
  closesAt: string;
  totalVolume: number;
  poolYes: number;
  poolNo: number;
  createdAt: string;
  tradeCount: number;
  positionCount: number;
};

type StatusFilter = "all" | "draft" | "open" | "closed" | "resolved";
type FormState = {
  categoryId: string;
  question: string;
  description: string;
  criteria: string;
  sourceUrl: string;
  opensAt: string;
  closesAt: string;
  liquidity: string;
  status: "draft" | "open";
};

const emptyForm: FormState = {
  categoryId: "",
  question: "",
  description: "",
  criteria: "",
  sourceUrl: "",
  opensAt: "",
  closesAt: "",
  liquidity: "1000",
  status: "draft",
};

function EagleMark() {
  return <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>;
}

function formatEag(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function marketProbability(market: AdminMarket) {
  return Math.round((market.poolNo / (market.poolYes + market.poolNo)) * 100);
}

export default function AdminClient({
  balance,
  displayName,
  markets,
  categories,
  announcements,
}: {
  balance: number;
  displayName: string;
  markets: AdminMarket[];
  categories: AdminCategory[];
  announcements: AdminAnnouncement[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [working, setWorking] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [resolution, setResolution] = useState<{ marketId: number; outcome: "yes" | "no" } | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const visibleMarkets = useMemo(
    () => markets.filter((market) =>
      (filter === "all" || market.status === filter) &&
      market.question.toLowerCase().includes(query.trim().toLowerCase()),
    ),
    [filter, markets, query],
  );

  const counts = {
    draft: markets.filter((market) => market.status === "draft").length,
    open: markets.filter((market) => market.status === "open").length,
    closed: markets.filter((market) => market.status === "closed").length,
    resolved: markets.filter((market) => market.status === "resolved").length,
  };

  const updateForm = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFeedback(null);
  };

  const createMarket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.categoryId || !form.opensAt || !form.closesAt) {
      setFeedback({ tone: "error", message: "Category, opening time, and closing time are required." });
      return;
    }

    setWorking("create");
    setFeedback(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_create_market", {
      p_category_id: Number(form.categoryId),
      p_question: form.question,
      p_description: form.description,
      p_resolution_criteria: form.criteria,
      p_resolution_source_url: form.sourceUrl,
      p_opens_at: new Date(form.opensAt).toISOString(),
      p_closes_at: new Date(form.closesAt).toISOString(),
      p_initial_liquidity: Number(form.liquidity),
      p_status: form.status,
    });

    if (error) {
      setWorking(null);
      setFeedback({ tone: "error", message: error.message });
      return;
    }

    setForm(emptyForm);
    setCreating(false);
    setWorking(null);
    setFeedback({ tone: "success", message: "Market created successfully." });
    router.refresh();
  };

  const changeStatus = async (marketId: number, status: "open" | "closed") => {
    setWorking(`${status}:${marketId}`);
    setFeedback(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("admin_set_market_status", {
      p_market_id: marketId,
      p_status: status,
    });
    setWorking(null);
    if (error) {
      setFeedback({ tone: "error", message: error.message });
      return;
    }
    setFeedback({ tone: "success", message: status === "open" ? "Market published." : "Trading closed." });
    router.refresh();
  };

  const resolveMarket = async () => {
    if (!resolution) return;
    setWorking(`resolve:${resolution.marketId}`);
    setFeedback(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_resolve_market", {
      p_market_id: resolution.marketId,
      p_outcome: resolution.outcome,
      p_resolution_note: resolutionNote,
    });
    setWorking(null);
    if (error) {
      setFeedback({ tone: "error", message: error.message });
      return;
    }
    const result = data?.[0];
    setResolution(null);
    setResolutionNote("");
    setFeedback({
      tone: "success",
      message: `Resolved ${resolution.outcome.toUpperCase()}. ${result?.settled_positions ?? 0} positions settled for ${formatEag(Number(result?.total_payout ?? 0))} EAG.`,
    });
    router.refresh();
  };

  return (
    <div className="app-shell admin-shell">
      <header className="topbar">
        <Link className="wordmark" href="/markets"><EagleMark /><span>EagleMarket</span></Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link href="/markets">Markets</Link>
          <Link href="/picks">My picks</Link>
          <Link href="/rankings">Rankings</Link>
        </nav>
        <label className="search-box">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search managed markets" />
          <kbd>Cmd K</kbd>
        </label>
        <div className="auth-actions">
          <button className="token-balance"><EagCoin size="sm" /> {balance.toLocaleString()} EAG</button>
          <NotificationPanel />
          <Link className="icon-button" href="/settings" aria-label="Settings"><Settings size={18} /></Link>
        </div>
        <button className="mobile-menu" onClick={() => setMobileOpen((open) => !open)} aria-label="Toggle menu"><Menu /></button>
      </header>

      {mobileOpen && (
        <nav className="mobile-nav">
          <Link href="/markets">Markets</Link><Link href="/picks">My picks</Link><Link href="/rankings">Rankings</Link>
          <Link className="mobile-settings-link" href="/settings">Settings</Link>
        </nav>
      )}

      <main className="admin-main">
        <MotionReveal>
        <div className="admin-intro">
          <div><span><ShieldCheck size={14} /> Admin · {displayName}</span><h1>Market operations</h1><p>Create questions, manage trading states, and settle official outcomes.</p></div>
          <button onClick={() => setCreating((open) => !open)}>{creating ? <X size={16} /> : <Plus size={16} />}{creating ? "Close form" : "Create market"}</button>
        </div>
        </MotionReveal>

        <MotionReveal delay={0.05}>
        <section className="admin-stats" aria-label="Market status overview">
          {(["open", "closed", "draft", "resolved"] as const).map((status) => (
            <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(filter === status ? "all" : status)}>
              <span>{status === "closed" ? "Awaiting resolution" : status}</span><strong>{counts[status]}</strong>
            </button>
          ))}
        </section>
        </MotionReveal>

        {feedback && <div className={`admin-feedback ${feedback.tone}`} role="status">{feedback.tone === "success" ? <Check size={15} /> : <CircleAlert size={15} />}{feedback.message}</div>}

        {creating && (
          <MotionReveal>
          <form className="admin-create-panel" onSubmit={createMarket}>
            <div className="admin-panel-heading"><div><h2>New market</h2><p>Define the question and an objective source before publishing.</p></div></div>
            <div className="admin-form-grid">
              <label><span>Category</span><select value={form.categoryId} onChange={(event) => updateForm("categoryId", event.target.value)} required><option value="">Select category</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
              <label><span>Starting state</span><select value={form.status} onChange={(event) => updateForm("status", event.target.value)}><option value="draft">Save as draft</option><option value="open">Publish immediately</option></select></label>
              <label className="admin-full-field"><span>Market question</span><input value={form.question} onChange={(event) => updateForm("question", event.target.value)} minLength={10} maxLength={240} placeholder="Will the next…?" required /></label>
              <label className="admin-full-field"><span>Description</span><textarea value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Optional context students should know." /></label>
              <label className="admin-full-field"><span>Resolution criteria</span><textarea value={form.criteria} onChange={(event) => updateForm("criteria", event.target.value)} minLength={10} maxLength={2000} placeholder="State exactly what evidence resolves Yes or No." required /></label>
              <label className="admin-full-field"><span>Official source URL</span><input type="url" value={form.sourceUrl} onChange={(event) => updateForm("sourceUrl", event.target.value)} placeholder="https://…" /></label>
              <label><span>Opens</span><input type="datetime-local" value={form.opensAt} onChange={(event) => updateForm("opensAt", event.target.value)} required /></label>
              <label><span>Closes</span><input type="datetime-local" value={form.closesAt} onChange={(event) => updateForm("closesAt", event.target.value)} required /></label>
              <label><span>Liquidity per side</span><input type="number" min="100" max="100000" step="1" value={form.liquidity} onChange={(event) => updateForm("liquidity", event.target.value)} required /></label>
            </div>
            <div className="admin-form-footer"><span>Winning shares settle at exactly 1 EAG each.</span><button disabled={working === "create"}>{working === "create" ? <><LoaderCircle className="trade-spinner" size={15} /> Creating…</> : <>Create market <ArrowRight size={15} /></>}</button></div>
          </form>
          </MotionReveal>
        )}

        <MotionReveal delay={0.1}>
        <AnnouncementsPanel announcements={announcements} />

        <section className="admin-market-section">
          <div className="admin-section-heading"><div><h2>All markets</h2><span>{visibleMarkets.length} shown</span></div><div className="admin-filters">{(["all", "draft", "open", "closed", "resolved"] as StatusFilter[]).map((status) => <button className={filter === status ? "active" : ""} onClick={() => setFilter(status)} key={status}>{status}</button>)}</div></div>
          <div className="admin-market-list">
            {visibleMarkets.map((market) => (
              <article className="admin-market-row" key={market.id}>
                <div className="admin-market-copy">
                  <div><span className="admin-category-dot" style={{ background: market.categoryColor }} />{market.categoryName}<span className={`admin-status ${market.status}`}>{market.status}{market.resolvedOutcome ? ` · ${market.resolvedOutcome}` : ""}</span></div>
                  <h3>{market.question}</h3>
                  <span><Clock3 size={12} /> Closes {new Date(market.closesAt).toLocaleString()}</span>
                </div>
                <div className="admin-market-metrics"><span><small>Yes chance</small>{marketProbability(market)}%</span><span><small>Volume</small>{formatEag(market.totalVolume)} EAG</span><span><small>Positions</small>{market.positionCount}</span></div>
                <div className="admin-market-actions">
                  {market.status === "draft" && <button onClick={() => changeStatus(market.id, "open")} disabled={working === `open:${market.id}`}>Publish</button>}
                  {market.status === "open" && <button onClick={() => changeStatus(market.id, "closed")} disabled={working === `closed:${market.id}`}>Close trading</button>}
                  {market.status === "closed" && <><button className="resolve-yes" onClick={() => setResolution({ marketId: market.id, outcome: "yes" })}>Resolve Yes</button><button className="resolve-no" onClick={() => setResolution({ marketId: market.id, outcome: "no" })}>Resolve No</button></>}
                  {market.status === "resolved" && <span className="admin-complete"><Check size={14} /> Settled</span>}
                </div>
                {resolution?.marketId === market.id && (
                  <div className="admin-resolution-confirm">
                    <div><CircleAlert size={17} /><span><strong>Resolve {resolution.outcome.toUpperCase()}?</strong>This pays every winning share and cannot be undone.</span></div>
                    <input value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} maxLength={1000} placeholder="Optional resolution note" />
                    <button onClick={() => { setResolution(null); setResolutionNote(""); }}>Cancel</button>
                    <button className={resolution.outcome === "yes" ? "confirm-yes" : "confirm-no"} onClick={resolveMarket} disabled={working === `resolve:${market.id}`}>{working === `resolve:${market.id}` ? "Settling…" : `Confirm ${resolution.outcome.toUpperCase()}`}</button>
                  </div>
                )}
              </article>
            ))}
            {!visibleMarkets.length && <div className="admin-empty">No markets match this view.</div>}
          </div>
        </section>
        </MotionReveal>
      </main>
    </div>
  );
}
