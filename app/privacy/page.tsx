import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | EagleMarket",
  description:
    "Learn what information EagleMarket collects, why it is used, and the choices available to you.",
};

const sections = [
  ["overview", "Overview"],
  ["information", "Information we collect"],
  ["use", "How we use information"],
  ["sharing", "When information is shared"],
  ["cookies", "Cookies and analytics"],
  ["retention", "Retention and security"],
  ["choices", "Your choices"],
  ["minors", "Users under 13"],
  ["changes", "Changes and contact"],
] as const;

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Legal navigation">
        <Link className={styles.brand} href="/">
          <span className={styles.wing} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          EagleMarket
        </Link>
        <div className={styles.navLinks}>
          <Link href="/terms">Terms</Link>
          <Link className={styles.backLink} href="/auth">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to sign up
          </Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.eyebrow}>
          <ShieldCheck size={15} aria-hidden="true" />
          PRIVACY, IN PLAIN LANGUAGE
        </div>
        <h1>Your privacy matters.</h1>
        <p>
          This policy explains what EagleMarket collects, what we do with it,
          and the choices you have. We wrote it to be read—not skipped.
        </p>
        <div className={styles.meta}>
          <span>Effective August 10, 2026</span>
          <span>Last updated August 10, 2026</span>
        </div>
      </header>

      <section className={styles.promises} aria-label="Privacy highlights">
        <article>
          <Check size={15} aria-hidden="true" />
          <div>
            <strong>No sale of personal information</strong>
            <p>
              We do not sell your personal information or use it for targeted
              advertising.
            </p>
          </div>
        </article>
        <article>
          <Check size={15} aria-hidden="true" />
          <div>
            <strong>Only play tokens</strong>
            <p>
              EAG has no cash value, and EagleMarket does not collect payment
              information.
            </p>
          </div>
        </article>
        <article>
          <Check size={15} aria-hidden="true" />
          <div>
            <strong>Designed for ages 13+</strong>
            <p>The service is not intended for children under 13.</p>
          </div>
        </article>
      </section>

      <div className={styles.layout}>
        <aside className={styles.contents}>
          <span>ON THIS PAGE</span>
          <ol>
            {sections.map(([id, label], index) => (
              <li key={id}>
                <a href={`#${id}`}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </aside>

        <article className={styles.policy}>
          <section id="overview">
            <span className={styles.sectionNumber}>01</span>
            <h2>Overview</h2>
            <p>
              EagleMarket is a free, school-community prediction game built for
              American High School. Students use play-only EAG tokens to make
              predictions about school events. EAG cannot be purchased, sold,
              withdrawn, exchanged for money, or redeemed for prizes.
            </p>
            <p>
              In this policy, “EagleMarket,” “we,” “us,” and “our” refer to the
              EagleMarket service and its operator. This policy applies when you
              visit eaglemarket.bet, create an account, or use the service.
            </p>
          </section>

          <section id="information">
            <span className={styles.sectionNumber}>02</span>
            <h2>Information we collect</h2>

            <h3>Information you provide</h3>
            <ul>
              <li>
                <strong>Account information:</strong> your email address,
                display name or username, password credentials, and any optional
                profile information you add, such as an avatar or graduation
                year.
              </li>
              <li>
                <strong>Google sign-in information:</strong> if you choose
                Google, we receive basic account information that Google makes
                available with your permission, such as your email, name,
                profile image, and a provider account identifier.
              </li>
              <li>
                <strong>Communications:</strong> information you include when
                you contact us about support, safety, moderation, or a privacy
                request.
              </li>
            </ul>
            <p className={styles.note}>
              Authentication is handled by Supabase. EagleMarket does not have
              access to a readable copy of your password.
            </p>

            <h3>Information created when you use EagleMarket</h3>
            <ul>
              <li>
                <strong>Prediction activity:</strong> markets you trade in, Yes
                or No selections, token amounts, shares, prices, positions,
                payouts, and transaction history.
              </li>
              <li>
                <strong>Account standing:</strong> EAG balance, leaderboard
                statistics, watchlisted markets, account status, and timestamps.
              </li>
              <li>
                <strong>Moderation and administration:</strong> records of
                actions needed to create or resolve markets, enforce rules,
                investigate abuse, or protect the integrity of the service.
              </li>
            </ul>

            <h3>Technical information</h3>
            <p>
              When you use the service, EagleMarket and its service providers
              may process request and device information such as IP address,
              browser and device type, operating system, page viewed, referral
              source, approximate region, timestamps, session identifiers, and
              security signals. We use this information to operate, secure, and
              understand the service.
            </p>
          </section>

          <section id="use">
            <span className={styles.sectionNumber}>03</span>
            <h2>How we use information</h2>
            <p>We use information to:</p>
            <ul>
              <li>
                create accounts, authenticate users, and maintain sessions;
              </li>
              <li>
                process predictions and calculate positions, prices, balances,
                and payouts;
              </li>
              <li>
                display markets, leaderboards, public profiles, and market
                activity;
              </li>
              <li>
                send account, verification, security, and service messages;
              </li>
              <li>
                prevent spam, automated signups, fraud, attacks, and rule
                violations;
              </li>
              <li>
                moderate usernames, accounts, markets, and other submitted
                content;
              </li>
              <li>
                diagnose problems, measure aggregate usage, and improve
                EagleMarket; and
              </li>
              <li>
                comply with law and protect users, EagleMarket, and others.
              </li>
            </ul>
            <p>
              We ask for information that is reasonably necessary for these
              purposes. Please do not submit grades, student records, health
              information, or other confidential school information to
              EagleMarket.
            </p>
          </section>

          <section id="sharing">
            <span className={styles.sectionNumber}>04</span>
            <h2>When information is shared</h2>
            <p>
              We do not sell your personal information. We may disclose limited
              information in these situations:
            </p>
            <ul>
              <li>
                <strong>Other users.</strong> Your display name, avatar,
                leaderboard results, and certain prediction activity may be
                visible as part of the service. Your email address and password
                are not displayed to other users.
              </li>
              <li>
                <strong>Service providers.</strong> We use vendors to provide
                infrastructure, authentication, security, and analytics. They
                may process information only to provide those services or as
                permitted by their agreements and applicable law.
              </li>
              <li>
                <strong>Safety and legal reasons.</strong> We may preserve or
                disclose information if reasonably necessary to comply with law,
                respond to lawful requests, enforce our terms, investigate
                abuse, or protect someone’s rights or safety.
              </li>
              <li>
                <strong>Service reorganization.</strong> If EagleMarket is
                transferred or reorganized, information may be included in that
                transaction, subject to this policy and applicable law.
              </li>
            </ul>

            <div className={styles.providers}>
              <h3>Current service providers</h3>
              <a
                href="https://supabase.com/privacy"
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <strong>Supabase</strong>Authentication, database, and
                  realtime infrastructure
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
              <a
                href="https://vercel.com/legal/privacy-policy"
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <strong>Vercel</strong>Hosting and privacy-focused web
                  analytics
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <strong>Cloudflare Turnstile</strong>Bot and abuse prevention
                  during authentication
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer"
              >
                <span>
                  <strong>Google</strong>Optional Google account sign-in
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          </section>

          <section id="cookies">
            <span className={styles.sectionNumber}>05</span>
            <h2>Cookies, local storage, and analytics</h2>
            <p>
              EagleMarket uses essential browser storage to keep you signed in
              and maintain security. It also stores a small local marker on your
              device so the same payout notification is not repeatedly shown.
              Blocking essential storage may prevent account features from
              working.
            </p>
            <p>
              We use Vercel Web Analytics to understand aggregate traffic, such
              as page views, referrers, approximate location, browser, operating
              system, and device type. Vercel states that this analytics product
              does not use third-party cookies, does not associate analytics
              with an individual or IP address, and resets its visitor hash
              daily.
            </p>
            <p>
              Cloudflare Turnstile runs browser checks during sign-in and
              sign-up to distinguish legitimate use from automated abuse. It
              processes browser-environment and security signals for that
              purpose.
            </p>
          </section>

          <section id="retention">
            <span className={styles.sectionNumber}>06</span>
            <h2>Retention and security</h2>
            <p>
              We keep information while your account is active and for as long
              as reasonably necessary to run EagleMarket, maintain the accuracy
              and integrity of resolved markets, prevent abuse, resolve
              disputes, and meet legal obligations. Retention periods may differ
              by data type. When information is no longer needed, we aim to
              delete or de-identify it.
            </p>
            <p>
              We use technical and organizational safeguards designed to protect
              information, including access controls, encrypted connections,
              database row-level security, bot protection, and restricted
              administrative tools. No system is completely secure, so we cannot
              guarantee that unauthorized access will never occur.
            </p>
          </section>

          <section id="choices">
            <span className={styles.sectionNumber}>07</span>
            <h2>Your choices and privacy rights</h2>
            <p>
              You can update certain profile information from account settings.
              You may also ask to access, correct, or delete personal
              information associated with your account. We may need to verify
              that the account belongs to you before completing a request, and
              some information may be retained where permitted or required for
              security, market integrity, or legal reasons.
            </p>
            <p>
              Depending on where you live, privacy law may provide additional
              rights, including the right to know, access, correct, delete, or
              obtain a copy of certain information, and to opt out of certain
              sales or sharing. EagleMarket does not currently sell personal
              information or share it for cross-context behavioral advertising,
              and we will not discriminate against you for exercising an
              applicable privacy right.
            </p>
            <p>
              To make a request, email{" "}
              <a href="mailto:thegreenninja1210@gmail.com">
                thegreenninja1210@gmail.com
              </a>
              . An authorized agent may submit a request where allowed by law,
              but we may require proof of authorization and identity.
            </p>
          </section>

          <section id="minors">
            <span className={styles.sectionNumber}>08</span>
            <h2>Users under 13</h2>
            <p>
              EagleMarket is intended only for people who are at least 13 years
              old. We do not knowingly collect personal information from
              children under 13. If we learn that an account belongs to someone
              under 13, we will take reasonable steps to disable the account and
              delete the child’s personal information, subject to any
              information we must preserve for safety or legal reasons.
            </p>
            <p>
              If you are a parent or guardian and believe a child under 13 has
              provided information to EagleMarket, contact{" "}
              <a href="mailto:thegreenninja1210@gmail.com">
                thegreenninja1210@gmail.com
              </a>
              .
            </p>
          </section>

          <section id="changes">
            <span className={styles.sectionNumber}>09</span>
            <h2>Changes and contact</h2>
            <p>
              We may update this policy as EagleMarket changes. We will post the
              revised policy here and update the date above. If a change is
              material, we will provide additional notice where appropriate.
            </p>
            <p>
              Questions or privacy requests can be sent to{" "}
              <a href="mailto:thegreenninja1210@gmail.com">
                thegreenninja1210@gmail.com
              </a>
              .
            </p>
          </section>
        </article>
      </div>

      <footer className={styles.footer}>
        <Link className={styles.brand} href="/">
          <span className={styles.wing} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          EagleMarket
        </Link>
        <p>Free to play. School only. No cash value.</p>
        <div>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy" aria-current="page">
            Privacy
          </Link>
        </div>
      </footer>
    </main>
  );
}
