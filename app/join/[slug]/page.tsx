"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import SaveToHomeButton from "@/app/components/save-to-home-button";

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

// Display strings + plain-language explanations for each pool rule. Kept side
// by side so the Pool Details card can pair each value with an info tooltip.

function draftTypeLabel(t?: string): string {
  switch (t) {
    case "auto-snake": return "Auto Snake Draft";
    case "random": return "Random Draft";
    case "snake": return "Live Draft";
    default: return "Auto Snake Draft";
  }
}
function draftTypeBlurb(t?: string): string {
  switch (t) {
    case "auto-snake":
      return "Players are seeded randomly, then take turns picking golfers in reverse order each round to keep it fair.";
    case "random":
      return "Golfers are randomly assigned to players. No picking required.";
    case "snake":
      return "Players take turns picking in real time on draft day.";
    default:
      return "";
  }
}

function scoringLabel(s?: string, bestN?: number): string {
  if (s === "best-n") return `Best ${bestN ?? 3} golfers count`;
  return "Count All Golfers";
}
function scoringBlurb(s?: string): string {
  if (s === "best-n") return "Only your top N performers count. Reduces impact of one bad pick.";
  return "Every golfer on your roster contributes to your team total.";
}

function missedCutLabel(m?: string): string {
  switch (m) {
    case "zero": return "Zero Contribution";
    case "penalty": return "Fixed Penalty";
    case "worst-made": return "Worst Made Score";
    default: return "Zero Contribution";
  }
}
function missedCutBlurb(m?: string): string {
  switch (m) {
    case "zero": return "Missed cut golfers stop counting. No penalty, no benefit.";
    case "penalty": return "Missed cut golfers receive a set score per remaining round.";
    case "worst-made": return "Missed cut golfers receive the total of the worst golfer who made the cut.";
    default: return "";
  }
}

