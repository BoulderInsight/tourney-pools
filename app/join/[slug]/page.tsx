"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type RsvpStatus = "pending" | "accepted" | "declined";

interface JoinPlayer {
  id: string;
  name: string;
  rsvpStatus: RsvpStatus;
}

interface JoinData {
  poolName: string;
  buyIn: number;
  chairmanName: string;
  draftComplete: boolean;
  tournament: {
    name: string;
    course: string | null;
    location: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string | null;
  } | null;
  players: JoinPlayer[];
  settings?: {
    draftType?: string;
    purseType?: string;
    payoutMethod?: string;
    missedCutRule?: string;
    scoringType?: string;
    bestN?: number;
  };
}

function draftTypeLabel(t?: string): string {
  switch (t) {
    case "auto-snake": return "Auto Snake Draft";
    case "random": return "Auto Random";
    case "snake": return "Live Snake Draft";
    default: return "Auto Snake Draft";
  }
}

function draftTypeBlurb(t?: string): string {
  switch (t) {
    case "auto-snake":
      return "Players are seeded randomly, then golfers are assigned by world ranking in snake order (1, 2, 3, then 3, 2, 1) so every team gets a fair mix of stars and longshots.";
    case "random":
      return "Every golfer in the field is shuffled and dealt out randomly. No picking, no order, no draft to schedule.";
    case "snake":
      return "The chairman draws for pick order, then players take turns picking golfers live. Order reverses each round so everyone gets a fair mix of early and late picks.";
    default:
      return "";
  }
}

function purseSentence(t?: string): string {
  switch (t) {
    case "winner-take-all": return "and the entire purse goes to the winner";
    case "70-30": return "and the purse splits 70 / 30 between the top two";
    case "60-30-10": return "and the purse splits 60 / 30 / 10 between the top three";
    case "custom": return "and the purse splits across the top finishers";
    default: return "";
  }
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return "";
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  const sStr = s.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  if (!e || s.toDateString() === e.toDateString()) return sStr;
  const eStr = e.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `${sStr} to ${eStr}`;
}

/**
 * Inline (i) trigger. Hover on desktop shows a tooltip; tap on mobile toggles
 * a small popover under the icon. Keeps the explainer one line on desktop
 * without forcing a 'Learn more' link.
 */
function DraftTypeInfo({ blurb }: { blurb: string }) {
  const [open, setOpen] = useState(false);
  if (!blurb) return null;
  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-tp-primary/15 text-tp-primary text-[10px] font-bold leading-none active:bg-tp-primary/25"
        aria-label="What is this draft type?"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-10 top-full mt-2 left-1/2 -translate-x-1/2 w-64 bg-tp-primary text-white text-xs leading-snug rounded-lg p-3 shadow-lg normal-case font-normal"
        >
          {blurb}
        </span>
      )}
    </span>
  );
}

