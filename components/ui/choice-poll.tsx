"use client";

import { Check } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { calculateProbability, calculatePurchaseOutput, createInitialPool, type MarketPool } from "@/lib/amm";

type PollContextValue = {
  selected: string;
  voted: boolean;
  votes: Record<string, number>;
  total: number;
  pool: MarketPool;
  tradeAmount: number;
  setTradeAmount: (amount: number) => void;
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

function Root({
  children,
  votes,
  initialPool,
  onTradeExecuted,
}: {
  children: ReactNode;
  votes: Record<string, number>;
  initialPool?: MarketPool;
  onTradeExecuted?: (pool: MarketPool) => void;
}) {
  const [selected, setSelected] = useState("");
  const [voted, setVoted] = useState(false);
  const [tradeAmount, setTradeAmount] = useState<number>(10);
  const [pool, setPool] = useState<MarketPool>(initialPool || createInitialPool(1000));

  const total = useMemo(
    () => Object.values(votes).reduce((sum, count) => sum + count, 0) + (voted ? 1 : 0),
    [votes, voted]
  );

  const submit = () => {
    if (!selected || voted) return;
    const isBuyingYes = selected.toLowerCase() === "yes" || selected.toLowerCase() === "option1";
    const { newPoolYes, newPoolNo } = calculatePurchaseOutput(
      tradeAmount,
      pool.sharesYes,
      pool.sharesNo,
      isBuyingYes
    );
    const updated: MarketPool = {
      sharesYes: newPoolYes,
      sharesNo: newPoolNo,
      liquidity: newPoolYes * newPoolNo,
    };
    setPool(updated);
    setVoted(true);
    if (onTradeExecuted) {
      onTradeExecuted(updated);
    }
  };

  return (
    <PollContext.Provider
      value={{
        selected,
        voted,
        votes,
        total,
        pool,
        tradeAmount,
        setTradeAmount,
        select: setSelected,
        submit,
      }}
    >
      <div className="choice-poll">{children}</div>
    </PollContext.Provider>
  );
}

function Option({ value, children }: { value: string; children: ReactNode }) {
  const poll = usePoll();
  const active = poll.selected === value;

  const isYes = value.toLowerCase() === "yes" || value.toLowerCase() === "option1";
  const probYes = calculateProbability(poll.pool.sharesYes, poll.pool.sharesNo);
  const ammPercentage = Math.round((isYes ? probYes : 1 - probYes) * 100);

  const percentage = poll.voted
    ? ammPercentage
    : Math.round((((poll.votes[value] ?? 0) + (poll.voted && active ? 1 : 0)) / poll.total) * 100);

  return (
    <OptionContext.Provider value={value}>
      <button
        className={`poll-option ${active ? "selected" : ""}`}
        onClick={() => poll.select(value)}
        disabled={poll.voted}
        aria-pressed={active}
      >
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
  return (
    <button className="poll-submit" onClick={poll.submit} disabled={!poll.selected || poll.voted}>
      {poll.voted ? "Vote submitted" : "Submit vote"}
    </button>
  );
}

function Footer() {
  const poll = usePoll();
  return (
    <div className="poll-footer">
      <span>{poll.total.toLocaleString()} votes</span>
      {poll.voted && <span><Check size={13} /> You voted</span>}
    </div>
  );
}

export const ChoicePoll = { Root, Option, Submit, Footer };
