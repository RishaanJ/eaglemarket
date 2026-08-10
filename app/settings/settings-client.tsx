"use client";

import { Check, GraduationCap, Lock, LoaderCircle, LogOut, Menu, Search, Settings, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EagCoin } from "@/components/ui/eag-coin";
import { createClient } from "@/lib/supabase/client";
import { MotionReveal } from "@/components/ui/motion-reveal";
import {
  getUsernameFormatError,
  normalizeUsername,
  USERNAME_MAX_LENGTH,
} from "@/lib/usernames";

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

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SettingsClient({
  userId,
  email,
  provider,
  displayName: initialDisplayName,
  graduationYear: initialGraduationYear,
  role,
  balance,
}: {
  userId: string;
  email: string;
  provider: string;
  displayName: string;
  graduationYear: number | null;
  role: string;
  balance: number;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [graduationYear, setGraduationYear] = useState(
    initialGraduationYear?.toString() ?? "",
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = normalizeUsername(displayName);
    const year = graduationYear ? Number(graduationYear) : null;

    const usernameError = getUsernameFormatError(cleanName);
    if (usernameError) {
      setSaveState("error");
      setMessage(usernameError);
      return;
    }

    if (year !== null && (!Number.isInteger(year) || year < 2020 || year > 2100)) {
      setSaveState("error");
      setMessage("Enter a valid graduation year.");
      return;
    }

    setSaveState("saving");
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: cleanName, graduation_year: year })
      .eq("user_id", userId);

    if (error) {
      setSaveState("error");
      if (error.code === "23505") {
        setMessage("That username is already taken. Try another one.");
      } else if (error.message.includes("USERNAME_NOT_ALLOWED")) {
        setMessage("That username isn’t allowed. Choose another one.");
      } else if (error.message.includes("USERNAME_INVALID_FORMAT")) {
        setMessage("That username doesn’t match the required format.");
      } else {
        setMessage("Your profile couldn’t be saved. Please try again.");
      }
      return;
    }

    setDisplayName(cleanName);
    setSaveState("saved");
    setMessage("Profile saved.");
    router.refresh();
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="app-shell settings-shell">
      <header className="topbar">
        <Link className="wordmark" href="/">
          <EagleMark />
          <span>EagleMarket</span>
        </Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link href="/markets">Markets</Link>
          <Link href="/picks">My picks</Link>
          <Link href="/rankings">Rankings</Link>
        </nav>
        <label className="search-box">
          <Search size={18} />
          <input readOnly placeholder="Search markets" onFocus={() => router.push("/markets")} />
          <kbd>Cmd K</kbd>
        </label>
        <div className="auth-actions">
          <button className="token-balance">
            <EagCoin size="sm" /> {balance.toLocaleString()} EAG
          </button>
          <Link className="icon-button settings-active" href="/settings" aria-label="Settings"><Settings size={18} /></Link>
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

      <main className="settings-main">
        <MotionReveal>
        <div className="settings-intro">
          <h1>Account settings</h1>
          <p>Manage how you appear across EagleMarket and review your sign-in details.</p>
        </div>
        </MotionReveal>

        <MotionReveal delay={0.05}>
        <Card className="settings-identity">
          <CardContent className="settings-identity-inner">
            <span className="settings-avatar">{initials(displayName)}</span>
            <div className="settings-identity-name">
              <h2>{displayName}</h2>
              <p>{email}</p>
              <div className="settings-chips">
                <span className="settings-chip"><ShieldCheck size={12} /> {provider === "google" ? "Google" : "Email"}</span>
                {graduationYear && <span className="settings-chip"><GraduationCap size={12} /> Class of {graduationYear}</span>}
              </div>
            </div>
            <div className="settings-balance">
              <span>BALANCE</span>
              <strong><EagCoin size="sm" />{balance.toLocaleString()} <small>EAG</small></strong>
            </div>
          </CardContent>
        </Card>
        </MotionReveal>

        <MotionReveal delay={0.1}>
        <div className="settings-content">
          <form onSubmit={saveProfile}>
            <Card className="settings-card">
            <CardHeader className="border-b">
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your username appears on rankings and your public activity.</CardDescription>
            </CardHeader>
            <CardContent className="settings-fields">
              <label>
                <span>Username</span>
                <div className="settings-input-wrap">
                  <input
                    value={displayName}
                    onChange={(event) => { setDisplayName(event.target.value); setSaveState("idle"); }}
                    maxLength={USERNAME_MAX_LENGTH}
                    autoComplete="username"
                    aria-describedby="username-hint"
                  />
                </div>
                <small id="username-hint">3–30 characters. Letters, numbers, spaces, periods, underscores, and hyphens.</small>
              </label>
              <label>
                <span>Graduation year</span>
                <div className="settings-input-wrap">
                  <input
                    value={graduationYear}
                    onChange={(event) => { setGraduationYear(event.target.value.replace(/\D/g, "").slice(0, 4)); setSaveState("idle"); }}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="2027"
                  />
                </div>
              </label>
              <label className="settings-email-field">
                <span>School email</span>
                <div className="settings-input-wrap">
                  <input value={email} readOnly aria-readonly="true" />
                  <span className="settings-input-lock"><Lock size={14} /></span>
                </div>
                <small>Your email is managed by your sign-in provider.</small>
              </label>
            </CardContent>
            <CardFooter className="settings-form-footer border-t">
              <span
                className={saveState === "error" ? "settings-message error" : "settings-message"}
                role={saveState === "error" ? "alert" : "status"}
              >
                {saveState === "saved" && <Check size={14} />}{message}
              </span>
              <button type="submit" disabled={saveState === "saving"}>
                {saveState === "saving" ? <><LoaderCircle className="trade-spinner" size={15} /> Saving…</> : "Save changes"}
              </button>
            </CardFooter>
            </Card>
          </form>

          <Card className="settings-card">
            <CardHeader className="border-b">
              <CardTitle>Access</CardTitle>
              <CardDescription>Your connected account and current session.</CardDescription>
            </CardHeader>
            <CardContent className="settings-rows">
              <div className="settings-row">
                <span className="provider-icon"><ShieldCheck size={18} /></span>
                <div><strong>{provider === "google" ? "Google" : "Email"}</strong><span>Connected as {email}</span></div>
                <span className="provider-status"><i /> Connected</span>
              </div>
              {role === "admin" && (
                <Link className="settings-row admin-access-row" href="/admin">
                  <span className="provider-icon"><ShieldCheck size={18} /></span>
                  <div><strong>Admin panel</strong><span>Create, close, and resolve school markets.</span></div>
                  <span>Open admin →</span>
                </Link>
              )}
              <div className="settings-row">
                <div><strong>Sign out</strong><span>End your EagleMarket session on this device.</span></div>
                <button className="signout-button" type="button" onClick={signOut}><LogOut size={15} /> Sign out</button>
              </div>
            </CardContent>
          </Card>
        </div>
        </MotionReveal>
      </main>
    </div>
  );
}