export default function JoinPoolPage() {
  const { slug } = useParams();
  const [data, setData] = useState<JoinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recentChoice, setRecentChoice] = useState<RsvpStatus | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/join/${slug}`);
    if (!res.ok) {
      setError(res.status === 404 ? "We couldn't find that pool." : "Could not load this invitation.");
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, [slug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function submitRsvp(status: "accepted" | "declined") {
    if (!selectedPlayerId) return;
    setSubmitting(true);
    const res = await fetch(`/api/join/${slug}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: selectedPlayerId, status }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || "Could not save your response.");
      return;
    }
    setRecentChoice(status);
    await fetchData();
  }

  if (loading) {
    return (
      <main className="px-4 pt-12 pb-12 max-w-lg mx-auto text-center">
        <div className="flex justify-center gap-3"><div className="loading-dot" /><div className="loading-dot" /><div className="loading-dot" /></div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="px-4 pt-12 pb-12 max-w-lg mx-auto text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="TourneyPools" className="h-12 mx-auto mb-6" />
        <h1 className="font-serif text-2xl font-bold text-tp-primary mb-2">Hmm.</h1>
        <p className="text-sm text-gray-500">{error || "Could not load this invitation."}</p>
      </main>
    );
  }

  const selected = selectedPlayerId ? data.players.find((p) => p.id === selectedPlayerId) : null;
  const dateRange = data.tournament ? formatDateRange(data.tournament.startDate, data.tournament.endDate) : "";

  return (
    <main className="px-4 pt-6 pb-12 max-w-lg mx-auto">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="TourneyPools" className="h-10 mx-auto mb-4" />

      {/* Pool header */}
      <div className="text-center mb-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-tp-accent font-bold mb-1">
          {data.chairmanName} invited you to
        </p>
        <h1 className="font-serif text-3xl font-bold text-tp-primary leading-tight">{data.poolName}</h1>
        {data.tournament && (
          <p className="text-sm text-tp-primary/70 font-semibold mt-1">{data.tournament.name}</p>
        )}
        {dateRange && (
          <p className="text-xs text-gray-500 mt-0.5">{dateRange}</p>
        )}
        {data.tournament?.course && (
          <p className="text-xs text-gray-400 mt-0.5">
            {data.tournament.course}{data.tournament.location ? ` · ${data.tournament.location}` : ""}
          </p>
        )}
      </div>

      {/* Friendly explainer. The two paragraphs describe the format
          generically, then drop in the specifics for this pool: tournament,
          draft type (with an info popover), buy-in, purse split, chairman.
          Warm cream background + gold left rail to feel like a card pulled
          out of the rules, not just a callout. */}
      <div
        className="rounded-xl border-l-4 border-tp-accent bg-[#FFF8E8] p-4 mb-5"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      >
        <p className="text-sm text-tp-primary leading-relaxed">
          A <strong>TourneyPool</strong> is a friendly bet between friends. Each player drafts a
          roster of pros from the field, and{" "}
          {data.settings?.scoringType === "best-n" && data.settings?.bestN ? (
            <>your best <strong>{data.settings.bestN}</strong> golfer scores combine to rank your team.</>
          ) : (
            <>all your golfer scores combine to rank your team.</>
          )}{" "}
          Lowest total wins.
        </p>
        <p className="text-sm text-tp-primary leading-relaxed mt-3">
          This pool runs on the <strong>{data.tournament?.name ?? "tournament"}</strong> with a{" "}
          <span className="inline-flex items-baseline gap-1">
            <strong>{draftTypeLabel(data.settings?.draftType)}</strong>
            <DraftTypeInfo blurb={draftTypeBlurb(data.settings?.draftType)} />
          </span>{" "}
          format. Buy in is <strong>${data.buyIn}</strong>, {purseSentence(data.settings?.purseType)}.
          Chairman is <strong>{data.chairmanName}</strong>.
        </p>
        <p className="text-xs text-gray-600 leading-relaxed mt-3">
          Tap your name below, hit <strong>I&rsquo;m In</strong> or <strong>I&rsquo;m Out</strong>,
          and you&rsquo;re set. The leaderboard updates live during the tournament so you can follow along.
        </p>
      </div>

      {/* Roster-locked banner. Also links onward to the leaderboard so a late
          tap of the invite link doesn't dead-end after the draft. */}
      {data.draftComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-center">
          <p className="text-xs font-semibold text-amber-700">The draft has already happened. Roster is locked.</p>
          <a
            href={`/pool/${slug}`}
            className="inline-block mt-2 text-xs font-bold text-tp-primary underline decoration-tp-accent underline-offset-4"
          >
            View live leaderboard →
          </a>
        </div>
      )}

      {/* Picker step */}
      {!selectedPlayerId && (
        <>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold text-center mb-2">
            Tap your name
          </p>
          {data.players.length === 0 ? (
            <p className="text-center text-gray-400 italic text-sm py-6">
              The chairman hasn&rsquo;t added anyone yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {data.players.map((p) => {
                const isAccepted = p.rsvpStatus === "accepted";
                const isDeclined = p.rsvpStatus === "declined";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setSelectedPlayerId(p.id); setRecentChoice(null); }}
                    className="flex items-center justify-between bg-white border border-tp-bg-dark rounded-xl px-3 py-3 text-left active:bg-tp-bg/60 transition-colors min-w-0"
                  >
                    <span className="font-semibold text-tp-primary truncate">{p.name}</span>
                    {isAccepted && (
                      <span className="text-green-600 text-base flex-shrink-0 ml-1" aria-label="Already joined">✅</span>
                    )}
                    {isDeclined && (
                      <span className="text-red-500 text-base flex-shrink-0 ml-1" aria-label="Declined">❌</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div className="text-center mt-6">
            <p className="text-[11px] text-gray-400">
              Not on the list? <span className="text-tp-primary font-semibold">Contact the chairman</span> ({data.chairmanName}) to be added.
            </p>
          </div>
        </>
      )}

      {/* RSVP step */}
      {selected && (
        <div className="card p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold text-center mb-1">
            Responding as
          </p>
          <h2 className="font-serif text-2xl font-bold text-tp-primary text-center mb-1">{selected.name}</h2>

          {selected.rsvpStatus === "accepted" && recentChoice !== "declined" && (
            <p className="text-center text-xs text-green-600 font-semibold mb-4">
              ✅ You&rsquo;re already in. Tap I&rsquo;m Out below to change your mind.
            </p>
          )}
          {selected.rsvpStatus === "declined" && recentChoice !== "accepted" && (
            <p className="text-center text-xs text-gray-500 mb-4">
              You previously declined. Tap I&rsquo;m In to switch.
            </p>
          )}
          {recentChoice === "accepted" && (
            <p className="text-center text-xs text-green-600 font-semibold mb-4">
              Saved. See you on the leaderboard.
            </p>
          )}
          {recentChoice === "declined" && (
            <p className="text-center text-xs text-gray-500 mb-4">Saved. Maybe next time.</p>
          )}

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              type="button"
              onClick={() => submitRsvp("accepted")}
              disabled={submitting || data.draftComplete || selected.rsvpStatus === "accepted"}
              className="py-6 rounded-xl bg-green-600 text-white text-base font-bold active:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I&rsquo;m In ✅
            </button>
            <button
              type="button"
              onClick={() => submitRsvp("declined")}
              disabled={submitting || data.draftComplete || selected.rsvpStatus === "declined"}
              className="py-6 rounded-xl bg-gray-700 text-white text-base font-bold active:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              I&rsquo;m Out ❌
            </button>
          </div>

          <button
            type="button"
            onClick={() => { setSelectedPlayerId(null); setRecentChoice(null); }}
            className="w-full py-2 text-xs text-gray-400 active:text-tp-primary"
          >
            Not {selected.name}? Pick again
          </button>
        </div>
      )}

      {/* Always-visible footer link to the live leaderboard. Useful for invitees
          who've already RSVP'd and just want to peek at scores, especially after
          the draft when this page is mostly the locked banner. */}
      {!data.draftComplete && data.players.length > 0 && (
        <div className="text-center mt-8">
          <a
            href={`/pool/${slug}`}
            className="text-xs text-gray-400 active:text-tp-primary"
          >
            View live leaderboard →
          </a>
        </div>
      )}
    </main>
  );
}
