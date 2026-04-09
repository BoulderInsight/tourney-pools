import {
  CommissionerSettings,
  DraftAssignment,
  DraftType,
  Golfer,
  GolferStanding,
  PlayerStanding,
  PoolConfig,
  PoolPlayer,
} from "./types";

export const DEFAULT_SETTINGS: CommissionerSettings = {
  draftType: "snake",
  scoringType: "all",
  bestN: 4,
  missedCutRule: "penalty",
  missedCutPenalty: 5,
  purseType: "70-30",
  purseDistribution: [],
};

export const DEFAULT_FIELD: string[] = [
  "Scottie Scheffler",
  "Xander Schauffele",
  "Rory McIlroy",
  "Collin Morikawa",
  "Ludvig Aberg",
  "Jon Rahm",
  "Bryson DeChambeau",
  "Brooks Koepka",
  "Tommy Fleetwood",
  "Patrick Cantlay",
  "Shane Lowry",
  "Hideki Matsuyama",
  "Viktor Hovland",
  "Wyndham Clark",
  "Sahith Theegala",
  "Justin Thomas",
  "Russell Henley",
  "Cameron Smith",
  "Tony Finau",
  "Sungjae Im",
  "Robert MacIntyre",
  "Jordan Spieth",
  "Dustin Johnson",
  "Min Woo Lee",
  "Corey Conners",
  "Cameron Young",
  "Tom Kim",
  "Keegan Bradley",
  "Joaquin Niemann",
  "Sepp Straka",
  "Adam Scott",
  "Jason Day",
  "Will Zalatoris",
  "Sam Burns",
  "Matt Fitzpatrick",
  "Max Homa",
  "Si Woo Kim",
  "Akshay Bhatia",
  "Davis Thompson",
  "Chris Kirk",
  "Brian Harman",
  "Denny McCarthy",
  "Billy Horschel",
  "Taylor Moore",
  "Nick Dunlap",
  "Austin Eckroat",
  "Angel Yin",
  "Fred Couples",
];

export function formatScore(score: number | null): string {
  if (score === null) return "-";
  if (score === 0) return "E";
  return score > 0 ? `+${score}` : `${score}`;
}

export function scoreColorClass(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score < 0) return "text-red-600";
  if (score === 0) return "text-gray-700";
  return "text-blue-700";
}

function golferTotal(g: Golfer): number | null {
  const rounds = [g.r1, g.r2, g.r3, g.r4].filter(
    (r): r is number => r !== null
  );
  if (rounds.length === 0) return null;
  return rounds.reduce((a, b) => a + b, 0);
}

function computeGolferStanding(
  golfer: Golfer,
  settings: CommissionerSettings
): { rawScore: number | null; penaltyScore: number; totalScore: number | null } {
  const raw = golferTotal(golfer);

  if (golfer.madeCut === false) {
    const playedRounds = [golfer.r1, golfer.r2].filter(
      (r): r is number => r !== null
    );
    const playedTotal =
      playedRounds.length > 0 ? playedRounds.reduce((a, b) => a + b, 0) : 0;

    if (settings.missedCutRule === "zero") {
      return { rawScore: playedTotal, penaltyScore: 0, totalScore: playedTotal };
    }

    if (settings.missedCutRule === "penalty") {
      const missedRounds = 4 - playedRounds.length;
      const penalty = missedRounds * settings.missedCutPenalty;
      return {
        rawScore: playedTotal,
        penaltyScore: penalty,
        totalScore: playedTotal + penalty,
      };
    }

    // worst-made: handled at pool level — needs all golfers context
    // placeholder; the caller patches this
    return { rawScore: playedTotal, penaltyScore: 0, totalScore: null };
  }

  return { rawScore: raw, penaltyScore: 0, totalScore: raw };
}

function purseBreakdown(
  purseType: string,
  purseDistribution: number[],
  total: number,
  numPlayers: number
): number[] {
  let pcts: number[];
  switch (purseType) {
    case "winner-take-all":
      pcts = [100];
      break;
    case "70-30":
      pcts = [70, 30];
      break;
    case "60-30-10":
      pcts = [60, 30, 10];
      break;
    case "custom":
      pcts = purseDistribution;
      break;
    default:
      pcts = [100];
  }
  return pcts.map((p) => Math.round((p / 100) * total));
}

