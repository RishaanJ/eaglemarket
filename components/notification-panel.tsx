"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Tables } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

type WalletTransaction = Tables<"wallet_transactions">;

type NotificationItem = {
  id: number;
  transactionType: string;
  amount: number;
  note: string | null;
  createdAt: string;
  marketId: number | null;
  question: string | null;
};

const MAX_NOTIFICATIONS = 20;

function formatAmount(amount: number) {
  return Math.abs(amount).toLocaleString(undefined, {
    maximumFractionDigits: 1,
  });
}

function relativeTime(value: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function notificationCopy(item: NotificationItem) {
  switch (item.transactionType) {
    case "payout":
      return {
        title: "Prediction paid out",
        detail: item.question ?? "A market settled in your favor.",
      };
    case "trade":
      return {
        title: "Prediction placed",
        detail: item.question ?? item.note ?? "Your order was filled.",
      };
    case "refund":
      return {
        title: "Market refunded",
        detail: item.question ?? item.note ?? "Your EAG was returned.",
      };
    case "initial_grant":
      return {
        title: "Welcome to EagleMarket",
        detail: item.note ?? "Your starting balance is ready.",
      };
    case "admin_adjustment":
      return {
        title: "Balance adjusted",
        detail: item.note ?? "Your EAG balance was updated.",
      };
    default:
      return {
        title: "Account activity",
        detail: item.question ?? item.note ?? "Your balance was updated.",
      };
  }
}

export function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [lastReadId, setLastReadId] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(
    () =>
      items.reduce((count, item) => count + (item.id > lastReadId ? 1 : 0), 0),
    [items, lastReadId],
  );

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const hydrateTransaction = async (
      transaction: WalletTransaction,
    ): Promise<NotificationItem> => {
      let question: string | null = null;
      if (transaction.market_id) {
        const { data } = await supabase
          .from("markets")
          .select("question")
          .eq("id", transaction.market_id)
          .maybeSingle();
        question = data?.question ?? null;
      }
      return {
        id: transaction.id,
        transactionType: transaction.transaction_type,
        amount: Number(transaction.amount),
        note: transaction.note,
        createdAt: transaction.created_at,
        marketId: transaction.market_id,
        question,
      };
    };

    const connect = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user || !active) {
        if (active) setLoading(false);
        return;
      }

      const nextUserId = data.user.id;
      setUserId(nextUserId);
      setLastReadId(
        Number(
          localStorage.getItem(
            `eaglemarket:notifications-read:${nextUserId}`,
          ) ?? 0,
        ),
      );

      const { data: transactions } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", nextUserId)
        .order("id", { ascending: false })
        .limit(MAX_NOTIFICATIONS);

      const hydrated = await Promise.all(
        (transactions ?? []).map(hydrateTransaction),
      );
      if (!active) return;
      setItems(hydrated);
      setLoading(false);

      channel = supabase
        .channel(`notification-center-${nextUserId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "wallet_transactions",
            filter: `user_id=eq.${nextUserId}`,
          },
          (payload) => {
            void hydrateTransaction(payload.new as WalletTransaction).then(
              (item) => {
                if (!active) return;
                setItems((current) =>
                  [
                    item,
                    ...current.filter((entry) => entry.id !== item.id),
                  ].slice(0, MAX_NOTIFICATIONS),
                );
              },
            );
          },
        )
        .subscribe();
    };

    void connect();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const markAllRead = () => {
    const newestId = items[0]?.id ?? 0;
    setLastReadId(newestId);
    if (userId)
      localStorage.setItem(
        `eaglemarket:notifications-read:${userId}`,
        String(newestId),
      );
  };

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        className="icon-button notification-trigger"
        type="button"
        aria-label={
          unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"
        }
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          id="notification-panel"
          className="notification-panel"
          aria-label="Notifications"
        >
          <header className="notification-panel-header">
            <h2>Notifications</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </header>

          <div className="notification-list">
            {loading ? (
              Array.from({ length: 3 }, (_, index) => (
                <div
                  className="notification-skeleton"
                  key={index}
                  aria-hidden="true"
                >
                  <i />
                  <span>
                    <b />
                    <b />
                  </span>
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="notification-empty">
                <strong>You&apos;re all caught up</strong>
                <p>Trades, payouts, and account updates will show up here.</p>
              </div>
            ) : (
              items.map((item) => {
                const copy = notificationCopy(item);
                const unread = item.id > lastReadId;
                const positive = item.amount > 0;
                return (
                  <article
                    className={`notification-item${unread ? " unread" : ""}`}
                    key={item.id}
                  >
                    <div className="notification-item-copy">
                      <div>
                        <strong>{copy.title}</strong>
                        <time dateTime={item.createdAt}>
                          {relativeTime(item.createdAt)}
                        </time>
                      </div>
                      <p>{copy.detail}</p>
                      <span className={positive ? "positive" : "negative"}>
                        {positive ? "+" : "−"}
                        {formatAmount(item.amount)} EAG
                      </span>
                    </div>
                    {unread && (
                      <i
                        className="notification-unread-dot"
                        aria-label="Unread"
                      />
                    )}
                  </article>
                );
              })
            )}
          </div>

          <footer className="notification-panel-footer">
            <Link href="/picks" onClick={() => setOpen(false)}>
              View portfolio activity
            </Link>
          </footer>
        </section>
      )}
    </div>
  );
}
