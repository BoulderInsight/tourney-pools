"use client";

import { useEffect, useState } from "react";
import { formatUsPhoneDisplay } from "@/lib/phone";

export interface NameMatch {
  id: string;
  name: string;
  phone: string | null;
  venmoHandle: string | null;
  cashappHandle: string | null;
  paypalHandle: string | null;
  preferredMethod: string | null;
}

export type NameChoice =
  | { kind: "existing"; personId: string }
  | { kind: "new" };

/**
 * Shared collision-prompt UI for add-player and add-group-member forms.
 *
 * Given a name, queries /api/people/match. If any chairman-owned Persons with
 * the same name already have meaningful data (phone or any payment handle),
 * renders a small chooser:
 *
 *   "You already have someone named {Name}:"
 *   ( ) {phone / handles summary}    <- one row per existing match
 *   ( ) Add as new person
 *
 * Calls `onChoice` whenever the selection (or the absence of matches) changes,
 * so the parent form can submit with the right { personId } or { forceNew }
 * flag when the chairman hits Add. Defaults to the first existing match, which
 * preserves the legacy 'silently match' behavior for users who don't notice
 * the prompt.
 *
 * Renders nothing when there are no matches with data.
 */
export default function NameMatchChooser({
  name,
  onChoice,
}: {
  name: string;
  onChoice: (choice: NameChoice) => void;
}) {
  const [matches, setMatches] = useState<NameMatch[]>([]);
  const [selected, setSelected] = useState<string>(""); // "" = new, otherwise personId
  const [loading, setLoading] = useState(false);

  // Debounce so the chairman typing 'Christi' doesn't hammer the API on every
  // keystroke. 350ms balances responsiveness against quiet typing.
  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setMatches([]);
      setSelected("");
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/people/match?name=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          setMatches([]);
          return;
        }
        const data = await res.json();
        const ms = (data.matches as NameMatch[]) ?? [];
        setMatches(ms);
        // Default selection: 'new'. Defaulting to an existing match would
        // reproduce the original silent-link bug for chairmen who don't read
        // the prompt. With 'new' as the default, the chairman has to actively
        // pick 'Use existing' to opt into merging, which is the safer side of
        // the trade. Legitimate reuse (Brack's Venmo carrying forward) costs
        // one extra click.
        setSelected("new");
      } catch {
        setMatches([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [name]);

  // Surface the current choice upward whenever it changes. Empty matches list
  // always means 'new' (nothing else to pick) and is the safe default for the
  // parent form to fall back on.
  useEffect(() => {
    if (matches.length === 0) {
      onChoice({ kind: "new" });
      return;
    }
    if (selected === "" || selected === "new") {
      onChoice({ kind: "new" });
    } else {
      onChoice({ kind: "existing", personId: selected });
    }
  }, [matches, selected, onChoice]);

  if (matches.length === 0) return null;

  return (
    <div className="border border-amber-200 bg-amber-50/70 rounded-lg p-3 mt-2">
      <p className="text-[11px] uppercase tracking-wider text-amber-700 font-bold mb-2">
        {matches.length === 1 ? "Already have this name on file" : "Already have this name on file"}
      </p>
      <p className="text-xs text-gray-600 mb-2 leading-relaxed">
        Pick the existing person to reuse their info, or add as new if this is a different person with the same name.
      </p>
      <div className="space-y-1.5">
        {matches.map((m) => (
          <label
            key={m.id}
            className={`flex items-start gap-2 rounded-md px-2 py-1.5 cursor-pointer ${
              selected === m.id ? "bg-white border border-amber-300" : "hover:bg-white/60"
            }`}
          >
            <input
              type="radio"
              name="name-match"
              value={m.id}
              checked={selected === m.id}
              onChange={() => setSelected(m.id)}
              className="mt-0.5 accent-tp-primary"
            />
            <span className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-tp-primary block">Use existing</span>
              <span className="text-[11px] text-gray-600 block truncate">
                {[
                  m.phone ? `📱 ${formatUsPhoneDisplay(m.phone)}` : null,
                  m.venmoHandle ? `Venmo @${m.venmoHandle}` : null,
                  m.cashappHandle ? `Cash App $${m.cashappHandle}` : null,
                  m.paypalHandle ? `PayPal @${m.paypalHandle}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </label>
        ))}
        <label
          className={`flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer ${
            selected === "new" ? "bg-white border border-amber-300" : "hover:bg-white/60"
          }`}
        >
          <input
            type="radio"
            name="name-match"
            value="new"
            checked={selected === "new"}
            onChange={() => setSelected("new")}
            className="accent-tp-primary"
          />
          <span className="text-xs font-semibold text-tp-primary">
            Add as new person {loading ? <span className="text-gray-400 font-normal">checking…</span> : null}
          </span>
        </label>
      </div>
    </div>
  );
}