export function computeLeaderboard(config: PoolConfig): PlayerStanding[] {
  const { players, golfers, settings, assignments, buyIn } = config;
  const totalPurse = players.length * buyIn;
  const prizes = purseBreakdown(
    settings.purseType,
    settings.purseDistribution,
    totalPurse,
    players.length
  );

  // Worst made-cut score (for worst-made rule)
  let worstMadeTotal: number | null = null;
  if (settings.missedCutRule === "worst-made") {
    for (const g of golfers) {
      if (g.madeCut !== false) {
        const t = golferTotal(g);
        if (t !== null && (worstMadeTotal === null || t > worstMadeTotal)) {
          worstMadeTotal = t;
        }
      }
    }
  }

  const standings: PlayerStanding[] = players.map((player) => {
    const myAssignments = assignments
      .filter((a) => a.playerId === player.id)
      .sort((a, b) => a.pickNumber - b.pickNumber);

    const golferStandings: GolferStanding[] = myAssignments.map((a) => {
      const golfer = golfers.find((g) => g.id === a.golferId)!;
      const gs = computeGolferStanding(golfer, settings);

      // Patch worst-made
      if (
        settings.missedCutRule === "worst-made" &&
        golfer.madeCut === false &&
        worstMadeTotal !== null
      ) {
        gs.totalScore = worstMadeTotal;
      }

      return {
        golfer,
        counted: false,
        totalScore: gs.totalScore,
        penaltyScore: gs.penaltyScore,
      };
    });

    // Decide which golfers count
    const withScores = golferStandings
      .filter((gs) => gs.totalScore !== null)
      .sort((a, b) => (a.totalScore ?? 0) - (b.totalScore ?? 0));

    const countN =
      settings.scoringType === "best-n"
        ? settings.bestN
        : withScores.length;

    const counted = new Set<string>();
    for (let i = 0; i < Math.min(countN, withScores.length); i++) {
      counted.add(withScores[i].golfer.id);
      withScores[i].counted = true;
    }
    // Also mark on the main array
    for (const gs of golferStandings) {
      gs.counted = counted.has(gs.golfer.id);
    }

    const totalScore =
      golferStandings.filter((gs) => gs.counted).length > 0
        ? golferStandings
            .filter((gs) => gs.counted)
            .reduce((sum, gs) => sum + (gs.totalScore ?? 0), 0)
        : null;

    return {
      player,
      rank: 0,
      totalScore,
      prize: 0,
      golfers: golferStandings,
    };
  });

  // Sort by total score (lower is better in golf)
  standings.sort((a, b) => {
    if (a.totalScore === null && b.totalScore === null) return 0;
    if (a.totalScore === null) return 1;
    if (b.totalScore === null) return -1;
    return a.totalScore - b.totalScore;
  });

  // Only assign ranks/prizes if at least one player has a score
  const anyScores = standings.some((s) => s.totalScore !== null);

  if (anyScores) {
    // Assign ranks (handle ties)
    let currentRank = 1;
    for (let i = 0; i < standings.length; i++) {
      if (
        i > 0 &&
        standings[i].totalScore !== null &&
        standings[i].totalScore === standings[i - 1].totalScore
      ) {
        standings[i].rank = standings[i - 1].rank;
      } else {
        standings[i].rank = currentRank;
      }
      currentRank = i + 2;
    }

    // Assign prizes
    for (let i = 0; i < prizes.length && i < standings.length; i++) {
      standings[i].prize = prizes[i];
    }
  }

  return standings;
}

export function draftGolfers(
  players: PoolPlayer[],
  golfers: Golfer[],
  draftType: DraftType
): DraftAssignment[] {
  const assignments: DraftAssignment[] = [];
  const pool = [...golfers];
  const numPlayers = players.length;
  const totalPicks = pool.length;
  let pickNumber = 0;

  if (draftType === "random") {
    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let i = 0; i < totalPicks; i++) {
      assignments.push({
        playerId: players[i % numPlayers].id,
        golferId: pool[i].id,
        pickNumber: i + 1,
      });
    }
  } else {
    // Snake draft
    // Shuffle pool for randomness
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    let round = 0;
    let idx = 0;
    while (idx < totalPicks) {
      const forward = round % 2 === 0;
      for (
        let p = forward ? 0 : numPlayers - 1;
        forward ? p < numPlayers : p >= 0;
        forward ? p++ : p--
      ) {
        if (idx >= totalPicks) break;
        assignments.push({
          playerId: players[p].id,
          golferId: pool[idx].id,
          pickNumber: idx + 1,
        });
        idx++;
      }
      round++;
    }
  }

  return assignments;
}
