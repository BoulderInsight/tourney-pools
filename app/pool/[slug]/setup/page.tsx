"use client";

import { useState, useId, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CommissionerSettings, PoolPlayer, DraftType, MissedCutRule, PurseType, PayoutMethod } from "@/lib/types";
import { DEFAULT_SETTINGS, DEFAULT_FIELD, draftGolfers } from "@/lib/pool";

const STEPS = ["Pool Info", "Rules", "Field", "Draft", "Confirm"] as const;

function OptionCard({
  selected,
  onClick,
  title,
  description,
  badge,
  info,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  badge?: string;
  info?: string;
}) {
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className={`w-full rounded-xl border-2 transition-all duration-150 overflow-hidden
      ${selected
        ? "border-masters-green bg-masters-green/5 shadow-card"
        : "border-masters-cream-dark bg-white"}`}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left p-4"
        style={{ minHeight: 48 }}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center
              ${selected ? "border-masters-green bg-masters-green" : "border-gray-300"}`}
          >
            {selected && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">{title}</span>
              {badge && (
                <span className="text-[9px] bg-masters-gold text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
      </button>
      {info && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
            className="w-full text-left px-4 pb-1 -mt-1"
          >
            <span className="text-[11px] text-masters-green font-semibold">
              {showInfo ? "Hide details" : "Learn more"}
            </span>
          </button>
          {showInfo && (
            <div className="px-4 pb-4 pt-1 animate-fade-in">
              <div className="bg-masters-cream/60 rounded-lg p-3 text-xs text-gray-600 leading-relaxed">
                {info}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-3 font-sans">
        {label}
      </h3>
      {children}
    </div>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300
            ${i === current
              ? "w-8 h-2.5 bg-masters-green"
              : i < current
              ? "w-2.5 h-2.5 bg-masters-gold"
              : "w-2.5 h-2.5 bg-gray-200"
            }`}
        />
      ))}
    </div>
  );
}

