"use client";

import { useEffect, useState, useCallback } from "react";
import { PoolConfig } from "@/lib/types";
import { formatScore, scoreColorClass } from "@/lib/pool";
import Link from "next/link";

type Filter = "all" | "made" | "missed" | "tbd";

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="flex gap-3">
        <div className="loading-dot" />
        <div className="loading-dot" />
        <div className="loading-dot" />
      </div>
      <p className="font-serif italic text-masters-green/60 text-sm">Loading golfers...</p>
    </div>
  );
}

function ScoreCell({
  label,
  value,
  golferId,
  field,
  password,
  onUpdate,
}: {
  label: string;
  value: number | null;
  golferId: string;
  field: string;
  password: string;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value !== null ? String(value) : "");

  async function save() {
    const val = input.trim() === "" ? null : Number(input);
    await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ golferId, field, value: val }),
    });
    setEditing(false);
    onUpdate();
  }

  if (editing) {
    return (
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
        <input
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && save()}
          autoFocus
          className="w-16 h-14 text-center text-lg font-mono font-bold border-2 border-masters-green rounded-xl bg-white outline-none"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setInput(value !== null ? String(value) : "");
        setEditing(true);
      }}
      className="flex flex-col items-center gap-1 min-w-[64px]"
    >
      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{label}</span>
      <div
        className={`w-16 h-14 flex items-center justify-center rounded-xl border-2 transition-colors
          ${value !== null
            ? "border-masters-cream-dark bg-white"
            : "border-dashed border-gray-200 bg-masters-cream/40"}`}
      >
        <span className={`text-lg font-mono font-bold ${value !== null ? scoreColorClass(value) : "text-gray-200"}`}>
          {value !== null ? formatScore(value) : "-"}
        </span>
      </div>
    </button>
  );
}

function GolferCard({
  golfer,
  password,
  onUpdate,
  index,
}: {
  golfer: PoolConfig["golfers"][0];
  password: string;
  onUpdate: () => void;
  index: number;
}) {
  const cutStatus =
    golfer.madeCut === true ? "made" : golfer.madeCut === false ? "missed" : "tbd";

  async function toggleCut() {
    const next =
      golfer.madeCut === null ? true : golfer.madeCut === true ? false : null;
    await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": password },
      body: JSON.stringify({ golferId: golfer.id, field: "madeCut", value: next }),
    });
    onUpdate();
  }

  const total = [golfer.r1, golfer.r2, golfer.r3, golfer.r4]
    .filter((r): r is number => r !== null)
    .reduce((a, b) => a + b, 0);
  const hasScores = [golfer.r1, golfer.r2, golfer.r3, golfer.r4].some(r => r !== null);

  return (
    <div className={`card overflow-hidden animate-stagger-in stagger-${Math.min(index + 1, 10)}`}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-serif font-bold text-gray-900 truncate">{golfer.name}</span>
          {cutStatus === "missed" && (
            <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
              MC
            </span>
          )}
          {cutStatus === "made" && (
            <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
              Made
            </span>
          )}
        </div>
        {hasScores && (
          <span className={`font-mono font-bold text-lg ${scoreColorClass(total)}`}>
            {formatScore(total)}
          </span>
        )}
      </div>

      {/* Round scores */}
      <div className="px-4 pb-3">
        <div className="flex justify-between gap-2">
          <ScoreCell label="R1" value={golfer.r1} golferId={golfer.id} field="r1" password={password} onUpdate={onUpdate} />
          <ScoreCell label="R2" value={golfer.r2} golferId={golfer.id} field="r2" password={password} onUpdate={onUpdate} />
          <ScoreCell label="R3" value={golfer.r3} golferId={golfer.id} field="r3" password={password} onUpdate={onUpdate} />
          <ScoreCell label="R4" value={golfer.r4} golferId={golfer.id} field="r4" password={password} onUpdate={onUpdate} />
        </div>
      </div>

      {/* Cut toggle */}
      <button
        type="button"
        onClick={toggleCut}
        className={`w-full py-3 text-xs font-semibold tracking-wide uppercase text-center transition-colors
          ${cutStatus === "made"
            ? "bg-green-50 text-green-700"
            : cutStatus === "missed"
            ? "bg-red-50 text-red-600"
            : "bg-masters-cream/40 text-gray-400"
          }`}
      >
        {cutStatus === "made" ? "Made Cut" : cutStatus === "missed" ? "Missed Cut" : "Cut Status: TBD"} — Tap to change
      </button>
    </div>
  );
}

export default function ScoresPage() {
  const [config, setConfig] = useState<PoolConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch("/api/pool");
      const data = await res.json();
      if (data) setConfig(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
    } else {
      setAuthError("Incorrect password.");
    }
  }

  if (loading) return <LoadingState />;

  if (!config || !config.setupComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-masters-green/10 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-masters-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h1 className="font-serif text-2xl font-bold text-masters-green mb-2">No Pool Yet</h1>
        <p className="text-gray-500 text-sm mb-8">Set up the pool first before entering scores.</p>
        <Link href="/setup" className="btn-green">Go to Setup</Link>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="card p-8 w-full text-center">
          <div className="w-16 h-16 rounded-full bg-masters-green/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-masters-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h2 className="font-serif text-xl text-masters-green mb-1 font-bold">Score Entry</h2>
          <p className="text-xs text-gray-500 mb-6">Commissioner password required to edit scores.</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="input-field text-center"
            />
            {authError && <p className="text-red-500 text-xs">{authError}</p>}
            <button type="submit" className="btn-green w-full">Enter</button>
          </form>
        </div>
      </div>
    );
  }

  const filteredGolfers = config.golfers.filter((g) => {
    const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "made") return g.madeCut === true;
    if (filter === "missed") return g.madeCut === false;
    if (filter === "tbd") return g.madeCut === null;
    return true;
  });

  const filters: { label: string; value: Filter }[] = [
    { label: "All", value: "all" },
    { label: "Made", value: "made" },
    { label: "Missed", value: "missed" },
    { label: "TBD", value: "tbd" },
  ];

  return (
    <div>
      {/* Sticky search + filters */}
      <div className="sticky top-0 z-40 -mx-4 px-4 pt-2 pb-3 bg-masters-cream/95 backdrop-blur-sm space-y-3">
        <h1 className="font-serif text-2xl font-bold text-masters-green">
          Score Entry
        </h1>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search golfers..."
            className="input-field pl-10"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`pill ${filter === f.value ? "pill-active" : "pill-inactive"}`}
            >
              {f.label}
              {f.value !== "all" && (
                <span className="ml-1 opacity-70">
                  {f.value === "made"
                    ? config.golfers.filter(g => g.madeCut === true).length
                    : f.value === "missed"
                    ? config.golfers.filter(g => g.madeCut === false).length
                    : config.golfers.filter(g => g.madeCut === null).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Golfer cards */}
      <div className="space-y-3 mt-4">
        {filteredGolfers.map((golfer, i) => (
          <GolferCard
            key={golfer.id}
            golfer={golfer}
            password={password}
            onUpdate={fetchPool}
            index={i}
          />
        ))}
      </div>

      {filteredGolfers.length === 0 && (
        <div className="text-center py-12">
          <p className="font-serif italic text-gray-400 text-sm">No golfers match your search.</p>
        </div>
      )}
    </div>
  );
}
