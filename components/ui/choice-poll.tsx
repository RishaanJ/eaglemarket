"use client";

import { Check } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type PollContextValue = {
  selected: string;
  voted: boolean;
  votes: Record<string, number>;
  total: number;
  select: (value: string) => void;
  submit: () => void;
};

const PollContext = createContext<PollContextValue | null>(null);
const OptionContext = createContext<string>("");

function usePoll() {
  const value = useContext(PollContext);
  if (!value) throw new Error("ChoicePoll components must be used inside ChoicePoll.Root");
  return value;
}

function Root({ children, votes }: { children: ReactNode; votes: Record<string, number> }) {
  const [selected, setSelected] = useState("");
  const [voted, setVoted] = useState(false);
  const total = useMemo(() => Object.values(votes).reduce((sum, count) => sum + count, 0) + (voted ? 1 : 0), [votes, voted]);
  return <PollContext.Provider value={{ selected, voted, votes, total, select: setSelected, submit: () => selected && setVoted(true) }}><div className="choice-poll">{children}</div></PollContext.Provider>;
}

function Option({ value, children }: { value: string; children: ReactNode }) {
  const poll = usePoll();
  const active = poll.selected === value;
  const percentage = Math.round((((poll.votes[value] ?? 0) + (poll.voted && active ? 1 : 0)) / poll.total) * 100);
  return (
    <OptionContext.Provider value={value}>
      <button className={`poll-option ${active ? "selected" : ""}`} onClick={() => poll.select(value)} disabled={poll.voted} aria-pressed={active}>
        {poll.voted && <span className="poll-progress-fill" style={{ width: `${percentage}%` }} />}
        <span className="poll-indicator">{active && <Check size={12} strokeWidth={3} />}</span>
        <span className="poll-label">{children}</span>
        {poll.voted && <span className="poll-percentage">{percentage}%</span>}
      </button>
    </OptionContext.Provider>
  );
}

function Submit() {
  const poll = usePoll();
  return <button className="poll-submit" onClick={poll.submit} disabled={!poll.selected || poll.voted}>{poll.voted ? "Vote submitted" : "Submit vote"}</button>;
}

function Footer() {
  const poll = usePoll();
  return <div className="poll-footer"><span>{poll.total.toLocaleString()} votes</span>{poll.voted && <span><Check size={13} /> You voted</span>}</div>;
}

export const ChoicePoll = { Root, Option, Submit, Footer };
