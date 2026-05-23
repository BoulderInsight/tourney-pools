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
  /**
   * Server-attached payment info, used by the leaderboard's one-tap pay buttons.
   * Resolved from the player's linked Person (handles + preferred method) at fetch time.
   * `null` means the player has no handle on file yet. `undefined` means the server
   * didn't attach it (e.g. an endpoint that doesn't resolve payment info, or a pool
   * with no linked Persons).
   */
  paymentInfo?: PaymentHandle | null;
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

export type PaymentMethod = "venmo" | "cashapp" | "paypal";

/**
 * The picked payment-app handle for a Person: which app to send via, and the bare
 * handle (no leading sigil). Used by the public leaderboard's one-tap pay buttons
 * and by any caller of `pickHandleForPerson`.
 */
export interface PaymentHandle {
  method: PaymentMethod;
  handle: string;
}

/**
 * One leg of an honor-system payout: a losing player owes `amount` to the winner
 * identified by `toPlayerId`. Produced by `computePaymentPlan` so the UI can render
 * a self-contained pay button per transfer without a second lookup.
 */
export interface PayoutTransfer {
  toPlayerId: string;
  toPlayerName: string;
  toPaymentInfo: PaymentHandle | null;
  amount: number;
}

export interface Person {
  id: string;
  chairmanId: string;
  name: string;
  venmoHandle: string | null;
  cashappHandle: string | null;
  paypalHandle: string | null;
  preferredMethod: PaymentMethod | null;
  /**
   * E.164 US phone (+1XXXXXXXXXX) or null. Chairman-only visibility: returned by
   * the chairman-only /api/pool/[slug]/people and /api/groups/[id] endpoints; never
   * by the public leaderboard endpoint; never logged; never in OG images.
   */
  phone: string | null;
}

export interface PlayerWithPerson {
  id: string;          // player id
  name: string;        // player name (used in pool standings)
  personId: string;
  person: Person;
}

export interface CollectionRequest {
  id: string;
  token: string;
  personId: string;
  poolId: string;
  createdAt: string;
  submittedAt: string | null;
}

export interface Group {
  id: string;
  chairmanId: string;
  name: string;
  createdAt: string;
}

/** A group with a member count, used in list views. */
export interface GroupSummary extends Group {
  memberCount: number;
}

/** A group with its full member list. Each member is a Person from Phase 1. */
export interface GroupWithMembers extends Group {
  members: Person[];
}
