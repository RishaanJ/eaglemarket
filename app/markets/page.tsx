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
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  Clock3,
  FlaskConical,
  Menu,
  Mic2,
  Search,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DitherCardFrame } from "@/components/ui/hero-dithering";
import { EagCoin } from "@/components/ui/eag-coin";

const chartData = [
  { day: "Jul 14", yes: 42, no: 58 },
  { day: "Jul 18", yes: 44, no: 56 },
  { day: "Jul 22", yes: 43, no: 57 },
  { day: "Jul 26", yes: 48, no: 52 },
  { day: "Jul 30", yes: 46, no: 54 },
  { day: "Aug 3", yes: 52, no: 48 },
  { day: "Aug 6", yes: 58, no: 42 },
  { day: "Aug 10", yes: 64, no: 36 },
];

const markets = [
  { icon: FlaskConical, category: "Classes", title: "Will the Carel test happen next week?", yes: 64, volume: "18.4k EAG", move: "+7%", color: "#0b84bb", closes: "Closes in 3 days" },
  { icon: CalendarDays, category: "Campus", title: "Will CO29 place above 3rd Place at SPW?", yes: 71, volume: "24.9k EAG", move: "+3%", color: "#a264d8", closes: "Closes Apr 18" },
  { icon: Mic2, category: "Clubs", title: "Will Buggin Art Mag drop next week?", yes: 46, volume: "8.7k EAG", move: "−2%", color: "#e76d45", closes: "Closes Friday" },
  { icon: Trophy, category: "Sports", title: "Will Women's varsity volleyball win Friday's home match?", yes: 58, volume: "12.1k EAG", move: "+5%", color: "#2d9a70", closes: "Closes in 8 hours" },
];

const categories = ["Trending", "Classes", "Campus", "SPW", "Sports", "Clubs", "Teachers", "Seniors"];

function EagleMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function MarketCard({ market }: { market: (typeof markets)[number] }) {
  const [side, setSide] = useState<"yes" | "no" | null>(null);
  const Icon = market.icon;
  const card = (
    <article className="market-card">
      <div className="market-card-top">
        <span className="category-label">{market.category}</span>
        <button className="watch-button" aria-label={`Watch ${market.title}`}><Bell size={16} /></button>
      </div>
      <h3>{market.title}</h3>
      <div className="probability-row">
        <div><strong>{market.yes}%</strong><span>chance</span></div>
        <span className={market.move.startsWith("+") ? "move-up" : "move-down"}>{market.move} today</span>
      </div>
      <div className="trade-row">
        <button className={side === "yes" ? "yes selected" : "yes"} onClick={() => setSide("yes")}>Yes <span>{market.yes}¢</span></button>
        <button className={side === "no" ? "no selected" : "no"} onClick={() => setSide("no")}>No <span>{100 - market.yes}¢</span></button>
      </div>
      <div className="card-foot"><span>{market.volume} traded</span><span><Clock3 size={12} />{market.closes}</span></div>
    </article>
  );
  return <DitherCardFrame icon={Icon} color={market.color}>{card}</DitherCardFrame>;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("Trending");
  const [orderSide, setOrderSide] = useState<"yes" | "no">("yes");
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleMarkets = markets.filter((market) =>
    market.title.toLowerCase().includes(query.toLowerCase()) &&
    (activeCategory === "Trending" || market.category === activeCategory)
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="wordmark" href="/"><EagleMark /><span>EagleMarket</span></Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          <a className="active" href="#markets">Markets</a>
          <a href="#portfolio">My picks</a>
          <a href="#rankings">Rankings</a>
        </nav>
        <label className="search-box">
          <Search size={18} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search markets" />
          <kbd>⌘ K</kbd>
        </label>
        <div className="auth-actions">
          <button className="token-balance"><EagCoin size="sm" /> 2,450 EAG</button>
          <button className="signup">Profile</button>
        </div>
        <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu"><Menu /></button>
      </header>

      {mobileOpen && <nav className="mobile-nav"><a href="#markets">Markets</a><a href="#live">Live</a><a href="#portfolio">My picks</a><button>Profile</button></nav>}

      <div className="category-bar">
        <div className="category-scroll">
          {categories.map((category) => (
            <button key={category} className={activeCategory === category ? "active" : ""} onClick={() => setActiveCategory(category)}>{category}</button>
          ))}
        </div>
      </div>

      <main>
        <section className="hero-market" id="markets">
          <div className="hero-copy">
            <h1>Will the next Chem Honors Liu test average be above 82%?</h1>
            <p className="hero-description">Resolves Yes if the official class average posted by Ms. Liu is 82.1% or higher. Retakes are not included.</p>

            <div className="outcome-summary">
              <div className="outcome active"><span className="outcome-dot yes-dot" /><div><span>YES</span><strong>64%</strong></div></div>
              <div className="outcome"><span className="outcome-dot no-dot" /><div><span>NO</span><strong>36%</strong></div></div>
            </div>
            <div className="market-stats"><span><strong>18.4k EAG</strong> volume</span><span><strong>286</strong> predictors</span><span><Clock3 size={15} /><strong>3 days</strong> left</span></div>
          </div>

          <div className="chart-panel" aria-label="Market probability chart">
            <div className="chart-header"><div className="chart-legend"><span><i className="legend-dot yes-line" />Yes <strong>64%</strong></span><span><i className="legend-dot no-line" />No <strong>36%</strong></span></div><div className="range-tabs"><button>1D</button><button>1W</button><button className="active">1M</button><button>ALL</button></div></div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 15, right: 8, bottom: 0, left: -6 }}>
                  <CartesianGrid stroke="oklch(0.83 0 0)" strokeDasharray="2 7" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: "oklch(0.53 0.02 240)", fontSize: 11 }} interval={1} />
                  <YAxis orientation="right" domain={[30, 70]} ticks={[30, 40, 50, 60, 70]} tickLine={false} axisLine={false} width={38} tick={{ fill: "oklch(0.53 0.02 240)", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ border: "none", borderRadius: 8, boxShadow: "0 3px 8px oklch(0.2 0.03 240 / .14)", fontSize: 12 }} formatter={(value, name) => [`${value}%`, name === "yes" ? "Yes" : "No"]} />
                  <Line type="stepAfter" dataKey="no" stroke="oklch(0.62 0.2 25)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "oklch(0.62 0.2 25)", strokeWidth: 0 }} />
                  <Line type="stepAfter" dataKey="yes" stroke="oklch(0.58 0.18 255)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: "oklch(0.58 0.18 255)", strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <aside className="order-panel">
            <div className="order-title"><span>Make a prediction</span><span>Balance 2,450 EAG</span></div>
            <div className="side-toggle"><button className={orderSide === "yes" ? "active yes" : ""} onClick={() => setOrderSide("yes")}>Yes <span>64¢</span></button><button className={orderSide === "no" ? "active no" : ""} onClick={() => setOrderSide("no")}>No <span>36¢</span></button></div>
            <label className="amount-label">Play tokens</label>
            <div className="amount-input"><EagCoin size="sm" /><input inputMode="decimal" placeholder="0" /><button>EAG <ChevronDown size={14} /></button></div>
            <div className="quick-amounts"><button>10</button><button>25</button><button>50</button><button>Max</button></div>
            <div className="order-summary"><span>Potential return</span><strong>0 EAG</strong></div>
            <button className="review-button">Review prediction <ArrowRight size={17} /></button>
            <p>EAG are free play tokens with no cash value. Correct picks settle at 100 EAG per contract.</p>
          </aside>
        </section>

        

        <section className="market-section mt-12">
          <div className="section-heading"><div><h2>Markets moving at school</h2><p>What Eagles are predicting today</p></div><button>View all markets <ArrowRight size={17} /></button></div>
          <div className="market-grid">
            {visibleMarkets.length ? visibleMarkets.map((market) => <MarketCard key={market.title} market={market} />) : <div className="empty-state">No markets match this search yet.</div>}
          </div>
        </section>

      </main>
    </div>
  );
}
