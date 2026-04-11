"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmModal from "@/app/components/confirm-modal";

interface Chairman {
  id: string;
  email: string;
  name: string;
  email_verified: boolean;
  is_super_admin: boolean;
  tier: string;
  created_at: string;
  pool_count: number;
}

interface Pool {
  id: string;
  slug: string;
  pool_name: string;
  buy_in: number;
  setup_complete: boolean;
  created_at: string;
  chairman_id: string;
  chairman_name: string;
  chairman_email: string;
  player_count: number;
  golfer_count: number;
}

export default function AdminPage() {
  const router = useRouter();
  const [chairmen, setChairmen] = useState<Chairman[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"chairmen" | "pools" | "suggestions">("chairmen");
  const [suggestions, setSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [newSuggestion, setNewSuggestion] = useState("");

  const fetchData = useCallback(async () => {
    const [res, sugRes] = await Promise.all([
      fetch("/api/admin"),
      fetch("/api/admin/suggestions"),
    ]);
    if (res.status === 403) {
      router.push("/dashboard");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setChairmen(data.chairmen);
      setPools(data.pools);
    } else {
      setError("Failed to load admin data");
    }
    if (sugRes.ok) {
      setSuggestions(await sugRes.json());
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const [modal, setModal] = useState<{ type: "chairman" | "pool"; id: string; label: string } | null>(null);

  async function confirmDelete() {
    if (!modal) return;
    await fetch("/api/admin", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: modal.type, id: modal.id }),
    });
    setModal(null);
    fetchData();
  }

  async function patchChairman(id: string, action: string, value?: boolean | string) {
    await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, value }),
    });
    fetchData();
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6">
        <div className="flex gap-3">
          <div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" />
        </div>
      </div>
    );
  }

  return (
    <main className="px-4 pt-4 pb-safe max-w-lg mx-auto">
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <img src="/logo.png" alt="TourneyPools" className="h-12" />
        <div className="flex flex-col items-end gap-1">
          <Link href="/dashboard" className="text-xs text-tp-primary font-semibold">
            Dashboard
          </Link>
          <h1 className="font-serif text-xl font-bold text-tp-primary">Super Admin</h1>
          <p className="text-[10px] text-gray-400">System management</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-5">
        <div className="card p-3 flex-1 text-center">
          <div className="text-2xl font-serif font-bold text-tp-primary">{chairmen.length}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Chairmen</div>
        </div>
        <div className="card p-3 flex-1 text-center">
          <div className="text-2xl font-serif font-bold text-tp-primary">{pools.length}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Pools</div>
        </div>
        <div className="card p-3 flex-1 text-center">
          <div className="text-2xl font-serif font-bold text-tp-primary">{pools.filter(p => p.setup_complete).length}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Live</div>
        </div>
      </div>

      {error && <p className="text-red-500 text-xs mb-4">{error}</p>}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("chairmen")}
          className={`pill ${tab === "chairmen" ? "pill-active" : "pill-inactive"}`}
        >
          Chairmen ({chairmen.length})
        </button>
        <button
          onClick={() => setTab("pools")}
          className={`pill ${tab === "pools" ? "pill-active" : "pill-inactive"}`}
        >
          Pools ({pools.length})
        </button>
        <button
          onClick={() => setTab("suggestions")}
          className={`pill ${tab === "suggestions" ? "pill-active" : "pill-inactive"}`}
        >
          Names ({suggestions.length})
        </button>
      </div>

      {/* Chairmen Tab */}
      {tab === "chairmen" && (
        <div className="space-y-3">
          {chairmen.map((c) => (
            <div key={c.id} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-gray-900">{c.name}</span>
                      {c.is_super_admin && (
                        <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase">Admin</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{c.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(c.tier === "pro" || c.tier === "paid") ? (
                      <span className="text-[10px] bg-tp-accent/20 text-tp-accent-dark px-2 py-0.5 rounded-full font-semibold">Pro</span>
                    ) : (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">Free</span>
                    )}
                    {c.email_verified ? (
                      <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-semibold">Verified</span>
                    ) : (
                      <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-semibold">Unverified</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span>{c.pool_count} pool{c.pool_count !== 1 ? "s" : ""}</span>
                  <span className="text-gray-200">|</span>
                  <span>Joined {new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              {/* Actions */}
              <div className="flex border-t border-tp-bg-dark text-xs font-semibold">
                {!c.email_verified && (
                  <>
                    <button
                      onClick={() => patchChairman(c.id, "verify_email")}
                      className="flex-1 text-center py-2.5 text-tp-primary active:bg-tp-primary/5 transition-colors"
                    >
                      Verify Email
                    </button>
                    <div className="w-px bg-tp-bg-dark" />
                  </>
                )}
                <button
                  onClick={() => patchChairman(c.id, "set_tier", (c.tier === "pro" || c.tier === "paid") ? "free" : "pro")}
                  className="flex-1 text-center py-2.5 text-tp-accent active:bg-tp-accent/5 transition-colors"
                >
                  {(c.tier === "pro" || c.tier === "paid") ? "Downgrade" : "Upgrade"}
                </button>
                <div className="w-px bg-tp-bg-dark" />
                <button
                  onClick={() => patchChairman(c.id, "toggle_super_admin", !c.is_super_admin)}
                  className="flex-1 text-center py-2.5 text-purple-600 active:bg-purple-50 transition-colors"
                >
                  {c.is_super_admin ? "Remove Admin" : "Make Admin"}
                </button>
                <div className="w-px bg-tp-bg-dark" />
                <button
                  onClick={() => setModal({ type: "chairman", id: c.id, label: c.name })}
                  className="flex-1 text-center py-2.5 text-red-400 active:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pools Tab */}
      {tab === "pools" && (
        <div className="space-y-3">
          {pools.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-serif font-bold text-gray-900">{p.pool_name}</span>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <span>{p.player_count} players</span>
                      <span className="text-gray-200">|</span>
                      <span>{p.golfer_count} golfers</span>
                      <span className="text-gray-200">|</span>
                      <span>${p.buy_in}</span>
                    </div>
                  </div>
                  {p.setup_complete ? (
                    <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-semibold">Live</span>
                  ) : (
                    <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-semibold">Draft</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <span>Chairman: {p.chairman_name}</span>
                  <span className="text-gray-200">|</span>
                  <span>{p.chairman_email}</span>
                </div>
              </div>
              <div className="flex border-t border-tp-bg-dark text-xs font-semibold">
                <Link
                  href={`/pool/${p.slug}`}
                  className="flex-1 text-center py-2.5 text-tp-primary active:bg-tp-primary/5 transition-colors"
                >
                  View
                </Link>
                <div className="w-px bg-tp-bg-dark" />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://tourneypools.com/pool/${p.slug}`);
                  }}
                  className="flex-1 text-center py-2.5 text-tp-accent active:bg-tp-accent/5 transition-colors"
                >
                  Copy Link
                </button>
                <div className="w-px bg-tp-bg-dark" />
                <button
                  onClick={() => setModal({ type: "pool", id: p.id, label: p.pool_name })}
                  className="flex-1 text-center py-2.5 text-red-400 active:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions Tab */}
      {tab === "suggestions" && (
        <div>
          <div className="flex gap-2 mb-4">
            <input
              value={newSuggestion}
              onChange={(e) => setNewSuggestion(e.target.value)}
              placeholder="Add a funny pool name..."
              className="input-field flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newSuggestion.trim()) {
                  fetch("/api/suggestions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newSuggestion.trim() }),
                  }).then(() => { setNewSuggestion(""); fetchData(); });
                }
              }}
            />
            <button
              onClick={() => {
                if (!newSuggestion.trim()) return;
                fetch("/api/suggestions", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name: newSuggestion.trim() }),
                }).then(() => { setNewSuggestion(""); fetchData(); });
              }}
              className="btn-green flex-shrink-0"
            >
              Add
            </button>
          </div>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.id} className="card px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">{s.name}</span>
                <button
                  onClick={() => {
                    fetch("/api/suggestions", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: s.id }),
                    }).then(() => fetchData());
                  }}
                  className="text-xs text-red-400 font-semibold active:underline"
                >
                  Delete
                </button>
              </div>
            ))}
            {suggestions.length === 0 && (
              <p className="text-center text-sm text-gray-400 italic py-6">No suggestions yet. Add your first one above.</p>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!modal}
        title={modal ? `Delete ${modal.type === "chairman" ? "Chairman" : "Pool"}` : ""}
        message={modal ? `Are you sure you want to delete "${modal.label}"? This action cannot be undone and all associated data will be permanently removed.` : ""}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setModal(null)}
      />
    </div>
    </main>
  );
}
