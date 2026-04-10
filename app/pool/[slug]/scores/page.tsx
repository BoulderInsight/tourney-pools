"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
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
  slug,
  onUpdate,
  editable,
}: {
  label: string;
  value: number | null;
  golferId: string;
  field: string;
  slug: string;
  onUpdate: () => void;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value !== null ? String(value) : "");

  async function save() {
    const val = input.trim() === "" ? null : Number(input);
    await fetch(`/api/pool/${slug}/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ golferId, field, value: val }),
    });
    setEditing(false);
    onUpdate();
  }

  if (editing && editable) {
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
    <div
      onClick={() => {
        if (!editable) return;
        setInput(value !== null ? String(value) : "");
        setEditing(true);
      }}
      className={`flex flex-col items-center gap-1 min-w-[64px] ${editable ? "cursor-pointer" : ""}`}
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
    </div>
  );
}

function GolferCard({
  golfer,
  slug,
  onUpdate,
  index,
  editable,
}: {
  golfer: PoolConfig["golfers"][0];
  slug: string;
  onUpdate: () => void;
  index: number;
  editable: boolean;
}) {
  const cutStatus =
    golfer.madeCut === true ? "made" : golfer.madeCut === false ? "missed" : "tbd";

  async function toggleCut() {
    const next =
      golfer.madeCut === null ? true : golfer.madeCut === true ? false : null;
    await fetch(`/api/pool/${slug}/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
          <ScoreCell label="R1" value={golfer.r1} golferId={golfer.id} field="r1" slug={slug} onUpdate={onUpdate} editable={editable} />
          <ScoreCell label="R2" value={golfer.r2} golferId={golfer.id} field="r2" slug={slug} onUpdate={onUpdate} editable={editable} />
          <ScoreCell label="R3" value={golfer.r3} golferId={golfer.id} field="r3" slug={slug} onUpdate={onUpdate} editable={editable} />
          <ScoreCell label="R4" value={golfer.r4} golferId={golfer.id} field="r4" slug={slug} onUpdate={onUpdate} editable={editable} />
        </div>
      </div>

      {/* Cut status */}
      {editable ? (
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
      ) : (
        <div
          className={`w-full py-3 text-xs font-semibold tracking-wide uppercase text-center
            ${cutStatus === "made"
              ? "bg-green-50 text-green-700"
              : cutStatus === "missed"
              ? "bg-red-50 text-red-600"
              : "bg-masters-cream/40 text-gray-400"
            }`}
        >
          {cutStatus === "made" ? "Made Cut" : cutStatus === "missed" ? "Missed Cut" : "Cut Status: TBD"}
        </div>
      )}
    </div>
  );
}

export default function PoolScoresPage() {
  const { slug } = useParams() as { slug: string };
  const [config, setConfig] = useState<PoolConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchPool = useCallback(async () => {
    try {
      const [poolRes, meRes] = await Promise.all([
        fetch(`/api/pool/${slug}`),
        fetch("/api/auth/me"),
      ]);
      const data = await poolRes.json();
      if (data) setConfig(data);
      if (meRes.ok) {
        const me = await meRes.json();
        if (me?.isSuperAdmin) setIsSuperAdmin(true);
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const res = await fetch(`/api/pool/${slug}/sync`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncMsg(data.message || "Sync complete");
        fetchPool();
      } else {
        setSyncMsg(data.error || "Sync failed");
      }
    } catch {
      setSyncMsg("Network error");
    } finally {
      setSyncing(false);
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
        <Link href={`/pool/${slug}/setup`} className="btn-green">Go to Setup</Link>
      </div>
    );
  }

  const filteredGolfers = config.golfers
    .filter((g) => {
      const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (filter === "made") return g.madeCut === true;
      if (filter === "missed") return g.madeCut === false;
      if (filter === "tbd") return g.madeCut === null;
      return true;
    })
    .sort((a, b) => {
      const aTotal = [a.r1, a.r2, a.r3, a.r4].filter((r): r is number => r !== null).reduce((s, r) => s + r, 0);
      const bTotal = [b.r1, b.r2, b.r3, b.r4].filter((r): r is number => r !== null).reduce((s, r) => s + r, 0);
      const aHas = [a.r1, a.r2, a.r3, a.r4].some(r => r !== null);
      const bHas = [b.r1, b.r2, b.r3, b.r4].some(r => r !== null);
      if (!aHas && !bHas) return 0;
      if (!aHas) return 1;
      if (!bHas) return -1;
      return aTotal - bTotal;
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
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl font-bold text-masters-green">
            {isSuperAdmin ? "Score Entry" : "Scores"}
          </h1>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs font-semibold text-masters-green bg-masters-green/10 px-3 py-2 rounded-full active:bg-masters-green/20 transition-colors disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? "Syncing..." : "Refresh from API"}
            </button>
          )}
        </div>

        {syncMsg && (
          <p className={`text-xs font-medium px-1 ${syncMsg.includes("fail") || syncMsg.includes("error") ? "text-red-500" : "text-masters-green"}`}>
            {syncMsg}
          </p>
        )}

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
            slug={slug}
            onUpdate={fetchPool}
            index={i}
            editable={isSuperAdmin}
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
