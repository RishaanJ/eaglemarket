import { ArrowLeft, ArrowRight, Check, Mail } from "lucide-react";
import Link from "next/link";
import styles from "./check-email.module.css";

function BrandMark() {
  return (
    <span className={styles.brandMark} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

export default function CheckEmailPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.wordmark} aria-label="EagleMarket home">
        <BrandMark />
        <span>EagleMarket</span>
      </Link>

      <section className={styles.card} aria-labelledby="check-email-heading">
        <div className={styles.icon} aria-hidden="true">
          <Mail size={30} strokeWidth={1.8} />
          <span>
            <Check size={15} strokeWidth={3} />
          </span>
        </div>

        <p className={styles.eyebrow}>ONE MORE STEP</p>
        <h1 id="check-email-heading">Check your email. (check your spam)</h1>
        <p className={styles.description}>
          We sent a confirmation link to your school email. Open it to verify your account and
          we&apos;ll take you straight to the markets.
        </p>

        <div className={styles.steps}>
          <span>1</span>
          <p><strong>Open the email from EagleMarket</strong><small>It may take a minute to arrive.</small></p>
          <span>2</span>
          <p><strong>Click confirm email</strong><small>The link signs you in automatically.</small></p>
        </div>

        <Link className={styles.primaryAction} href="/auth">
          Back to log in
          <ArrowRight size={17} />
        </Link>
        <Link className={styles.secondaryAction} href="/">
          <ArrowLeft size={15} />
          Return home
        </Link>

        <p className={styles.hint}>
          Don&apos;t see it? Check your spam folder and make sure you entered the correct address.
        </p>
      </section>
    </main>
  );
}
