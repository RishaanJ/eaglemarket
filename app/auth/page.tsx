"use client";

import { Dithering } from "@paper-design/shaders-react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_NEXT_PATH, safeNextPath } from "@/lib/security/next-path";
import { FormEvent, useEffect, useRef, useState } from "react";
import { LEGAL_POLICY_VERSION } from "@/lib/legal";
import { REFERRAL_QUERY_PARAM, safeReferralCode } from "@/lib/security/referral-code";
import { createClient } from "@/lib/supabase/client";
import { MotionReveal } from "@/components/ui/motion-reveal";
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "@/components/turnstile-widget";
import styles from "./auth.module.css";

type AuthMode = "login" | "signup";

function BrandMark() {
  return (
    <span className={styles.brandMark} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/**
 * Where to land after login. proxy.ts sets ?next= when it bounces a signed out
 * visitor off a protected route, which is what lets a shared link to a specific
 * market survive the login round trip.
 *
 * Read at call time rather than held in state: it is only needed inside event
 * handlers, and reading it during render would break server rendering. Always
 * routed through safeNextPath — redirecting to a raw caller-supplied value
 * would make this page an open redirect.
 */
function currentNextPath() {
  if (typeof window === "undefined") return DEFAULT_NEXT_PATH;
  return safeNextPath(new URLSearchParams(window.location.search).get("next"));
}

/**
 * The referral code from the invite link, if the URL carries a well-formed one.
 * Read at call time rather than held in state: it is only needed inside event
 * handlers, and reading it during render would break server rendering.
 */
function currentReferralCode() {
  if (typeof window === "undefined") return null;
  return safeReferralCode(
    new URLSearchParams(window.location.search).get(REFERRAL_QUERY_PARAM),
  );
}

export default function AuthPage() {
  const router = useRouter();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const [mode, setMode] = useState<AuthMode>("login");
  const [captchaToken, setCaptchaToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    const callbackError = new URLSearchParams(window.location.search).get("error");
    if (callbackError) {
      queueMicrotask(() => setMessage({ type: "error", text: callbackError.slice(0, 180) }));
    }
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  async function continueWithGoogle() {
    if (mode === "signup" && (!acceptedPolicies || !confirmedAge)) {
      setMessage({
        type: "error",
        text: "Accept the Terms and Privacy Policy and confirm that you’re at least 13 to continue.",
      });
      return;
    }

    setPending(true);
    setMessage(null);
    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", currentNextPath());
    if (mode === "signup") callbackUrl.searchParams.set("legal", LEGAL_POLICY_VERSION);
    // Google discards our own query string, but returns the callback URL we
    // hand it intact — the same route `next` and `legal` already travel.
    const oauthReferral = currentReferralCode();
    if (mode === "signup" && oauthReferral) {
      callbackUrl.searchParams.set(REFERRAL_QUERY_PARAM, oauthReferral);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl.toString() },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
      setPending(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage(null);
    setCaptchaToken("");
    setAcceptedPolicies(false);
    setConfirmedAge(false);
    turnstileRef.current?.reset();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "signup" && (!acceptedPolicies || !confirmedAge)) {
      setMessage({
        type: "error",
        text: "Accept the Terms and Privacy Policy and confirm that you’re at least 13 to continue.",
      });
      return;
    }

    if (!turnstileSiteKey) {
      setMessage({
        type: "error",
        text: "Security check is not configured. Add the Turnstile site key and try again.",
      });
      return;
    }

    if (!captchaToken) {
      setMessage({ type: "error", text: "Complete the security check to continue." });
      return;
    }

    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("name") ?? "").trim();
    const supabase = createClient();
    const confirmationUrl = new URL("/auth/confirm", window.location.origin);
    const consentAcceptedAt = new Date().toISOString();

    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken },
        })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              // Read by the on_auth_user_created_referral trigger, which
              // creates the pending referral row automatically — so a user who
              // trades before ever "entering a code" is still matched.
              ...(currentReferralCode() ? { referral_code: currentReferralCode() } : {}),
              terms_accepted_at: consentAcceptedAt,
              privacy_accepted_at: consentAcceptedAt,
              age_13_confirmed_at: consentAcceptedAt,
              legal_policy_version: LEGAL_POLICY_VERSION,
            },
            emailRedirectTo: confirmationUrl.toString(),
            captchaToken,
          },
        });

    setCaptchaToken("");
    turnstileRef.current?.reset();

    if (result.error) {
      setMessage({ type: "error", text: result.error.message });
      setPending(false);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      router.replace("/auth/check-email");
      return;
    }

    router.push(currentNextPath());
    router.refresh();
  }

  return (
    <main className={styles.page}>
      <section className={styles.formPanel} aria-labelledby="auth-heading">
        <div className={styles.formRail}>
          <Link href="/" className={styles.wordmark} aria-label="EagleMarket home">
            <BrandMark />
            <span>EagleMarket</span>
          </Link>

          <MotionReveal className={styles.formBody} distance={8}>
            <div className={styles.modeTabs} role="tablist" aria-label="Account action">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? styles.activeTab : ""}
                onClick={() => changeMode("login")}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={mode === "signup" ? styles.activeTab : ""}
                onClick={() => changeMode("signup")}
              >
                Sign up
              </button>
            </div>

            <div className={styles.headingBlock}>
              <h1 id="auth-heading">{mode === "login" ? "Welcome back." : "Join your school market."}</h1>
              <p>
                {mode === "login"
                  ? "Log in to see your picks, balance, and the markets moving around school."
                  : "Create an account with your school email. It takes less than a minute."}
              </p>
            </div>

            <button type="button" className={styles.googleButton} onClick={continueWithGoogle} disabled={pending}>
              <Image src="/google-g.svg" alt="" width={18} height={18} aria-hidden="true" />
              {pending ? "Please wait…" : mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
            </button>

            <div className={styles.divider}><span>or use your school email</span></div>

            <form className={styles.form} onSubmit={submit}>
              {mode === "signup" && (
                <label>
                  <span>Full name</span>
                  <input name="name" type="text" autoComplete="name" placeholder="Your name" required />
                </label>
              )}

              <label>
                <span>School email</span>
                <input name="email" type="email" autoComplete="email" placeholder="you@school.org" required />
              </label>

              <label>
                <span>Password</span>
                <span className={styles.passwordField}>
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              {mode === "signup" && (
                <fieldset className={styles.consentGroup}>
                  <legend className="sr-only">Required agreements</legend>
                  <div className={styles.consentOption}>
                    <input
                      id="policiesAccepted"
                      type="checkbox"
                      name="policiesAccepted"
                      checked={acceptedPolicies}
                      onChange={(event) => setAcceptedPolicies(event.target.checked)}
                      required
                    />
                    <span>
                      <label htmlFor="policiesAccepted">I agree to the </label>
                      <Link href="/terms" target="_blank" rel="noreferrer">Terms of Service</Link>
                      <label htmlFor="policiesAccepted"> and </label>
                      <Link href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>
                      <label htmlFor="policiesAccepted">.</label>
                    </span>
                  </div>
                  <label className={styles.consentOption}>
                    <input
                      type="checkbox"
                      name="ageConfirmed"
                      checked={confirmedAge}
                      onChange={(event) => setConfirmedAge(event.target.checked)}
                      required
                    />
                    <span>I confirm that I am at least 13 years old.</span>
                  </label>
                </fieldset>
              )}

              {mode === "login" && (
                <div className={styles.formOptions}>
                  <label className={styles.remember}>
                    <input type="checkbox" name="remember" />
                    <span>Keep me logged in</span>
                  </label>
                  <button type="button" className={styles.textButton}>Forgot password?</button>
                </div>
              )}

              {turnstileSiteKey ? (
                <div className={styles.turnstileBlock}>
                  <span className={styles.turnstileLabel}>Security check</span>
                  <TurnstileWidget
                    ref={turnstileRef}
                    siteKey={turnstileSiteKey}
                    className={styles.turnstileWidget}
                    onVerify={setCaptchaToken}
                    onError={(errorCode) => {
                      setMessage({
                        type: "error",
                        text: errorCode?.startsWith("110200")
                          ? "This domain is not authorized for the security check. Add it in Turnstile Hostname Management."
                          : "The security check could not load. Refresh the page and try again.",
                      });
                    }}
                  />
                </div>
              ) : (
                <p className={styles.formError} role="status">
                  Turnstile is not configured for this environment.
                </p>
              )}

              {message && (
                <p className={message.type === "error" ? styles.formError : styles.formSuccess} role="status">
                  {message.text}
                </p>
              )}

              <button
                type="submit"
                className={styles.submitButton}
                disabled={pending || !captchaToken || !turnstileSiteKey}
              >
                {pending
                  ? "Please wait…"
                  : !captchaToken
                    ? "Complete security check"
                    : mode === "login"
                      ? "Log in"
                      : "Create account"}
                <ArrowRight size={17} />
              </button>
            </form>

            <p className={styles.switchPrompt}>
              {mode === "login" ? "New to EagleMarket?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => changeMode(mode === "login" ? "signup" : "login")}>
                {mode === "login" ? "Create an account" : "Log in"}
              </button>
            </p>
          </MotionReveal>

          <p className={styles.legal}>For AHS students · Play tokens only · No cash value</p>
        </div>
      </section>

      <aside className={styles.visualPanel} aria-label="EagleMarket preview">
        <div className={styles.baseDither}>
          <Dithering
            colorBack="#043d5b"
            colorFront="#22b8e6"
            shape="warp"
            type="4x4"
            size={2.4}
            speed={reducedMotion ? 0 : 0.22}
            scale={0.62}
            rotation={-8}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          />
        </div>
        <div className={styles.visualGlow} />
        <div className={styles.visualGrid} />
        <div className={styles.visualContent}>
          <div className={styles.visualStage} aria-hidden="true">
            <i className={`${styles.orbit} ${styles.orbitOne}`} />
            <i className={`${styles.orbit} ${styles.orbitTwo}`} />

            <div className={`${styles.ditherFragment} ${styles.fragmentOne}`}>
              <Dithering
                colorBack="#075b7b00"
                colorFront="#a9efff9e"
                shape="ripple"
                type="8x8"
                size={2.2}
                speed={reducedMotion ? 0 : 0.18}
                scale={0.72}
                offsetX={0.12}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
            </div>

            <div className={styles.signalGraphic}>
              <Dithering
                colorBack="#073e59cc"
                colorFront="#c8f6ff"
                shape="sphere"
                type="4x4"
                size={2.1}
                speed={reducedMotion ? 0 : 0.3}
                scale={0.88}
                rotation={12}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
              <svg className={styles.marketTrace} viewBox="0 0 440 310" fill="none">
                <path d="M23 238H88V215H145V226H206V176H260V152H322V106H414V62" />
                <circle cx="414" cy="62" r="5" />
              </svg>
              <span className={styles.signalMark}><i /><i /><i /></span>
            </div>

            <div className={`${styles.ditherFragment} ${styles.fragmentTwo}`}>
              <Dithering
                colorBack="#075b7b00"
                colorFront="#d4f8ff87"
                shape="dots"
                type="2x2"
                size={2.6}
                speed={reducedMotion ? 0 : 0.16}
                scale={0.68}
                rotation={18}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}
