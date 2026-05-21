const BASE_URL = "https://live-golf-data.p.rapidapi.com";

function headers() {
  const key = process.env.GOLF_API_KEY;
  if (!key) throw new Error("GOLF_API_KEY not set");
  return {
    "x-rapidapi-host": "live-golf-data.p.rapidapi.com",
    "x-rapidapi-key": key,
    "Content-Type": "application/json",
  };
}

// Parse the MongoDB-style extended JSON numbers the API returns
function num(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, string>;
    if ("$numberInt" in obj) return Number(obj.$numberInt);
    if ("$numberLong" in obj) return Number(obj.$numberLong);
    if ("$numberDouble" in obj) return Number(obj.$numberDouble);
  }
  return null;
}

// Parse MongoDB-style date to JS Date
function parseDate(val: unknown): Date | null {
  if (val == null) return null;
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    if ("$date" in obj) {
      const inner = obj.$date;
      if (typeof inner === "string") return new Date(inner);
      if (typeof inner === "object" && inner !== null) {
        const ms = num(inner);
        if (ms !== null) return new Date(ms);
      }
    }
  }
  return null;
}

// ── Schedule ──────────────────────────────────────────────

export interface ScheduleTournament {
  tournId: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  format: string;
  purse: number | null;
}

export async function fetchSchedule(year: number, orgId = 1): Promise<ScheduleTournament[]> {
  const res = await fetch(`${BASE_URL}/schedule?orgId=${orgId}&year=${year}`, {
    headers: headers(),
    cache: "no-store",
  });

  if (res.status === 429) throw new Error("Rate limited by golf API");
  if (!res.ok) throw new Error(`Golf API schedule error: ${res.status}`);

  const data = await res.json();
  const schedule = data.schedule || [];

  return schedule.map((t: Record<string, unknown>) => ({
    tournId: t.tournId as string,
    name: t.name as string,
    startDate: parseDate((t.date as Record<string, unknown>)?.start),
    endDate: parseDate((t.date as Record<string, unknown>)?.end),
    format: (t.format as string) || "stroke",
    purse: num(t.purse),
  }));
}

// ── Tournament detail (includes course/location) ─────────

export interface TournamentDetail {
  tournId: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  courseName: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

export async function fetchTournamentDetail(tournId: string, year: number, orgId = 1): Promise<TournamentDetail> {
  const res = await fetch(`${BASE_URL}/tournament?orgId=${orgId}&tournId=${tournId}&year=${year}`, {
    headers: headers(),
    cache: "no-store",
  });

  if (res.status === 429) throw new Error("Rate limited by golf API");
  if (!res.ok) throw new Error(`Golf API tournament error: ${res.status}`);

  const data = await res.json();
  const courses = (data.courses as Record<string, unknown>[]) || [];
  const hostCourse = courses.find((c) => c.host === "Yes") || courses[0];
  const location = (hostCourse?.location as Record<string, string>) || {};

  return {
    tournId: data.tournId as string,
    name: data.name as string,
    startDate: parseDate((data.date as Record<string, unknown>)?.start),
    endDate: parseDate((data.date as Record<string, unknown>)?.end),
    status: (data.status as string) || "unknown",
    courseName: (hostCourse?.courseName as string) || null,
    city: location.city || null,
    state: location.state || null,
    country: location.country || null,
  };
}

// ── Leaderboard (doubles as field + live scores) ─────────

export interface LeaderboardGolfer {
  playerId: string;
  firstName: string;
  lastName: string;
  isAmateur: boolean;
  position: string;
  total: string; // e.g. "-12", "+5", "E"
  status: string; // "active", "cut", "wd"
  rounds: {
    roundId: number;
    scoreToPar: string;
    strokes: number | null;
    courseName: string;
  }[];
  thru: string;
  currentRound: number | null;
}

export interface LeaderboardResult {
  status: string;
  roundId: number | null;
  golfers: LeaderboardGolfer[];
}

// Parse a slashgolf score-to-par string ("-5" → -5, "E" → 0, "+3" → 3, "" → null)
export function parseScore(s: string | null | undefined): number | null {
  if (!s) return null;
  if (s === "E") return 0;
  const n = Number(s);
  return isNaN(n) ? null : n;
}

// Normalize a golfer name for fuzzy matching: strip accents, lowercase,
// keep letters only. Lets API players match wizard-entered names that differ
// by accents, punctuation, or spacing ("José Mª" ↔ "Jose Maria").
export function normalizeName(name: string): string {
  const decomposed = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const fixed = decomposed.replace(/ø/gi, "o");
  return fixed.toLowerCase().replace(/[^a-z]/g, "");
}

// Pull r1-r4 scores from a leaderboard golfer.
// For ACTIVE (mid-round) players, derives the in-progress round score from `total`
// since the API leaves scoreToPar empty until the round is complete.
export function extractRoundScores(g: LeaderboardGolfer): {
  r1: number | null; r2: number | null; r3: number | null; r4: number | null;
} {
  const r1 = parseScore(g.rounds.find((r) => r.roundId === 1)?.scoreToPar);
  const r2 = parseScore(g.rounds.find((r) => r.roundId === 2)?.scoreToPar);
  const r3 = parseScore(g.rounds.find((r) => r.roundId === 3)?.scoreToPar);
  const r4 = parseScore(g.rounds.find((r) => r.roundId === 4)?.scoreToPar);
  const out = { r1, r2, r3, r4 };

  if (g.status !== "active") return out;
  const total = parseScore(g.total);
  if (total === null) return out;

  const completedSum = (r1 ?? 0) + (r2 ?? 0) + (r3 ?? 0) + (r4 ?? 0);
  const inRound = total - completedSum;
  const cur = g.currentRound;
  // Only fill the slot for the round actually being played, and only if not already final
  if (cur === 1 && r1 === null) out.r1 = inRound;
  else if (cur === 2 && r2 === null) out.r2 = inRound;
  else if (cur === 3 && r3 === null) out.r3 = inRound;
  else if (cur === 4 && r4 === null) out.r4 = inRound;
  return out;
}

export async function fetchLeaderboard(tournId: string, year: number, orgId = 1): Promise<LeaderboardResult> {
  const res = await fetch(`${BASE_URL}/leaderboard?orgId=${orgId}&tournId=${tournId}&year=${year}`, {
    headers: headers(),
    cache: "no-store",
  });

  if (res.status === 429) throw new Error("Rate limited by golf API");
  if (!res.ok) throw new Error(`Golf API leaderboard error: ${res.status}`);

  const data = await res.json();
  const rows = (data.leaderboardRows as Record<string, unknown>[]) || [];

  const golfers: LeaderboardGolfer[] = rows.map((r) => ({
    playerId: r.playerId as string,
    firstName: r.firstName as string,
    lastName: r.lastName as string,
    isAmateur: (r.isAmateur as boolean) || false,
    position: (r.position as string) || "",
    total: (r.total as string) || "",
    status: (r.status as string) || "active",
    rounds: ((r.rounds as Record<string, unknown>[]) || []).map((rd) => ({
      roundId: num(rd.roundId) ?? 0,
      scoreToPar: (rd.scoreToPar as string) || "",
      strokes: num(rd.strokes),
      courseName: (rd.courseName as string) || "",
    })),
    thru: (r.thru as string) || "",
    currentRound: num(r.currentRound),
  }));

  return {
    status: (data.status as string) || "unknown",
    roundId: num(data.roundId),
    golfers,
  };
}
