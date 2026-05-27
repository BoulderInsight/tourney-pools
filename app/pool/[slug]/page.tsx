"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PoolConfig, PlayerStanding, PayoutTransfer, PaymentHandle } from "@/lib/types";
import { computeLeaderboard, computePaymentPlan, formatScore, scoreColorClass } from "@/lib/pool";
import { buildPaymentLink, paymentMethodLabel } from "@/lib/payment-links";
import { buildSmsLink } from "@/lib/phone";
import Link from "next/link";
import { SponsorBanner } from "@/app/components/sponsor-banner";
import { TipTheCommish } from "@/app/components/tip-the-commish";
import SaveToHomeButton from "@/app/components/save-to-home-button";

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

/** "$20" for whole dollars, "$20.50" otherwise. Avoids the noisy "$20.00" form. */
function formatAmount(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/**
 * The "Owes" block that lives on the collapsed standing card so losers see who to
 * pay without expanding. Honor-system pools render gold pill deep-links; chairman-
 * collects pools render a plain "Pay [Chairman] $X" line. Renders nothing for
 * winners or for losers who happen to owe no one.
 */
function OwesOnCard({ standing, buyIn, payoutMethod, chairmanName, poolName, paymentPlan }: {
  standing: PlayerStanding;
  buyIn: number;
  payoutMethod: string;
  chairmanName: string;
  poolName: string;
  paymentPlan: Map<string, PayoutTransfer[]>;
}) {
  const isWinner = standing.prize > 0;
  if (isWinner) return null;
  const isChairmanCollects = payoutMethod === "chairman-collects";

  if (isChairmanCollects) {
    return (
      <div className="border-t border-tp-bg-dark bg-red-50/50 px-4 py-3">
        <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-1">Owes</p>
        <p className="text-xs font-medium text-red-700">
          Pay {chairmanName || "the Chairman"} <strong>{formatAmount(buyIn)}</strong>
        </p>
      </div>
    );
  }

  const transfers = paymentPlan.get(standing.player.id) ?? [];
  if (transfers.length === 0) return null;

  const note = `${poolName} payout`;
  return (
    <div className="border-t border-tp-bg-dark bg-red-50/50 px-4 py-3">
      <p className="text-[10px] text-red-400 uppercase tracking-wider font-semibold mb-1.5">Owes</p>
      <div className="space-y-2">
        {transfers.map((t) => {
          if (!t.toPaymentInfo) {
            return (
              <div key={t.toPlayerId} className="text-xs font-medium text-red-700">
                Pay {t.toPlayerName} <strong>{formatAmount(t.amount)}</strong>
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
              aria-label={`Pay ${t.toPlayerName} ${formatAmount(t.amount)} via ${paymentMethodLabel(t.toPaymentInfo.method)}`}
              className="flex items-center justify-between bg-tp-accent text-tp-primary rounded-lg px-3 py-3 active:opacity-90 transition-opacity"
            >
              <span className="text-sm font-semibold">
                Pay {t.toPlayerName} {formatAmount(t.amount)}
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

/**
 * The winner's "Collects $X net" badge shown inside the expanded card.
 * Losers see their pay buttons on the always-visible card via `OwesOnCard`,
 * so this only fires for prize-earning players.
 */
function WinnerBadge({ standing, buyIn, payoutMethod }: {
  standing: PlayerStanding;
  buyIn: number;
  payoutMethod: string;
}) {
  const isWinner = standing.prize > 0;
  const netWin = standing.prize - buyIn;
  if (!isWinner || netWin <= 0) return null;
  const isChairmanCollects = payoutMethod === "chairman-collects";
  return (
    <div className="mb-3 bg-green-50 rounded-xl p-3">
      <p className="text-xs font-semibold text-green-700">
        {isChairmanCollects
          ? `Receives ${formatAmount(standing.prize)} from the Chairman`
          : `Collects ${formatAmount(netWin)} net (${formatAmount(standing.prize)} prize - ${formatAmount(buyIn)} buy-in)`
        }
      </p>
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
          {/* Prize pill is the final payout, not a projection. Only show it
              once the tournament is actually complete; mid-round it implies
              someone has 'won' when play is still live. */}
          {tournamentOver && standing.prize > 0 && (
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

      {/* Pay buttons live on the collapsed card so a loser doesn't have to expand
          to see who they owe. Renders nothing for winners and pre-tournament-over. */}
      {tournamentOver && (
        <OwesOnCard
          standing={standing}
          buyIn={buyIn}
          payoutMethod={payoutMethod}
          chairmanName={chairmanNameForPayout}
          poolName={poolName}
          paymentPlan={paymentPlan}
        />
      )}

      {/* Expanded view: the winner's collects badge (losers see their pay buttons
          on the card above), then the golfer-by-golfer score breakdown. */}
      {expanded && (
        <div className="px-4 pb-4 animate-expand">
          {tournamentOver && (
            <WinnerBadge standing={standing} buyIn={buyIn} payoutMethod={payoutMethod} />
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

/**
 * Read-only roster grid that mirrors /join's picker. Green check = accepted,
 * no marker = still pending. Declined are dropped server-side so the public
 * pool page never outs anyone who said no.
 *
 * For the chairman a second row appears under each name with payment status:
 * "Venmo on file" when any handle exists, a one-tap Get Venmo button when
 * we have a phone but no handle yet, or a muted "No phone on file" hint
 * otherwise. Same flow as the Get Venmo button on /groups; reuses
 * POST /api/people/[id]/collection-requests via the parent's handler.
 */
function InviteeRosterGrid({
  invitees,
  isOwner,
  paymentByPlayer,
  getVenmoBusyId,
  onGetVenmo,
  slug,
  onAfterBulkAccept,
}: {
  invitees: { id: string; name: string; rsvpStatus: "accepted" | "pending" }[];
  isOwner: boolean;
  paymentByPlayer: Record<string, { personId: string; phone: string | null; hasHandle: boolean }>;
  getVenmoBusyId: string | null;
  onGetVenmo: (playerId: string, name: string, personId: string, phone: string) => void | Promise<void>;
  slug: string;
  onAfterBulkAccept: () => void | Promise<void>;
}) {
  const [bulkBusy, setBulkBusy] = useState(false);
  if (invitees.length === 0) return null;
  const acceptedCount = invitees.filter((p) => p.rsvpStatus === "accepted").length;
  const pendingPlayers = invitees.filter((p) => p.rsvpStatus === "pending");
  // Chairman-only bulk override: flip every pending invitee to accepted in
  // one tap. Useful when the field has already arrived and the chairman
  // knows everyone's in; saves chasing RSVP taps. Fires PATCH calls in
  // parallel; partial failures are swallowed (refetch will show the real
  // state). Server-side, the endpoint relaxes the draft_complete lock when
  // no assignments exist, so this also unsticks pools where the flag was
  // set prematurely.
  async function handleMarkAllAccepted() {
    if (bulkBusy) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        pendingPlayers.map((p) =>
          fetch(`/api/pool/${slug}/players/${p.id}/rsvp`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "accepted" }),
          }).catch(() => null),
        ),
      );
      await onAfterBulkAccept();
    } finally {
      setBulkBusy(false);
    }
  }
  return (
    <div className="mt-2 mb-8">
      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold text-center mb-3">
        {acceptedCount} of {invitees.length} RSVPed
      </p>
      {/* Chairman shortcut: skip the RSVP chase when the field has already
          arrived and everyone is known to be in. */}
      {isOwner && pendingPlayers.length > 0 && (
        <div className="max-w-md mx-auto mb-3">
          <button
            type="button"
            onClick={handleMarkAllAccepted}
            disabled={bulkBusy}
            className="w-full text-xs font-bold text-tp-primary bg-tp-accent/15 border border-tp-accent/40 rounded-xl px-3 py-2 active:bg-tp-accent/25 disabled:opacity-50"
          >
            {bulkBusy
              ? "Marking..."
              : `Mark ${pendingPlayers.length === invitees.length ? "all" : `the ${pendingPlayers.length} pending`} as RSVPed`}
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
        {invitees.map((p) => {
          const isAccepted = p.rsvpStatus === "accepted";
          const pay = isOwner ? paymentByPlayer[p.id] : undefined;
          return (
            <div
              key={p.id}
              className="flex flex-col bg-white border border-tp-bg-dark rounded-xl px-3 py-3 min-w-0"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="font-semibold text-tp-primary truncate">{p.name}</span>
                {isAccepted && (
                  <span className="text-green-600 text-base flex-shrink-0" aria-label="Accepted">✅</span>
                )}
              </div>
              {pay && (
                <div className="mt-2">
                  {pay.hasHandle ? (
                    <p className="text-[11px] text-green-700 font-semibold">💵 Venmo on file</p>
                  ) : pay.phone ? (
                    <button
                      type="button"
                      onClick={() => onGetVenmo(p.id, p.name, pay.personId, pay.phone as string)}
                      disabled={getVenmoBusyId === p.id}
                      className="w-full text-[11px] font-bold text-tp-primary border border-tp-primary/30 rounded-lg px-2 py-1.5 active:bg-tp-primary/10 disabled:opacity-50"
                    >
                      {getVenmoBusyId === p.id ? "Opening..." : "📱 Get Venmo"}
                    </button>
                  ) : (
                    <p className="text-[11px] text-gray-400 italic">No phone on file</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AwaitingFieldState({
  info,
  invitees,
  isOwner,
  paymentByPlayer,
  getVenmoBusyId,
  onGetVenmo,
  slug,
  onAfterBulkAccept,
}: {
  info: { name: string; status: string | null; startDate: string | null };
  invitees: { id: string; name: string; rsvpStatus: "accepted" | "pending" }[];
  isOwner: boolean;
  paymentByPlayer: Record<string, { personId: string; phone: string | null; hasHandle: boolean }>;
  getVenmoBusyId: string | null;
  onGetVenmo: (playerId: string, name: string, personId: string, phone: string) => void | Promise<void>;
  slug: string;
  onAfterBulkAccept: () => void | Promise<void>;
}) {
  // Rendered inside the main pool layout, beneath the shared header + rules
  // pills. The page-level header already carries the TourneyPools mark and
  // pool/tournament context, so this block stays focused on the "what's
  // happening / when" message and skips its own logo.
  const started =
    info.status === "in_progress" ||
    info.status === "completed" ||
    (info.startDate ? new Date(info.startDate) <= new Date() : false);
  const startLabel = info.startDate
    ? new Date(info.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : null;
  return (
    <div>
      <div className="flex flex-col items-center justify-center py-12 text-center">
        {started ? (
          <>
            <h2 className="font-serif text-xl font-bold text-tp-primary mb-2">Draft Not Ready</h2>
            <p className="text-gray-500 text-sm mb-2 max-w-xs leading-relaxed">
              We haven&apos;t been able to load {info.name || "the tournament"}&apos;s field yet.
            </p>
            <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
              This usually resolves on its own within a few minutes. If it doesn&apos;t, contact support.
            </p>
          </>
        ) : (
          <>
            <h2 className="font-serif text-xl font-bold text-tp-primary mb-2">Draft Pending</h2>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
              Waiting for {info.name || "the tournament"}&apos;s field to be announced
              {startLabel ? `, the tournament starts ${startLabel}` : ""}. The field is usually
              published a few days before play begins, and the draft runs as soon as it&apos;s out.
            </p>
          </>
        )}
      </div>

      <InviteeRosterGrid
        invitees={invitees}
        isOwner={isOwner}
        paymentByPlayer={paymentByPlayer}
        getVenmoBusyId={getVenmoBusyId}
        onGetVenmo={onGetVenmo}
        slug={slug}
        onAfterBulkAccept={onAfterBulkAccept}
      />
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
  const [tournamentStatus, setTournamentStatus] = useState<string | null>(null);
  const [tournamentEndDate, setTournamentEndDate] = useState<string | null>(null);
  const [chairmanPaymentInfo, setChairmanPaymentInfo] = useState<PaymentHandle | null>(null);
  // Invite totals from the public API. Pre-draft we render "X of Y RSVPed" in
  // the header so chairmen and invitees can see momentum (and so the
  // post-RSVP landing doesn't read "1 player" when 7 were invited). Post-draft
  // the roster is frozen and we fall back to the plain accepted count.
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [invitedCount, setInvitedCount] = useState(0);
  // Pre-draft roster (accepted + pending). Rendered below Draft Pending so
  // invitees can see who's joined and who's still outstanding. Declined are
  // excluded server-side; this list never contains them.
  const [invitees, setInvitees] = useState<{ id: string; name: string; rsvpStatus: "accepted" | "pending" }[]>([]);
  // Chairman-only: name + E.164 phone for players in this pool who have one on
  // file. Empty until the owner fetch resolves; never populated for non-owners.
  // Names let us show "On file: Brack, Chig, Jef" so the chairman can spot at a
  // glance whether they've collected enough phones.
  const [phoneRecipients, setPhoneRecipients] = useState<{ name: string; phone: string }[]>([]);
  // Chairman-only payment state keyed by playerId. Powers the Draft Pending
  // roster grid: shows whether a player has a payment handle on file and, if
  // not, lets the chairman one-tap text them a self-serve collect link
  // (same flow as the Get Venmo button on the groups page).
  const [paymentByPlayer, setPaymentByPlayer] = useState<Record<string, { personId: string; phone: string | null; hasHandle: boolean }>>({});
  // Per-row busy lock while we mint a collect-link URL and hand off to SMS.
  const [getVenmoBusyId, setGetVenmoBusyId] = useState<string | null>(null);

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
        setTournamentStatus(data.tournamentStatus || null);
        setTournamentEndDate(data.tournamentEndDate || null);
        setChairmanPaymentInfo(data.chairmanPaymentInfo ?? null);
        setAcceptedCount(Number(data.acceptedCount ?? 0));
        setInvitedCount(Number(data.invitedCount ?? 0));
        setInvitees(Array.isArray(data.invitees) ? data.invitees : []);
        // Check if current user is chairman
        let owner = false;
        try {
          const meRes = await fetch("/api/auth/me");
          if (meRes.ok) {
            const me = await meRes.json();
            if (me?.chairmanId === data.chairmanId) {
              owner = true;
              setIsOwner(true);
            }
          }
        } catch { /* not logged in */ }

        // Owner-only: fetch player names + phone numbers via the chairman-scoped
        // endpoint. The public /api/pool/[slug] response never carries phones, so
        // non-owners can't see them under any circumstance. Failures here are
        // silent; the Text the Pool button just won't render.
        if (owner) {
          try {
            const peopleRes = await fetch(`/api/pool/${slug}/people`);
            if (peopleRes.ok) {
              const { players: peopleRows } = await peopleRes.json();
              type PeopleRow = {
                id?: string;
                name?: string;
                personId?: string;
                person?: {
                  phone?: string | null;
                  venmoHandle?: string | null;
                  cashappHandle?: string | null;
                  paypalHandle?: string | null;
                };
              };
              const rows = peopleRows as PeopleRow[];
              const recipients = rows
                .map((r) => ({ name: r.name ?? "", phone: r.person?.phone ?? "" }))
                .filter((r) => r.phone.length > 0 && r.phone.startsWith("+"));
              setPhoneRecipients(recipients);

              // Chairman map for the Draft Pending roster grid: which players
              // already have a handle, and which have a phone we can text a
              // collect link to. Keyed by playerId so we can match the public
              // `invitees` list 1:1.
              const map: Record<string, { personId: string; phone: string | null; hasHandle: boolean }> = {};
              for (const r of rows) {
                if (!r.id || !r.personId) continue;
                const hasHandle = !!(
                  r.person?.venmoHandle || r.person?.cashappHandle || r.person?.paypalHandle
                );
                map[r.id] = { personId: r.personId, phone: r.person?.phone ?? null, hasHandle };
              }
              setPaymentByPlayer(map);
            }
          } catch { /* the button just stays hidden */ }
        }
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
          {/* Pre-draft: "2 of 7 RSVPed" so chairmen and invitees see who's
              still outstanding. Post-draft: the roster is frozen, so we
              fall back to the simpler "N players" count of who's playing. */}
          {!draftComplete && invitedCount > acceptedCount ? (
            <span>
              <strong className="text-gray-700">{acceptedCount}</strong> of {invitedCount} RSVPed
            </span>
          ) : (
            <span>{config.players.length} players</span>
          )}
          {chairmanName && (
            <>
              <span className="text-gray-300">|</span>
              <span>Chairman: <strong className="text-gray-700">{chairmanName}</strong></span>
            </>
          )}
          {currentRound > 0 && (
            <>
              <span className="text-gray-300">|</span>
              {tournamentStatus === "completed" ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-tp-accent" />
                  Complete
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Rd {currentRound}
                </span>
              )}
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

      {/* Chairman-only: Text the Pool. Renders only when the current viewer is the
          chairman AND at least one player has a phone on file. Listing the names
          inline so the chairman can see at a glance who's getting the text and
          who's still missing a phone. The sms: URL opens the device's native
          messaging app with everyone pre-addressed. Skipped during awaitingField
          since there's no draft / scores to message about yet. */}
      {!awaitingField && isOwner && (() => {
        const smsUrl = buildSmsLink(phoneRecipients.map((r) => r.phone));
        if (!smsUrl) return null;
        const count = phoneRecipients.length;
        const totalPlayers = config.players.length;
        const missing = totalPlayers - count;
        const nameList = phoneRecipients.map((r) => r.name).join(", ");
        return (
          <a
            href={smsUrl}
            className="block rounded-xl bg-tp-primary text-white px-4 py-3 my-4 active:opacity-95 transition-opacity"
            aria-label={`Text ${count} of ${totalPlayers} players: ${nameList}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-base" aria-hidden="true">📱</span>
                <span className="text-sm font-semibold">Text the Pool</span>
              </div>
              <span className="text-[10px] text-white/60 uppercase tracking-wider">
                {count} of {totalPlayers}
              </span>
            </div>
            <p className="text-[11px] text-white/70 mt-1 ml-7 truncate">
              {nameList}
            </p>
            {missing > 0 && (
              <p className="text-[10px] text-white/40 mt-0.5 ml-7">
                {missing} {missing === 1 ? "player has" : "players have"} no phone on file
              </p>
            )}
            {/* iOS quirk: a named/saved group thread (e.g. one you've titled
                "Blue Rock Mafia") lives separately from any ad-hoc thread with
                the same recipients, and sms: URLs can only target ad-hoc. Set
                expectations so the chairman knows the fast path. */}
            <p className="text-[10px] text-white/35 italic mt-2 ml-7">
              iOS opens a new thread. To use a saved group, open Messages directly.
            </p>
          </a>
        );
      })()}

      {/* Same slot, three states:
            - tournament_status completed AND chairman has a payment handle → Tip the Commish
            - >30 days past tournament_end_date → render nothing (pool is a static archive)
            - everything else → existing sponsor ad
          The 30-day cutoff is independent of status so a stale completed pool still archives.
          Skipped during awaitingField so pre-draft pages stay focused on the
          "field coming soon" message rather than ads. */}
      {!awaitingField && (() => {
        const ARCHIVE_AFTER_DAYS = 30;
        if (tournamentEndDate) {
          const daysSinceEnd = (Date.now() - new Date(tournamentEndDate).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceEnd > ARCHIVE_AFTER_DAYS) return null;
        }
        if (tournamentStatus === "completed" && chairmanPaymentInfo) {
          return <TipTheCommish chairmanName={chairmanName} paymentInfo={chairmanPaymentInfo} />;
        }
        return (
          <SponsorBanner
            tier={chairmanTier}
            adRemoved={adRemoved}
            customAdImage={customAdImage}
            customAdUrl={customAdUrl}
            customAdHeadline={customAdHeadline}
            customAdDescription={customAdDescription}
          />
        );
      })()}

      {/* Quick-save action. Renders for everyone (chairman + players), then
          self-hides if the page is already running as an installed app
          (display-mode: standalone or iOS navigator.standalone). On Android
          it triggers the real install prompt; on iOS it explains the Share
          menu steps. The dynamic per-pool manifest + apple-mobile-web-app-title
          ensure the saved icon uses the pool name and TourneyPools mark. */}
      <div className="mb-4">
        <SaveToHomeButton poolName={config.poolName || "Golf Pool"} />
      </div>

      {/* Refresh button. Hidden during awaitingField because there are no
          scores to refresh yet, just a "waiting for field" message. */}
      {!awaitingField && (
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
      )}

      {/* Awaiting-field message, draft, or standings.
          Awaiting field wins first so pre-draft pools show only the shared
          header + rules + Save-to-Home + the "Draft Pending / Not Ready" body. */}
      {awaitingField ? (
        <AwaitingFieldState
          info={awaitingInfo}
          invitees={invitees}
          isOwner={isOwner}
          paymentByPlayer={paymentByPlayer}
          getVenmoBusyId={getVenmoBusyId}
          onGetVenmo={async (playerId, name, personId, phone) => {
            // Mirrors the Get Venmo flow on /groups: mint a self-serve collect
            // URL for this Person, then open SMS prefilled with the same body.
            // Player taps, fills in handles, data lands on the chairman's
            // people row, and on next pool fetch the row's hasHandle flips.
            if (getVenmoBusyId || !phone) return;
            setGetVenmoBusyId(playerId);
            try {
              const res = await fetch(`/api/people/${personId}/collection-requests`, { method: "POST" });
              if (!res.ok) return;
              const { url } = await res.json();
              const firstName = (name || "").trim().split(/\s+/)[0] || "there";
              const body =
                `Hey ${firstName}! Drop your Venmo (or Cash App / PayPal) here so the losers can pay you when you win our golf pool: ${url}`;
              window.location.href = `sms:${phone}&body=${encodeURIComponent(body)}`;
            } finally {
              setGetVenmoBusyId(null);
            }
          }}
          slug={slug as string}
          onAfterBulkAccept={fetchPool}
        />
      ) : !draftComplete ? (
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
                tournamentOver={tournamentStatus === "completed"}
                payoutMethod={config.settings.payoutMethod || "honor-system"}
                chairmanNameForPayout={chairmanName}
                poolName={config.poolName || "Golf Pool"}
                paymentPlan={paymentPlan}
              />
            ))}
          </div>

          {/* When standings are empty but invitees exist, surface the roster
              grid instead of the bare "Scores will appear" text. This catches
              two cases:
                1. No draft assignments yet (field hasn't been drafted)
                2. Assignments exist but everyone is still pending — the
                   public API filters players to accepted-only, so standings
                   render empty even though the draft technically ran.
              Either way the chairman gets a clear chase list with the
              Mark-all-RSVPed shortcut so the pool can actually get going. */}
          {standings.length === 0 && invitees.length > 0 && (
            <div className="mt-2">
              <div className="gold-rule mb-4" />
              <InviteeRosterGrid
                invitees={invitees}
                isOwner={isOwner}
                paymentByPlayer={paymentByPlayer}
                getVenmoBusyId={getVenmoBusyId}
                onGetVenmo={async (playerId, name, personId, phone) => {
                  if (getVenmoBusyId || !phone) return;
                  setGetVenmoBusyId(playerId);
                  try {
                    const res = await fetch(`/api/people/${personId}/collection-requests`, { method: "POST" });
                    if (!res.ok) return;
                    const { url } = await res.json();
                    const firstName = (name || "").trim().split(/\s+/)[0] || "there";
                    const body =
                      `Hey ${firstName}! Drop your Venmo (or Cash App / PayPal) here so the losers can pay you when you win our golf pool: ${url}`;
                    window.location.href = `sms:${phone}&body=${encodeURIComponent(body)}`;
                  } finally {
                    setGetVenmoBusyId(null);
                  }
                }}
                slug={slug as string}
                onAfterBulkAccept={fetchPool}
              />
            </div>
          )}

          {/* Empty state: only when there is no roster to show either. The
              roster grid above handles the "no accepted players yet" case. */}
          {currentRound === 0 && !(standings.length === 0 && invitees.length > 0) && (
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
