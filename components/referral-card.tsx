"use client";

import { Check, Copy, Gift, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { REFERRAL_QUERY_PARAM } from "@/lib/security/referral-code";
import { createClient } from "@/lib/supabase/client";

const BONUS = 250;

type ReferralStats = {
  code: string;
  paid_count: number;
  pending_count: number;
  referral_earned: number;
  cap: number;
  referred_by_display_name: string | null;
  referred_bonus_paid: boolean | null;
  program_enabled: boolean;
};

export function ReferralCard() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    void supabase
      .rpc("get_my_referral_stats")
      .then(({ data }) => {
        if (!active) return;
        setStats((data?.[0] as ReferralStats | undefined) ?? null);
        setLoading(false);
      });

    return () => {
      active = false;
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const link = stats
    ? `${typeof window === "undefined" ? "" : window.location.origin}/auth?${REFERRAL_QUERY_PARAM}=${stats.code}`
    : "";

  const copy = useCallback(async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions; the input stays selectable.
    }
  }, [link]);

  if (loading) {
    return (
      <Card className="settings-card">
        <CardHeader className="border-b">
          <CardTitle>Invite a friend</CardTitle>
          <CardDescription>Loading your invite link…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!stats) return null;

  const remaining = Math.max(0, stats.cap - stats.paid_count);

  return (
    <Card className="settings-card">
      <CardHeader className="border-b">
        <CardTitle>Invite a friend</CardTitle>
        <CardDescription>
          {stats.program_enabled
            ? `You and your friend each get ${BONUS} EAG once they join with a school email and make their first prediction.`
            : "Invites are not switched on yet. Your link will start paying once an administrator enables the program."}
        </CardDescription>
      </CardHeader>
      <CardContent className="settings-rows">
        {stats.referred_by_display_name && (
          <div className="settings-row">
            <span className="provider-icon">
              <Gift size={18} />
            </span>
            <div>
              <strong>You joined through {stats.referred_by_display_name}</strong>
              <span>
                {stats.referred_bonus_paid
                  ? `Your ${BONUS} EAG welcome bonus has been added to your balance.`
                  : "Your welcome bonus arrives after your first prediction."}
              </span>
            </div>
          </div>
        )}

        <div className="settings-row referral-link-row">
          <div>
            <strong>Your invite link</strong>
            <span>Share this with someone who has not joined yet.</span>
          </div>
          <div className="referral-link-controls">
            <input readOnly value={link} onFocus={(event) => event.target.select()} />
            <button type="button" onClick={copy} aria-label="Copy invite link">
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="settings-row">
          <div>
            <strong>Invites so far</strong>
            <span>
              {stats.paid_count} joined
              {stats.pending_count > 0 && ` · ${stats.pending_count} waiting on a first prediction`}
              {` · ${remaining} of ${stats.cap} bonuses left`}
            </span>
          </div>
          <span className="referral-earned">
            {Number(stats.referral_earned ?? 0).toLocaleString()} EAG earned
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReferralCardFallback() {
  return (
    <Card className="settings-card">
      <CardHeader className="border-b">
        <CardTitle>Invite a friend</CardTitle>
        <CardDescription>
          <LoaderCircle className="trade-spinner" size={14} /> Loading…
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
