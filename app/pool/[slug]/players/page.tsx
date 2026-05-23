"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PaymentMethod, PlayerWithPerson } from "@/lib/types";
import CollectDialog from "./CollectDialog";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  paypal: "PayPal",
};

function preferredHandle(p: PlayerWithPerson): { method: PaymentMethod; handle: string } | null {
  const order: PaymentMethod[] = p.person.preferredMethod
    ? [p.person.preferredMethod, "venmo", "cashapp", "paypal"]
    : ["venmo", "cashapp", "paypal"];
  for (const m of order) {
    const value =
      m === "venmo" ? p.person.venmoHandle
      : m === "cashapp" ? p.person.cashappHandle
      : p.person.paypalHandle;
    if (value) return { method: m, handle: value };
  }
  return null;
}

export default function PlayersTabPage() {
  const { slug } = useParams();
  const slugStr = slug as string;
  const [players, setPlayers] = useState<PlayerWithPerson[] | null>(null);
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupSaved, setGroupSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/pool/${slugStr}/people`);
    if (!res.ok) {
      setError(res.status === 401 ? "You must be the chairman of this pool to see Players." : "Could not load players.");
      setPlayers([]);
      return;
    }
    const data = await res.json();
    setPlayers(data.players);
  }, [slugStr]);

  useEffect(() => { load(); }, [load]);

  async function handleSaveAsGroup() {
    const name = groupName.trim();
    if (!name) return;
    setSavingGroup(true);
    const res = await fetch(`/api/pool/${slugStr}/save-as-group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSavingGroup(false);
    if (!res.ok) return;
    setGroupSaved(name);
    setGroupDialogOpen(false);
  }

  if (players === null) {
    return (
      <div className="flex justify-center py-16">
        <p className="font-serif italic text-tp-primary/60 text-sm">Loading players...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  const openPlayer = players.find((p) => p.personId === openPersonId) ?? null;

  return (
    <div className="pt-2 pb-12">
      <h1 className="font-serif text-2xl font-bold text-tp-primary mb-1">Players</h1>
      <p className="text-xs text-gray-400 mb-5">
        Save each player&rsquo;s payment info so the winners can be paid easily.
      </p>

      <div className="space-y-2">
        {players.map((p) => {
          const handle = preferredHandle(p);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpenPersonId(p.personId)}
              className="w-full flex items-center justify-between bg-white border border-tp-bg-dark rounded-xl px-4 py-3.5 text-left active:bg-tp-bg/60 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                {handle ? (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-3.5 h-3.5 rounded-full bg-tp-accent flex items-center justify-center flex-shrink-0">
                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {METHOD_LABEL[handle.method]} &middot; @{handle.handle}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">No handle on file</p>
                )}
              </div>
              {handle ? (
                <span className="text-xs font-semibold text-tp-primary flex-shrink-0">Edit</span>
              ) : (
                <span className="text-xs font-semibold text-white bg-tp-accent rounded-full px-3 py-1.5 flex-shrink-0">Payments</span>
              )}
            </button>
          );
        })}
      </div>

      {openPlayer && (
        <CollectDialog
          slug={slugStr}
          person={openPlayer.person}
          displayName={openPlayer.name}
          onClose={() => setOpenPersonId(null)}
          onSaved={async () => { await load(); setOpenPersonId(null); }}
        />
      )}

      {/* Save as group action */}
      <div className="mt-8">
        <div className="gold-rule mb-4" />
        <button
          type="button"
          onClick={() => {
            setGroupName("");
            setGroupSaved(null);
            setGroupDialogOpen(true);
          }}
          className="w-full py-3 rounded-xl text-sm font-semibold text-tp-primary border border-tp-bg-dark active:bg-tp-bg/60"
        >
          Save roster as a group
        </button>
        {groupSaved && (
          <p className="text-xs text-tp-accent mt-2 text-center">
            Saved {groupSaved} to <a href="/groups" className="font-semibold underline">My Groups</a>.
          </p>
        )}
      </div>

      {groupDialogOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0"
          onClick={() => setGroupDialogOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Save roster as a group"
        >
          <div className="w-full max-w-md bg-white rounded-2xl p-5 shadow-card-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-serif text-xl font-bold text-tp-primary mb-1">Save roster as a group</h2>
            <p className="text-xs text-gray-500 mb-4">Reuse these players next time you start a pool.</p>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Blue Rock Mafia"
              className="input-field mb-3"
              aria-label="Group name"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGroupDialogOpen(false)}
                className="py-3 rounded-xl text-sm font-semibold border border-tp-bg-dark text-gray-600 active:bg-tp-bg/60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAsGroup}
                disabled={savingGroup || !groupName.trim()}
                className="btn-gold disabled:opacity-60"
              >
                {savingGroup ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
