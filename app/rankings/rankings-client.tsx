"use client";

import { ArrowRight, Menu, Search, Settings, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EagCoin } from "@/components/ui/eag-coin";
import { DitherCardFrame } from "@/components/ui/hero-dithering";
import { MotionReveal } from "@/components/ui/motion-reveal";

export type RankingEntry = {
  rank: number;
  displayName: string;
  graduationYear: number | null;
  isCurrentUser: boolean;
  portfolioValue: number;
  openPositions: number;
  totalPicks: number;
  wins: number;
  resolvedPicks: number;
};

function EagleMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "EM";
}

function formatEag(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function winRate(entry: RankingEntry) {
  return entry.resolvedPicks ? Math.round((entry.wins / entry.resolvedPicks) * 100) : null;
}

export default function RankingsClient({
  balance,
  rankings,
}: {
  balance: number;
  rankings: RankingEntry[];
}) {
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const leader = rankings[0] ?? null;
  const currentUser = rankings.find((entry) => entry.isCurrentUser) ?? null;
  const visibleRankings = useMemo(
    () => rankings.filter((entry) => entry.displayName.toLowerCase().includes(query.trim().toLowerCase())),
    [query, rankings],
  );

  return (
    <div className="app-shell rankings-shell">
      <header className="topbar">
        <Link className="wordmark" href="/">
          <EagleMark />
          <span>EagleMarket</span>
        </Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link href="/markets">Markets</Link>
          <Link href="/picks">My picks</Link>
          <Link className="active" href="/rankings">Rankings</Link>
        </nav>
        <label className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search rankings"
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
          onClick={() => setMobileOpen((open) => !open)}
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

      <main className="rankings-main">
        <MotionReveal>
        <div className="rankings-intro">
          <div>
            <h1>School rankings</h1>
            <p>Portfolio value across EagleMarket. Play tokens only—bragging rights included.</p>
          </div>
          <Link href="/markets">Make a pick <ArrowRight size={16} /></Link>
        </div>
        </MotionReveal>

        {leader ? (
          <MotionReveal delay={0.06}>
          <section className="rankings-overview" aria-label="Ranking highlights">
            <DitherCardFrame
              className="rankings-leader-dither"
              icon={Trophy}
              color="#0b84bb"
            >
              <article className="rankings-leader">
                <div className="leader-label"><Trophy size={15} /> School leader</div>
                <div className="leader-identity">
                  <span className="ranking-avatar ranking-avatar-lg">{initials(leader.displayName)}</span>
                  <div>
                    <h2>{leader.displayName}</h2>
                    <span>{leader.graduationYear ? `Class of ${leader.graduationYear}` : "American High School"}</span>
                  </div>
                </div>
                <div className="leader-value">
                  <span>Portfolio value</span>
                  <strong>{formatEag(leader.portfolioValue)} <small>EAG</small></strong>
                </div>
                <div className="leader-stats">
                  <span>{leader.totalPicks} picks</span>
                  <span>{winRate(leader) === null ? "No resolved picks" : `${winRate(leader)}% win rate`}</span>
                </div>
              </article>
            </DitherCardFrame>

            <aside className="your-standing">
              <span>Your standing</span>
              <strong>{currentUser ? `#${currentUser.rank}` : "—"}</strong>
              <p>{currentUser ? `You’re ranked among ${rankings.length} active students.` : "Make a prediction to enter the rankings."}</p>
              <div>
                <span><small>Portfolio</small>{currentUser ? `${formatEag(currentUser.portfolioValue)} EAG` : "—"}</span>
                <span><small>Win rate</small>{currentUser && winRate(currentUser) !== null ? `${winRate(currentUser)}%` : "—"}</span>
              </div>
            </aside>
          </section>
          </MotionReveal>
        ) : (
          <div className="rankings-empty">Rankings will appear after the first student joins.</div>
        )}

        <MotionReveal delay={0.12}>
        <section className="leaderboard-section">
          <div className="leaderboard-heading">
            <div><h2>Leaderboard</h2><span>{rankings.length} students ranked</span></div>
            <span>All time</span>
          </div>
          <div className="leaderboard-table">
            <div className="leaderboard-row leaderboard-header" aria-hidden="true">
              <span>Rank</span><span>Student</span><span>Portfolio</span><span>Picks</span><span>Win rate</span>
            </div>
            {visibleRankings.map((entry) => (
              <div
                className={`leaderboard-row${entry.isCurrentUser ? " current-user" : ""}`}
                key={entry.rank}
              >
                <span className={`rank-number rank-${Math.min(entry.rank, 4)}`}>{entry.rank}</span>
                <div className="ranking-student">
                  <span className="ranking-avatar">{initials(entry.displayName)}</span>
                  <div><strong>{entry.displayName}</strong><small>{entry.graduationYear ? `Class of ${entry.graduationYear}` : "AHS student"}</small></div>
                  {entry.isCurrentUser && <em>You</em>}
                </div>
                <strong className="ranking-portfolio">{formatEag(entry.portfolioValue)} <small>EAG</small></strong>
                <span>{entry.totalPicks}</span>
                <span>{winRate(entry) === null ? "—" : `${winRate(entry)}%`}</span>
              </div>
            ))}
            {!visibleRankings.length && <div className="rankings-empty">No students match that search.</div>}
          </div>
        </section>
        </MotionReveal>
      </main>
    </div>
  );
}
