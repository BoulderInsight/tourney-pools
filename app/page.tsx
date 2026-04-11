import Link from "next/link";
import { getDb } from "@/lib/db";

interface Tournament {
  id: string;
  name: string;
  slug: string;
  course_name: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  year: number;
  status: string;
  logo_url: string | null;
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "";
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : null;
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const startStr = start.toLocaleDateString("en-US", opts);
  if (!end) return startStr;
  const startMonth = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endDay = end.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
  if (startMonth === endMonth) {
    const startDay = start.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" });
    return `${startMonth} ${startDay}–${endDay}`;
  }
  const endStr = end.toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}`;
}

async function getUpcomingTournaments(): Promise<Tournament[]> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT id, name, slug, course_name, location, start_date, end_date, year, status, logo_url
      FROM tournaments
      WHERE status IN ('scheduled', 'in_progress')
      ORDER BY start_date ASC
      LIMIT 4
    `;
    return rows as Tournament[];
  } catch {
    return [];
  }
}

const STEPS = [
  {
    number: "1",
    title: "Pick a Tournament",
    description: "Choose from upcoming PGA events — The Masters, PGA Championship, U.S. Open, The Open, or any tournament you want.",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    number: "2",
    title: "Set Your Rules",
    description: "Configure draft type, scoring, missed-cut penalties, and purse distribution. Your pool, your way.",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    number: "3",
    title: "Invite Your Friends",
    description: "Share a link, run a live draft or auto-assign, and track scores in real time on a shareable leaderboard.",
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const FEATURES = [
  {
    title: "3 Draft Modes",
    description: "Live snake draft, auto snake by ranking, or pure random. Pick the style that fits your group.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
      </svg>
    ),
  },
  {
    title: "Custom Scoring",
    description: "All golfers count or best-N. Missed-cut penalties, fixed or worst-made. Full control.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Live Leaderboards",
    description: "Scores update automatically. Expand any player to see their full roster and round-by-round detail.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Shareable Links",
    description: "Every pool gets a unique URL. Share it and anyone can follow the leaderboard — no login required.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
  {
    title: "Purse Payouts",
    description: "Winner-take-all, 70/30, 60/30/10, or custom splits. Shows each player exactly who they owe.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Any Tournament",
    description: "Not just the majors. Set up a pool for any golf event — PGA Tour, LIV, amateur, or your local club.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const tournaments = await getUpcomingTournaments();

  return (
    <div className="min-h-screen">
      {/* ─── Nav ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-tp-bg/90 backdrop-blur-md border-b border-tp-bg-dark/60">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="TourneyPools" className="h-8" />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-tp-primary/70 hover:text-tp-primary transition-colors px-3 py-1.5">
              Sign In
            </Link>
            <Link href="/signup" className="text-sm font-semibold text-white bg-tp-primary hover:bg-tp-primary-deep transition-colors rounded-lg px-4 py-1.5">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(26,54,93,0.06) 0%, transparent 70%)"
        }} />
        <div className="max-w-2xl mx-auto px-6 pt-20 pb-16 text-center relative">
          <div className="inline-flex items-center gap-2 bg-tp-accent/10 text-tp-accent-dark text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6 tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-tp-accent" />
            Free to use &middot; No credit card required
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-bold text-tp-primary leading-tight mb-5">
            Run your golf pool<br />for any tournament
          </h1>
          <p className="text-gray-500 text-base sm:text-lg leading-relaxed max-w-md mx-auto mb-10">
            Draft golfers with friends, set your own rules, and track live scores on a shareable leaderboard. Works for every event on the calendar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup" className="btn-green text-center w-full sm:w-auto px-8">
              Create a Pool
            </Link>
            <a href="#how-it-works" className="btn-outline text-center w-full sm:w-auto px-8">
              See How It Works
            </a>
          </div>
          <p className="text-xs text-gray-400 mt-6">
            Have an invite link? Just open it to view the leaderboard — no account needed.
          </p>
        </div>
      </section>

      {/* ─── How It Works ────────────────────────────────── */}
      <section id="how-it-works" className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-tp-accent mb-2">How It Works</p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-tp-primary">Three steps to tournament day</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {STEPS.map((step) => (
              <div key={step.number} className="bg-white rounded-2xl p-6 shadow-card border border-tp-primary/[0.04] text-center">
                <div className="w-14 h-14 rounded-2xl bg-tp-primary/[0.06] flex items-center justify-center mx-auto mb-4 text-tp-primary">
                  {step.icon}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-tp-accent mb-2">Step {step.number}</div>
                <h3 className="font-serif text-lg font-bold text-tp-primary mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Upcoming Tournaments ────────────────────────── */}
      {tournaments.length > 0 && (
        <section className="py-16 sm:py-20 bg-tp-primary">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-tp-accent mb-2">Upcoming Events</p>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">Start a pool for any of these</h2>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {tournaments.map((t) => (
                <div key={t.id} className="bg-white/[0.08] backdrop-blur-sm rounded-2xl p-5 border border-white/[0.08]">
                  <div className="flex items-start gap-4 mb-3">
                    {t.logo_url && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={t.logo_url} alt="" className="w-10 h-10 object-contain flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif text-lg font-bold text-white">{t.name}</h3>
                        {t.status === "in_progress" ? (
                          <span className="text-[9px] bg-green-400/20 text-green-300 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider flex-shrink-0">
                            Live
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/30 font-mono flex-shrink-0">{t.year}</span>
                        )}
                      </div>
                      {t.course_name && (
                        <p className="text-sm text-white/60 mt-0.5">{t.course_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    {t.location && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t.location}
                      </span>
                    )}
                    {t.start_date && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDateRange(t.start_date, t.end_date)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center mt-8">
              <Link href="/signup" className="inline-flex items-center gap-2 text-sm font-semibold text-tp-accent hover:text-tp-accent-light transition-colors">
                Create a pool for any event
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ─── Features ────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-tp-accent mb-2">Features</p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-tp-primary">Everything you need to run a pool</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-4 bg-white rounded-xl p-5 shadow-card border border-tp-primary/[0.04]">
                <div className="w-10 h-10 rounded-xl bg-tp-accent/10 flex items-center justify-center text-tp-accent flex-shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-tp-primary text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-xl mx-auto px-6 text-center">
          <div className="bg-white rounded-3xl shadow-card-lg p-8 sm:p-12 border border-tp-primary/[0.04]">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-tp-primary mb-3">Ready to get started?</h2>
            <p className="text-sm text-gray-500 leading-relaxed mb-8 max-w-sm mx-auto">
              Create your free account, set up a pool in minutes, and share the link with your group before tee time.
            </p>
            <Link href="/signup" className="btn-green inline-block px-10">
              Create Your First Pool
            </Link>
            <p className="text-xs text-gray-400 mt-4">
              Free plan includes 1 pool with up to 8 players. <span className="text-tp-accent font-medium">Go Pro for $4.99/mo</span> for unlimited pools and players.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-tp-bg-dark">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="TourneyPools" className="h-6 opacity-50" />
            </div>
            <div className="flex items-center gap-6 text-xs text-gray-400">
              <Link href="/login" className="hover:text-tp-primary transition-colors">Sign In</Link>
              <Link href="/signup" className="hover:text-tp-primary transition-colors">Create Account</Link>
              <span>&copy; {new Date().getFullYear()} TourneyPools</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
