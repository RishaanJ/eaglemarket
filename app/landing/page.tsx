"use client";

import { ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight, FlaskConical, Trophy } from "lucide-react";
import Link from "next/link";
import { BentoGrid } from "@/components/ui/bento-grid";
import { LineShadowText } from "@/components/ui/line-shadow-text"
import { EagCoin } from "@/components/ui/eag-coin";
import { GridPattern } from "@/components/ui/grid-pattern";
import { DitherCardFrame } from "@/components/ui/hero-dithering";
import { Marquee } from "@/components/ui/marquee";
import { NoiseBars } from "@/components/ui/noise-bars";
import styles from "./landing.module.css";

const topics = ["AP Chemistry", "Friday football", "SPW", "Senior class", "Clubs", "Campus events"];

// Placeholder roadmap — statuses and wording are drafts, edit freely.
const roadmap = [
  { status: "PLANNED", title: "Multi-choice markets", body: "Questions with more than two answers, priced by the same market maker. Who wins SPW, which team takes the title." },
  { status: "PLANNED", title: "Class leagues", body: "Leaderboards split by graduating class, so 2027 can finally settle it with 2028." },
  { status: "EXPLORING", title: "Student-proposed markets", body: "Submit a question, get it reviewed, then watch the whole school put a price on it." },
  { status: "EXPLORING", title: "EAG on Solana", body: "We are working to make EAG tradable on the Solana blockchain." },
];

