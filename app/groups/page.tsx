"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { GroupSummary } from "@/lib/types";

interface PoolSummary {
  id: string;
  slug: string;
  pool_name: string;
  player_count: number;
}

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [gRes, pRes] = await Promise.all([
      fetch("/api/groups"),
      fetch("/api/pools"),
    ]);
    if (gRes.ok) {
      const data = await gRes.json();
      setGroups(data.groups);
    } else {
      setGroups([]);
    }
    if (pRes.ok) {
      const pools = (await pRes.json()) as PoolSummary[];
      setPools(pools);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreateEmpty() {
    const name = newGroupName.trim();
    if (!name) return;
    setCreating(true);
    setError("");
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (!res.ok) { setError("Could not create group. Try again."); return; }
    const data = await res.json();
    router.push(`/groups/${data.group.id}`);
  }

  async function handleImportPool(pool: PoolSummary) {
    setImporting(pool.slug);
    setError("");
    const res = await fetch(`/api/pool/${pool.slug}/save-as-group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: pool.pool_name }),
    });
    setImporting(null);
    if (!res.ok) { setError(`Could not import ${pool.pool_name}. Try again.`); return; }
    await load();
  }

  return (
    <main className="px-4 pt-4 pb-12 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-4 -mt-1">
        <img src="/logo.png" alt="TourneyPools" className="h-12" />
        <Link href="/dashboard" className="text-xs text-tp-primary font-semibold active:underline">
          My Pools
        </Link>
      </div>

      <h1 className="font-serif text-2xl font-bold text-tp-primary mb-1">My Groups</h1>
      <p className="text-xs text-gray-400 mb-5">
        A group is a saved set of players. Reuse them when you start a new pool so you don&rsquo;t retype names every time.
      </p>

      {/* Existing groups list */}
      {groups === null ? (
        <p className="font-serif italic text-tp-primary/60 text-sm">Loading...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500 mb-6">You don&rsquo;t have any groups yet.</p>
      ) : (
        <div className="space-y-2 mb-6">
          {groups.map((g) => (
            <Link
              key={g.id}
              href={`/groups/${g.id}`}
              className="flex items-center justify-between bg-white border border-tp-bg-dark rounded-xl px-4 py-3.5 active:bg-tp-bg/60 transition-colors"
            >
              <span className="font-semibold text-gray-900 truncate">{g.name}</span>
              <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{g.memberCount} {g.memberCount === 1 ? "player" : "players"}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Create empty group */}
      <div className="bg-white rounded-2xl p-4 mb-4">
        <h2 className="font-serif text-base font-bold text-tp-primary mb-2">Create a new group</h2>
        <div className="flex gap-2">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="e.g. Blue Rock Mafia"
            className="input-field flex-1"
            aria-label="New group name"
          />
          <button
            type="button"
            onClick={handleCreateEmpty}
            disabled={creating || !newGroupName.trim()}
            className="btn-gold disabled:opacity-60"
          >
            Create
          </button>
        </div>
      </div>

      {/* Import from past pools */}
      {pools.length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-4">
          <h2 className="font-serif text-base font-bold text-tp-primary mb-1">Start from a pool</h2>
          <p className="text-xs text-gray-500 mb-3">
            Turn one of your pools into a group so you can reuse the same players next time.
          </p>
          <div className="space-y-2">
            {pools.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleImportPool(p)}
                disabled={importing === p.slug}
                className="w-full flex items-center justify-between bg-tp-bg rounded-xl px-3 py-2.5 active:bg-tp-bg-dark transition-colors disabled:opacity-60"
              >
                <span className="font-medium text-gray-800 truncate text-sm">{p.pool_name}</span>
                <span className="text-xs text-tp-primary font-semibold flex-shrink-0 ml-2">
                  {importing === p.slug ? "Importing..." : `Import (${p.player_count})`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
    </main>
  );
}
