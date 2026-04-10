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
  draftType: "random",
  scoringType: "all",
  bestN: 4,
  missedCutRule: "penalty",
  missedCutPenalty: 5,
  purseType: "70-30",
  purseDistribution: [],
};

export interface FieldEntry {
  name: string;
  ranking: number | null;
}

export const DEFAULT_FIELD: FieldEntry[] = [
  { name: "Scottie Scheffler", ranking: 1 },
  { name: "Rory McIlroy", ranking: 2 },
  { name: "Cameron Young", ranking: 3 },
  { name: "Tommy Fleetwood", ranking: 4 },
  { name: "J.J. Spaun", ranking: 5 },
  { name: "Matt Fitzpatrick", ranking: 6 },
  { name: "Collin Morikawa", ranking: 7 },
  { name: "Robert MacIntyre", ranking: 8 },
  { name: "Justin Rose", ranking: 9 },
  { name: "Xander Schauffele", ranking: 10 },
  { name: "Chris Gotterup", ranking: 11 },
  { name: "Russell Henley", ranking: 12 },
  { name: "Sepp Straka", ranking: 13 },
  { name: "Hideki Matsuyama", ranking: 14 },
  { name: "Justin Thomas", ranking: 15 },
  { name: "Ben Griffin", ranking: 16 },
  { name: "Ludvig Aberg", ranking: 17 },
  { name: "Jacob Bridgeman", ranking: 18 },
  { name: "Alex Noren", ranking: 19 },
  { name: "Harris English", ranking: 20 },
  { name: "Akshay Bhatia", ranking: 21 },
  { name: "Viktor Hovland", ranking: 22 },
  { name: "Patrick Reed", ranking: 23 },
  { name: "Bryson DeChambeau", ranking: 24 },
  { name: "Min Woo Lee", ranking: 25 },
  { name: "Keegan Bradley", ranking: 26 },
  { name: "Maverick McNealy", ranking: 27 },
  { name: "Si Woo Kim", ranking: 28 },
  { name: "Ryan Gerard", ranking: 29 },
  { name: "Jon Rahm", ranking: 30 },
  { name: "Tyrrell Hatton", ranking: 31 },
  { name: "Shane Lowry", ranking: 32 },
  { name: "Sam Burns", ranking: 33 },
  { name: "Kurt Kitayama", ranking: 34 },
  { name: "Patrick Cantlay", ranking: 35 },
  { name: "Nicolai Hojgaard", ranking: 36 },
  { name: "Marco Penge", ranking: 37 },
  { name: "Daniel Berger", ranking: 38 },
  { name: "Aaron Rai", ranking: 39 },
  { name: "Nico Echavarria", ranking: 40 },
  { name: "Jason Day", ranking: 41 },
  { name: "Jake Knapp", ranking: 42 },
  { name: "Michael Kim", ranking: 43 },
  { name: "Corey Conners", ranking: 44 },
  { name: "Kristoffer Reitan", ranking: 46 },
  { name: "Michael Brennan", ranking: 47 },
  { name: "Andrew Novak", ranking: 48 },
  { name: "Matt McCarty", ranking: 49 },
  { name: "Brian Harman", ranking: 50 },
  { name: "Ryan Fox", ranking: 51 },
  { name: "Gary Woodland", ranking: 52 },
  { name: "Adam Scott", ranking: 53 },
  { name: "Sami Valimaki", ranking: 56 },
  { name: "Rasmus Hojgaard", ranking: 57 },
  { name: "Max Greyserman", ranking: 59 },
  { name: "Jordan Spieth", ranking: 61 },
  { name: "Harry Hall", ranking: 62 },
  { name: "Johnny Keefer", ranking: 64 },
  { name: "Nick Taylor", ranking: 67 },
  { name: "Rasmus Neergaard-Petersen", ranking: 69 },
  { name: "Casey Jarvis", ranking: 70 },
  { name: "Aldrich Potgieter", ranking: 77 },
  { name: "Wyndham Clark", ranking: 78 },
  { name: "Haotong Li", ranking: 84 },
  { name: "Max Homa", ranking: null },
  { name: "Cameron Smith", ranking: null },
  { name: "Brooks Koepka", ranking: null },
  { name: "Dustin Johnson", ranking: null },
  { name: "Sergio Garcia", ranking: null },
  { name: "Carlos Ortiz", ranking: null },
  { name: "Tom McKibbin", ranking: null },
  { name: "Davis Riley", ranking: null },
  { name: "Danny Willett", ranking: null },
  { name: "Angel Cabrera", ranking: null },
  { name: "Charl Schwartzel", ranking: null },
  { name: "Bubba Watson", ranking: null },
  { name: "Zach Johnson", ranking: null },
  { name: "Vijay Singh", ranking: null },
  { name: "Fred Couples", ranking: null },
  { name: "Mike Weir", ranking: null },
  { name: "Jose Maria Olazabal", ranking: null },
  { name: "Brian Campbell", ranking: null },
  { name: "Ethan Fang", ranking: null },
  { name: "Pongsapek Laopakdee", ranking: null },
  { name: "Naoyuki Kataoka", ranking: null },
  { name: "Brandon Holtz", ranking: null },
  { name: "Jackson Herrington", ranking: null },
  { name: "Mateo Pulcini", ranking: null },
  { name: "Mason Howell", ranking: null },
  { name: "Sam Stevens", ranking: null },
  { name: "Sungjae Im", ranking: 71 },
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
