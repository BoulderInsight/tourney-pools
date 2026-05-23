"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { GroupWithMembers, PaymentMethod, Person } from "@/lib/types";
import CollectDialog from "@/app/pool/[slug]/players/CollectDialog";
import TopNav from "@/app/components/top-nav";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [collectingPersonId, setCollectingPersonId] = useState<string | null>(null);

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
    const res = await fetch(`/api/groups/${groupId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) { setError("Could not add member."); return; }
    setNewMemberName("");
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
              className="flex items-center justify-between bg-white border border-tp-bg-dark rounded-xl px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 truncate">{m.name}</p>
                {handle ? (
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {METHOD_LABEL[handle.method]} &middot; @{handle.handle}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">No handle on file</p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setCollectingPersonId(m.id)}
                  disabled={saving}
                  className={`text-xs font-semibold rounded-full px-3 py-1.5 disabled:opacity-50 ${
                    handle
                      ? "text-tp-primary border border-tp-bg-dark active:bg-tp-bg/60"
                      : "text-white bg-tp-accent active:opacity-90"
                  }`}
                  aria-label={handle ? `Edit ${m.name}'s payment info` : `Collect ${m.name}'s payment info`}
                >
                  {handle ? "Edit" : "Collect"}
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
        <div className="flex gap-2">
          <input
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            placeholder="Player name"
            className="input-field flex-1"
            aria-label="New member name"
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
        <p className="text-[11px] text-gray-400 mt-2">
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
