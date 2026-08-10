"use client";

import { Dithering } from "@paper-design/shaders-react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    const callbackError = new URLSearchParams(window.location.search).get("error");
    if (callbackError) {
      queueMicrotask(() => setMessage({ type: "error", text: callbackError }));
    }
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  async function continueWithGoogle() {
    setPending(true);
    setMessage(null);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${siteUrl}/auth/callback?next=/markets` },
    });

    if (error) {
      setMessage({ type: "error", text: error.message });
      setPending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const fullName = String(form.get("name") ?? "").trim();
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${siteUrl}/auth/callback?next=/markets`,
          },
        });

    if (result.error) {
      setMessage({ type: "error", text: result.error.message });
      setPending(false);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage({ type: "success", text: "Check your school email to confirm your account." });
      setPending(false);
      return;
    }

    router.push("/markets");
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

          <div className={styles.formBody}>
            <div className={styles.modeTabs} role="tablist" aria-label="Account action">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                className={mode === "login" ? styles.activeTab : ""}
                onClick={() => setMode("login")}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={mode === "signup" ? styles.activeTab : ""}
                onClick={() => setMode("signup")}
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
              {pending ? "Signing in…" : "Sign in with Google"}
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

              <div className={styles.formOptions}>
                <label className={styles.remember}>
                  <input type="checkbox" name="remember" />
                  <span>Keep me logged in</span>
                </label>
                {mode === "login" && <button type="button" className={styles.textButton}>Forgot password?</button>}
              </div>

              {message && (
                <p className={message.type === "error" ? styles.formError : styles.formSuccess} role="status">
                  {message.text}
                </p>
              )}

              <button type="submit" className={styles.submitButton} disabled={pending}>
                {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
                <ArrowRight size={17} />
              </button>
            </form>

            <p className={styles.switchPrompt}>
              {mode === "login" ? "New to EagleMarket?" : "Already have an account?"}{" "}
              <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
                {mode === "login" ? "Create an account" : "Log in"}
              </button>
            </p>
          </div>

          <p className={styles.legal}>For AHS students · Play tokens only · No cash value</p>
        </div>
      </section>

      <aside className={styles.visualPanel} aria-label="EagleMarket preview">
        <Dithering
          colorBack="#087fb2"
          colorFront="#75daf4"
          shape="wave"
          type="4x4"
          size={3.2}
          speed={reducedMotion ? 0 : 0.06}
          scale={0.86}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        <div className={styles.visualFade} />
        <div className={styles.visualContent}>
          <div className={styles.signalGraphic} aria-hidden="true">
            <span className={styles.signalMark}><i /><i /><i /></span>
          </div>
        </div>
      </aside>
    </main>
  );
}
