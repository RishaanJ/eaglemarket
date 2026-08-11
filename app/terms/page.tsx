import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import styles from "./terms.module.css";

export const metadata: Metadata = {
  title: "Terms of Use — EagleMarket",
  description:
    "The rules for using EagleMarket, a free school prediction market for the American High School community.",
};

const sections = [
  { id: "eligibility", label: "Eligibility" },
  { id: "play-tokens", label: "EAG and market rules" },
  { id: "conduct", label: "Acceptable use" },
  { id: "content", label: "Your content" },
  { id: "moderation", label: "Moderation" },
  { id: "privacy", label: "Privacy" },
  { id: "ownership", label: "Ownership" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "liability", label: "Liability" },
  { id: "changes", label: "Changes and contact" },
];

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <span className={styles.mark} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          EagleMarket
        </Link>
        <Link className={styles.back} href="/auth">
          <ArrowLeft size={15} /> Back to sign up
        </Link>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Terms sections">
          <span>ON THIS PAGE</span>
          <nav>
            {sections.map((section, index) => (
              <a href={`#${section.id}`} key={section.id}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className={styles.document}>
          <div className={styles.eyebrow}>
            <ShieldCheck size={14} /> LEGAL
          </div>
          <h1>Terms of Use</h1>
          <p className={styles.lede}>
            The straightforward rules for making predictions, using play tokens,
            and keeping EagleMarket fair for everyone at American High School.
          </p>
          <div className={styles.meta}>
            <span>Effective August 10, 2026</span>
            <span>Version 1.0</span>
          </div>

          <div className={styles.callout}>
            <strong>Before you start</strong>
            <p>
              EagleMarket is free to use. EAG is a play token with no cash
              value, and the Service does not offer gambling, wagering, prizes,
              or withdrawals.
            </p>
          </div>

          <p>
            These Terms of Use (the <strong>“Terms”</strong>) govern your access
            to EagleMarket, including its website, accounts, markets, rankings,
            and related features (collectively, the <strong>“Service”</strong>).
            By creating an account or using the Service, you agree to these
            Terms. If you do not agree, do not use EagleMarket.
          </p>

          <section id="eligibility">
            <div className={styles.sectionTitle}>
              <span>01</span>
              <h2>Eligibility and accounts</h2>
            </div>
            <p>
              You must be at least 13 years old to create an account. If you are
              under the age of majority where you live, use EagleMarket only
              with permission from your parent or legal guardian.
            </p>
            <p>
              The Service is intended for the American High School community.
              You must provide accurate account information, keep your login
              credentials private, and use only one account. You are responsible
              for activity performed through your account.
            </p>
            <p>
              EagleMarket is an independent student project. It is not operated
              by, sponsored by, endorsed by, or an official service of American
              High School, Fremont Unified School District, or their employees
              unless we explicitly state otherwise in writing.
            </p>
          </section>

          <section id="play-tokens">
            <div className={styles.sectionTitle}>
              <span>02</span>
              <h2>EAG and market rules</h2>
            </div>
            <p>
              EAG is a fictional, closed-loop play token used only to keep score
              inside EagleMarket. EAG:
            </p>
            <ul>
              <li>
                cannot be purchased, sold, gifted, transferred, withdrawn, or
                redeemed;
              </li>
              <li>
                has no monetary, cash-equivalent, property, or prize value;
              </li>
              <li>
                does not represent cryptocurrency, legal tender, credit, a
                security, or a claim against anyone; and
              </li>
              <li>
                may not be exchanged on or off the Service for money, goods,
                services, favors, or anything else of value.
              </li>
            </ul>
            <p>
              Each market includes a question, closing time, resolution
              criteria, and outcome source. Prices reflect activity within the
              Service and are not statements of fact or guarantees. We may
              correct obvious errors, pause trading, void a market, change a
              closing time before trading closes, or resolve a market using the
              stated source and reasonable judgment. Our resolution decision is
              final unless we reopen it to correct a clear mistake.
            </p>
            <p>
              Do not arrange side bets, prizes, payments, or exchanges based on
              EagleMarket activity. If you do, that arrangement is outside the
              Service, violates these Terms, and is solely your responsibility.
            </p>
          </section>

          <section id="conduct">
            <div className={styles.sectionTitle}>
              <span>03</span>
              <h2>Acceptable use and market integrity</h2>
            </div>
            <p>
              Use EagleMarket in a way that is safe, honest, and respectful. You
              may not:
            </p>
            <ul>
              <li>
                create duplicate or automated accounts, share accounts, evade
                limits, or manipulate prices, rankings, referrals, balances, or
                resolutions;
              </li>
              <li>
                trade using improperly obtained private records, stolen
                credentials, confidential grades, answer keys, or information
                acquired through academic dishonesty;
              </li>
              <li>
                harass, threaten, bully, dox, impersonate, discriminate against,
                or target another student or staff member;
              </li>
              <li>
                submit slurs, hateful or sexual content, graphic violence,
                personal information, dangerous challenges, or content that
                encourages self-harm or illegal conduct;
              </li>
              <li>
                probe, scrape, overload, disrupt, reverse engineer, bypass
                security, exploit vulnerabilities, distribute malware, or
                attempt unauthorized access;
              </li>
              <li>
                use bots, scripts, coordinated trading, denial-of-service
                attacks, or any method that gives an unfair technical advantage;
                or
              </li>
              <li>
                use the Service for real-money gambling, commercial activity,
                advertising, fraud, or any unlawful purpose.
              </li>
            </ul>
            <p>
              Report security issues privately. Do not exploit a vulnerability
              or access data that does not belong to you, even if you intend to
              report it later.
            </p>
          </section>

          <section id="content">
            <div className={styles.sectionTitle}>
              <span>04</span>
              <h2>Your content</h2>
            </div>
            <p>
              If the Service lets you submit a username, market proposal,
              report, profile information, or other content, you keep any rights
              you already hold in it. You grant EagleMarket a non-exclusive,
              worldwide, royalty-free license to host, reproduce, display,
              format, and moderate that content only as needed to operate,
              secure, and improve the Service.
            </p>
            <p>
              You represent that you have the right to submit your content and
              that it does not violate these Terms, another person&apos;s
              rights, school rules, or the law. Do not submit sensitive
              information about yourself or anyone else.
            </p>
          </section>

          <section id="moderation">
            <div className={styles.sectionTitle}>
              <span>05</span>
              <h2>Moderation, suspension, and closure</h2>
            </div>
            <p>
              We may review content and account activity, remove content,
              reverse or void affected trades, adjust corrupted balances, limit
              features, or suspend or terminate accounts when reasonably
              necessary to protect users, preserve market integrity, investigate
              abuse, comply with law, or operate the Service.
            </p>
            <p>
              We will try to act proportionately, but urgent safety or security
              issues may require immediate action. You may stop using the
              Service at any time. Account deletion may be requested through the
              account settings or by emailing{" "}
              <a href="mailto:thegreenninja1210@gmail.com">
                thegreenninja1210@gmail.com
              </a>
              .
            </p>
          </section>

          <section id="privacy">
            <div className={styles.sectionTitle}>
              <span>06</span>
              <h2>Privacy</h2>
            </div>
            <p>
              Our <Link href="/privacy">Privacy Policy</Link> explains what
              information we collect, why we use it, the service providers
              involved, retention, security, and the choices available to you.
              It is incorporated into these Terms by reference.
            </p>
            <p>
              EagleMarket is not intended for children under 13, and we do not
              knowingly collect personal information from them. If we learn that
              an account belongs to someone under 13, we may delete the account
              and associated information.
            </p>
          </section>

          <section id="ownership">
            <div className={styles.sectionTitle}>
              <span>07</span>
              <h2>Service ownership</h2>
            </div>
            <p>
              Except for user content and third-party materials, the
              Service—including its software, visual design, branding, copy, and
              original content—is owned by EagleMarket&apos;s operator and
              protected by applicable intellectual-property laws. These Terms
              give you a limited, personal, revocable, non-transferable right to
              use the Service as intended. They do not transfer ownership to
              you.
            </p>
            <p>
              If you believe content on the Service infringes your rights, email{" "}
              <a href="mailto:thegreenninja1210@gmail.com">
                thegreenninja1210@gmail.com
              </a>{" "}
              with enough information to identify the work, the content at
              issue, and how we can reach you.
            </p>
          </section>

          <section id="disclaimers">
            <div className={styles.sectionTitle}>
              <span>08</span>
              <h2>Disclaimers</h2>
            </div>
            <p>
              The Service is provided on an “as is” and “as available” basis. To
              the fullest extent allowed by law, we disclaim implied warranties
              of merchantability, fitness for a particular purpose, title, and
              non-infringement. We do not promise that the Service will always
              be available, secure, accurate, or error-free, or that market
              outcomes and information will be complete or timely.
            </p>
            <p>
              EagleMarket is for entertainment and educational use. Market
              prices and content are not financial, investment, academic, legal,
              or professional advice. Do not make academic, safety,
              disciplinary, or financial decisions based on them.
            </p>
          </section>

          <section id="liability">
            <div className={styles.sectionTitle}>
              <span>09</span>
              <h2>Limitation of liability</h2>
            </div>
            <p>
              To the fullest extent permitted by law, EagleMarket and its
              operator will not be liable for indirect, incidental, special,
              consequential, exemplary, or punitive damages, or for lost data,
              reputation, opportunities, or access arising from your use of—or
              inability to use—the Service.
            </p>
            <p>
              Nothing in these Terms excludes liability that cannot lawfully be
              excluded. Because the Service is free and EAG has no cash value,
              our total liability for claims relating to the Service will not
              exceed the greater of the amount you paid us to use the Service in
              the preceding 12 months or US $25.
            </p>
          </section>

          <section id="changes">
            <div className={styles.sectionTitle}>
              <span>10</span>
              <h2>Changes, governing law, and contact</h2>
            </div>
            <p>
              We may update these Terms as the Service changes. We will post the
              revised version, update the effective date, and provide additional
              notice when a change materially affects your rights. Continuing to
              use the Service after the revised Terms take effect means you
              accept them.
            </p>
            <p>
              We may modify, pause, or discontinue any part of the Service.
              These Terms are governed by California law, without regard to
              conflict-of-law principles. Any dispute that cannot be resolved
              informally will be handled by a court with jurisdiction in Alameda
              County, California, except where applicable law requires
              otherwise.
            </p>
            <p>
              Questions, safety concerns, account requests, and legal notices may
              be sent to{" "}
              <a href="mailto:thegreenninja1210@gmail.com">
                thegreenninja1210@gmail.com
              </a>
              . If any part of these Terms is unenforceable, the rest remains in
              effect. Our failure to enforce a provision is not a waiver of it.
            </p>
          </section>

          <footer className={styles.documentFooter}>
            <div>
              <span>RELATED</span>
              <strong>How EagleMarket handles your data</strong>
            </div>
            <Link href="/privacy">
              Read the Privacy Policy <ArrowUpRight size={15} />
            </Link>
          </footer>
        </article>
      </div>
    </main>
  );
}
