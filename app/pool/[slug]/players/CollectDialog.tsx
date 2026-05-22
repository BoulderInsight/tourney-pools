"use client";

import { useState } from "react";
import type { PaymentMethod, PlayerWithPerson } from "@/lib/types";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  paypal: "PayPal",
};

interface DialogState {
  venmoHandle: string;
  cashappHandle: string;
  paypalHandle: string;
  preferredMethod: PaymentMethod | null;
}

function initialState(player: PlayerWithPerson): DialogState {
  return {
    venmoHandle: player.person.venmoHandle ?? "",
    cashappHandle: player.person.cashappHandle ?? "",
    paypalHandle: player.person.paypalHandle ?? "",
    preferredMethod: player.person.preferredMethod,
  };
}

function HandleRow({
  method, label, value, onChange, isPreferred, onPrefer,
}: {
  method: PaymentMethod;
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
        <span className="absolute left-[5.5rem] top-1/2 -translate-y-1/2 text-gray-300">@</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="handle"
          className="input-field pl-[6.25rem]"
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

export default function CollectDialog({
  slug, player, onClose, onSaved,
}: {
  slug: string;
  player: PlayerWithPerson;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [state, setState] = useState<DialogState>(initialState(player));
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
    const res = await fetch(`/api/people/${player.personId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venmoHandle: state.venmoHandle,
        cashappHandle: state.cashappHandle,
        paypalHandle: state.paypalHandle,
        preferredMethod: state.preferredMethod,
      }),
    });
    setSaving(false);
    if (!res.ok) { setError("Could not save. Try again."); return; }
    await onSaved();
  }

  async function handleMakeLink() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/pool/${slug}/collection-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: player.personId }),
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
    `Hi ${player.person.name}, please send me your payment info for our pool: ${linkUrl ?? ""}`,
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center px-3 pb-3 sm:pb-0"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Collect payment info for ${player.name}`}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl p-5 shadow-card-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-serif text-xl font-bold text-tp-primary">
            Collect from {player.name}
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
            method="venmo" label="Venmo"
            value={state.venmoHandle}
            onChange={(v) => set("venmoHandle", v)}
            isPreferred={state.preferredMethod === "venmo"}
            onPrefer={() => set("preferredMethod", state.preferredMethod === "venmo" ? null : "venmo")}
          />
          <HandleRow
            method="cashapp" label="Cash App"
            value={state.cashappHandle}
            onChange={(v) => set("cashappHandle", v)}
            isPreferred={state.preferredMethod === "cashapp"}
            onPrefer={() => set("preferredMethod", state.preferredMethod === "cashapp" ? null : "cashapp")}
          />
          <HandleRow
            method="paypal" label="PayPal"
            value={state.paypalHandle}
            onChange={(v) => set("paypalHandle", v)}
            isPreferred={state.preferredMethod === "paypal"}
            onPrefer={() => set("preferredMethod", state.preferredMethod === "paypal" ? null : "paypal")}
          />
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
          Or ask {player.name} to send their info themselves.
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
                href={`sms:?&body=${smsBody}`}
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
