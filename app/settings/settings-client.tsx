"use client";

import { Check, LoaderCircle, LogOut, Menu, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EagCoin } from "@/components/ui/eag-coin";
import { createClient } from "@/lib/supabase/client";

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
  balance,
}: {
  userId: string;
  email: string;
  provider: string;
  displayName: string;
  graduationYear: number | null;
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
    const cleanName = displayName.trim();
    const year = graduationYear ? Number(graduationYear) : null;

    if (!cleanName || cleanName.length > 80) {
      setSaveState("error");
      setMessage("Display name must be between 1 and 80 characters.");
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
      setMessage("Your profile couldn’t be saved. Please try again.");
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
          <Link className="signup settings-active" href="/settings">Settings</Link>
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
        <div className="settings-intro">
          <h1>Account settings</h1>
          <p>Manage how you appear across EagleMarket and review your sign-in details.</p>
        </div>

        <div className="settings-layout">
          <aside className="settings-profile-summary">
            <span className="settings-avatar">{initials(displayName)}</span>
            <h2>{displayName}</h2>
            <p>{email}</p>
            <div><span>Balance</span><strong>{balance.toLocaleString()} EAG</strong></div>
          </aside>

          <div className="settings-content">
            <form className="settings-card" onSubmit={saveProfile}>
              <div className="settings-card-heading">
                <div><h2>Profile</h2><p>This information appears on rankings and your public activity.</p></div>
              </div>
              <div className="settings-fields">
                <label>
                  <span>Display name</span>
                  <input
                    value={displayName}
                    onChange={(event) => { setDisplayName(event.target.value); setSaveState("idle"); }}
                    maxLength={80}
                    autoComplete="name"
                  />
                </label>
                <label>
                  <span>Graduation year</span>
                  <input
                    value={graduationYear}
                    onChange={(event) => { setGraduationYear(event.target.value); setSaveState("idle"); }}
                    inputMode="numeric"
                    placeholder="2027"
                  />
                </label>
                <label className="settings-email-field">
                  <span>School email</span>
                  <input value={email} readOnly aria-readonly="true" />
                  <small>Your email is managed by your sign-in provider.</small>
                </label>
              </div>
              <div className="settings-form-footer">
                <span className={saveState === "error" ? "settings-message error" : "settings-message"} role="status">
                  {saveState === "saved" && <Check size={14} />}{message}
                </span>
                <button type="submit" disabled={saveState === "saving"}>
                  {saveState === "saving" ? <><LoaderCircle className="trade-spinner" size={15} /> Saving…</> : "Save changes"}
                </button>
              </div>
            </form>

            <section className="settings-card settings-access-card">
              <div className="settings-card-heading">
                <div><h2>Access</h2><p>Your connected account and current session.</p></div>
              </div>
              <div className="provider-row">
                <span className="provider-icon"><ShieldCheck size={18} /></span>
                <div><strong>{provider === "google" ? "Google" : "Email"}</strong><span>Connected as {email}</span></div>
                <span className="provider-status"><i /> Connected</span>
              </div>
              <div className="settings-signout-row">
                <div><strong>Sign out</strong><span>End your EagleMarket session on this device.</span></div>
                <button onClick={signOut}><LogOut size={15} /> Sign out</button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
