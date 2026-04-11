export type DraftType = "snake" | "random" | "auto-snake";
export type ScoringType = "all" | "best-n";
export type MissedCutRule = "penalty" | "zero" | "worst-made";
export type PurseType = "winner-take-all" | "70-30" | "60-30-10" | "custom";
export type PayoutMethod = "chairman-collects" | "honor-system";

export interface CommissionerSettings {
  draftType: DraftType;
  scoringType: ScoringType;
  bestN: number;
  missedCutRule: MissedCutRule;
  missedCutPenalty: number;
  purseType: PurseType;
  purseDistribution: number[];
  payoutMethod?: PayoutMethod;
}

export interface PoolPlayer {
  id: string;
  name: string;
}

export interface Golfer {
  id: string;
  name: string;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  madeCut: boolean | null;
  oddsApiId?: string | null;
  manualOverride?: boolean;
  worldRanking?: number | null;
}

export interface DraftAssignment {
  playerId: string;
  golferId: string;
  pickNumber: number;
}

export interface PoolConfig {
  poolName: string;
  players: PoolPlayer[];
  golfers: Golfer[];
  buyIn: number;
  settings: CommissionerSettings;
  setupComplete: boolean;
  assignments: DraftAssignment[];
}

export interface GolferStanding {
  golfer: Golfer;
  counted: boolean;
  totalScore: number | null;
  penaltyScore: number;
}

export interface PlayerStanding {
  player: PoolPlayer;
  rank: number;
  totalScore: number | null;
  prize: number;
  golfers: GolferStanding[];
}
