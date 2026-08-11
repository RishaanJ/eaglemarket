"use client";

import { AlertTriangle, Info, Megaphone, Wrench, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Severity = "info" | "warning" | "emergency" | "maintenance";

type Announcement = {
  id: number;
  message: string;
  severity: Severity;
  updated_at: string;
};

const severityIcons: Record<Severity, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  emergency: Megaphone,
  maintenance: Wrench,
};

/**
 * Dismissals are keyed by id *and* updated_at, so editing an announcement
 * brings it back for people who had already dismissed the earlier wording.
 */
function dismissKey(announcement: Announcement) {
  return `em-announcement:${announcement.id}:${announcement.updated_at}`;
}

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // RLS already limits this to live announcements, so no time filtering here.
      const { data, error } = await createClient()
        .from("announcements")
        .select("id, message, severity, updated_at")
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled || error || !data) return;
      const next = data as Announcement;
      setAnnouncement(next);
      setDismissed(window.localStorage.getItem(dismissKey(next)) === "1");
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!announcement || dismissed) return null;

  const Icon = severityIcons[announcement.severity] ?? Info;

  const dismiss = () => {
    try {
      window.localStorage.setItem(dismissKey(announcement), "1");
    } catch {
      // Private-mode storage failures shouldn't keep the banner on screen.
    }
    setDismissed(true);
  };

  return (
    <div
      className={`announcement-banner announcement-${announcement.severity}`}
      role={announcement.severity === "emergency" ? "alert" : "status"}
    >
      <span className="announcement-icon" aria-hidden="true">
        <Icon size={15} />
      </span>
      <p>{announcement.message}</p>
      <button type="button" onClick={dismiss} aria-label="Dismiss announcement">
        <X size={15} />
      </button>
    </div>
  );
}
