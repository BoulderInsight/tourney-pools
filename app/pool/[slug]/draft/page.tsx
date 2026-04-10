"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";

interface Player { id: string; name: string; pick_order: number; }
interface Golfer { id: string; name: string; world_ranking: number | null; tg_ranking: number | null; }
interface Assignment { player_id: string; golfer_id: string; pick_number: number; }

function getSnakeOrder(players: Player[], pickNumber: number): Player {
  const n = players.length;
  const round = Math.floor(pickNumber / n);
  const pos = pickNumber % n;
  const forward = round % 2 === 0;
  const idx = forward ? pos : n - 1 - pos;
  return players[idx];
}

export default function DraftPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderDrawn, setOrderDrawn] = useState(false);
  const [selectedGolfer, setSelectedGolfer] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const fetchDraft = useCallback(async () => {
    const res = await fetch(`/api/pool/${slug}/draft`);
    if (res.ok) {
      const data = await res.json();
      setPlayers(data.players.sort((a: Player, b: Player) => a.pick_order - b.pick_order));
      setGolfers(data.golfers);
      setAssignments(data.assignments);
      const orders = data.players.map((p: Player) => p.pick_order);
      setOrderDrawn(new Set(orders).size === orders.length && orders.length > 1);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => { fetchDraft(); }, [fetchDraft]);

  async function drawOrder() {
    setSaving(true);
    await fetch(`/api/pool/${slug}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "draw_order" }),
    });
    await fetchDraft();
    setSaving(false);
  }

  async function confirmPick() {
    if (!selectedGolfer || !currentPicker) return;
    setSaving(true);
    await fetch(`/api/pool/${slug}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "pick",
        playerId: currentPicker.id,
        golferId: selectedGolfer,
        pickNumber: assignments.length + 1,
      }),
    });
    setSelectedGolfer(null);
    await fetchDraft();
    setSaving(false);
  }

  async function undoPick() {
    setSaving(true);
    await fetch(`/api/pool/${slug}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "undo" }),
    });
    setSelectedGolfer(null);
    await fetchDraft();
    setSaving(false);
  }

  async function lockPool() {
    setSaving(true);
    await fetch(`/api/pool/${slug}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lock" }),
    });
    router.push(`/pool/${slug}`);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="flex gap-3"><div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" /></div>
      </div>
    );
  }

  const draftedIds = new Set(assignments.map(a => a.golfer_id));
  const picksPerPlayer: Record<string, number> = {};
  for (const p of players) picksPerPlayer[p.id] = 0;
  for (const a of assignments) picksPerPlayer[a.player_id] = (picksPerPlayer[a.player_id] || 0) + 1;
  const pickCounts = Object.values(picksPerPlayer);
  const allEqual = pickCounts.length > 0 && pickCounts.every(c => c === pickCounts[0]) && pickCounts[0] > 0;

  const currentPicker = players.length > 0 ? getSnakeOrder(players, assignments.length) : null;
  const currentRound = players.length > 0 ? Math.floor(assignments.length / players.length) + 1 : 0;

  const selectedGolferName = golfers.find(g => g.id === selectedGolfer)?.name;

  return (
    <div className="pb-safe">
      {/* Header */}
      <div className="flex items-center justify-center mb-3">
        <Image src="/MyMastersPoolstacked.png" alt="My Masters Pool" width={160} height={116} />
      </div>
      <h1 className="font-serif text-2xl font-bold text-masters-green text-center mb-4">Live Snake Draft</h1>

      {/* Step 1: Draw for order */}
      {!orderDrawn ? (
        <div className="card p-6 text-center">
          <h2 className="font-serif text-lg font-bold text-masters-green mb-2">Draw for Pick Order</h2>
          <p className="text-xs text-gray-500 mb-6">
            Randomly assign who picks first, second, third, and so on.
          </p>
          <div className="space-y-2 mb-6">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-masters-cream/60 rounded-xl px-4 py-3">
                <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-400">?</span>
                <span className="font-medium text-gray-800">{p.name}</span>
              </div>
            ))}
          </div>
          <button onClick={drawOrder} disabled={saving} className="btn-gold w-full disabled:opacity-60">
            {saving ? "Drawing..." : "Draw Straws"}
          </button>
        </div>
      ) : (
        <>
          {/* Pick order */}
          <div className="flex items-center gap-2 justify-center mb-4 flex-wrap">
            {players.map((p, i) => (
              <div
                key={p.id}
                className={`flex flex-col items-center px-3 py-2 rounded-xl text-center
                  ${currentPicker?.id === p.id ? "bg-masters-green text-white shadow-card" : "bg-white border border-masters-cream-dark text-gray-600"}`}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">#{i + 1}</span>
                <span className="text-xs font-bold truncate max-w-[70px]">{p.name}</span>
                <span className="text-[9px] opacity-60">{picksPerPlayer[p.id]} picks</span>
              </div>
            ))}
          </div>

          {/* Current picker */}
          {currentPicker && (
            <div className="bg-masters-green text-white rounded-xl px-4 py-3 mb-4 text-center">
              <p className="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Round {currentRound} · Pick #{assignments.length + 1}</p>
              <p className="font-serif text-xl font-bold">{currentPicker.name}&apos;s Pick</p>
            </div>
          )}

          {/* Confirm pick button (shows when a golfer is selected) */}
          {selectedGolfer && currentPicker && (
            <button
              onClick={confirmPick}
              disabled={saving}
              className="w-full btn-gold mb-3 disabled:opacity-60"
            >
              {saving ? "Adding..." : `Add ${selectedGolferName} to ${currentPicker.name}'s Team`}
            </button>
          )}

          {/* Actions */}
          <div className="flex justify-between mb-3 px-1">
            {assignments.length > 0 ? (
              <button onClick={undoPick} disabled={saving} className="text-xs text-red-400 font-semibold active:underline disabled:opacity-50">
                Undo Last Pick
              </button>
            ) : <div />}
            <button onClick={drawOrder} disabled={saving} className="text-xs text-gray-400 font-semibold active:underline disabled:opacity-50">
              Redraw Order
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search golfers..."
              className="input-field pl-10 text-sm"
            />
          </div>

          {/* Golfer list with checkboxes / owner labels */}
          <div className="card overflow-hidden mb-4">
            <div className="divide-y divide-masters-cream-dark max-h-[400px] overflow-y-auto">
              {golfers
                .filter(g => g.name.toLowerCase().includes(search.toLowerCase()))
                .map((g) => {
                  const rank = g.tg_ranking || g.world_ranking;
                  const isDrafted = draftedIds.has(g.id);
                  const owner = isDrafted
                    ? players.find(p => assignments.find(a => a.golfer_id === g.id && a.player_id === p.id))
                    : null;
                  const isSelected = selectedGolfer === g.id;

                  if (isDrafted) {
                    return (
                      <div key={g.id} className="flex items-center gap-3 px-4 py-3 opacity-50">
                        <div className="w-5 h-5 flex-shrink-0" />
                        {rank && <span className="text-[10px] text-gray-400 font-mono w-6 flex-shrink-0">#{rank}</span>}
                        <span className="text-sm text-gray-500 line-through flex-1">{g.name}</span>
                        <span className="text-[10px] bg-masters-green/10 text-masters-green px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                          {owner?.name}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGolfer(isSelected ? null : g.id)}
                      disabled={!currentPicker}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                        ${isSelected ? "bg-masters-green/10" : "active:bg-masters-cream/60"}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors
                        ${isSelected ? "border-masters-green bg-masters-green" : "border-gray-300"}`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      {rank && <span className="text-[10px] text-gray-400 font-mono w-6 flex-shrink-0">#{rank}</span>}
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
            {players.map((p) => {
              const myPicks = assignments
                .filter(a => a.player_id === p.id)
                .sort((a, b) => a.pick_number - b.pick_number);
              return (
                <div key={p.id} className="card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-serif font-bold text-sm text-masters-green">{p.name}</span>
                    <span className="text-[10px] text-gray-400">{myPicks.length} picks</span>
                  </div>
                  {myPicks.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {myPicks.map(a => {
                        const g = golfers.find(gf => gf.id === a.golfer_id);
                        return (
                          <span key={a.golfer_id} className="text-[10px] bg-masters-cream-dark rounded-full px-2 py-0.5 font-medium text-gray-700">
                            {g?.name || "?"}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-300 italic">No picks yet</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Lock pool */}
          <button
            onClick={lockPool}
            disabled={!allEqual || saving}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-colors mb-4 ${
              allEqual
                ? "bg-masters-gold text-white active:bg-masters-gold-dark"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {allEqual
              ? `Lock Pool — ${pickCounts[0]} golfers each`
              : "Each player must have equal picks to lock"
            }
          </button>
        </>
      )}
    </div>
  );
}
