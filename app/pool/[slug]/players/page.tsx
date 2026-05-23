"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PaymentMethod, PlayerWithPerson, RsvpStatus } from "@/lib/types";
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

/** Small status badge plus a tap-to-override popover (chairman-only). */
function RsvpBadge({
  status, onOverride, locked,
}: {
  status: RsvpStatus;
  onOverride: (next: RsvpStatus) => void;
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const visual = status === "accepted"
    ? { icon: "✅", text: "Accepted", className: "text-green-600 bg-green-50" }
    : status === "declined"
      ? { icon: "❌", text: "Declined", className: "text-gray-500 bg-gray-100" }
      : { icon: "🟡", text: "Pending", className: "text-amber-700 bg-amber-50" };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!locked) setOpen((v) => !v); }}
        disabled={locked}
        className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full flex items-center gap-1 ${visual.className} ${locked ? "cursor-not-allowed" : "active:opacity-70"}`}
        aria-label={`Status: ${visual.text}. ${locked ? "Locked." : "Tap to override."}`}
      >
        <span aria-hidden="true">{visual.icon}</span>
        <span>{visual.text}</span>
      </button>
      {open && !locked && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            aria-hidden="true"
          />
          <div
            className="absolute right-0 mt-1 z-40 bg-white border border-tp-bg-dark rounded-lg shadow-lg overflow-hidden w-36"
            onClick={(e) => e.stopPropagation()}
          >
            {(["accepted", "pending", "declined"] as RsvpStatus[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { setOpen(false); onOverride(opt); }}
                className={`block w-full text-left text-xs px-3 py-2 active:bg-tp-bg/60 ${opt === status ? "font-bold text-tp-primary" : "text-gray-700"}`}
              >
                {opt === "accepted" && "✅ "}
                {opt === "declined" && "❌ "}
                {opt === "pending" && "🟡 "}
                {opt[0].toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PlayerRow({
  p, locked, onOpenDialog, onOverride,
}: {
  p: PlayerWithPerson;
  locked: boolean;
  onOpenDialog: () => void;
  onOverride: (next: RsvpStatus) => void;
}) {
  const handle = preferredHandle(p);
  return (
    <div className="flex items-center justify-between bg-white border border-tp-bg-dark rounded-xl px-4 py-3 gap-2">
      <button
        type="button"
        onClick={onOpenDialog}
        className="min-w-0 flex-1 text-left active:opacity-70"
      >
        <p className="font-semibold text-gray-900 truncate flex items-center gap-1.5">
          {p.name}
          {p.person.phone && (
            <span
              className="text-tp-accent text-sm flex-shrink-0"
              title="Phone on file"
              aria-label="Phone on file"
            >
              📱
            </span>
          )}
        </p>
        {handle ? (
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {METHOD_LABEL[handle.method]} &middot; @{handle.handle}
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">No handle on file</p>
        )}
      </button>
      <RsvpBadge status={p.rsvpStatus} onOverride={onOverride} locked={locked} />
    </div>
  );
}

export default function PlayersTabPage() {
  const { slug } = useParams();
  const slugStr = slug as string;
  const [players, setPlayers] = useState<PlayerWithPerson[] | null>(null);
  const [draftComplete, setDraftComplete] = useState(false);
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupSaved, setGroupSaved] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [showDeclined, setShowDeclined] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/pool/${slugStr}/people`);
    if (!res.ok) {
      setError(res.status === 401 ? "You must be the chairman of this pool to see Players." : "Could not load players.");
      setPlayers([]);
      return;
    }
    const data = await res.json();
    setPlayers(data.players);
    setDraftComplete(!!data.draftComplete);
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

  async function handleOverride(playerId: string, status: RsvpStatus) {
    const res = await fetch(`/api/pool/${slugStr}/players/${playerId}/rsvp`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) await load();
  }

  async function handleInvite(mode: "new" | "resend") {
    setInviting(true);
    const res = await fetch(`/api/pool/${slugStr}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    setInviting(false);
    if (!res.ok) return;
    const { smsUrl } = await res.json();
    if (smsUrl) {
      // Open the device's native messaging app with recipients + body prefilled.
      window.location.href = smsUrl;
    }
    // Refresh so invited_at flips and the buttons re-evaluate which to show.
    await load();
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

  const accepted = players.filter((p) => p.rsvpStatus === "accepted");
  const pending = players.filter((p) => p.rsvpStatus === "pending");
  const declined = players.filter((p) => p.rsvpStatus === "declined");
  const untextedPendingWithPhone = pending.filter((p) => !p.invitedAt && p.person.phone);
  const allPendingWithPhone = pending.filter((p) => p.person.phone);
  const respondedCount = accepted.length + declined.length;
  const totalInvited = players.length;

  const readinessLabel = draftComplete
    ? "Draft complete"
    : pending.length === 0 && accepted.length > 0
      ? "Ready to draft (all RSVPs in)"
      : `Awaiting RSVPs (${respondedCount} of ${totalInvited} responded)`;
  const readinessClass = draftComplete
    ? "bg-gray-100 text-gray-600"
    : pending.length === 0 && accepted.length > 0
      ? "bg-green-50 text-green-700"
      : "bg-amber-50 text-amber-700";

  return (
    <div className="pt-2 pb-12">
      <h1 className="font-serif text-2xl font-bold text-tp-primary mb-1">Players</h1>
      <p className="text-xs text-gray-400 mb-4">
        Save each player&rsquo;s payment info and invite them to RSVP.
      </p>

      {/* Readiness status */}
      <div className={`text-[11px] font-semibold uppercase tracking-wider rounded-lg px-3 py-2 mb-4 text-center ${readinessClass}`}>
        {readinessLabel}
      </div>

      {/* Lock banner when draft is done */}
      {draftComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-center text-xs text-amber-700 font-semibold">
          Draft is complete. Pool roster is locked.
        </div>
      )}

      {/* Invite / Resend buttons. Only render when not locked AND there's someone
          to text. New = untexted pending with a phone. Resend = all pending with
          phones (re-prods even those already pinged). */}
      {!draftComplete && (untextedPendingWithPhone.length > 0 || allPendingWithPhone.length > 0) && (
        <div className="space-y-2 mb-4">
          {untextedPendingWithPhone.length > 0 && (
            <button
              type="button"
              onClick={() => handleInvite("new")}
              disabled={inviting}
              className="w-full bg-tp-primary text-white rounded-xl px-4 py-3.5 text-sm font-bold active:opacity-90 disabled:opacity-60"
            >
              📨 Invite to Pool
              <span className="block text-[11px] font-normal text-white/70 mt-0.5">
                Texts the {untextedPendingWithPhone.length} {untextedPendingWithPhone.length === 1 ? "person" : "people"} who haven&rsquo;t been pinged yet
              </span>
            </button>
          )}
          {allPendingWithPhone.length > 0 && (
            <button
              type="button"
              onClick={() => handleInvite("resend")}
              disabled={inviting}
              className="w-full border-2 border-tp-bg-dark rounded-xl px-4 py-3 text-sm font-semibold text-tp-primary active:bg-tp-bg/60 disabled:opacity-60"
            >
              🔁 Resend Invites
              <span className="block text-[11px] font-normal text-gray-500 mt-0.5">
                Re-prods all {allPendingWithPhone.length} pending {allPendingWithPhone.length === 1 ? "invitee" : "invitees"} (whether texted before or not)
              </span>
            </button>
          )}
        </div>
      )}
      {!draftComplete && pending.length > 0 && allPendingWithPhone.length === 0 && (
        <p className="text-[11px] text-gray-500 mb-4 text-center italic">
          Add phone numbers to your pending invitees to text them the invite link.
        </p>
      )}

      {/* Players section: accepted + pending. Pending rows surface the 🟡 badge
          so the chairman can see at a glance who hasn't responded. */}
      <h2 className="font-serif text-sm font-bold text-tp-primary uppercase tracking-wider mb-2">
        Players ({accepted.length + pending.length})
      </h2>
      <div className="space-y-2 mb-6">
        {[...accepted, ...pending].length === 0 ? (
          <p className="text-xs text-gray-400 italic py-4 text-center">No players yet.</p>
        ) : (
          [...accepted, ...pending].map((p) => (
            <PlayerRow
              key={p.id}
              p={p}
              locked={draftComplete}
              onOpenDialog={() => setOpenPersonId(p.personId)}
              onOverride={(next) => handleOverride(p.id, next)}
            />
          ))
        )}
      </div>

      {/* Declined section, collapsible. Chairman-only visibility; never reaches
          public surfaces because the leaderboard endpoint filters to accepted. */}
      {declined.length > 0 && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowDeclined((v) => !v)}
            className="text-xs font-semibold uppercase tracking-wider text-gray-500 active:text-tp-primary flex items-center gap-1.5"
          >
            <span>{showDeclined ? "▾" : "▸"}</span>
            Invited but declined ({declined.length})
          </button>
          {showDeclined && (
            <div className="space-y-2 mt-2">
              {declined.map((p) => (
                <PlayerRow
                  key={p.id}
                  p={p}
                  locked={draftComplete}
                  onOpenDialog={() => setOpenPersonId(p.personId)}
                  onOverride={(next) => handleOverride(p.id, next)}
                />
              ))}
            </div>
          )}
        </div>
      )}

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
