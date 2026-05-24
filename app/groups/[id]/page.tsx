"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { GroupWithMembers, PaymentMethod, Person } from "@/lib/types";
import CollectDialog from "@/app/pool/[slug]/players/CollectDialog";
import TopNav from "@/app/components/top-nav";
import { formatUsPhoneDisplay } from "@/lib/phone";
import NameMatchChooser, { type NameChoice } from "@/app/components/name-match-chooser";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  paypal: "PayPal",
};

function preferredHandle(p: Person): { method: PaymentMethod; handle: string } | null {
  const order: PaymentMethod[] = p.preferredMethod
    ? [p.preferredMethod, "venmo", "cashapp", "paypal"]
    : ["venmo", "cashapp", "paypal"];
  for (const m of order) {
    const value =
      m === "venmo" ? p.venmoHandle
      : m === "cashapp" ? p.cashappHandle
      : p.paypalHandle;
    if (value) return { method: m, handle: value };
  }
  return null;
}

export default function GroupEditPage() {
  const { id } = useParams();
  const groupId = id as string;
  const router = useRouter();
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberPhone, setNewMemberPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [collectingPersonId, setCollectingPersonId] = useState<string | null>(null);
  const [getVenmoBusyId, setGetVenmoBusyId] = useState<string | null>(null);
  const [getVenmoFlash, setGetVenmoFlash] = useState<{ id: string; text: string } | null>(null);
  const [memberChoice, setMemberChoice] = useState<NameChoice>({ kind: "new" });

  const load = useCallback(async () => {
    const res = await fetch(`/api/groups/${groupId}`);
    if (!res.ok) {
      if (res.status === 404) router.push("/groups");
      setError("Could not load group.");
      return;
    }
    const data = await res.json();
    setGroup(data.group);
    setNameDraft(data.group.name);
  }, [groupId, router]);

  useEffect(() => { load(); }, [load]);

  async function handleRename() {
    const name = nameDraft.trim();
    if (!name || !group || name === group.name) {
      setEditingName(false);
      setNameDraft(group?.name ?? "");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) { setError("Could not rename group."); return; }
    setEditingName(false);
    await load();
  }

  async function handleAddMember() {
    const name = newMemberName.trim();
    if (!name) return;
    setSaving(true);
    setError("");
    // Translate the chooser choice into the group-member endpoint's body:
    //   { personId }   chairman picked an existing Person from the prompt
    //   { forceNew }   chairman picked 'add as new person'
    // The endpoint also supports { name } alone for legacy callers.
    const body: Record<string, unknown> = {
      name,
      phone: newMemberPhone.trim() || undefined,
    };
    if (memberChoice.kind === "existing") {
      body.personId = memberChoice.personId;
    } else {
      body.forceNew = true;
    }
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Could not add member.");
      return;
    }
    setNewMemberName("");
    setNewMemberPhone("");
    setMemberChoice({ kind: "new" });
    await load();
  }

  async function handleRemoveMember(personId: string) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/groups/${groupId}/members/${personId}`, {
      method: "DELETE",
    });
    setSaving(false);
    if (!res.ok) { setError("Could not remove member."); return; }
    await load();
  }

  /**
   * 'Get Venmo' shortcut: mints a self-serve collect link for this Person and
   * opens iMessage addressed to their phone with the link prefilled in the
   * body. The member taps the link, fills in Venmo / Cash App / PayPal on
   * their own device, and the data lands on the chairman's people row. Avoids
   * the chairman having to copy a token, switch apps, paste, and address by
   * hand.
   */
  async function handleGetVenmo(m: { id: string; name: string; phone: string | null }) {
    if (getVenmoBusyId || !m.phone) return;
    setGetVenmoBusyId(m.id);
    setGetVenmoFlash(null);
    const res = await fetch(`/api/people/${m.id}/collection-requests`, { method: "POST" });
    setGetVenmoBusyId(null);
    if (!res.ok) {
      setGetVenmoFlash({ id: m.id, text: "Could not generate link." });
      setTimeout(() => setGetVenmoFlash(null), 5000);
      return;
    }
    const { url } = await res.json();
    const firstName = (m.name || "").trim().split(/\s+/)[0] || "there";
    const body =
      `Hey ${firstName}! Drop your Venmo (or Cash App / PayPal) here so I can pay you when you win our golf pool: ${url}`;
    // Single recipient + body: iOS handles either ?body= or &body=. Use & so
    // the form matches the multi-recipient helper we use elsewhere.
    window.location.href = `sms:${m.phone}&body=${encodeURIComponent(body)}`;
  }

  async function handleDeleteGroup() {
    if (!group) return;
    if (!confirm(`Delete the group "${group.name}"? This won't delete the players themselves.`)) return;
    setSaving(true);
    const res = await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) { setError("Could not delete group."); return; }
    router.push("/groups");
  }

  if (group === null && !error) {
    return (
      <main className="px-4 pt-10 max-w-lg mx-auto">
        <p className="font-serif italic text-tp-primary/60 text-sm text-center">Loading...</p>
      </main>
    );
  }

  if (!group) {
    return (
      <main className="px-4 pt-10 max-w-lg mx-auto text-center">
        <p className="text-sm text-gray-500">{error || "Group not found."}</p>
        <Link href="/groups" className="text-sm text-tp-primary font-semibold mt-3 inline-block">
          Back to groups
        </Link>
      </main>
    );
  }

  return (
    <main className="px-4 pt-4 pb-12 max-w-lg mx-auto">
      <TopNav active="groups" />

      {/* Editable name */}
      {editingName ? (
        <div className="flex gap-2 mb-1">
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            className="input-field flex-1"
            autoFocus
            aria-label="Group name"
          />
          <button type="button" onClick={handleRename} disabled={saving} className="btn-gold">
            Save
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditingName(true)}
          className="text-left w-full mb-1"
        >
          <h1 className="font-serif text-2xl font-bold text-tp-primary leading-tight inline-flex items-center gap-2">
            {group.name}
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </h1>
        </button>
      )}
      <p className="text-xs text-gray-400 mb-5">
        {group.members.length} {group.members.length === 1 ? "player" : "players"}
      </p>

      {/* Member list */}
      <div className="space-y-2 mb-4">
        {group.members.map((m) => {
          const handle = preferredHandle(m);
          return (
            <div
              key={m.id}
              className="bg-white border border-tp-bg-dark rounded-xl px-4 py-3"
            >
              <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate flex items-center gap-1.5">
                  {m.name}
                  {/* Phone-on-file marker. Pretty US format on hover, hidden on
                      narrow widths via the tooltip only. Renders even when no
                      handle is set, since phone is independent of payment info. */}
                  {m.phone && (
                    <span
                      className="text-tp-accent text-sm flex-shrink-0"
                      title={`Phone on file: ${formatUsPhoneDisplay(m.phone)}`}
                      aria-label={`Phone on file: ${formatUsPhoneDisplay(m.phone)}`}
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
              </div>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                {/* Get Venmo: one-tap self-serve link via SMS. Only renders
                    when phone is on file AND no handle yet (otherwise the
                    chairman either can't text or already has the data). */}
                {!handle && m.phone && (
                  <button
                    type="button"
                    onClick={() => handleGetVenmo(m)}
                    disabled={saving || getVenmoBusyId === m.id}
                    className="text-xs font-semibold text-white bg-tp-primary rounded-full px-3 py-1.5 active:opacity-90 disabled:opacity-50"
                    aria-label={`Text ${m.name} a link to enter their payment info`}
                  >
                    {getVenmoBusyId === m.id ? "Opening..." : "📱 Get Venmo"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCollectingPersonId(m.id)}
                  disabled={saving}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 disabled:opacity-50 ${
                    handle
                      ? "text-tp-primary border border-tp-bg-dark active:bg-tp-bg/60"
                      : "text-tp-accent border border-tp-accent/40 active:bg-tp-accent/10"
                  }`}
                  aria-label={handle ? `Edit ${m.name}'s payment info` : `Add ${m.name}'s payment info`}
                >
                  {handle ? "Edit" : "Payments"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(m.id)}
                  disabled={saving}
                  className="text-xs text-red-400 font-semibold active:text-red-600 disabled:opacity-50"
                  aria-label={`Remove ${m.name} from group`}
                >
                  Remove
                </button>
              </div>
              </div>
              {getVenmoFlash && getVenmoFlash.id === m.id && (
                <p className="text-[11px] text-amber-600 font-semibold mt-2">
                  {getVenmoFlash.text}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {(() => {
        const collecting = collectingPersonId
          ? group.members.find((m) => m.id === collectingPersonId)
          : null;
        if (!collecting) return null;
        return (
          <CollectDialog
            person={collecting}
            onClose={() => setCollectingPersonId(null)}
            onSaved={async () => { await load(); setCollectingPersonId(null); }}
          />
        );
      })()}

      {/* Add member */}
      <div className="bg-white rounded-2xl p-4 mb-4">
        <h2 className="font-serif text-base font-bold text-tp-primary mb-2">Add a player</h2>
        <div className="space-y-2">
          <input
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            placeholder="Player name"
            className="input-field"
            aria-label="New member name"
            onKeyDown={(e) => { if (e.key === "Enter" && newMemberName.trim()) handleAddMember(); }}
          />
          <div className="flex gap-2">
            <input
              type="tel"
              value={newMemberPhone}
              onChange={(e) => setNewMemberPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="input-field flex-1"
              aria-label="New member phone"
              autoComplete="tel-national"
              inputMode="tel"
              onKeyDown={(e) => { if (e.key === "Enter" && newMemberName.trim()) handleAddMember(); }}
            />
            <button
              type="button"
              onClick={handleAddMember}
              disabled={saving || !newMemberName.trim()}
              className="btn-gold disabled:opacity-60"
            >
              Add
            </button>
          </div>
          {/* Same collision prompt as the /players add row. Defaults to
              'Add as new' so a chairman who doesn't read it won't silently
              link the new member to an existing same-name Person's row. */}
          <NameMatchChooser name={newMemberName} onChoice={setMemberChoice} />
        </div>
        {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}
        <p className="text-[11px] text-gray-400 mt-2">
          Phone is chairman-only. Powers Text the Pool when you use this group in a pool.
          If the name matches an existing player you&rsquo;ve added before, their saved handles come with them.
        </p>
      </div>

      <button
        type="button"
        onClick={handleDeleteGroup}
        disabled={saving}
        className="w-full py-3 rounded-xl text-sm font-semibold text-red-500 border border-red-100 active:bg-red-50 disabled:opacity-50"
      >
        Delete group
      </button>

      {error && <p className="text-xs text-red-600 mt-3 text-center">{error}</p>}
    </main>
  );
}
