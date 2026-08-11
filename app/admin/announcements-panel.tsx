"use client";

import { Check, LoaderCircle, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export type AdminAnnouncement = {
  id: number;
  message: string;
  severity: string;
  isActive: boolean;
  endsAt: string | null;
  isLive: boolean;
  updatedAt: string;
};

const SEVERITIES = ["info", "warning", "emergency", "maintenance"] as const;
const MAX_LENGTH = 300;

/** `datetime-local` needs `YYYY-MM-DDTHH:mm` in local time, not an ISO string. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function AnnouncementsPanel({ announcements }: { announcements: AdminAnnouncement[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<string>("info");
  const [isActive, setIsActive] = useState(true);
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const startCreate = () => {
    setEditingId("new");
    setMessage("");
    setSeverity("info");
    setIsActive(true);
    setEndsAt("");
    setFeedback(null);
  };

  const startEdit = (announcement: AdminAnnouncement) => {
    setEditingId(announcement.id);
    setMessage(announcement.message);
    setSeverity(announcement.severity);
    setIsActive(announcement.isActive);
    setEndsAt(toLocalInput(announcement.endsAt));
    setFeedback(null);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) {
      setFeedback({ tone: "error", text: "The message can’t be empty." });
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const ends = endsAt ? new Date(endsAt).toISOString() : null;

    const { error } =
      editingId === "new"
        ? await supabase.rpc("admin_create_announcement", {
            p_message: text,
            p_severity: severity,
            p_ends_at: ends,
          })
        : await supabase.rpc("admin_update_announcement", {
            p_id: editingId as number,
            p_message: text,
            p_severity: severity,
            p_is_active: isActive,
            p_ends_at: ends,
          });

    setBusy(false);
    if (error) {
      setFeedback({ tone: "error", text: error.message });
      return;
    }

    setEditingId(null);
    setFeedback({ tone: "success", text: editingId === "new" ? "Announcement posted." : "Announcement updated." });
    router.refresh();
  };

  const remove = async (id: number) => {
    setBusy(true);
    const { error } = await createClient().rpc("admin_delete_announcement", { p_id: id });
    setBusy(false);
    if (error) {
      setFeedback({ tone: "error", text: error.message });
      return;
    }
    setFeedback({ tone: "success", text: "Announcement removed." });
    router.refresh();
  };

  return (
    <section className="admin-announcements">
      <div className="section-heading">
        <div>
          <h2>Announcements</h2>
          <p>Banner shown at the top of the markets page.</p>
        </div>
        {editingId === null && (
          <button className="admin-new-announcement" onClick={startCreate}>
            <Plus size={15} /> New announcement
          </button>
        )}
      </div>

      {feedback && (
        <p className={feedback.tone === "error" ? "admin-feedback error" : "admin-feedback"} role="status">
          {feedback.tone === "success" && <Check size={14} />} {feedback.text}
        </p>
      )}

      {editingId !== null && (
        <form className="announcement-form" onSubmit={save}>
          <label>
            <span>Message</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, MAX_LENGTH))}
              rows={2}
              placeholder="Markets are paused during the assembly."
              autoFocus
            />
            <small>{message.length}/{MAX_LENGTH}</small>
          </label>

          <div className="announcement-form-row">
            <label>
              <span>Category</span>
              <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                {SEVERITIES.map((option) => (
                  <option key={option} value={option}>
                    {option[0].toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Hide after (optional)</span>
              <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
            </label>
            {editingId !== "new" && (
              <label className="announcement-active">
                <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
                <span>Active</span>
              </label>
            )}
          </div>

          <div className="announcement-form-actions">
            <button type="button" className="announcement-cancel" onClick={() => setEditingId(null)}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {busy ? <><LoaderCircle className="trade-spinner" size={15} /> Saving…</> : "Save announcement"}
            </button>
          </div>
        </form>
      )}

      {announcements.length ? (
        <ul className="announcement-list">
          {announcements.map((announcement) => (
            <li key={announcement.id}>
              <span className={`announcement-tag announcement-${announcement.severity}`}>
                {announcement.severity}
              </span>
              <div>
                <p>{announcement.message}</p>
                <span className="announcement-state">
                  {announcement.isLive ? "Live now" : announcement.isActive ? "Scheduled or expired" : "Inactive"}
                  {announcement.endsAt && ` · hides ${new Date(announcement.endsAt).toLocaleString()}`}
                </span>
              </div>
              <button onClick={() => startEdit(announcement)} aria-label="Edit announcement" disabled={busy}>
                <Pencil size={14} />
              </button>
              <button
                className="announcement-delete"
                onClick={() => void remove(announcement.id)}
                aria-label="Remove announcement"
                disabled={busy}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        editingId === null && (
          <p className="announcement-empty">
            <Megaphone size={15} /> No announcements yet. Students see nothing at the top of the markets page.
          </p>
        )
      )}
    </section>
  );
}
