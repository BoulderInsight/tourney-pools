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
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchDraft = useCallback(async () => {
    const res = await fetch(`/api/pool/${slug}/draft`);
    if (res.ok) {
      const data = await res.json();
      setPlayers(data.players.sort((a: Player, b: Player) => a.pick_order - b.pick_order));
      setGolfers(data.golfers);
      setAssignments(data.assignments);
      // If players have distinct pick_orders (not all 0), order was drawn
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
    // Clear existing assignments when redrawing
    await fetchDraft();
    setSaving(false);
  }

  async function makePick(golferId: string) {
    setSaving(true);
    const currentPicker = getSnakeOrder(players, assignments.length);
    await fetch(`/api/pool/${slug}/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "pick",
        playerId: currentPicker.id,
        golferId,
        pickNumber: assignments.length + 1,
      }),
    });
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

  const draftedGolferIds = new Set(assignments.map(a => a.golfer_id));
  const availableGolfers = golfers.filter(g =>
    !draftedGolferIds.has(g.id) &&
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  // Count picks per player
  const picksPerPlayer: Record<string, number> = {};
  for (const p of players) picksPerPlayer[p.id] = 0;
  for (const a of assignments) picksPerPlayer[a.player_id] = (picksPerPlayer[a.player_id] || 0) + 1;

  // Check if all players have equal picks and at least 1
  const pickCounts = Object.values(picksPerPlayer);
  const allEqual = pickCounts.length > 0 && pickCounts.every(c => c === pickCounts[0]) && pickCounts[0] > 0;

  const currentPicker = players.length > 0 && assignments.length < golfers.length
    ? getSnakeOrder(players, assignments.length)
    : null;

  // Current round info
  const currentRound = players.length > 0 ? Math.floor(assignments.length / players.length) + 1 : 0;

  return (
    <div className="pb-safe">
      {/* Header */}
      <div className="flex items-center justify-center mb-2">
        <Image src="/Masters_Logo_Horiz.png" alt="The Masters" width={160} height={32} className="opacity-90" />
      </div>
      <h1 className="font-serif text-2xl font-bold text-masters-green text-center mb-1">Live Snake Draft</h1>

      {/* Step 1: Draw for order */}
      {!orderDrawn ? (
        <div className="card p-6 text-center mt-4">
          <div className="w-16 h-16 rounded-full bg-masters-gold/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-masters-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
            </svg>
          </div>
          <h2 className="font-serif text-lg font-bold text-masters-green mb-2">Draw for Pick Order</h2>
          <p className="text-xs text-gray-500 mb-6">
            Randomly assign who picks first, second, third, and so on.
          </p>
          <button onClick={drawOrder} disabled={saving} className="btn-gold w-full disabled:opacity-60">
            {saving ? "Drawing..." : "Draw Straws"}
          </button>
        </div>
      ) : (
        <>
          {/* Pick order display */}
          <div className="flex items-center gap-2 justify-center mt-3 mb-4">
            {players.map((p, i) => (
              <div
                key={p.id}
                className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-center min-w-[50px]
                  ${currentPicker?.id === p.id ? "bg-masters-green text-white" : "bg-masters-cream-dark text-gray-600"}`}
              >
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-70">#{i + 1}</span>
                <span className="text-xs font-semibold truncate max-w-[60px]">{p.name}</span>
                <span className="text-[9px] opacity-60">{picksPerPlayer[p.id]} picks</span>
              </div>
            ))}
          </div>

          {/* Current picker banner */}
          {currentPicker && (
            <div className="bg-masters-green text-white rounded-xl px-4 py-3 mb-3 text-center">
              <p className="text-[10px] uppercase tracking-wider opacity-70">Round {currentRound} · Pick #{assignments.length + 1}</p>
              <p className="font-serif text-lg font-bold">{currentPicker.name}&apos;s Pick</p>
            </div>
          )}

          {/* Undo + redraw */}
          <div className="flex gap-2 mb-3">
            {assignments.length > 0 && (
              <button onClick={undoPick} disabled={saving} className="text-xs text-red-400 font-semibold px-3 py-2 active:underline disabled:opacity-50">
                Undo Last Pick
              </button>
            )}
            <button onClick={drawOrder} disabled={saving} className="text-xs text-gray-400 font-semibold px-3 py-2 active:underline disabled:opacity-50 ml-auto">
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

          {/* Available golfers */}
          <div className="space-y-1.5 mb-4">
            {availableGolfers.map((g) => {
              const rank = g.tg_ranking || g.world_ranking;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => makePick(g.id)}
                  disabled={saving || !currentPicker}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white border border-masters-cream-dark active:bg-masters-green/5 active:border-masters-green transition-colors disabled:opacity-50 text-left"
                >
                  <div className="flex items-center gap-2">
                    {rank && <span className="text-[10px] text-gray-400 font-mono w-6">#{rank}</span>}
                    <span className="text-sm font-medium text-gray-900">{g.name}</span>
                  </div>
                  <svg className="w-4 h-4 text-masters-green opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              );
            })}
          </div>

          {/* Teams summary */}
          <div className="gold-rule mb-4" />
          <h3 className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Teams</h3>
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

          {/* Lock pool button */}
          <button
            onClick={lockPool}
            disabled={!allEqual || saving}
            className={`w-full py-4 rounded-xl font-semibold text-sm transition-colors ${
              allEqual
                ? "bg-masters-gold text-white active:bg-masters-gold-dark"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {allEqual
              ? `Lock Pool — ${pickCounts[0]} golfers each`
              : `Each player must have the same number of picks`
            }
          </button>
        </>
      )}
    </div>
  );
}
