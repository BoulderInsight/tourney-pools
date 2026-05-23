"use client";

import { useState } from "react";
import type { PaymentMethod, Person } from "@/lib/types";
import { formatUsPhoneDisplay } from "@/lib/phone";

interface DialogState {
  venmoHandle: string;
  cashappHandle: string;
  paypalHandle: string;
  preferredMethod: PaymentMethod | null;
  phone: string;
}

function initialState(person: Person): DialogState {
  return {
    venmoHandle: person.venmoHandle ?? "",
    cashappHandle: person.cashappHandle ?? "",
    paypalHandle: person.paypalHandle ?? "",
    preferredMethod: person.preferredMethod,
    // Pretty-print the stored E.164 so the chairman sees (919) 555-1234, not +19195551234.
    phone: formatUsPhoneDisplay(person.phone),
  };
}

function HandleRow({
  label, value, onChange, isPreferred, onPrefer,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  isPreferred: boolean;
  onPrefer: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 w-16">{label}</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="handle (no @ needed)"
          className="input-field pl-[5.25rem]"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label={`${label} handle`}
        />
      </div>
      <button
        type="button"
        onClick={onPrefer}
        disabled={!value && !isPreferred}
        title={isPreferred ? "Preferred app" : value ? "Set as preferred" : "Enter a handle first"}
        aria-label={isPreferred ? `${label} is preferred` : `Set ${label} as preferred`}
        className={`w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors
          ${isPreferred ? "text-tp-accent" : value ? "text-gray-300 active:text-tp-accent" : "text-gray-200 cursor-not-allowed"}`}
      >
        <svg className="w-5 h-5" fill={isPreferred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.518-4.674z" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Collect a Person's payment handles. When `slug` is provided, the dialog also
 * offers a "send self-serve link" path tied to that pool. Without `slug` (e.g. when
 * called from the Groups page) the send-link section is hidden.
 */
export default function CollectDialog({
  person, displayName, slug, onClose, onSaved,
}: {
  person: Person;
  /** Name shown in the dialog title. Defaults to `person.name`. */
  displayName?: string;
  /** When set, enables the send-self-serve-link path. */
  slug?: string;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const name = displayName ?? person.name;
  const [state, setState] = useState<DialogState>(initialState(person));
  const [saving, setSaving] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [error, setError] = useState("");

  function set<K extends keyof DialogState>(k: K, v: DialogState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/people/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venmoHandle: state.venmoHandle,
        cashappHandle: state.cashappHandle,
        paypalHandle: state.paypalHandle,
        preferredMethod: state.preferredMethod,
        phone: state.phone,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.error || "Could not save. Try again.");
      return;
    }
    await onSaved();
  }

  async function handleMakeLink() {
    setSaving(true);
    setError("");
    // Pool-scoped link when invoked from a pool's Players tab; person-only link from
    // the Groups view (no pool context).
    const url = slug
      ? `/api/pool/${slug}/collection-requests`
      : `/api/people/${person.id}/collection-requests`;
    const body = slug ? JSON.stringify({ personId: person.id }) : JSON.stringify({});
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    setSaving(false);
    if (!res.ok) { setError("Could not create link. Try again."); return; }
    const data = await res.json();
    setLinkUrl(data.url as string);
  }

  function handleCopy() {
    if (!linkUrl) return;
    navigator.clipboard.writeText(linkUrl);
    setCopyState("copied");
    setTimeout(() => setCopyState("idle"), 1500);
  }

  const smsBody = encodeURIComponent(
    `Hi ${person.name}, please send me your payment info for our pool: ${linkUrl ?? ""}`,
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Payment info for ${name}`}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl p-5 shadow-card-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-serif text-xl font-bold text-tp-primary">
            Payments for {name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 w-9 h-9 flex items-center justify-center text-gray-300 active:text-gray-600 rounded-full"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Star their preferred app. You can save what you know and ask them for the rest.
        </p>

        <div className="space-y-2.5 mb-4">
          <HandleRow
            label="Venmo"
            value={state.venmoHandle}
            onChange={(v) => set("venmoHandle", v)}
            isPreferred={state.preferredMethod === "venmo"}
            onPrefer={() => set("preferredMethod", state.preferredMethod === "venmo" ? null : "venmo")}
          />
          <HandleRow
            label="Cash App"
            value={state.cashappHandle}
            onChange={(v) => set("cashappHandle", v)}
            isPreferred={state.preferredMethod === "cashapp"}
            onPrefer={() => set("preferredMethod", state.preferredMethod === "cashapp" ? null : "cashapp")}
          />
          <HandleRow
            label="PayPal"
            value={state.paypalHandle}
            onChange={(v) => set("paypalHandle", v)}
            isPreferred={state.preferredMethod === "paypal"}
            onPrefer={() => set("preferredMethod", state.preferredMethod === "paypal" ? null : "paypal")}
          />
        </div>

        {/* Phone (chairman-only, US format). Powers the "Text the Pool" button on
            the leaderboard. Never shown to other players; never returned by the
            public pool API. Server normalizes to E.164 on save. */}
        <div className="mb-4">
          <label className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-1.5 block">
            Phone (just for you)
          </label>
          <input
            type="tel"
            value={state.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="(919) 555-1234"
            className="input-field"
            autoComplete="tel-national"
            inputMode="tel"
            aria-label={`${name}'s phone number`}
          />
          <p className="text-[10px] text-gray-400 mt-1.5">
            Only visible to you. Powers Text the Pool. US numbers only for now.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-gold w-full disabled:opacity-60 mb-2"
        >
          {saving ? "Saving..." : "Save"}
        </button>

        <div className="gold-rule my-4" />

        <p className="text-xs text-gray-500 mb-2">
          Or ask {name} to send their info themselves.
        </p>
        {!linkUrl ? (
          <button
            type="button"
            onClick={handleMakeLink}
            disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-semibold border border-tp-bg-dark text-tp-primary active:bg-tp-bg/60 disabled:opacity-60"
          >
            Generate self-serve link
          </button>
        ) : (
          <div className="space-y-2">
            <div className="bg-tp-bg/80 rounded-xl px-3 py-2 text-xs text-gray-700 break-all font-mono">
              {linkUrl}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="py-3 rounded-xl text-sm font-semibold border border-tp-bg-dark text-tp-primary active:bg-tp-bg/60"
              >
                {copyState === "copied" ? "Copied!" : "Copy link"}
              </button>
              <a
                href={`sms:?body=${smsBody}`}
                className="py-3 rounded-xl text-sm font-semibold bg-tp-primary text-white text-center active:bg-tp-primary/90"
              >
                Text it
              </a>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
      </div>
    </div>
  );
}