// Single Payout row covers both shapes of the prize: a 'Winner Take All'
// label when the whole purse goes to first, or the actual percentage split
// when multiple finishers cash. Tooltip text adapts to how many finishers
// the split covers so it reads naturally.
function payoutLabel(p?: string): string {
  switch (p) {
    case "winner-take-all": return "Winner Take All";
    case "70-30": return "70 / 30";
    case "60-30-10": return "60 / 30 / 10";
    case "custom": return "Standard Split";
    default: return "Winner Take All";
  }
}
function payoutBlurb(p?: string): string {
  switch (p) {
    case "winner-take-all":
      return "First place takes the entire purse.";
    case "70-30":
      return "The purse is divided between the top two finishers according to these percentages.";
    case "60-30-10":
      return "The purse is divided between the top three finishers according to these percentages.";
    case "custom":
      return "The purse is divided across the top finishers according to these percentages.";
    default:
      return "";
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
 * Inline info trigger. Hover on desktop shows a tooltip; tap on mobile toggles
 * a small popover under the icon. Used by both the intro paragraph and every
 * label in the Pool Details card so all tooltips read and behave the same.
 *
 * `align` controls which side the popover anchors to; for rows that sit on the
 * left edge of a card we anchor 'left' so the bubble doesn't clip the viewport.
 */
function InfoTip({
  blurb,
  label,
  align = "center",
}: {
  blurb: string;
  label: string;
  align?: "left" | "center";
}) {
  const [open, setOpen] = useState(false);
  if (!blurb) return null;
  const pos =
    align === "left"
      ? "left-0 -translate-x-0"
      : "left-1/2 -translate-x-1/2";
  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold leading-none active:bg-gray-300"
        aria-label={`What is ${label}?`}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-10 top-full mt-2 ${pos} w-60 bg-tp-primary text-white text-xs leading-snug rounded-lg p-3 shadow-lg normal-case font-normal`}
        >
          {blurb}
        </span>
      )}
    </span>
  );
}

/**
 * One row in the Pool Details card. Label on the left (with optional info
 * tooltip), value on the right in bold navy. Stays two-column on every screen
 * size since each value is short.
 */
function DetailRow({
  label,
  value,
  blurb,
}: {
  label: string;
  value: string;
  blurb?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-gray-500 font-semibold">
        {label}
        {blurb && <InfoTip blurb={blurb} label={label} align="left" />}
      </div>
      <div className="text-sm font-bold text-tp-primary text-right">{value}</div>
    </div>
  );
}

export default function JoinPoolPage() {
  const { slug } = useParams();
  const router = useRouter();
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
    if (!res.ok) {
      setSubmitting(false);
      const d = await res.json().catch(() => ({}));
      setError(d?.error || "Could not save your response.");
      return;
    }
    // Accepted RSVPs go straight to the pool page so the invitee lands on the
    // header + rules + Save to Home Screen treatment that frames the rest of
    // the season. Pre-draft pools show the Draft Pending body beneath the
    // same header, post-draft pools show the live leaderboard. Declines stay
    // on /join with the confirmation so people can flip back to "I'm In"
    // without losing context.
    if (status === "accepted") {
      router.push(`/pool/${slug}`);
      return;
    }
    setSubmitting(false);
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

      {/* Intro card. Warm cream + gold left rail, short copy that names the
          three pool-shaping rules in bold (draft format, scoring, purse split)
          and the chairman by name. Specifics live in the Pool Details card
          below so this paragraph stays short and generic. */}
      <div
        className="rounded-xl border-l-4 border-tp-accent bg-[#FFF8E8] p-4 mb-5"
        style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
      >
        <p className="text-sm text-tp-primary leading-relaxed">
          A <strong>TourneyPool</strong> is a friendly bet between friends. Each player drafts a
          roster of pros from the field. The <strong>draft format</strong>, <strong>scoring</strong>,
          and <strong>purse split</strong> are all up to your chairman,{" "}
          <strong>{data.chairmanName}</strong>.
        </p>
        <p className="text-xs text-gray-600 leading-relaxed mt-3">
          Tap your name below, hit <strong>I&rsquo;m In</strong> or <strong>I&rsquo;m Out</strong>,
          and you&rsquo;re set. The leaderboard updates live during the tournament so you can follow along.
        </p>
      </div>

      {/* Pool Details card. White background, two-column rows, info tooltips
          on the rule labels so invitees can dig in without leaving the page.
          Rule values are dynamic from settings; defaults match DEFAULT_SETTINGS
          if any field is missing on an older pool. */}
      <div className="card p-4 mb-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400 font-bold mb-2">
          Pool Details
        </p>
        <DetailRow
          label="Draft"
          value={draftTypeLabel(data.settings?.draftType)}
          blurb={draftTypeBlurb(data.settings?.draftType)}
        />
        <DetailRow
          label="Scoring"
          value={scoringLabel(data.settings?.scoringType, data.settings?.bestN)}
          blurb={scoringBlurb(data.settings?.scoringType)}
        />
        <DetailRow
          label="Missed Cut"
          value={missedCutLabel(data.settings?.missedCutRule)}
          blurb={missedCutBlurb(data.settings?.missedCutRule)}
        />
        <DetailRow
          label="Buy-in"
          value={`$${data.buyIn}`}
        />
        <DetailRow
          label="Payout"
          value={payoutLabel(data.settings?.purseType)}
          blurb={payoutBlurb(data.settings?.purseType)}
        />
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

      {/* Save to Home Screen lives near the bottom so it doesn't compete
          with the RSVP decision. Self-hides if the page is already running
          as an installed app, so an invitee who already saved it won't be
          nagged on return visits. Uses the same per-pool manifest as the
          leaderboard so the saved icon's label is the pool name. */}
      <div className="mt-8">
        <SaveToHomeButton poolName={data.poolName} />
      </div>

      {/* Always-visible footer link to the live leaderboard. Useful for invitees
          who've already RSVP'd and just want to peek at scores, especially after
          the draft when this page is mostly the locked banner. */}
      {!data.draftComplete && data.players.length > 0 && (
        <div className="text-center mt-4">
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