export default function PoolSetupPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const uid = useId();
  const [step, setStep] = useState(0);

  // Pool info
  const [poolName, setPoolName] = useState("Masters Pool 2026");
  const [buyIn, setBuyIn] = useState(20);
  const [players, setPlayers] = useState<PoolPlayer[]>([
    { id: "p0", name: "" },
  ]);

  // Chairman settings
  const [settings, setSettings] = useState<CommissionerSettings>(DEFAULT_SETTINGS);
  const [customDist, setCustomDist] = useState("100");

  // Golfer field
  const [fieldText, setFieldText] = useState(
    DEFAULT_FIELD.map(e => e.ranking ? `${e.name} (#${e.ranking})` : e.name).join("\n")
  );

  // Draft results
  const [assignments, setAssignments] = useState<ReturnType<typeof draftGolfers>>([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Load existing pool data (pool name was set during create)
  useEffect(() => {
    async function loadPool() {
      const res = await fetch(`/api/pool/${slug}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.poolName) setPoolName(data.poolName);
        if (data?.buyIn) setBuyIn(data.buyIn);
      }
    }
    loadPool();
  }, [slug]);

  const set = <K extends keyof CommissionerSettings>(key: K, val: CommissionerSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: val }));

  // Players
  const addPlayer = () =>
    setPlayers((p) => [...p, { id: `p${Date.now()}`, name: "" }]);

  const removePlayer = (id: string) =>
    setPlayers((p) => p.filter((pl) => pl.id !== id));

  const updatePlayer = (id: string, name: string) =>
    setPlayers((p) => p.map((pl) => (pl.id === id ? { ...pl, name } : pl)));

  function parseFieldEntries() {
    return fieldText.split("\n").map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^(.+?)\s*\(#(\d+)\)$/);
      if (match) return { name: match[1].trim(), ranking: parseInt(match[2]) };
      return { name: trimmed, ranking: null };
    }).filter(Boolean) as { name: string; ranking: number | null }[];
  }

  // Draft
  function runDraft() {
    const entries = parseFieldEntries();

    const golfers = entries.map((e, i) => ({
      id: `g${i}`,
      name: e.name,
      r1: null, r2: null, r3: null, r4: null,
      madeCut: null,
    }));

    const result = draftGolfers(players, golfers, settings.draftType);
    setAssignments(result);
    setStep(3);
  }

  // Save
  async function handleSave() {
    setSaving(true);
    setError("");

    const golferEntries = fieldText.split("\n").map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^(.+?)\s*\(#(\d+)\)$/);
      if (match) return { name: match[1].trim(), ranking: parseInt(match[2]) };
      return { name: trimmed, ranking: null };
    }).filter(Boolean) as { name: string; ranking: number | null }[];

    const dist =
      settings.purseType === "custom"
        ? customDist.split(",").map((n) => Number(n.trim()))
        : [];

    const finalSettings = { ...settings, purseDistribution: dist };

    const res = await fetch(`/api/pool/${slug}/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        poolName,
        players: players.filter((p) => p.name.trim()),
        golferEntries,
        buyIn,
        settings: finalSettings,
      }),
    });

    if (res.ok) {
      setSaved(true);
    } else {
      setError("Failed to save. Check your connection and try again.");
    }
    setSaving(false);
  }

  const validPlayers = players.filter((p) => p.name.trim());
  const golferCount = parseFieldEntries().length;

  // Saved state
  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-masters-gold/15 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-masters-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="font-serif text-2xl text-masters-green mb-2 font-bold">Pool is Live!</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs">
          Share the leaderboard link with your players. Scores can be entered as rounds are played.
        </p>
        <a href={"/pool/" + slug} className="btn-green inline-block">View Leaderboard</a>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-2">
        <h1 className="font-serif text-2xl font-bold text-masters-green">
          Chairman - Pool Set Up
        </h1>
      </div>

      {/* Step dots */}
      <StepDots current={step} total={STEPS.length} />

      <div className="card p-5">
        {/* -- Step 0: Pool Info -- */}
        {step === 0 && (
          <div>
            <h2 className="font-serif text-lg text-masters-green mb-5 font-bold">Pool Info</h2>

            <Section label="Pool Name">
              <input
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                className="input-field"
              />
            </Section>

            <Section label="Buy-in Per Player">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                <input
                  type="number"
                  min={1}
                  value={buyIn}
                  onChange={(e) => setBuyIn(Number(e.target.value))}
                  className="input-field pl-8"
                />
              </div>
            </Section>

            <Section label={`Players (${validPlayers.length})`}>
              <div className="space-y-2.5">
                {players.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <input
                      value={p.name}
                      onChange={(e) => updatePlayer(p.id, e.target.value)}
                      placeholder="Player name"
                      className="input-field flex-1"
                    />
                    {players.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePlayer(p.id)}
                        className="w-12 h-12 flex items-center justify-center text-gray-300 active:text-red-500 transition-colors rounded-xl"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPlayer}
                  className="w-full h-12 flex items-center justify-center gap-2 text-sm text-masters-green font-semibold
                    border-2 border-dashed border-masters-green/20 rounded-xl active:bg-masters-green/5 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Player
                </button>
              </div>

              {validPlayers.length > 0 && (
                <p className="text-xs text-gray-400 mt-3">
                  Total purse: <strong className="text-gray-600">${validPlayers.length * buyIn}</strong>
                </p>
              )}
            </Section>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={validPlayers.length < 2}
                className="btn-green disabled:opacity-40"
              >
                Next: Rules
              </button>
            </div>
          </div>
        )}

        {/* -- Step 1: Rules -- */}
        {step === 1 && (
          <div>
            <h2 className="font-serif text-lg text-masters-green mb-5 font-bold">Chairman Rules</h2>

            <Section label="Draft Type">
              <div className="space-y-2.5">
                <OptionCard
                  selected={settings.draftType === "random"}
                  onClick={() => set("draftType", "random")}
                  title="Auto Random"
                  description="Golfers are shuffled and dealt out randomly. Fully automated — no picking required."
                  badge="Quick & Easy"
                  info="All golfers in the field are randomly shuffled, then automatically dealt out evenly to each player. No one picks — the app handles everything instantly. Great for casual pools or when you don't want to coordinate a live draft."
                />
                <OptionCard
                  selected={settings.draftType === "snake"}
                  onClick={() => set("draftType", "snake")}
                  title="Live Snake Draft"
                  description="Players take turns picking golfers. Pick order reverses each round for fairness."
                  badge="Most Popular"
                  info="The chairman draws for pick order, then each player takes turns choosing a golfer. The order reverses each round (1-2-3-4, then 4-3-2-1, then 1-2-3-4...) so everyone gets a fair mix of early and late picks. The chairman enters each pick as players call them out. This is how most serious pools run their draft."
                />
              </div>
            </Section>

            <Section label="Missed Cut Rule">
              <div className="space-y-2.5">
                <OptionCard
                  selected={settings.missedCutRule === "penalty"}
                  onClick={() => set("missedCutRule", "penalty")}
                  title="Fixed Penalty"
                  description="Missed cut golfers receive a set score per remaining round."
                  badge="Recommended"
                  info="When a golfer misses the cut (eliminated after Round 2), they receive a fixed penalty score for each remaining round they don't play. For example, with a +5 penalty: if a golfer shot +3 through 2 rounds then missed the cut, they'd get +5 added for Round 3 and +5 for Round 4, making their total +13. This discourages picking longshots who might miss the cut."
                />
                <OptionCard
                  selected={settings.missedCutRule === "zero"}
                  onClick={() => set("missedCutRule", "zero")}
                  title="Zero Contribution"
                  description="Missed cut golfers stop counting. No penalty, no benefit."
                  info="If a golfer misses the cut, their score simply stops accumulating. They keep whatever score they had through the rounds they played, but add nothing for the remaining rounds. This is the most forgiving option — a missed cut doesn't actively hurt your team, it just means you lose that golfer's potential for weekend improvement."
                />
                <OptionCard
                  selected={settings.missedCutRule === "worst-made"}
                  onClick={() => set("missedCutRule", "worst-made")}
                  title="Worst Made Score"
                  description="Missed cut golfers receive the total of the worst golfer who made the cut."
                  info="Missed cut golfers are assigned the same total score as the worst-performing golfer who DID make the cut. This creates a realistic penalty — your missed-cut golfer essentially performs as badly as the worst weekend player. It's a middle ground between the harsh fixed penalty and the forgiving zero contribution."
                />
              </div>

              {settings.missedCutRule === "penalty" && (
                <div className="mt-4 flex items-center gap-3 bg-masters-cream/60 rounded-xl p-4">
                  <label className="text-sm text-gray-600 flex-shrink-0">Penalty per round:</label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-400 font-mono">+</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={settings.missedCutPenalty}
                      onChange={(e) => set("missedCutPenalty", Number(e.target.value))}
                      className="w-16 border-2 border-masters-cream-dark bg-white rounded-lg px-2 py-2 text-sm text-center font-mono focus:border-masters-green outline-none"
                    />
                  </div>
                  <span className="text-xs text-gray-400">(x2 rds = +{settings.missedCutPenalty * 2})</span>
                </div>
              )}
            </Section>

            <Section label="Scoring">
              <div className="space-y-2.5">
                <OptionCard
                  selected={settings.scoringType === "all"}
                  onClick={() => set("scoringType", "all")}
                  title="Count All Golfers"
                  description="Every golfer on your roster contributes to your total."
                  badge="Recommended"
                  info="Every golfer drafted to your team counts toward your total score. If you have 10 golfers, all 10 scores are added together. This rewards consistent drafting across your entire roster and makes every pick matter equally. It's the most common format for Masters pools."
                />
                <OptionCard
                  selected={settings.scoringType === "best-n"}
                  onClick={() => set("scoringType", "best-n")}
                  title="Best N Golfers"
                  description="Only your top N performers count. Reduces impact of one bad pick."
                  info="Only your best-performing golfers count toward your total. For example, if set to 'Best 3', only your 3 lowest-scoring golfers are counted — the rest are benched. This reduces the pain of one bad pick and rewards players who draft a few elite golfers rather than a deep balanced roster."
                />
              </div>

              {settings.scoringType === "best-n" && (
                <div className="mt-4 flex items-center gap-3 bg-masters-cream/60 rounded-xl p-4">
                  <label className="text-sm text-gray-600">Count best:</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.bestN}
                    onChange={(e) => set("bestN", Number(e.target.value))}
                    className="w-16 border-2 border-masters-cream-dark bg-white rounded-lg px-2 py-2 text-sm text-center font-mono focus:border-masters-green outline-none"
                  />
                  <span className="text-sm text-gray-400">golfers per player</span>
                </div>
              )}
            </Section>

            <Section label="Purse Distribution">
              <div className="space-y-2.5">
                {([
                  { value: "winner-take-all" as PurseType, title: "Winner Take All", desc: "First place takes 100%", info: "The entire prize pool goes to the player with the lowest total score. Simple, high-stakes, and the most exciting finish — but only one person walks away with money." },
                  { value: "70-30" as PurseType, title: "70 / 30", desc: "Split between top 2", info: "First place takes 70% of the total purse, second place takes 30%. This rewards the winner heavily while still giving the runner-up something to play for through the final round." },
                  { value: "60-30-10" as PurseType, title: "60 / 30 / 10", desc: "Split between top 3", info: "First place takes 60%, second takes 30%, third takes 10%. This keeps more players in contention deeper into the tournament and softens the all-or-nothing pressure." },
                  { value: "custom" as PurseType, title: "Custom", desc: "Set your own percentages", info: "Define your own payout structure. Enter comma-separated percentages that sum to 100. For example: 50,25,15,10 would pay the top 4 finishers. You can split it however you like." },
                ] as const).map(({ value, title, desc, info }) => (
                  <OptionCard
                    key={value}
                    selected={settings.purseType === value}
                    onClick={() => set("purseType", value)}
                    title={title}
                    description={desc}
                    info={info}
                  />
                ))}
              </div>

              {settings.purseType === "custom" && (
                <div className="mt-4 bg-masters-cream/60 rounded-xl p-4">
                  <label className="text-xs text-gray-500 block mb-2">
                    Comma-separated percentages summing to 100 (e.g. 50,30,20)
                  </label>
                  <input
                    value={customDist}
                    onChange={(e) => setCustomDist(e.target.value)}
                    placeholder="70,30"
                    className="input-field"
                  />
                </div>
              )}
            </Section>

            <Section label="Payout Method">
              <div className="space-y-2.5">
                <OptionCard
                  selected={(settings.payoutMethod || "honor-system") === "honor-system"}
                  onClick={() => set("payoutMethod", "honor-system")}
                  title="Honor System"
                  description="Players settle up directly with each other after the tournament."
                  badge="Default"
                  info="When the tournament ends, each player's card will show exactly who they owe and how much. Players handle payments directly — Venmo, cash, etc. The chairman doesn't need to collect or distribute anything."
                />
                <OptionCard
                  selected={settings.payoutMethod === "chairman-collects"}
                  onClick={() => set("payoutMethod", "chairman-collects")}
                  title="Chairman Collects"
                  description="The chairman collects all buy-ins upfront and distributes winnings."
                  info="The chairman collects the buy-in from each player before the tournament starts, then pays out the winners when it's over. Each player's card will show 'Pay the Chairman' instead of individual names."
                />
              </div>
            </Section>

            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(0)} className="text-sm text-gray-400 font-medium px-4 py-3">
                Back
              </button>
              {settings.draftType === "snake" ? (
                <button
                  type="button"
                  onClick={async () => {
                    setSaving(true);
                    setError("");
                    const golferEntries = parseFieldEntries();
                    const dist = settings.purseType === "custom"
                      ? customDist.split(",").map((n) => Number(n.trim())) : [];
                    const finalSettings = { ...settings, purseDistribution: dist };
                    const res = await fetch(`/api/pool/${slug}/setup`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        poolName,
                        players: players.filter((p) => p.name.trim()),
                        golferEntries,
                        buyIn,
                        settings: finalSettings,
                      }),
                    });
                    setSaving(false);
                    if (res.ok) {
                      router.push(`/pool/${slug}`);
                    } else {
                      setError("Failed to save. Try again.");
                    }
                  }}
                  disabled={saving}
                  className="btn-green disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Launch Live Draft"}
                </button>
              ) : (
                <button type="button" onClick={() => setStep(2)} className="btn-green">
                  Next: Field
                </button>
              )}
            </div>
          </div>
        )}

        {/* -- Step 2: Field -- */}
        {step === 2 && (
          <div>
            <h2 className="font-serif text-lg text-masters-green mb-1 font-bold">Golfer Field</h2>
            <p className="text-xs text-gray-500 mb-5">
              2026 Masters field — {golferCount} golfers sorted by world ranking.
            </p>

            <div className="rounded-xl border-2 border-masters-cream-dark bg-masters-cream/30 p-3 font-mono text-xs leading-relaxed overflow-y-auto" style={{ maxHeight: 320 }}>
              {parseFieldEntries().map((e, i) => (
                <div key={i} className="py-0.5 text-gray-700">
                  {e.ranking ? <span className="text-gray-400">#{e.ranking} </span> : null}{e.name}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 mt-2">
              {golferCount} golfers · {validPlayers.length} players
              {golferCount > 0 && validPlayers.length > 0
                ? (() => {
                    const perPlayer = Math.floor(golferCount / validPlayers.length);
                    const unused = golferCount % validPlayers.length;
                    return ` · ${perPlayer} golfers per player${unused > 0 ? ` (${unused} unused)` : ""}`;
                  })()
                : ""}
            </p>

            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => setStep(1)} className="text-sm text-gray-400 font-medium px-4 py-3">
                Back
              </button>
              {settings.draftType === "snake" ? (
                <button
                  type="button"
                  onClick={async () => {
                    setSaving(true);
                    setError("");
                    const golferEntries = parseFieldEntries();
                    const dist = settings.purseType === "custom"
                      ? customDist.split(",").map((n) => Number(n.trim())) : [];
                    const finalSettings = { ...settings, purseDistribution: dist };
                    const res = await fetch(`/api/pool/${slug}/setup`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        poolName,
                        players: players.filter((p) => p.name.trim()),
                        golferEntries,
                        buyIn,
                        settings: finalSettings,
                      }),
                    });
                    setSaving(false);
                    if (res.ok) {
                      router.push(`/pool/${slug}`);
                    } else {
                      setError("Failed to save. Try again.");
                    }
                  }}
                  disabled={golferCount < validPlayers.length || saving}
                  className="btn-green disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Next: Draft"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={runDraft}
                  disabled={golferCount < validPlayers.length}
                  className="btn-green disabled:opacity-40"
                >
                  Run Auto Draft
                </button>
              )}
            </div>
          </div>
        )}

        {/* -- Step 3: Draft Results -- */}
        {step === 3 && (
          <div>
            <h2 className="font-serif text-lg text-masters-green mb-1 font-bold">Draft Results</h2>
            <p className="text-xs text-gray-500 mb-5">
              {settings.draftType === "snake" ? "Snake draft" : "Random assignment"} complete.
            </p>

            <div className="space-y-4">
              {validPlayers.map((player) => {
                const myPicks = assignments
                  .filter((a) => a.playerId === player.id)
                  .sort((a, b) => a.pickNumber - b.pickNumber);
                const entries = parseFieldEntries();

                return (
                  <div key={player.id} className="bg-masters-cream/60 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-serif font-bold text-masters-green">{player.name}</span>
                      <span className="text-xs text-gray-400">{myPicks.length} picks</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {myPicks.map((a) => {
                        const idx = parseInt(a.golferId.replace("g", ""));
                        return (
                          <span
                            key={a.golferId}
                            className="inline-flex items-center text-xs bg-white border border-masters-cream-dark rounded-full px-3 py-1.5 font-medium"
                          >
                            <span className="text-gray-300 mr-1 text-[10px] font-mono">#{a.pickNumber}</span>
                            {entries[idx]?.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={() => { runDraft(); }}
                className="text-sm text-masters-green font-medium active:underline px-4 py-3"
              >
                Re-run Draft
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(2)} className="text-sm text-gray-400 font-medium px-4 py-3">
                  Back
                </button>
                <button type="button" onClick={() => setStep(4)} className="btn-green">
                  Review
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -- Step 4: Confirm -- */}
        {step === 4 && (
          <div>
            <h2 className="font-serif text-lg text-masters-green mb-5 font-bold">Confirm &amp; Launch</h2>

            <div className="space-y-0">
              {[
                { label: "Pool Name", value: poolName },
                { label: "Players", value: `${validPlayers.length} (${validPlayers.map(p => p.name).join(", ")})` },
                { label: "Buy-in", value: `$${buyIn}/player · $${validPlayers.length * buyIn} total` },
                { label: "Golfers", value: `${golferCount} in field` },
                {
                  label: "Draft",
                  value: settings.draftType === "snake" ? "Snake Draft" : "Pure Random",
                },
                {
                  label: "Missed Cut",
                  value:
                    settings.missedCutRule === "penalty"
                      ? `+${settings.missedCutPenalty}/round penalty (+${settings.missedCutPenalty * 2} total)`
                      : settings.missedCutRule === "zero"
                      ? "No contribution"
                      : "Worst made-cut score",
                },
                {
                  label: "Scoring",
                  value:
                    settings.scoringType === "all"
                      ? "All golfers count"
                      : `Best ${settings.bestN} count`,
                },
                {
                  label: "Purse",
                  value:
                    settings.purseType === "winner-take-all"
                      ? "Winner take all"
                      : settings.purseType === "70-30"
                      ? "70/30 split (top 2)"
                      : settings.purseType === "60-30-10"
                      ? "60/30/10 split (top 3)"
                      : `Custom: ${customDist}`,
                },
                {
                  label: "Payout",
                  value: settings.payoutMethod === "chairman-collects"
                    ? "Chairman collects"
                    : "Honor system",
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3 text-sm py-3 border-b border-masters-cream-dark last:border-0">
                  <span className="w-24 text-gray-400 flex-shrink-0 font-medium">{label}</span>
                  <span className="text-gray-800">{value}</span>
                </div>
              ))}
            </div>

            {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

            <div className="flex justify-between mt-6">
              <button type="button" onClick={() => setStep(3)} className="text-sm text-gray-400 font-medium px-4 py-3">
                Back
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-gold disabled:opacity-60"
              >
                {saving ? "Saving..." : "Launch Pool"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
