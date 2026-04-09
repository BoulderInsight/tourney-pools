"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PoolConfig, PlayerStanding } from "@/lib/types";
import { computeLeaderboard, formatScore, scoreColorClass } from "@/lib/pool";

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="flex gap-3">
        <div className="loading-dot" />
        <div className="loading-dot" />
        <div className="loading-dot" />
      </div>
      <p className="font-serif italic text-masters-green/60 text-sm">
        Loading standings...
      </p>
    </div>
  );
}

function ScoreBadge({ score, size = "sm" }: { score: number | null; size?: "sm" | "lg" | "xl" }) {
  const sizeClass = size === "xl" ? "text-3xl" : size === "lg" ? "text-xl" : "text-sm";
  return (
    <span className={`font-mono font-bold tabular-nums ${sizeClass} ${scoreColorClass(score)}`}>
      {formatScore(score)}
    </span>
  );
}

function RoundDots({ golfer }: { golfer: PoolConfig["golfers"][0] }) {
  const rounds = [golfer.r1, golfer.r2, golfer.r3, golfer.r4];
  return (
    <div className="flex gap-1.5">
      {rounds.map((r, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${r !== null ? "bg-masters-green" : "bg-gray-200"}`}
          title={`R${i + 1}: ${formatScore(r)}`}
        />
      ))}
    </div>
  );
}

function GolferDetail({ golfer, counted, totalScore, penaltyScore }: {
  golfer: PoolConfig["golfers"][0];
  counted: boolean;
  totalScore: number | null;
  penaltyScore: number;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-3 py-3 text-sm
        ${counted ? "bg-white border border-masters-cream-dark" : "bg-masters-cream/60 opacity-60"}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <RoundDots golfer={golfer} />
        <span className="truncate font-medium text-gray-800">{golfer.name}</span>
        {golfer.madeCut === false && (
          <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
            MC
          </span>
        )}
        {!counted && (
          <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
            bench
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <div className="flex gap-1.5 text-xs text-gray-400 font-mono">
          {[golfer.r1, golfer.r2, golfer.r3, golfer.r4].map((r, i) => (
            <span key={i} className={r !== null ? scoreColorClass(r) : "text-gray-200"}>
              {r !== null ? formatScore(r) : "-"}
            </span>
          ))}
        </div>
        {penaltyScore > 0 && (
          <span className="text-[10px] text-red-500 font-mono">+{penaltyScore}</span>
        )}
        <ScoreBadge score={totalScore} />
      </div>
    </div>
  );
}

function StandingCard({ standing, expanded, onToggle, index }: {
  standing: PlayerStanding;
  expanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  const isLeader = standing.rank === 1 && standing.totalScore !== null;
  const hasRank = standing.rank > 0;

  return (
    <div
      className={`card-interactive animate-stagger-in stagger-${Math.min(index + 1, 10)} overflow-hidden
        ${isLeader ? "ring-2 ring-masters-gold/40" : ""}`}
    >
      {/* Main card content - tap to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-4 flex items-center gap-4"
      >
        {/* Rank */}
        <div className="flex-shrink-0 w-14 flex items-center justify-center">
          {isLeader ? (
            <div className="w-12 h-12 rounded-full bg-masters-gold flex items-center justify-center shadow-gold">
              <span className="text-white font-serif font-bold text-xl">1</span>
            </div>
          ) : hasRank ? (
            <span className="font-serif font-bold text-4xl text-masters-green/80 tabular-nums">
              {standing.rank}
            </span>
          ) : (
            <span className="font-serif font-bold text-2xl text-gray-300 tabular-nums">
              —
            </span>
          )}
        </div>

        {/* Name + info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-gray-900 text-lg truncate">
              {standing.player.name}
            </span>
            {isLeader && (
              <span className="text-[9px] bg-masters-gold text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Leader
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5 font-sans">
            {standing.golfers.filter(g => g.counted).length} golfers counted
          </div>
        </div>

        {/* Score */}
        <div className="flex flex-col items-end flex-shrink-0">
          <ScoreBadge score={standing.totalScore} size="xl" />
          {standing.prize > 0 && (
            <span className="text-xs font-semibold text-masters-gold mt-0.5">
              ${standing.prize}
            </span>
          )}
        </div>

        {/* Chevron */}
        <svg
          className={`w-5 h-5 text-gray-300 flex-shrink-0 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Expanded golfer details */}
      {expanded && (
        <div className="px-4 pb-4 animate-expand">
          <div className="gold-rule mb-3" />
          <div className="space-y-2">
            {standing.golfers.map((gs) => (
              <GolferDetail
                key={gs.golfer.id}
                golfer={gs.golfer}
                counted={gs.counted}
                totalScore={gs.totalScore}
                penaltyScore={gs.penaltyScore}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center bg-masters-green/8 text-masters-green px-3 py-1.5 rounded-full text-xs font-semibold">
      {label}
    </span>
  );
}

export default function PoolLeaderboardPage() {
  const { slug } = useParams();
  const [config, setConfig] = useState<PoolConfig | null>(null);
  const [standings, setStandings] = useState<PlayerStanding[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch(`/api/pool/${slug}`);
      const data = await res.json();
      if (data) {
        setConfig(data);
        setStandings(computeLeaderboard(data));
        setLastUpdated(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchPool();
    const interval = setInterval(fetchPool, 30_000);
    return () => clearInterval(interval);
  }, [fetchPool]);

  if (loading) return <LoadingState />;

  if (!config || !config.setupComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-masters-green/10 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-masters-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
          </svg>
        </div>
        <h1 className="font-serif text-2xl font-bold text-masters-green mb-2">
          No Pool Yet
        </h1>
        <p className="text-gray-500 text-sm mb-8 max-w-xs leading-relaxed">
          The chairman hasn&apos;t set things up yet. Check back soon.
        </p>
      </div>
    );
  }

  const totalPurse = config.players.length * config.buyIn;
  const roundsWithData = [1, 2, 3, 4].filter(r =>
    config.golfers.some(g => g[`r${r}` as keyof typeof g] !== null)
  );
  const currentRound = roundsWithData.length > 0 ? Math.max(...roundsWithData) : 0;

  return (
    <div>
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 -mx-4 px-4 pt-2 pb-3 bg-masters-cream/95 backdrop-blur-sm">
        <h1 className="font-serif text-2xl font-bold text-masters-green leading-tight">
          {config.poolName || "Masters Pool 2026"}
        </h1>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-masters-gold" />
            <strong className="text-gray-700">${totalPurse}</strong> purse
          </span>
          <span className="text-gray-300">|</span>
          <span>{config.players.length} players</span>
          {currentRound > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Rd {currentRound}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Settings pills */}
      <div className="flex flex-wrap gap-1.5 mt-3 mb-5">
        <SettingsPill label={config.settings.draftType === "snake" ? "Snake Draft" : "Random Draft"} />
        <SettingsPill label={
          config.settings.scoringType === "all"
            ? "All Golfers Count"
            : `Best ${config.settings.bestN} Count`
        } />
        <SettingsPill label={
          config.settings.missedCutRule === "penalty"
            ? `MC +${config.settings.missedCutPenalty}/rd`
            : config.settings.missedCutRule === "zero"
            ? "MC = Zero"
            : "MC = Worst"
        } />
      </div>

      {/* Refresh button */}
      <div className="flex justify-between items-center mb-4">
        <div className="gold-rule flex-1" />
        <button
          onClick={fetchPool}
          className="ml-3 flex items-center gap-1.5 text-xs text-gray-400 active:text-masters-green transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {lastUpdated && lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </button>
      </div>

      {/* Standings cards */}
      <div className="space-y-3">
        {standings.map((standing, i) => (
          <StandingCard
            key={standing.player.id}
            standing={standing}
            expanded={expandedId === standing.player.id}
            onToggle={() =>
              setExpandedId(expandedId === standing.player.id ? null : standing.player.id)
            }
            index={i}
          />
        ))}
      </div>

      {/* Empty state */}
      {currentRound === 0 && (
        <div className="text-center mt-8 mb-4">
          <div className="gold-rule mb-4" />
          <p className="font-serif italic text-gray-400 text-sm">
            Scores will appear once Round 1 data is entered.
          </p>
        </div>
      )}
    </div>
  );
}
