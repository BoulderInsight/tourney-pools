"use client";

import { useState } from "react";
import type { PaymentMethod } from "@/lib/types";

interface FormState {
  venmoHandle: string;
  cashappHandle: string;
  paypalHandle: string;
  preferredMethod: PaymentMethod | null;
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

export default function SelfServeForm({
  token, initiallySubmitted,
}: {
  token: string;
  initiallySubmitted: boolean;
}) {
  const [state, setState] = useState<FormState>({
    venmoHandle: "", cashappHandle: "", paypalHandle: "", preferredMethod: null,
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(initiallySubmitted);
  const [error, setError] = useState("");

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  const anyHandle = Boolean(state.venmoHandle.trim() || state.cashappHandle.trim() || state.paypalHandle.trim());

  async function handleSubmit() {
    if (!anyHandle) { setError("Please enter at least one handle."); return; }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/collect/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    setSaving(false);
    if (!res.ok) { setError("Could not save. Try again."); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="bg-white rounded-2xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-tp-accent mx-auto mb-3 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-serif text-xl font-bold text-tp-primary mb-1">Thanks!</h2>
        <p className="text-sm text-gray-500">Your info is saved. You can close this page.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5">
      <p className="text-xs text-gray-500 mb-3">
        Add the apps you use. Star the one you prefer.
      </p>
      <div className="space-y-2.5 mb-4">
        <HandleRow label="Venmo"    value={state.venmoHandle}   onChange={(v) => set("venmoHandle",   v)} isPreferred={state.preferredMethod === "venmo"}   onPrefer={() => set("preferredMethod", state.preferredMethod === "venmo"   ? null : "venmo")}   />
        <HandleRow label="Cash App" value={state.cashappHandle} onChange={(v) => set("cashappHandle", v)} isPreferred={state.preferredMethod === "cashapp"} onPrefer={() => set("preferredMethod", state.preferredMethod === "cashapp" ? null : "cashapp")} />
        <HandleRow label="PayPal"   value={state.paypalHandle}  onChange={(v) => set("paypalHandle",  v)} isPreferred={state.preferredMethod === "paypal"}  onPrefer={() => set("preferredMethod", state.preferredMethod === "paypal"  ? null : "paypal")}  />
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving || !anyHandle}
        className="btn-gold w-full disabled:opacity-60"
      >
        {saving ? "Saving..." : "Send to chairman"}
      </button>
      {error && <p className="text-xs text-red-600 mt-3 text-center">{error}</p>}
    </div>
  );
}
