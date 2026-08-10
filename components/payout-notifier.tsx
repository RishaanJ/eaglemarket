"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EagCoin } from "@/components/ui/eag-coin";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/database.types";

type WalletTransaction = Tables<"wallet_transactions">;

type PayoutNotice = {
  id: number;
  amount: number;
  question: string | null;
};

const CATCH_UP_WINDOW_MS = 24 * 60 * 60 * 1000;

function formatEag(amount: number) {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function PayoutNotifier() {
  const [notice, setNotice] = useState<PayoutNotice | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const scheduleDismiss = () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => setNotice(null), 6500);
    };

    const present = async (transaction: WalletTransaction, userId: string) => {
      if (!active || transaction.transaction_type !== "payout" || Number(transaction.amount) <= 0) {
        return;
      }

      const seenKey = `eaglemarket:last-payout:${userId}`;
      const lastSeen = Number(window.localStorage.getItem(seenKey) ?? 0);
      if (lastSeen >= transaction.id) return;
      window.localStorage.setItem(seenKey, String(transaction.id));

      let question: string | null = null;
      if (transaction.market_id) {
        const { data } = await supabase
          .from("markets")
          .select("question")
          .eq("id", transaction.market_id)
          .maybeSingle();
        question = data?.question ?? null;
      }

      if (!active) return;
      setNotice({ id: transaction.id, amount: Number(transaction.amount), question });
      scheduleDismiss();
    };

    const connect = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user || !active) return;
      const userId = data.user.id;

      const { data: latestPayout } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", userId)
        .eq("transaction_type", "payout")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (
        latestPayout &&
        Date.now() - new Date(latestPayout.created_at).getTime() <= CATCH_UP_WINDOW_MS
      ) {
        await present(latestPayout, userId);
      }

      if (!active) return;
      channel = supabase
        .channel(`payout-notifications-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "wallet_transactions",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => void present(payload.new as WalletTransaction, userId),
        )
        .subscribe();
    };

    void connect();

    return () => {
      active = false;
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  if (!notice) return null;

  return (
    <aside className="payout-toast" role="status" aria-live="polite">
      <div className="payout-toast-icon" aria-hidden="true">
        <EagCoin size="md" />
        <span><Check size={11} strokeWidth={3} /></span>
      </div>
      <div className="payout-toast-copy">
        <span>Prediction paid out</span>
        <strong>+{formatEag(notice.amount)} EAG</strong>
        <p>{notice.question ? `${notice.question} settled in your favor.` : "A market settled in your favor."}</p>
      </div>
      <button onClick={() => setNotice(null)} aria-label="Dismiss payout notification">
        <X size={15} />
      </button>
    </aside>
  );
}
