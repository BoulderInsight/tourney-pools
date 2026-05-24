"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PaymentMethod, PlayerWithPerson, RsvpStatus } from "@/lib/types";
import CollectDialog from "./CollectDialog";
import ConfirmModal from "@/app/components/confirm-modal";
import NameMatchChooser, { type NameChoice } from "@/app/components/name-match-chooser";

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
  p, locked, onOpenDialog, onOverride, onRename, onRemove,
}: {
  p: PlayerWithPerson;
  locked: boolean;
  onOpenDialog: () => void;
  onOverride: (next: RsvpStatus) => void;
  /** When provided, the row renders rename + remove affordances. Omit when locked. */
  onRename?: (next: string) => Promise<boolean>;
  onRemove?: () => void;
}) {
  const handle = preferredHandle(p);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(p.name);
  const [savingRename, setSavingRename] = useState(false);
  const editable = !locked && (onRename || onRemove);

  async function commitRename() {
    const next = draftName.trim();
    if (!onRename || next.length === 0 || next === p.name) {
      setEditing(false);
      setDraftName(p.name);
      return;
    }
    setSavingRename(true);
    const ok = await onRename(next);
    setSavingRename(false);
    if (ok) setEditing(false);
  }

  return (
    <div className="bg-white border border-tp-bg-dark rounded-xl px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenDialog}
          disabled={editing}
          className="min-w-0 flex-1 text-left active:opacity-70 disabled:active:opacity-100"
        >
          {editing ? (
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                if (e.key === "Escape") { setEditing(false); setDraftName(p.name); }
              }}
              onBlur={commitRename}
              disabled={savingRename}
              className="font-semibold text-gray-900 bg-tp-bg/40 border border-tp-bg-dark rounded-md px-2 py-1 w-full"
              aria-label="Rename player"
            />
          ) : (
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
          )}
          {handle ? (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {METHOD_LABEL[handle.method]} &middot; @{handle.handle}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-0.5">No handle on file</p>
          )}
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {editable && !editing && (
            <>
              {onRename && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDraftName(p.name); setEditing(true); }}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 active:text-tp-primary active:bg-tp-bg/60"
                  aria-label={`Rename ${p.name}`}
                  title="Rename"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRemove(); }}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-gray-300 active:text-red-500 active:bg-red-50"
                  aria-label={`Remove ${p.name}`}
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 4h4a1 1 0 011 1v2H9V5a1 1 0 011-1z" />
                  </svg>
                </button>
              )}
            </>
          )}
          <RsvpBadge status={p.rsvpStatus} onOverride={onOverride} locked={locked || editing} />
        </div>
      </div>
    </div>
  );
}

/**
 * Small inline form at the bottom of the Players list to add someone the
 * chairman forgot. Same fields as the setup wizard's player row: name + an
 * optional phone. Hidden once draft_complete=true.
 */
function AddPlayerInline({
  onAdd,
}: {
  onAdd: (name: string, phone: string, choice: NameChoice) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Default to 'new' until the chooser fires (it always fires at least once
  // when matches resolve, and stays 'new' when there are no matches).
  const [choice, setChoice] = useState<NameChoice>({ kind: "new" });

  async function submit() {
    if (busy) return;
    const cleanName = name.trim();
    if (cleanName.length === 0) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError("");
    const { ok, error: apiError } = await onAdd(cleanName, phone.trim(), choice);
    setBusy(false);
    if (ok) {
      setName("");
      setPhone("");
      setChoice({ kind: "new" });
    } else if (apiError) {
      setError(apiError);
    }
  }

  return (
    <div className="bg-tp-bg/40 border-2 border-dashed border-tp-primary/20 rounded-xl p-3 mt-2">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-2">
        Add a player
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) submit(); }}
          placeholder="Player name"
          className="input-field flex-1 text-sm"
          aria-label="New player name"
        />
        <div className="relative w-full sm:w-48">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none opacity-60"
            aria-hidden="true"
          >
            📱
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) submit(); }}
            placeholder="Phone (optional)"
            className="input-field w-full text-sm pl-10"
            autoComplete="tel-national"
            inputMode="tel"
            aria-label="New player phone"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={busy || name.trim().length === 0}
          className="bg-tp-primary text-white text-sm font-semibold rounded-xl px-4 py-2 active:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {busy ? "Adding..." : "Add"}
        </button>
      </div>
      {/* Renders only when the typed name matches an existing Person with data.
          Updates the parent's `choice` state so submit sends the right
          { personId } or { forceNew } flag. */}
      <NameMatchChooser name={name} onChoice={setChoice} />
      {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}
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
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

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

  /** Rename returns ok so the row's inline editor knows whether to exit edit mode. */
  async function handleRename(playerId: string, name: string): Promise<boolean> {
    const res = await fetch(`/api/pool/${slugStr}/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return false;
    await load();
    return true;
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setRemoving(true);
    const res = await fetch(`/api/pool/${slugStr}/players/${removeTarget.id}`, {
      method: "DELETE",
    });
    setRemoving(false);
    setRemoveTarget(null);
    if (res.ok) await load();
  }

  async function handleAddPlayer(
    name: string,
    phone: string,
    choice: NameChoice,
  ): Promise<{ ok: boolean; error?: string }> {
    // Translate the chooser choice into the API's add-player body shape:
    //   { personId }     link to an existing Person (chairman picked from prompt)
    //   { forceNew }     always create new (chairman picked 'add as new')
    // The endpoint also accepts neither, but the chooser always emits one or
    // the other so we always send something explicit.
    const body: Record<string, unknown> = { name, phone: phone || undefined };
    if (choice.kind === "existing") {
      body.personId = choice.personId;
    } else {
      body.forceNew = true;
    }
    const res = await fetch(`/api/pool/${slugStr}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data?.error || "Could not add player." };
    }
    await load();
    return { ok: true };
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
      <div className="space-y-2 mb-3">
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
              onRename={draftComplete ? undefined : (next) => handleRename(p.id, next)}
              onRemove={draftComplete ? undefined : () => setRemoveTarget({ id: p.id, name: p.name })}
            />
          ))
        )}
      </div>

      {/* Add-player row at the bottom of the list. Only available pre-draft
          so the chairman can catch missed names without re-running setup. */}
      {!draftComplete && (
        <div className="mb-6">
          <AddPlayerInline onAdd={handleAddPlayer} />
        </div>
      )}

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
                  onRename={draftComplete ? undefined : (next) => handleRename(p.id, next)}
                  onRemove={draftComplete ? undefined : () => setRemoveTarget({ id: p.id, name: p.name })}
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

      <ConfirmModal
        open={!!removeTarget}
        title={removeTarget ? `Remove ${removeTarget.name}?` : ""}
        message={
          removeTarget
            ? `Remove ${removeTarget.name} from this pool. Their payment info stays on file for any future pools. This can't be undone for this pool but you can re-add them.`
            : ""
        }
        confirmLabel={removing ? "Removing..." : "Remove"}
        danger
        onConfirm={confirmRemove}
        onCancel={() => (removing ? null : setRemoveTarget(null))}
      />

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
