"use client";

import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, FlaskConical, Trophy } from "lucide-react";
import Link from "next/link";
import { BentoGrid } from "@/components/ui/bento-grid";
import { LineShadowText } from "@/components/ui/line-shadow-text"
import { EagCoin } from "@/components/ui/eag-coin";
import { GridPattern } from "@/components/ui/grid-pattern";
import { DitherCardFrame } from "@/components/ui/hero-dithering";
import { Marquee } from "@/components/ui/marquee";
import styles from "./landing.module.css";

const topics = ["AP Chemistry", "Friday football", "SPW", "Senior class", "Clubs", "Campus events"];

const markets = [
  { category: "AP Chemistry", question: "Will the next test average be above 82%?", chance: 64, volume: "18.4K EAG", close: "3 days", icon: FlaskConical, color: "#1498cf" },
  { category: "Athletics", question: "Will AHS win Friday's home game?", chance: 71, volume: "12.8K EAG", close: "Friday", icon: Trophy, color: "#2b9b70" },
  { category: "SPW", question: "Will the Juniors win SPW overall?", chance: 43, volume: "9.2K EAG", close: "12 days", icon: CalendarDays, color: "#8d66c7" },
];

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Landing navigation">
        <Link className={styles.brand} href="/landing"><span className={styles.wing}><i /><i /><i /></span>EagleMarket</Link>
        <div className={styles.navLinks}><a href="#markets">Markets</a><a href="#how">How it works</a></div>
        <Link className={styles.openApp} href="/">Open app <ArrowRight size={15} /></Link>
      </nav>

      <section className={styles.hero}>
        <GridPattern width={38} height={38} className={styles.heroGrid} />
        <h1>The market for <LineShadowText className="italic">everything</LineShadowText> AHS.</h1>
        <p>Make predictions on tests, games, SPW, and the things everyone is already talking about. No money—just EAG and bragging rights.</p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryCta} href="/">Browse markets <ArrowRight size={16} /></Link>
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
        <div className={styles.sectionHeading}><div><span>LIVE MARKETS</span><h2>What AHS is predicting</h2></div><Link href="/">View all <ArrowRight size={15} /></Link></div>
        <BentoGrid className={styles.marketGrid}>
          {markets.map(market => <DitherCardFrame className={styles.landingDither} icon={market.icon} color={market.color} key={market.question}><Link href="/" className={styles.marketCard}><div className={styles.cardTop}><span>{market.category}</span><ChevronRight size={16} /></div><h3>{market.question}</h3><div className={styles.cardChance}><strong>{market.chance}%</strong><span>chance</span></div><div className={styles.miniBar}><i style={{ width: `${market.chance}%`, background: market.color }} /></div><div className={styles.cardBottom}><span>{market.volume}</span><span>Closes {market.close}</span></div></Link></DitherCardFrame>)}
        </BentoGrid>
      </section>

      <section className={styles.how} id="how">
        <div className={styles.sectionHeading}><div><span>HOW IT WORKS</span><h2>One question. Two sides.</h2></div></div>
        <div className={styles.steps}>
          <article><span>01</span><div><h3>Find a market</h3><p>Pick a question about school that you think you can call.</p></div></article>
          <article><span>02</span><div><h3>Take a side</h3><p>Use free EAG tokens to choose Yes or No.</p></div></article>
          <article><span>03</span><div><h3>Get the result</h3><p>Markets resolve from a clear, official school source.</p></div></article>
        </div>
      </section>

      <section className={styles.tokenCard}>
        <div className={styles.coinWrap}><EagCoin size="lg" /></div>
        <div><span>PLAY TOKENS</span><h2>EAG keeps the stakes social.</h2><p>EAG can&apos;t be bought, sold, withdrawn, or exchanged for prizes. It only tracks who made the better call.</p></div>
        <Link href="/">Start with free EAG <ArrowRight size={15} /></Link>
      </section>

      <footer className={styles.footer}><span>© 2026 EagleMarket</span><span>Built for AHS</span><Link href="/">Enter app ↗</Link></footer>
    </main>
  );
}
