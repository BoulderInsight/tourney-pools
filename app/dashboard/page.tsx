"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface Pool {
  id: string;
  slug: string;
  pool_name: string;
  buy_in: number;
  setup_complete: boolean;
  player_count: number;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const fetchPools = useCallback(async () => {
    const res = await fetch("/api/pools");
    if (res.ok) {
      setPools(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPools();
  }, [fetchPools]);

  async function createPool() {
    setCreating(true);
    const res = await fetch("/api/pools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolName: newName || "My Masters Pool" }),
    });
    if (res.ok) {
      const { slug } = await res.json();
      router.push(`/pool/${slug}/setup`);
    }
    setCreating(false);
  }

  async function deletePool(poolId: string, poolName: string) {
    if (!confirm(`Delete "${poolName}"? This cannot be undone.`)) return;
    const res = await fetch("/api/pools", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolId }),
    });
    if (res.ok) {
      setPools((p) => p.filter((pool) => pool.id !== poolId));
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="flex gap-3">
          <div className="loading-dot" />
          <div className="loading-dot" />
          <div className="loading-dot" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with logo */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Image src="/Masters_Logo.png.webp" alt="The Masters" width={80} height={53} />
          <h1 className="font-serif text-2xl font-bold text-masters-green">My Pools</h1>
        </div>
        <button onClick={handleLogout} className="text-xs text-gray-400 active:text-red-500 transition-colors">
          Sign out
        </button>
      </div>

      {/* Create pool */}
      <div className="card p-4 mb-6">
        <div className="flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Pool name (e.g. Blue Rock Masters)" className="input-field flex-1" />
          <button onClick={createPool} disabled={creating} className="btn-green flex-shrink-0 disabled:opacity-60">
            {creating ? "..." : "Create"}
          </button>
        </div>
      </div>

      {/* Pool list */}
      {pools.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-serif italic text-gray-400 text-sm">No pools yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pools.map((pool) => (
            <div key={pool.id} className="card overflow-hidden">
              <Link href={pool.setup_complete ? `/pool/${pool.slug}` : `/pool/${pool.slug}/setup`} className="block p-4 active:bg-masters-cream/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-serif font-bold text-gray-900">{pool.pool_name}</span>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{pool.player_count} players</span>
                      <span className="text-gray-200">|</span>
                      <span>${pool.buy_in} buy-in</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pool.setup_complete ? (
                      <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-semibold">Live</span>
                    ) : (
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-semibold">Draft</span>
                    )}
                    <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
              {/* Share link */}
              {pool.setup_complete && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://mymasterspool.com/pool/${pool.slug}`);
                    setCopied(pool.id);
                    setTimeout(() => setCopied(null), 2000);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-masters-gold border-t border-masters-cream-dark active:bg-masters-gold/5 transition-colors"
                >
                  {copied === pool.id ? (
                    <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Link Copied!</>
                  ) : (
                    <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg> Copy Invite Link</>
                  )}
                </button>
              )}
              {/* Pool actions */}
              <div className="flex border-t border-masters-cream-dark">
                <Link
                  href={`/pool/${pool.slug}`}
                  className="flex-1 text-center py-2.5 text-xs font-semibold text-masters-green active:bg-masters-green/5 transition-colors"
                >
                  View
                </Link>
                <div className="w-px bg-masters-cream-dark" />
                <Link
                  href={`/pool/${pool.slug}/scores`}
                  className="flex-1 text-center py-2.5 text-xs font-semibold text-masters-green active:bg-masters-green/5 transition-colors"
                >
                  Scores
                </Link>
                <div className="w-px bg-masters-cream-dark" />
                <Link
                  href={`/pool/${pool.slug}/setup`}
                  className="flex-1 text-center py-2.5 text-xs font-semibold text-masters-green active:bg-masters-green/5 transition-colors"
                >
                  Edit
                </Link>
                <div className="w-px bg-masters-cream-dark" />
                <button
                  onClick={() => deletePool(pool.id, pool.pool_name)}
                  className="flex-1 text-center py-2.5 text-xs font-semibold text-red-400 active:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