const markets = [
  { category: "AP Chemistry", question: "Will the next test average be above 82%?", chance: 64, volume: "18.4K EAG", close: "3 days", icon: FlaskConical, color: "#1498cf" },
  { category: "Athletics", question: "Will AHS win Friday's home game?", chance: 71, volume: "12.8K EAG", close: "Friday", icon: Trophy, color: "#2b9b70" },
  { category: "SPW", question: "Will the Juniors win SPW overall?", chance: 43, volume: "9.2K EAG", close: "12 days", icon: CalendarDays, color: "#8d66c7" },
];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Landing navigation">
        <Link className={styles.brand} href="/"><span className={styles.wing}><i /><i /><i /></span>EagleMarket</Link>
        <div className={styles.navLinks}><a href="#markets">Markets</a><a href="#how">How it works</a><Link href="/auth">Log in</Link></div>
        <Link className={styles.openApp} href="/markets">Open app <ArrowRight size={15} /></Link>
      </nav>

      <section className={styles.hero}>
        <GridPattern width={38} height={38} className={styles.heroGrid} />
        <h1>The market for <LineShadowText className="italic">everything</LineShadowText> AHS.</h1>
        <p>Predict tests, games, SPW, and everything else happening at AHS. Make your picks, earn EAG, and see if you called it first.</p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryCta} href="/markets">Claim your free EAG <ArrowRight size={16} /></Link>
          <a className={styles.secondaryCta} href="#how">How it works</a>
        </div>
        <div className={styles.trust}><span><Check size={13} /> Free to play</span><span><Check size={13} /> School only</span><span><Check size={13} /> No cash value</span></div>
      </section>

      <section className={styles.productFrame} aria-label="EagleMarket product preview">

        <h2 className={styles.featureTitle}>Will the next test average be above 82%?</h2>
        <div className={styles.featureBody}>
          <div className={styles.marketTable}>
            <div className={styles.tableHead}><span>Market</span><span>Pays out</span><span>Odds</span></div>
            <div className={styles.outcomeRow}><div><i className={styles.yesDot} /><strong>Yes</strong></div><span>1.56x</span><b>64%</b></div>
            <div className={styles.outcomeRow}><div><i className={styles.noDot} /><strong>No</strong></div><span>2.78x</span><b>36%</b></div>
            <div className={styles.volumeRow}><span>$18,400 vol</span><span>Trade</span></div>
            <p className={styles.marketNews}><strong>Market note</strong><span> · </span>The official class average will be posted after grading. Retakes and corrections are not included.</p>
          </div>
          <div className={styles.dualChart}>
            <div className={styles.chartLegend}><span><i className={styles.yesDot} /> Yes <b>64%</b></span><span><i className={styles.noDot} /> No <b>36%</b></span><strong>EagleMarket</strong></div>
            <div className={styles.chartPlot}>
              <div className={styles.chartScale}><span>70%</span><span>60%</span><span>50%</span><span>40%</span><span>30%</span></div>
              <svg viewBox="0 0 520 220" preserveAspectRatio="none" role="img" aria-label="Yes probability rose to 64 percent while No fell to 36 percent">
                <path className={styles.yesLine} d="M0 178H70V171H132V155H194V160H252V136H310V112H370V96H430V65H484V38H520" />
                <path className={styles.noLine} d="M0 42H70V49H132V65H194V60H252V84H310V108H370V124H430V155H484V182H520" />
                <circle className={styles.yesPoint} cx="520" cy="38" r="5" /><circle className={styles.noPoint} cx="520" cy="182" r="5" />
              </svg>
              <div className={styles.chartDates}><span>Jul 14</span><span>Jul 28</span><span>Aug 10</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.topicRail} aria-label="Market topics"><Marquee repeat={4} className={styles.topicMarquee}>{topics.map(topic => <span key={topic}>{topic}<i /></span>)}</Marquee></div>

      <section className={styles.section} id="markets">
        <div className={styles.sectionHeading}><div><span>LIVE MARKETS</span><h2>What AHS is predicting</h2></div><Link href="/markets">View all <ArrowRight size={15} /></Link></div>
        <BentoGrid className={styles.marketGrid}>
          {markets.map(market => <DitherCardFrame className={styles.landingDither} icon={market.icon} color={market.color} key={market.question}><Link href="/markets" className={styles.marketCard}><div className={styles.cardTop}><span>{market.category}</span><ChevronRight size={16} /></div><h3>{market.question}</h3><div className={styles.cardChance}><strong>{market.chance}%</strong><span>chance</span></div><div className={styles.miniBar}><i style={{ width: `${market.chance}%`, background: market.color }} /></div><div className={styles.cardBottom}><span>{market.volume}</span><span>Closes {market.close}</span></div></Link></DitherCardFrame>)}
        </BentoGrid>
      </section>

      <section className={styles.how} id="how">
        <div className={styles.sectionHeading}><div><span>HOW IT WORKS</span><h2>Pick a side. See if you called it.</h2></div></div>
        <p className={styles.howLead}>Every market starts with a simple question about AHS. Pick Yes or No, put your EAG behind it, and when the answer is settled, see if your call paid off.</p>
        <ol className={styles.steps}>
          <li>
            <div className={styles.stepHead}><span>01</span><h3>Pick a market</h3></div>
            <p>Find something happening at AHS and make your call. The percentage shows what the school thinks right now.</p>
            <div className={styles.stepCard}>
              <span className={styles.stepCat}>ATHLETICS</span>
              <strong>Will AHS win Friday&apos;s home game?</strong>
              <div className={styles.stepOdds}><b>71%</b><span>chance</span></div>
              <div className={styles.miniBar}><i style={{ width: "71%", background: "#1498cf" }} /></div>
            </div>
          </li>
          <li>
            <div className={styles.stepHead}><span>02</span><h3>Take a side</h3></div>
            <p>Yes or No. Put your EAG behind your call, the less likely your pick is, the bigger the potential payoff.</p>
            <div className={styles.stepCard}>
              <div className={styles.sideRow}><span className={styles.sideYes}>Yes<b>0.71</b></span><span className={styles.sideNo}>No<b>0.29</b></span></div>
              <div className={styles.stakeRow}><span>You stake</span><strong>50 EAG</strong></div>
              <div className={styles.stakeRow}><span>You receive</span><strong>69.73 shares</strong></div>
            </div>
          </li>
          <li>
            <div className={styles.stepHead}><span>03</span><h3>Collect</h3></div>
            <p>When the result is official the market resolves. Every winning share pays exactly 1 EAG; losing shares expire at zero.</p>
            <div className={styles.stepCard}>
              <span className={styles.resolved}><Check size={11} strokeWidth={2.5} /> RESOLVED YES</span>
              <div className={styles.payout}><strong>69.73 EAG</strong><span>+19.73 on the 50 you staked</span></div>
            </div>
          </li>
        </ol>
        <p className={styles.howNote}><span>PRICING</span>Prices are set by a constant product market maker: a decentralized finance pricing formula that eliminates the need for traditional buyer-and-seller order books and automatically adjusts token prices based on trade sizes and liquidity pool ratios.</p>
      </section>

      <section className={styles.next} id="next">
        <div className={styles.sectionHeading}><div><span>WHAT&apos;S NEXT</span><h2>Built in the open.</h2></div></div>
        <p className={styles.nextLead}>EagleMarket is still being built. Here is what is on deck &mdash; nothing here is a promise on a date.</p>
        <ul className={styles.nextGrid}>
          {roadmap.map(item => (
            <li key={item.title}>
              <span className={`${styles.nextStatus} ${item.status === "PLANNED" ? styles.nextPlanned : styles.nextExploring}`}>{item.status}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.tokenCard}>
        <div className={styles.coinWrap}><EagCoin size="lg" /></div>
        <div><span>PLAY TOKENS</span><h2>EAG keeps the stakes social.</h2><p>EAG can&apos;t be bought, sold, withdrawn, or exchanged for prizes. It only tracks who made the better call.</p></div>
        <Link href="/markets">Start with free EAG <ArrowRight size={15} /></Link>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerMeta}>
            <span>©2026 Copyright EagleMarket. Built for AHS. All rights reserved</span>
            <nav><a href="#markets">Markets</a><a href="#how">How it works</a><Link href="/markets">Enter app <ArrowUpRight size={14} strokeWidth={1.75} /></Link></nav>
          </div>
          <p className={styles.credit}>Brought to you by <span className={styles.jainStreet} role="img" aria-label="Jain Street" /></p>
        </div>
        <NoiseBars className={styles.footerChart} />
      </footer>
    </main>
  );
}
