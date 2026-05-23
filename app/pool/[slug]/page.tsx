"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PoolConfig, PlayerStanding, PayoutTransfer } from "@/lib/types";
import { computeLeaderboard, computePaymentPlan, formatScore, scoreColorClass } from "@/lib/pool";
import { buildPaymentLink, paymentMethodLabel } from "@/lib/payment-links";
import Link from "next/link";
import { SponsorBanner } from "@/app/components/sponsor-banner";

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="flex gap-3">
        <div className="loading-dot" />
        <div className="loading-dot" />
        <div className="loading-dot" />
      </div>
      <p className="font-serif italic text-tp-primary/60 text-sm">
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
          className={`w-2 h-2 rounded-full ${r !== null ? "bg-tp-primary" : "bg-gray-200"}`}
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
        ${counted ? "bg-white border border-tp-bg-dark" : "bg-tp-bg/60"}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {counted ? (
          <span
            className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-tp-accent"
            title="Counts toward total"
            aria-label="Counts toward total"
          >
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : (
          <span className="w-4 flex-shrink-0" aria-hidden="true" />
        )}
        <RoundDots golfer={golfer} />
        {golfer.worldRanking && (
          <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">#{golfer.worldRanking}</span>
        )}
        <span className="truncate font-medium text-gray-800">{golfer.name}</span>
        {golfer.madeCut === false && (
          <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
            MC
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

function PayoutInfo({ standing, buyIn, payoutMethod, chairmanName, poolName, paymentPlan }: {
  standing: PlayerStanding;
  buyIn: number;
  payoutMethod: string;
  chairmanName: string;
  poolName: string;
  paymentPlan: Map<string, PayoutTransfer[]>;
}) {
  const isWinner = standing.prize > 0;
  const netWin = standing.prize - buyIn;
  const isChairmanCollects = payoutMethod === "chairman-collects";

  if (isWinner && netWin > 0) {
    return (
      <div className="mb-3 bg-green-50 rounded-xl p-3">
        <p className="text-xs font-semibold text-green-700">
          {isChairmanCollects
            ? `Receives $${standing.prize} from the Chairman`
            : `Collects $${netWin} net ($${standing.prize} prize - $${buyIn} buy-in)`
          }
        </p>
      </div>
    );
  }

  const transfers = paymentPlan.get(standing.player.id) ?? [];
  if (isWinner || transfers.length === 0) return null;

  if (isChairmanCollects) {
    return (
      <div className="mb-3 bg-red-50 rounded-xl p-3">
        <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-1.5">Owes</p>
        <p className="text-xs font-medium text-red-700">
          Pay {chairmanName || "the Chairman"} <strong>${buyIn.toFixed(2)}</strong>
        </p>
      </div>
    );
  }

  // Honor system: render the netted transfers. The plan was computed once at the
  // page level via `computePaymentPlan`, so most losers see a single button (one
  // winner each); only the worst-finishing loser may see a split across two.
  const note = `${poolName} payout`;
  return (
    <div className="mb-3 bg-red-50 rounded-xl p-3">
      <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-1.5">Owes</p>
      <div className="space-y-2">
        {transfers.map((t) => {
          if (!t.toPaymentInfo) {
            return (
              <div key={t.toPlayerId} className="text-xs font-medium text-red-700">
                Pay {t.toPlayerName} <strong>${t.amount.toFixed(2)}</strong>
                <span className="block text-[10px] text-red-400 mt-0.5">
                  No handle on file. Ask {t.toPlayerName} for theirs.
                </span>
              </div>
            );
          }
          const url = buildPaymentLink(t.toPaymentInfo.method, t.toPaymentInfo.handle, {
            amount: t.amount,
            note,
          });
          return (
            <a
              key={t.toPlayerId}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Pay ${t.toPlayerName} $${t.amount.toFixed(2)} via ${paymentMethodLabel(t.toPaymentInfo.method)}`}
              className="flex items-center justify-between bg-tp-accent text-tp-primary rounded-lg px-3 py-3 active:opacity-90 transition-opacity"
            >
              <span className="text-sm font-semibold">
                Pay {t.toPlayerName} ${t.amount.toFixed(2)}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-bold opacity-80" aria-hidden="true">
                via {paymentMethodLabel(t.toPaymentInfo.method)} &rarr;
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function StandingCard({ standing, expanded, onToggle, index, buyIn, tournamentOver, payoutMethod, chairmanNameForPayout, poolName, paymentPlan }: {
  standing: PlayerStanding;
  expanded: boolean;
  onToggle: () => void;
  index: number;
  buyIn: number;
  tournamentOver: boolean;
  payoutMethod: string;
  chairmanNameForPayout: string;
  poolName: string;
  paymentPlan: Map<string, PayoutTransfer[]>;
}) {
  const isLeader = standing.rank === 1 && standing.totalScore !== null;
  const hasRank = standing.rank > 0;

  return (
    <div
      className={`card-interactive animate-stagger-in stagger-${Math.min(index + 1, 10)} overflow-hidden
        ${isLeader ? "ring-2 ring-tp-accent/40" : ""}`}
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
            <div className="w-12 h-12 rounded-full bg-tp-accent flex items-center justify-center shadow-gold">
              <span className="text-white font-serif font-bold text-xl">1</span>
            </div>
          ) : hasRank ? (
            <span className="font-serif font-bold text-4xl text-tp-primary/80 tabular-nums">
              {standing.rank}
            </span>
          ) : (
            <span className="font-serif font-bold text-2xl text-gray-300 tabular-nums">
              -
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
              <span className="text-[9px] bg-tp-accent text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
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
            <span className="text-xs font-semibold text-tp-accent mt-0.5">
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

      {/* Expanded view: payout summary first (most relevant once the tournament is
          over), then the golfer-by-golfer score breakdown below the gold rule. */}
      {expanded && (
        <div className="px-4 pb-4 animate-expand">
          {tournamentOver && (
            <PayoutInfo
              standing={standing}
              buyIn={buyIn}
              payoutMethod={payoutMethod}
              chairmanName={chairmanNameForPayout}
              poolName={poolName}
              paymentPlan={paymentPlan}
            />
          )}
          <div className="gold-rule mb-3" />
          <div className="space-y-2">
            {[...standing.golfers].sort((a, b) => {
              if (a.totalScore === null && b.totalScore === null) return 0;
              if (a.totalScore === null) return 1;
              if (b.totalScore === null) return -1;
              return a.totalScore - b.totalScore;
            }).map((gs) => (
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

const TEAM_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", bar: "bg-blue-500" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", bar: "bg-amber-500" },
  { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200", bar: "bg-purple-500" },
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200", bar: "bg-rose-500" },
  { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-200", bar: "bg-teal-500" },
  { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200", bar: "bg-orange-500" },
  { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200", bar: "bg-indigo-500" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", bar: "bg-emerald-500" },
];

function getTeamColor(playerIndex: number) {
  return TEAM_COLORS[playerIndex % TEAM_COLORS.length];
}

function LiveDraft({ slug, config, isOwner, onComplete }: {
  slug: string;
  config: PoolConfig & { assignments: { playerId: string; golferId: string; pickNumber: number }[] };
  isOwner: boolean;
  onComplete: () => void;
}) {
  const [players, setPlayers] = useState<{ id: string; name: string; pick_order: number }[]>([]);
  const [draftAssignments, setDraftAssignments] = useState<{ player_id: string; golfer_id: string; pick_number: number }[]>([]);
  const [orderDrawn, setOrderDrawn] = useState(false);
  const [selectedGolfer, setSelectedGolfer] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const fetchDraft = useCallback(async () => {
    const res = await fetch(`/api/pool/${slug}/draft`);
    if (res.ok) {
      const data = await res.json();
      const sorted = data.players.sort((a: { pick_order: number }, b: { pick_order: number }) => a.pick_order - b.pick_order);
      setPlayers(sorted);
      setDraftAssignments(data.assignments);
      const orders = sorted.map((p: { pick_order: number }) => p.pick_order);
      setOrderDrawn(new Set(orders).size === orders.length && orders.length > 1);
    }
  }, [slug]);

  useEffect(() => {
    fetchDraft();
    const interval = setInterval(fetchDraft, 5000); // Refresh every 5s for spectators
    return () => clearInterval(interval);
  }, [fetchDraft]);

  function getSnakeOrder(pickNum: number) {
    const n = players.length;
    if (n === 0) return null;
    const round = Math.floor(pickNum / n);
    const pos = pickNum % n;
    const idx = round % 2 === 0 ? pos : n - 1 - pos;
    return players[idx];
  }

  async function drawOrder() {
    setSaving(true);
    await fetch(`/api/pool/${slug}/draft`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "draw_order" }),
    });
    await fetchDraft();
    setSaving(false);
  }

  async function confirmPick() {
    if (!selectedGolfer) return;
    setSaving(true);
    const picker = getSnakeOrder(draftAssignments.length);
    await fetch(`/api/pool/${slug}/draft`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pick", playerId: picker?.id, golferId: selectedGolfer, pickNumber: draftAssignments.length + 1 }),
    });
    setSelectedGolfer(null);
    await fetchDraft();
    setSaving(false);
  }

  async function undoPick() {
    setSaving(true);
    await fetch(`/api/pool/${slug}/draft`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "undo" }),
    });
    setSelectedGolfer(null);
    await fetchDraft();
    setSaving(false);
  }

  async function lockDraft() {
    setSaving(true);
    await fetch(`/api/pool/${slug}/draft`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock" }),
    });
    onComplete();
  }

  const draftedIds = new Set(draftAssignments.map(a => a.golfer_id));
  const picksPerPlayer: Record<string, number> = {};
  for (const p of players) picksPerPlayer[p.id] = 0;
  for (const a of draftAssignments) picksPerPlayer[a.player_id] = (picksPerPlayer[a.player_id] || 0) + 1;
  const pickCounts = Object.values(picksPerPlayer);
  const allEqual = pickCounts.length > 0 && pickCounts.every(c => c === pickCounts[0]) && pickCounts[0] > 0;
  const currentPicker = getSnakeOrder(draftAssignments.length);
  const currentRound = players.length > 0 ? Math.floor(draftAssignments.length / players.length) + 1 : 0;
  const selectedName = config.golfers.find(g => g.id === selectedGolfer)?.name;

  // Draw order step
  if (!orderDrawn) {
    return (
      <div className="card p-6 text-center mt-4">
        <h2 className="font-serif text-lg font-bold text-tp-primary mb-2">
          {isOwner ? "Draw for Pick Order" : "Waiting for Chairman to Draw Order..."}
        </h2>
        <div className="space-y-2 mb-6">
          {players.map(p => (
            <div key={p.id} className="flex items-center gap-3 bg-tp-bg/60 rounded-xl px-4 py-3">
              <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-400">?</span>
              <span className="font-medium text-gray-800">{p.name}</span>
            </div>
          ))}
        </div>
        {isOwner && (
          <button onClick={drawOrder} disabled={saving} className="btn-gold w-full disabled:opacity-60">
            {saving ? "Drawing..." : "Draw Straws"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      {/* Pick order bar */}
      <div className="flex items-center gap-2 justify-center mb-4 flex-wrap">
        {players.map((p, i) => (
          <div key={p.id} className={`flex flex-col items-center px-3 py-2 rounded-xl text-center
            ${currentPicker?.id === p.id ? "bg-tp-primary text-white shadow-card" : `${getTeamColor(i).bg} ${getTeamColor(i).text} border ${getTeamColor(i).border}`}`}>
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">#{i + 1}</span>
            <span className="text-xs font-bold truncate max-w-[70px]">{p.name}</span>
            <span className="text-[9px] opacity-60">{picksPerPlayer[p.id]} picks</span>
          </div>
        ))}
      </div>

      {/* Current picker / confirm pick (replaces banner when golfer selected) */}
      {currentPicker && (
        isOwner && selectedGolfer ? (
          <button onClick={confirmPick} disabled={saving}
            className="w-full btn-gold rounded-xl px-4 py-3 mb-3 text-center disabled:opacity-60">
            <p className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Tap to confirm</p>
            <p className="font-serif text-xl font-bold">Add {selectedName} to {currentPicker.name}&apos;s Team</p>
          </button>
        ) : (
          <div className="bg-tp-primary text-white rounded-xl px-4 py-3 mb-3 text-center">
            <p className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Round {currentRound} · Pick #{draftAssignments.length + 1}</p>
            <p className="font-serif text-xl font-bold">{currentPicker.name}&apos;s Pick</p>
          </div>
        )
      )}

      {/* Copy link for spectators */}
      {isOwner && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
          }}
          className="w-full flex items-center justify-center gap-2 py-3.5 mb-3 font-semibold rounded-xl text-sm tracking-wide transition-colors"
          style={{ backgroundColor: "#fed60d", color: "#096a52" }}
        >
          {linkCopied ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
              Copy Link to Share with Players for Live Draft
            </>
          )}
        </button>
      )}

      {/* Chairman actions */}
      {isOwner && (
        <div className="flex justify-between mb-3 px-1">
          {draftAssignments.length > 0 ? (
            <button onClick={undoPick} disabled={saving} className="text-xs text-red-400 font-semibold active:underline disabled:opacity-50">Undo Last Pick</button>
          ) : <div />}
          <button onClick={drawOrder} disabled={saving} className="text-xs text-gray-400 font-semibold active:underline disabled:opacity-50">Redraw Order</button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search golfers..." className="input-field pl-10 text-sm" />
      </div>

      {/* Golfer list */}
      <div className="card overflow-hidden mb-4">
        <div className="divide-y divide-tp-bg-dark max-h-[400px] overflow-y-auto">
          {config.golfers
            .filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => (a.worldRanking || 999) - (b.worldRanking || 999))
            .map(g => {
              const isDrafted = draftedIds.has(g.id);
              const owner = isDrafted ? players.find(p => draftAssignments.find(a => a.golfer_id === g.id && a.player_id === p.id)) : null;
              const isSelected = selectedGolfer === g.id;

              if (isDrafted) {
                return (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-3 opacity-50">
                    <div className="w-5 h-5 flex-shrink-0" />
                    {g.worldRanking && <span className="text-[10px] text-gray-400 font-mono w-6 flex-shrink-0">#{g.worldRanking}</span>}
                    <span className="text-sm text-gray-500 line-through flex-1">{g.name}</span>
                    {(() => {
                      const ownerIdx = players.findIndex(p => p.id === owner?.id);
                      const tc = getTeamColor(ownerIdx >= 0 ? ownerIdx : 0);
                      return <span className={`text-[10px] ${tc.bg} ${tc.text} px-2 py-0.5 rounded-full font-semibold flex-shrink-0`}>{owner?.name}</span>;
                    })()}
                  </div>
                );
              }

              if (!isOwner) {
                return (
                  <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-5 h-5 flex-shrink-0" />
                    {g.worldRanking && <span className="text-[10px] text-gray-400 font-mono w-6 flex-shrink-0">#{g.worldRanking}</span>}
                    <span className="text-sm font-medium text-gray-900">{g.name}</span>
                  </div>
                );
              }

              return (
                <button key={g.id} type="button" onClick={() => setSelectedGolfer(isSelected ? null : g.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? "bg-tp-primary/10" : "active:bg-tp-bg/60"}`}>
                  <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? "border-tp-primary bg-tp-primary" : "border-gray-300"}`}>
                    {isSelected && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  {g.worldRanking && <span className="text-[10px] text-gray-400 font-mono w-6 flex-shrink-0">#{g.worldRanking}</span>}
                  <span className="text-sm font-medium text-gray-900">{g.name}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Teams */}
      <div className="gold-rule mb-4" />
      <h3 className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3 px-1">Teams</h3>
      <div className="space-y-3 mb-6">
        {players.map((p, pi) => {
          const myPicks = draftAssignments.filter(a => a.player_id === p.id).sort((a, b) => a.pick_number - b.pick_number);
          const tc = getTeamColor(pi);
          return (
            <div key={p.id} className={`card p-3 border-l-4 ${tc.border}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-serif font-bold text-sm ${tc.text}`}>{p.name}</span>
                <span className="text-[10px] text-gray-400">{myPicks.length} picks</span>
              </div>
              {myPicks.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {myPicks.map(a => {
                    const g = config.golfers.find(gf => gf.id === a.golfer_id);
                    return <span key={a.golfer_id} className="text-[10px] bg-tp-bg-dark rounded-full px-2 py-0.5 font-medium text-gray-700">{g?.name || "?"}</span>;
                  })}
                </div>
              ) : <p className="text-[10px] text-gray-300 italic">No picks yet</p>}
            </div>
          );
        })}
      </div>

      {/* Lock button (chairman only) */}
      {isOwner && (
        <button onClick={lockDraft} disabled={!allEqual || saving}
          className={`w-full py-4 rounded-xl font-semibold text-sm transition-colors mb-4 ${allEqual ? "bg-tp-accent text-white active:bg-tp-accent-dark" : "bg-gray-200 text-gray-400 cursor-not-allowed"}`}>
          {allEqual ? `Lock Draft: ${pickCounts[0]} golfers each` : "Each player must have equal picks to lock"}
        </button>
      )}
    </div>
  );
}

function SettingsPill({ label, info }: { label: string; info: string }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowInfo(!showInfo)}
        className="inline-flex items-center gap-1 bg-tp-primary/8 text-tp-primary px-3 py-1.5 rounded-full text-xs font-semibold active:bg-tp-primary/15 transition-colors"
      >
        {label}
        <svg className="w-3 h-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {showInfo && (
        <div className="absolute top-full left-0 mt-1 z-30 min-w-[260px]">
          <div className="bg-white rounded-xl shadow-card-lg p-3 text-xs text-gray-600 leading-relaxed border border-tp-bg-dark">
            {info}
            <button onClick={() => setShowInfo(false)} className="block mt-2 text-tp-primary font-semibold">Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AwaitingFieldState({ info }: {
  info: { name: string; status: string | null; startDate: string | null };
}) {
  const started =
    info.status === "in_progress" ||
    info.status === "completed" ||
    (info.startDate ? new Date(info.startDate) <= new Date() : false);
  const startLabel = info.startDate
    ? new Date(info.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <img src="/logo.png" alt="TourneyPools" className="h-10 mx-auto mb-3" />
      {started ? (
        <>
          <h1 className="font-serif text-2xl font-bold text-tp-primary mb-2">Draft Not Ready</h1>
          <p className="text-gray-500 text-sm mb-2 max-w-xs leading-relaxed">
            We haven&apos;t been able to load {info.name || "the tournament"}&apos;s field yet.
          </p>
          <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
            This usually resolves on its own within a few minutes. If it doesn&apos;t, contact support.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-serif text-2xl font-bold text-tp-primary mb-2">Draft Pending</h1>
          <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
            Waiting for {info.name || "the tournament"}&apos;s field to be announced
            {startLabel ? ` — the tournament starts ${startLabel}` : ""}. The field is usually
            published a few days before play begins, and the draft runs as soon as it&apos;s out.
          </p>
        </>
      )}
    </div>
  );
}

export default function PoolLeaderboardPage() {
  const { slug } = useParams();
  const [config, setConfig] = useState<PoolConfig | null>(null);
  const [standings, setStandings] = useState<PlayerStanding[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [chairmanName, setChairmanName] = useState("");
  const [chairmanTier, setChairmanTier] = useState("free");
  const [customAdImage, setCustomAdImage] = useState<string | null>(null);
  const [customAdUrl, setCustomAdUrl] = useState<string | null>(null);
  const [customAdHeadline, setCustomAdHeadline] = useState<string | null>(null);
  const [customAdDescription, setCustomAdDescription] = useState<string | null>(null);
  const [adRemoved, setAdRemoved] = useState(false);
  const [draftComplete, setDraftComplete] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [awaitingField, setAwaitingField] = useState(false);
  const [awaitingInfo, setAwaitingInfo] = useState<{ name: string; status: string | null; startDate: string | null }>({ name: "", status: null, startDate: null });
  const [tournamentName, setTournamentName] = useState("");

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch(`/api/pool/${slug}`);
      const data = await res.json();
      if (data) {
        setConfig(data);
        setStandings(computeLeaderboard(data));
        setLastUpdated(new Date());
        if (data.chairmanName) setChairmanName(data.chairmanName);
        if (data.chairmanTier) setChairmanTier(data.chairmanTier);
        if (data.customAdImage) setCustomAdImage(data.customAdImage);
        if (data.customAdUrl) setCustomAdUrl(data.customAdUrl);
        if (data.customAdHeadline) setCustomAdHeadline(data.customAdHeadline);
        if (data.customAdDescription) setCustomAdDescription(data.customAdDescription);
        if (data.adRemoved) setAdRemoved(data.adRemoved);
        setDraftComplete(data.draftComplete !== false);
        setAwaitingField(!!data.awaitingField);
        setAwaitingInfo({
          name: data.tournamentName || "",
          status: data.tournamentStatus || null,
          startDate: data.tournamentStartDate || null,
        });
        setTournamentName(data.tournamentName || "");
        // Check if current user is chairman
        try {
          const meRes = await fetch("/api/auth/me");
          if (meRes.ok) {
            const me = await meRes.json();
            if (me?.chairmanId === data.chairmanId) setIsOwner(true);
          }
        } catch { /* not logged in */ }
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

  // Honor-system payout plan: must live above the early returns so the hook order
  // stays stable across renders. `computePaymentPlan` returns an empty map for the
  // pre-data case (no standings yet or buyIn = 0), so the conditional is safe.
  const buyInForPlan = config?.buyIn ?? 0;
  const paymentPlan = useMemo(
    () => computePaymentPlan(standings, buyInForPlan),
    [standings, buyInForPlan],
  );

  if (loading) return <LoadingState />;

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <img src="/logo.png" alt="TourneyPools" className="h-10 mx-auto mb-2" />
        <h1 className="font-serif text-2xl font-bold text-tp-primary mb-2">
          Pool Not Found
        </h1>
        <p className="text-gray-500 text-sm mb-8 max-w-xs leading-relaxed">
          This pool is no longer active or the link may be incorrect.
        </p>
        <p className="text-sm font-semibold mb-3" style={{ color: "#096a52" }}>
          Want to become a Chairman and run your own pool?
        </p>
        <Link
          href="/signup"
          className="inline-block text-center font-semibold rounded-xl px-8 py-3.5 text-sm tracking-wide transition-colors"
          style={{ backgroundColor: "#fed60d", color: "#096a52" }}
        >
          Sign Up Here
        </Link>
      </div>
    );
  }

  if (!config.setupComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <img src="/logo.png" alt="TourneyPools" className="h-10 mx-auto mb-2" />
        <h1 className="font-serif text-2xl font-bold text-tp-primary mb-2">
          Pool Coming Soon
        </h1>
        <p className="text-gray-500 text-sm mb-8 max-w-xs leading-relaxed">
          The chairman is still setting things up. Check back soon!
        </p>
      </div>
    );
  }

  if (awaitingField) {
    return <AwaitingFieldState info={awaitingInfo} />;
  }

  const totalPurse = config.players.length * config.buyIn;
  const roundsWithData = [1, 2, 3, 4].filter(r =>
    config.golfers.some(g => g[`r${r}` as keyof typeof g] !== null)
  );
  const currentRound = roundsWithData.length > 0 ? Math.max(...roundsWithData) : 0;

  return (
    <div>
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 -mx-4 px-4 pt-2 pb-3 bg-tp-bg/95 backdrop-blur-sm">
        <h1 className="font-serif text-2xl font-bold text-tp-primary leading-tight text-center">
          {config.poolName || "Golf Pool"}
        </h1>
        {tournamentName && (
          <p className="text-center text-sm font-medium text-tp-accent mt-0.5">
            {tournamentName}
          </p>
        )}
        <div className="flex items-center justify-center gap-3 mt-1.5 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-tp-accent" />
            <strong className="text-gray-700">${totalPurse}</strong> purse
          </span>
          <span className="text-gray-300">|</span>
          <span>{config.players.length} players</span>
          {chairmanName && (
            <>
              <span className="text-gray-300">|</span>
              <span>Chairman: <strong className="text-gray-700">{chairmanName}</strong></span>
            </>
          )}
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

      {/* Settings pills: tap for explanation */}
      <div className="flex flex-wrap gap-1.5 mt-3 mb-5">
        <SettingsPill
          label={config.settings.draftType === "snake" ? "Snake Draft" : config.settings.draftType === "auto-snake" ? "Auto Snake" : "Random Draft"}
          info={config.settings.draftType === "snake"
            ? "Pick order reverses each round (1-2-3-4, then 4-3-2-1) so everyone gets a fair mix of early and late picks."
            : config.settings.draftType === "auto-snake"
            ? "Player order was randomized, then golfers were assigned by world ranking in snake format. Fair and balanced."
            : "Golfers are shuffled randomly and dealt out in order. Simpler but less balanced than snake."
          }
        />
        <SettingsPill
          label={config.settings.scoringType === "all" ? "All Golfers Count" : `Best ${config.settings.bestN} Count`}
          info={config.settings.scoringType === "all"
            ? "Every golfer on your roster counts toward your total. All picks matter equally."
            : `Only your ${config.settings.bestN} lowest-scoring golfers count. The rest are benched, reducing the impact of one bad pick.`
          }
        />
        <SettingsPill
          label={config.settings.missedCutRule === "penalty" ? `MC +${config.settings.missedCutPenalty}/rd` : config.settings.missedCutRule === "zero" ? "MC = Zero" : "MC = Worst"}
          info={config.settings.missedCutRule === "penalty"
            ? `Golfers who miss the cut get +${config.settings.missedCutPenalty} added per remaining round they don't play. This penalizes risky picks who get eliminated early.`
            : config.settings.missedCutRule === "zero"
            ? "Golfers who miss the cut simply stop scoring. No penalty, no benefit. Their score freezes where it was."
            : "Golfers who miss the cut get assigned the same total as the worst golfer who DID make the cut."
          }
        />
        <SettingsPill
          label={
            config.settings.purseType === "winner-take-all" ? "Winner Take All"
            : config.settings.purseType === "70-30" ? "70/30 Split"
            : config.settings.purseType === "60-30-10" ? "60/30/10 Split"
            : "Custom Purse"
          }
          info={
            config.settings.purseType === "winner-take-all"
              ? "The entire prize pool goes to first place. High stakes, one winner."
              : config.settings.purseType === "70-30"
              ? "First place takes 70% of the purse, second place takes 30%."
              : config.settings.purseType === "60-30-10"
              ? "First place takes 60%, second place 30%, third place 10%."
              : "Custom payout percentages set by the chairman."
          }
        />
      </div>

      {/* Sponsor banner */}
      <SponsorBanner tier={chairmanTier} adRemoved={adRemoved} customAdImage={customAdImage} customAdUrl={customAdUrl} customAdHeadline={customAdHeadline} customAdDescription={customAdDescription} />

      {/* Refresh button */}
      <div className="flex justify-between items-center mb-4">
        <div className="gold-rule flex-1" />
        <button
          onClick={fetchPool}
          className="ml-3 flex items-center gap-1.5 text-xs text-gray-400 active:text-tp-primary transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {lastUpdated && lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </button>
      </div>

      {/* Live Draft or Standings */}
      {!draftComplete ? (
        <LiveDraft
          slug={slug as string}
          config={config as PoolConfig & { assignments: { playerId: string; golferId: string; pickNumber: number }[] }}
          isOwner={isOwner}
          onComplete={fetchPool}
        />
      ) : (
        <>
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
                buyIn={config.buyIn}
                tournamentOver={currentRound >= 4}
                payoutMethod={config.settings.payoutMethod || "honor-system"}
                chairmanNameForPayout={chairmanName}
                poolName={config.poolName || "Golf Pool"}
                paymentPlan={paymentPlan}
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

      {/* CTA for visitors (not shown to logged-in users) */}
      {!isOwner && <div className="text-center mt-10 mb-6">
        <div className="gold-rule mb-6" />
        <p className="text-sm font-semibold mb-3" style={{ color: "#096a52" }}>
          Want to become a Chairman and run your own pool?
        </p>
        <Link
          href="/signup"
          className="inline-block text-center font-semibold rounded-xl px-8 py-3.5 text-sm tracking-wide transition-colors"
          style={{ backgroundColor: "#fed60d", color: "#096a52" }}
        >
          Sign Up Here
        </Link>
      </div>}
        </>
      )}
    </div>
  );
}
