import { GameState, Artist, ArtistAttributes, Song, GameEvent, ChartEntry, Album, TourSize, ArtistTraits, IndustrySong, RivalLabel, AwardCeremony, AwardNominee, AwardCategory, LabelMilestone, MilestoneType } from "./types";
import { generateArtist, generateSongTitle, generateAlbumTitle, isProducerUnlocked, computeOverall, computePotential, computeDynamicPotential, STUDIO_DATA, SCOUTING_DATA, ARTIST_DEV_DATA, TOURING_DEPT_DATA, MARKETING_DATA, PR_DATA, MERCH_DATA, RIVAL_LABEL_TEMPLATES } from "./data";
import { processHipHopEvents, applyHipHopEventEffects, applyJailDecay, isArtistAvailable, getComebackViralBonus } from "./hiphopEvents";
import { featureChartBonus, featureLongevityBonus, applyFeatureReleaseEffects, generateIncomingFeatureRequests, simulateRivalFeatures, resetYearlyFeatureCounts, decayRelationships } from "./features";
import { checkAchievements, processHallOfFame, checkDynasty } from "./achievements";

// ── Helpers ──────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Diminishing returns for reputation gains ──────────────────────────────────
// At low rep, gains are full. Above 50, gains taper. Above 80, gains are heavily reduced.
// This prevents snowballing past mid-game and makes elite reputation feel earned.
function dimRep(currentRep: number, rawGain: number): number {
  if (rawGain <= 0) return rawGain;
  const mult = currentRep >= 90 ? 0.15
             : currentRep >= 80 ? 0.30
             : currentRep >= 70 ? 0.50
             : currentRep >= 60 ? 0.65
             : currentRep >= 50 ? 0.80
             : 1.0;
  return Math.max(rawGain > 0 ? 1 : 0, Math.round(rawGain * mult));
}

// ── Calendar helpers ──────────────────────────────────────────────────────────

export function getGameDate(startDate: string, turn: number): Date {
  const d = new Date(startDate);
  d.setDate(d.getDate() + (turn - 1) * 7);
  return d;
}

export function formatGameDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Free agent visibility ─────────────────────────────────────────────────────
// Returns ALL free agents with a `scouted` flag based on scouting level.
// Discovered artists are fully visible with all stats.
// Undiscovered artists are not shown at all.
// Scouting level controls how many of the 400 total are discovered.

export function getVisibleFreeAgents(state: GameState): Artist[] {
  const scouting = SCOUTING_DATA[state.scoutingLevel];
  const pool = state.freeAgentPool;
  const discoveredCount = Math.max(1, Math.round(pool.length * scouting.visibilityPct / 100));
  return pool.slice(0, discoveredCount).map((artist) => ({
    ...artist,
    scouted: true,
  }));
}

// ── Prospect tier for unscouted artists ──────────────────────────────────────
// Gives a rough talent grade without revealing exact OVR.
export function getProspectTier(artist: Artist): { label: string; color: string } {
  const ovr = artist.overallRating;
  if (ovr >= 80) return { label: "Elite Prospect", color: "text-yellow-400" };
  if (ovr >= 65) return { label: "High Prospect", color: "text-indigo-400" };
  if (ovr >= 50) return { label: "Mid Prospect", color: "text-zinc-300" };
  if (ovr >= 35) return { label: "Low Prospect", color: "text-zinc-500" };
  return { label: "Raw Prospect", color: "text-zinc-600" };
}

// Minimum willingness threshold — below this, artists won't even consider signing.
export const MIN_SIGNING_WILLINGNESS = 25;

// ── Artist willingness to sign ────────────────────────────────────────────────
// Models real-world dynamics: "Would [artist] take a meeting with [label]?"
//
// The fundamental question every unsigned artist asks:
// "Is this label good enough for me, or can I do better?"
//
// Real-world answers:
// - Raw 18yo nobody (28 OVR): "Someone wants to sign ME?! Yes!" (80-95%)
// - Local grinder (45 OVR): "A real label deal? I'm in." (60-80% at rep 30)
// - Decent talent (55 OVR): "They're small but it's a shot..." (35-50% at rep 30)
// - Rising star (67 OVR): "I can do better than this." (10-20% at rep 30)
// - Elite (80+ OVR): "LOL no." (0-5% at rep 30)
// - Dropped veteran (65 OVR, declining): "I need this." (60-80% at rep 30)
//
// Returns 0–100; higher = more likely to accept the player's offer.

export function computeWillingness(artist: Artist, labelReputation: number): number {
  const rep = clamp(labelReputation, 0, 100);
  const ovr = artist.overallRating;
  const pot = artist.potential;
  const momentum = artist.momentum ?? 10;
  const stage = artist.careerPhase ?? "unknown";
  const loyalty = artist.traits.loyalty ?? 50;

  // ── Artist expectation: what tier of label do they think they deserve? ──
  const artistExpectation = ovr * 0.5 + pot * 0.3 + momentum * 0.2;

  // ── Gap: how far below their expectation is this label? ──
  const gap = artistExpectation - rep;

  // ── Base willingness from gap ──
  let willingness: number;
  if (gap <= -30) {
    willingness = 90 + Math.floor(Math.random() * 8); // dream label
  } else if (gap <= -15) {
    willingness = 75 + Math.floor(Math.random() * 10); // clearly above
  } else if (gap <= 0) {
    willingness = 55 + Math.floor(-gap); // matches expectations
  } else if (gap <= 15) {
    willingness = 40 - Math.floor(gap * 1.5); // somewhat below
  } else if (gap <= 30) {
    willingness = 15 - Math.floor((gap - 15) * 0.7); // clearly below
  } else {
    willingness = Math.max(0, 5 - Math.floor((gap - 30) * 0.3)); // laughable
  }

  // ── Career stage desperation modifiers ──
  if (stage === "washed" || stage === "declining") willingness += 30;
  else if (stage === "legacy") willingness += 20;
  else if (stage === "unknown") willingness += 12; // grateful for any chance
  else if (stage === "emerging") willingness += 5;
  else if (stage === "buzzing") willingness += 0;
  else if (stage === "breakout") willingness -= 5;
  else if (stage === "established") willingness -= 15;
  else if (stage === "peak") willingness -= 25; // real leverage

  // ── Momentum: cold = available, hot = picky ──
  if (momentum <= 5) willingness += 25;
  else if (momentum <= 12) willingness += 15;
  else if (momentum <= 20) willingness += 8;
  else if (momentum >= 50) willingness -= 15;
  else if (momentum >= 35) willingness -= 5;

  // ── Personality (small swing) ──
  willingness += Math.floor((loyalty - 50) * 0.10); // -5 to +5

  // ── Hard floors: elite talent simply won't sign with nobodies ──
  const isDesperateStage = stage === "declining" || stage === "washed" || stage === "legacy";
  if (ovr >= 80 && rep < 40 && !isDesperateStage) {
    willingness = Math.min(willingness, 3);
  }
  if (ovr >= 70 && rep < 30 && stage !== "declining" && stage !== "washed") {
    willingness = Math.min(willingness, 8);
  }
  if (ovr >= 60 && rep < 20 && !isDesperateStage) {
    willingness = Math.min(willingness, 12);
  }

  return clamp(Math.round(willingness), 0, 100);
}

// ── Quality multiplier from upgrades ─────────────────────────────────────────

export function getQualityBonusFlat(state: GameState): number {
  return STUDIO_DATA[state.studioLevel].qualityBonusFlat;
}

export function getRevenueMult(state: GameState): number {
  return 1 + MARKETING_DATA[state.marketingLevel].revenuePct / 100;
}

// ── Record a song ─────────────────────────────────────────────────────────────

export const EP_MIN_TRACKS    = 5;   // 5–6 tracks = EP/Mixtape
export const ALBUM_MIN_TRACKS = 7;  // 7+ tracks = Album (was 10)
export const ALBUM_SHORT_MAX = 10;  // 7–10 tracks = Short
export const ALBUM_LONG_MIN  = 15;  // 15+  tracks = Long  (11–14 = Medium)

export interface AlbumStrategy {
  category: "Short" | "Medium" | "Long";
  qualityBonus: number;    // added to quality score
  repBonus: number;        // extra rep on release
  viralMult: number;       // multiplier on viral potential of all tracks
  fits: string[];          // trait alignment messages
  clashes: string[];       // trait mismatch warnings
}

// ── Artist development curve (post-album, age-based) (#32/#33) ───────────────

export function applyAlbumDevelopment(artist: Artist, artistDevLevel = 0): {
  overallRating: number;
  potential: number;
  attributes: ArtistAttributes;
  event: string;
} {
  const { age, overallRating, attributes } = artist;
  const potential = artist.potential;
  const dev = ARTIST_DEV_DATA[artistDevLevel];
  const momentum = artist.momentum ?? 50;
  const durability = artist.durability ?? "solid";
  const r = Math.random();
  let delta = 0;
  let event = "stagnation";

  // Growth/decline chances driven by age, momentum, and durability
  let growthChance: number;
  let stagnateChance: number;
  let declineChance: number;

  // OVR ceiling proximity: artists near their potential grow slower
  const ceilingProximity = overallRating >= potential - 5 ? 0.85 : overallRating >= potential - 15 ? 0.95 : 1.0;

  // Momentum-based decline protection: high momentum shields artists from decline
  // At momentum 80: -0.08 decline chance. At momentum 40: -0.04. At momentum 0: 0.
  const momentumProtection = (momentum / 100) * 0.10;

  if (age <= 25) {
    // Prime development years — strong growth, minimal decline
    growthChance = (0.65 + (momentum / 100) * 0.15 + dev.improveProbBonus) * ceilingProximity;
    declineChance = Math.max(0.02, 0.05 - momentumProtection - dev.regressReduction * 0.2);
    stagnateChance = 1 - growthChance - declineChance;
  } else if (age <= 29) {
    // Peak years — still growing but plateauing. High-momentum artists keep improving.
    growthChance = (0.40 + (momentum / 100) * 0.20 + dev.improveProbBonus) * ceilingProximity;
    declineChance = Math.max(0.02, 0.08 - momentumProtection - dev.regressReduction * 0.3);
    stagnateChance = 1 - growthChance - declineChance;
  } else if (age <= 33) {
    // Maintenance years — durability and momentum matter heavily
    growthChance = (0.18 + (momentum / 100) * 0.15 + dev.improveProbBonus * 0.5) * ceilingProximity;
    const durDeclineMod = durability === "flash" ? 0.10 : durability === "solid" ? 0.03 : 0.0;
    declineChance = Math.max(0.02, 0.15 + durDeclineMod - momentumProtection - dev.regressReduction * 0.3);
    stagnateChance = 1 - growthChance - declineChance;
  } else {
    // Late career — mostly declining, durability + momentum offer some protection
    growthChance = durability === "durable" ? 0.10 + dev.improveProbBonus * 0.3
                 : durability === "solid" ? 0.05
                 : 0.02;
    const agePenalty = Math.min(0.35, (age - 33) * (durability === "flash" ? 0.10 : durability === "solid" ? 0.05 : 0.025));
    declineChance = Math.max(0.02, Math.min(0.60, 0.28 + agePenalty - momentumProtection * 0.5 - dev.ageDeclineReduction));
    stagnateChance = 1 - growthChance - declineChance;
  }

  // Clamp and normalize
  growthChance = Math.max(0.02, Math.min(0.95, growthChance));
  declineChance = Math.max(0.02, Math.min(0.70, declineChance));
  stagnateChance = Math.max(0.05, Math.min(0.80, stagnateChance));
  const total = growthChance + stagnateChance + declineChance;
  growthChance /= total;
  stagnateChance /= total;
  // declineChance = 1 - growthChance - stagnateChance (implicit)

  // Per-album development is a small immediate boost/dip; yearly progression handles major changes
  if (r < growthChance) {
    event = "improvement";
    const maxGain = age <= 25 ? 5 : age <= 29 ? 3 : age <= 33 ? 2 : 1;
    delta = rand(1, maxGain);
  } else if (r < growthChance + stagnateChance) {
    delta = 0;
  } else {
    event = "decline";
    const maxLoss = age <= 29 ? 2 : age <= 33 ? 3 : durability === "flash" ? 4 : 3;
    delta = -rand(1, maxLoss);
  }

  if (delta === 0) return { overallRating, potential, attributes, event };

  const absDelta = Math.abs(delta);
  const attrCount = absDelta >= 10 ? 10 : absDelta >= 6 ? 7 : 5;
  const perAttr = Math.round(absDelta * 15 / attrCount);

  const keys = Object.keys(attributes) as (keyof ArtistAttributes)[];
  const updated = { ...attributes };
  const selected = [...keys].sort(() => Math.random() - 0.5).slice(0, attrCount);

  for (const k of selected) {
    const noise = Math.floor((Math.random() - 0.5) * 4);
    const attrDelta = Math.sign(delta) * (perAttr + noise);
    updated[k] = delta > 0
      ? Math.min(Math.min(potential + 5, 100), updated[k] + attrDelta)
      : Math.max(1, updated[k] + attrDelta);
  }

  let newOverall = computeOverall(updated);
  if (newOverall < 25) {
    const bump = 25 - newOverall;
    for (const k of keys) updated[k] = Math.min(100, updated[k] + bump);
    newOverall = computeOverall(updated);
  }

  // Potential should be stable — it represents the artist's ceiling, not a recalculated value.
  // Only reduce potential slightly if the artist is old and declining (prevents infinite growth).
  let newPotential = potential;
  if (age >= 30 && delta < 0) {
    // Slight ceiling erosion on decline: lose 1 potential point per decline event after 30
    newPotential = Math.max(newOverall, potential - 1);
  }
  // Potential should never be below current OVR
  newPotential = Math.max(newOverall, newPotential);

  return { overallRating: newOverall, potential: newPotential, attributes: updated, event };
}

// ── Yearly progression system ─────────────────────────────────────────────────
// Resolves at end of each in-game year (every 52 turns). Uses accumulated
// yearly stats (releases, chart weeks, tour weeks, controversies) plus
// age/archetype/durability to determine OVR change, potential update,
// and archetype transitions.

export interface YearlyProgressionResult {
  overallRating: number;
  potential: number;
  attributes: ArtistAttributes;
  archetype: Artist["archetype"];
  event: "improvement" | "stagnation" | "decline";
  delta: number;
}

export function applyYearlyProgression(
  artist: Artist,
  artistDevLevel: number,
): YearlyProgressionResult {
  const { age, overallRating, attributes, durability, momentum, archetype } = artist;
  const potential = artist.potential;
  const dev = ARTIST_DEV_DATA[artistDevLevel];
  const stage = artist.careerPhase ?? "unknown";

  // ── Yearly performance score: how productive/successful was this year? ──
  const releasesQuality = artist.yearlyReleasesQuality ?? [];
  const avgReleaseQuality = releasesQuality.length > 0
    ? releasesQuality.reduce((s, v) => s + v, 0) / releasesQuality.length
    : 0;
  const chartWeeks = artist.yearlyChartsWeeks ?? 0;
  const tourWeeks = artist.yearlyTourWeeks ?? 0;
  const controversies = artist.yearlyControversies ?? 0;

  // Performance score (0-100): weighted combination of yearly activity
  const releaseScore = Math.min(40, releasesQuality.length * 8 + avgReleaseQuality * 0.2);
  const chartScore = Math.min(25, chartWeeks * 2.5);
  const tourScore = Math.min(15, tourWeeks * 1.5);
  const controversyPenalty = controversies * 5;
  const performanceScore = clamp(Math.round(releaseScore + chartScore + tourScore - controversyPenalty), 0, 100);

  // ── Growth/decline probabilities ──
  let growthChance: number;
  let declineChance: number;

  const ceilingProximity = overallRating >= potential - 5 ? 0.80
    : overallRating >= potential - 15 ? 0.92 : 1.0;
  const momentumFactor = (momentum ?? 30) / 100;
  const momentumProtection = momentumFactor * 0.12;
  const perfBonus = performanceScore / 100 * 0.20; // up to +0.20 growth chance from good year

  // Inactive year penalty: no releases = higher decline chance
  const inactivePenalty = releasesQuality.length === 0 ? 0.15 : 0;

  if (age <= 25) {
    growthChance = (0.55 + momentumFactor * 0.15 + perfBonus + dev.improveProbBonus) * ceilingProximity;
    declineChance = Math.max(0.03, 0.06 + inactivePenalty - momentumProtection - dev.regressReduction * 0.2);
  } else if (age <= 29) {
    growthChance = (0.35 + momentumFactor * 0.18 + perfBonus + dev.improveProbBonus) * ceilingProximity;
    declineChance = Math.max(0.03, 0.10 + inactivePenalty - momentumProtection - dev.regressReduction * 0.3);
  } else if (age <= 33) {
    const durDeclineMod = durability === "flash" ? 0.12 : durability === "solid" ? 0.04 : 0.0;
    growthChance = (0.15 + momentumFactor * 0.12 + perfBonus * 0.7 + dev.improveProbBonus * 0.5) * ceilingProximity;
    declineChance = Math.max(0.03, 0.18 + durDeclineMod + inactivePenalty - momentumProtection - dev.regressReduction * 0.3);
  } else {
    growthChance = durability === "durable" ? 0.08 + perfBonus * 0.5 + dev.improveProbBonus * 0.3
                 : durability === "solid" ? 0.04 + perfBonus * 0.3
                 : 0.02;
    const agePenalty = Math.min(0.35, (age - 33) * (durability === "flash" ? 0.10 : durability === "solid" ? 0.05 : 0.025));
    declineChance = Math.max(0.03, Math.min(0.65, 0.30 + agePenalty + inactivePenalty - momentumProtection * 0.5 - dev.ageDeclineReduction));
  }

  // Clamp
  growthChance = clamp(growthChance, 0.02, 0.90);
  declineChance = clamp(declineChance, 0.03, 0.70);
  const stagnateChance = Math.max(0.05, 1 - growthChance - declineChance);
  const total = growthChance + stagnateChance + declineChance;
  growthChance /= total;
  const stagnateThreshold = growthChance + stagnateChance / total;

  // ── Roll ──
  const r = Math.random();
  let delta = 0;
  let event: "improvement" | "stagnation" | "decline" = "stagnation";

  if (r < growthChance) {
    event = "improvement";
    // Performance-scaled growth: great year = bigger jumps
    const perfMult = 0.6 + (performanceScore / 100) * 0.8; // 0.6 to 1.4
    const maxGain = age <= 25 ? 12 : age <= 29 ? 7 : age <= 33 ? 4 : 2;
    const baseGain = age <= 25
      ? (Math.random() < 0.7 ? rand(2, 5) : rand(4, Math.min(10, maxGain)))
      : rand(1, maxGain);
    delta = Math.max(1, Math.round(baseGain * perfMult));
    // Can't exceed potential
    delta = Math.min(delta, Math.max(0, potential - overallRating));
  } else if (r < stagnateThreshold) {
    delta = 0;
  } else {
    event = "decline";
    const maxLoss = age <= 29 ? 3 : age <= 33 ? 5 : durability === "flash" ? 8 : 5;
    delta = -rand(1, maxLoss);
  }

  // ── Apply attribute changes ──
  const updated = { ...attributes };
  if (delta !== 0) {
    const absDelta = Math.abs(delta);
    const attrCount = absDelta >= 10 ? 10 : absDelta >= 6 ? 7 : 5;
    const perAttr = Math.round(absDelta * 15 / attrCount);

    const keys = Object.keys(attributes) as (keyof ArtistAttributes)[];
    const selected = [...keys].sort(() => Math.random() - 0.5).slice(0, attrCount);

    for (const k of selected) {
      const noise = Math.floor((Math.random() - 0.5) * 4);
      const attrDelta = Math.sign(delta) * (perAttr + noise);
      updated[k] = delta > 0
        ? Math.min(Math.min(potential + 5, 100), updated[k] + attrDelta)
        : Math.max(1, updated[k] + attrDelta);
    }
  }

  let newOverall = computeOverall(updated);
  if (newOverall < 25) {
    const keys = Object.keys(updated) as (keyof ArtistAttributes)[];
    const bump = 25 - newOverall;
    for (const k of keys) updated[k] = Math.min(100, updated[k] + bump);
    newOverall = computeOverall(updated);
  }

  // ── Dynamic potential update ──
  const newPotential = computeDynamicPotential(
    newOverall, age, artist.peakOverall ?? newOverall, archetype, stage,
  );

  // ── Archetype transitions ──
  let newArchetype = archetype;

  // Raw young prospect → buzzing underground (gained momentum + improved)
  if (archetype === "raw_young_prospect" && momentum >= 25 && newOverall >= 45) {
    newArchetype = "buzzing_underground";
  }
  // Raw young prospect → viral wildcard (high buzz, volatile)
  if (archetype === "raw_young_prospect" && (artist.buzz ?? 0) >= 40 && momentum >= 35) {
    newArchetype = "viral_wildcard";
  }
  // Buzzing underground → polished midtier (matured, stable)
  if (archetype === "buzzing_underground" && age >= 24 && newOverall >= 55 && momentum >= 20 && momentum < 50) {
    newArchetype = "polished_midtier";
  }
  // Anyone young + elite → generational prospect (rare recognition)
  if (age <= 23 && newOverall >= 75 && potential >= 88 && archetype !== "generational_prospect") {
    if (Math.random() < 0.10) newArchetype = "generational_prospect";
  }
  // Aging into veteran
  if (age >= 30 && (archetype === "polished_midtier" || archetype === "buzzing_underground") && momentum < 25) {
    newArchetype = "aging_veteran";
  }
  // Stalling out
  if (momentum < 10 && (artist.turnsAtLowMomentum ?? 0) > 30 && archetype !== "stalled_washed" && archetype !== "aging_veteran") {
    newArchetype = "stalled_washed";
  }
  // Viral wildcard → buzzing underground (stabilized)
  if (archetype === "viral_wildcard" && age >= 24 && momentum >= 20 && momentum < 50 && newOverall >= 50) {
    newArchetype = "buzzing_underground";
  }

  return {
    overallRating: newOverall,
    potential: newPotential,
    attributes: updated,
    archetype: newArchetype,
    event,
    delta,
  };
}

// ── Album approval check (#45) ────────────────────────────────────────────────

export interface AlbumApproval {
  approved: boolean;          // false = artist resists (warning, morale hit)
  moralePenalty: number;      // 0 if approved; negative if not
  issues: string[];           // human-readable list of unmet expectations
  summary: string;
}

export function evaluateAlbumApproval(
  artist: Artist,
  confirmedSongs: Song[],
  strategy: AlbumStrategy
): AlbumApproval {
  const issues: string[] = [];
  let moralePenalty = 0;
  const trackCount = confirmedSongs.length;
  const avgQuality = trackCount > 0
    ? confirmedSongs.reduce((s, x) => s + x.quality, 0) / trackCount
    : 0;

  // Track count vs preferred length
  const preferred = artist.preferredAlbumLength;
  const trackDiff = Math.abs(trackCount - preferred);
  if (trackDiff > 4) {
    const dir = trackCount < preferred ? "too short" : "too long";
    issues.push(`${trackCount} tracks is ${dir} (prefers ~${preferred})`);
    moralePenalty -= Math.min(15, trackDiff * 2);
  }

  // Quality floor
  const minQ = artist.minSongQuality;
  const belowFloor = confirmedSongs.filter((s) => s.quality < minQ);
  if (minQ > 0 && belowFloor.length > 0) {
    issues.push(`${belowFloor.length} track(s) below quality standard (min ${minQ})`);
    moralePenalty -= Math.min(20, belowFloor.length * 5);
  }

  // Fame motivation: cares about single quality
  const { fameMotivation } = artist.traits;
  if (fameMotivation > 60) {
    const maxSingles = Math.max(1, Math.floor(trackCount / 4));
    const topSingles = [...confirmedSongs].sort((a, b) => b.quality - a.quality).slice(0, maxSingles);
    const singleThreshold = 50 + Math.floor((fameMotivation - 60) / 2); // 50–70
    const weakSingles = topSingles.filter((s) => s.quality < singleThreshold);
    if (weakSingles.length > 0) {
      issues.push(`${weakSingles.length} potential single(s) not strong enough to pop off (needs quality ${singleThreshold}+)`);
      moralePenalty -= Math.min(15, weakSingles.length * 5);
    }
  }

  // Combined personality interaction (#44)
  const { moneyMotivation, competitiveness } = artist.traits;
  if (moneyMotivation > 65 && competitiveness > 65 && trackCount < 14) {
    issues.push("Expects a long album with strong songs — needs more confirmed tracks");
    moralePenalty -= 10;
  }
  if (moneyMotivation < 35 && competitiveness < 35 && trackCount > 14) {
    issues.push("Not fussed about a big album — would actually prefer fewer, tighter tracks");
  }

  // Strategy fit bonus cancels some penalty
  if (strategy.fits.length > strategy.clashes.length) moralePenalty = Math.min(0, moralePenalty + 5);

  const approved = moralePenalty >= -10; // minor dissatisfaction is tolerable
  return {
    approved,
    moralePenalty,
    issues,
    summary: approved
      ? issues.length === 0 ? "Artist is satisfied with this album." : "Artist has minor reservations but will proceed."
      : "Artist is unhappy with this project and will resist releasing it.",
  };
}

export function computeAlbumStrategy(trackCount: number, traits: ArtistTraits): AlbumStrategy {
  const isEP    = trackCount < ALBUM_MIN_TRACKS;
  const isShort = !isEP && trackCount <= ALBUM_SHORT_MAX;
  const isLong  = trackCount >= ALBUM_LONG_MIN;

  let qualityBonus = 0;
  let repBonus = 0;
  let viralMult = 1.0;
  const fits: string[] = [];
  const clashes: string[] = [];

  if (isShort) {
    // Short albums: tighter = higher quality, better reputation
    qualityBonus += 5;
    repBonus += 2;
    if (traits.competitiveness > 60) {
      qualityBonus += 5;
      repBonus += 2;
      fits.push("Competitive artist thrives on quality-focused projects");
    }
    if (traits.moneyMotivation > 60) {
      clashes.push("Money-motivated artist prefers longer albums for more streams");
    }
    if (traits.workEthic > 70) {
      fits.push("Strong work ethic produces tight, polished tracks");
    }
  } else if (isLong) {
    // Long albums: more streams, higher viral spread, quality risk
    viralMult = 1.15;
    if (traits.moneyMotivation > 60) {
      viralMult = 1.22;
      fits.push("Money-motivated artist maximizes stream volume");
    }
    if (traits.workEthic >= 60) {
      fits.push("Strong work ethic sustains quality across a longer project");
    } else {
      qualityBonus -= 6;
      clashes.push("Low work ethic leads to burnout — quality suffers on long albums");
    }
    if (traits.competitiveness > 60) {
      qualityBonus -= 3;
      clashes.push("Competitive artist would rather perfect a shorter, sharper album");
    }
  } else {
    // Medium: balanced
    if (traits.competitiveness > 60 && traits.moneyMotivation > 60) {
      fits.push("Balanced traits suit a medium-length project");
    }
  }

  // Fame motivation: viral boost on any album length (artist hypes singles hard)
  if (traits.fameMotivation > 60) {
    viralMult = Math.max(viralMult, 1.12);
    fits.push("Fame-driven artist pushes every single hard");
  }

  return {
    category: isShort ? "Short" : isLong ? "Long" : "Medium",
    qualityBonus,
    repBonus,
    viralMult,
    fits,
    clashes,
  };
}

export function recordSong(
  state: GameState,
  artistId: string,
  producerId: string,
  standalone = false
): { newState: GameState; song: Song | null; error?: string } {
  const artist = state.artists.find((a) => a.id === artistId);
  const producer = state.producers.find((p) => p.id === producerId);

  if (!artist || !producer) return { newState: state, song: null, error: "Artist or producer not found." };
  if (!artist.signed) return { newState: state, song: null, error: "Artist is not signed." };
  if (artist.jailed) return { newState: state, song: null, error: "Artist is currently incarcerated." };
  if (!isProducerUnlocked(producer, state)) {
    const minLevel = ({ 0: 0, 1: 4, 2: 7, 3: 9 } as Record<number, number>)[producer.studioTierRequired] ?? 4;
    return { newState: state, song: null, error: `${producer.name} requires Studio Level ${minLevel}+.` };
  }
  if (state.money < producer.costPerSong) return { newState: state, song: null, error: "Not enough money." };
  if (artist.fatigue >= 90) return { newState: state, song: null, error: "Artist is too fatigued." };

  // Work ethic gates weekly recording productivity; tokens allow bonus sessions
  const weeklyLimit =
    artist.traits.workEthic >= 75 ? 3 :
    artist.traits.workEthic >= 50 ? 2 : 1;
  const recordedThisTurn = state.songs.filter(
    (s) => s.artistId === artistId && s.turnRecorded === state.turn
  ).length;
  const needsToken = recordedThisTurn >= weeklyLimit;
  if (needsToken && state.recordingTokens <= 0)
    return { newState: state, song: null, error: `${artist.name} can only record ${weeklyLimit} song(s) per week. Upgrade studio for bonus tokens.` };

  const studio = STUDIO_DATA[state.studioLevel];
  const genreBonus = artist.genre === producer.specialty ? 6 : 0;
  const studioBonus = studio.qualityBonusFlat;
  // Quality: artist skill × 0.42 + producer quality × 0.48 + genre match + studio flat bonus
  const variance = Math.round(10 * (1 - producer.consistency / 200)); // 10→5 as consistency 0→100
  const baseQuality = artist.overallRating * 0.42 + producer.quality * 0.48 + genreBonus + studioBonus;
  const quality = clamp(rand(Math.round(baseQuality) - variance, Math.round(baseQuality) + variance), 1, 100);
  // Viral potential: studio floor/ceil bonuses + hitmaking bias (reduced ceiling dependency on quality)
  const fansBonus = artist.fanbase > 100000 ? 10 : 0;
  const hmBonus = Math.round(producer.hitmaking / 10); // 0–10 extra on ceiling
  const viralPotential = clamp(
    rand(quality - 20 + studio.floorBonus, quality + 15 + studio.ceilBonus + hmBonus) + fansBonus,
    1,
    100
  );

  // Auto-assign to artist's in-progress album unless recording as standalone single
  const inProgressAlbum = standalone
    ? undefined
    : state.albums.find((al) => al.artistId === artistId && al.status === "recording");

  const songId = uid();
  const song: Song = {
    id: songId,
    title: generateSongTitle(),
    artistId,
    producerId,
    genre: artist.genre,
    quality,
    viralPotential,
    chartPosition: null,
    streamsTotal: 0,
    released: false,
    turnRecorded: state.turn,
    turnReleased: 0,
    weeksOnChart: 0,
    revenue: 0,
    albumId: inProgressAlbum?.id,
    albumStatus: inProgressAlbum ? "maybe" : undefined,
    wasStandalone: !inProgressAlbum,  // true when recorded without an active album
  };

  const updatedAlbums = inProgressAlbum
    ? state.albums.map((al) =>
        al.id === inProgressAlbum.id
          ? { ...al, songIds: [...al.songIds, songId] }
          : al
      )
    : state.albums;

  // Fatigue per song: workEthic reduces it; higher studio levels add recovery infrastructure
  const workEthicFactor = 1 - (artist.traits.workEthic / 250);
  // Studio fatigue mult: stages 7–10 provide meaningful reduction
  const studioFatigueMult = state.studioLevel >= 9 ? 0.6 : state.studioLevel >= 7 ? 0.75 : state.studioLevel >= 5 ? 0.9 : 1.0;
  const fatigueGain = clamp(Math.floor(rand(4, 8) * workEthicFactor * studioFatigueMult), 2, 8);

  const updatedArtists = state.artists.map((a) =>
    a.id === artistId ? { ...a, fatigue: clamp(a.fatigue + fatigueGain, 0, 100) } : a
  );

  return {
    newState: {
      ...state,
      money: state.money - producer.costPerSong,
      recordingTokens: needsToken ? state.recordingTokens - 1 : state.recordingTokens,
      artists: updatedArtists,
      songs: [...state.songs, song],
      albums: updatedAlbums,
    },
    song,
  };
}

// ── Release a song ────────────────────────────────────────────────────────────

export function preReleaseSingleCheck(
  state: GameState,
  songId: string
): string | null {
  const song = state.songs.find((s) => s.id === songId);
  if (!song || !song.albumId) return null; // standalone, no cap
  const album = state.albums.find((al) => al.id === song.albumId && al.status === "recording");
  if (!album) return null;

  const confirmedCount = album.songIds.length; // total tracks planned
  const maxSingles = Math.floor(confirmedCount / 4);
  const alreadyReleased = state.songs.filter(
    (s) => s.albumId === album.id && s.released
  ).length;
  if (alreadyReleased >= maxSingles && maxSingles > 0) {
    return `Pre-release single cap reached (${alreadyReleased}/${maxSingles} for a ${confirmedCount}-track album). Remove the song from the album first to release it as a standalone.`;
  }
  return null;
}

export function releaseSong(state: GameState, songId: string): GameState {
  const song = state.songs.find((s) => s.id === songId);
  if (!song || song.released) return state;

  // Standalone singles (not part of an album) grant a small chance of minor attribute growth
  // so that artists who work singles-first don't have permanently frozen development
  let updatedArtists = state.artists;
  if (!song.albumId) {
    const artist = state.artists.find((a) => a.id === song.artistId);
    if (artist && artist.age <= 30 && Math.random() < 0.15) {
      const pot = computePotential(artist.overallRating, artist.age);
      const keys = Object.keys(artist.attributes) as (keyof ArtistAttributes)[];
      const selected = [...keys].sort(() => Math.random() - 0.5).slice(0, 2);
      const updated = { ...artist.attributes };
      for (const k of selected) {
        updated[k] = Math.min(Math.min(pot + 5, 100), updated[k] + 1);
      }
      const newOvr = computeOverall(updated);
      updatedArtists = state.artists.map((a) =>
        a.id === artist.id
          ? { ...a, attributes: updated, overallRating: newOvr, potential: computePotential(newOvr, a.age), minSongQuality: Math.floor(newOvr * (0.50 + a.traits.competitiveness / 200)) }
          : a
      );
    }
  }

  // Track single release + momentum/buzz boost
  const releaseArtist = updatedArtists.find((a) => a.id === song.artistId);
  if (releaseArtist && !song.albumId) {
    // Quality-scaled momentum/buzz: good songs boost more, bad songs can hurt
    const momBoost = song.quality >= 60 ? rand(3, 6) : song.quality >= 40 ? rand(1, 3) : rand(-2, 1);
    const buzzBoost = song.quality >= 60 ? rand(4, 8) : song.quality >= 40 ? rand(2, 4) : rand(0, 2);
    updatedArtists = updatedArtists.map((a) =>
      a.id === releaseArtist.id
        ? {
            ...a,
            totalSinglesReleased: (a.totalSinglesReleased ?? 0) + 1,
            momentum: clamp((a.momentum ?? 50) + momBoost, 0, 100),
            buzz: clamp((a.buzz ?? 30) + buzzBoost, 0, 100),
            yearlyReleasesQuality: [...(a.yearlyReleasesQuality ?? []), song.quality],
          }
        : a
    );
  }

  // Credibility check: releasing low-quality songs hurts label reputation
  // Flooding the market with junk should have consequences
  let repDelta = 0;
  if (song.quality < 25) repDelta = -rand(1, 2);     // terrible release hurts rep
  else if (song.quality < 35) repDelta = -rand(0, 1); // mediocre release can ding rep

  // Apply "First Day Out" comeback bonus to viral potential
  const comebackBonus = releaseArtist ? getComebackViralBonus(releaseArtist) : 0;
  let finalSongs = state.songs.map((s) =>
    s.id === songId
      ? { ...s, released: true, turnReleased: state.turn, viralPotential: clamp(s.viralPotential + comebackBonus, 0, 100), albumEligible: !s.albumId } // released standalone singles are album-eligible
      : s
  );

  // Consume comeback bonus
  if (comebackBonus > 0 && releaseArtist) {
    updatedArtists = updatedArtists.map((a) =>
      a.id === releaseArtist.id ? { ...a, comebackBonusTurns: 0 } : a
    );
  }

  // Apply feature release effects (fan crossover, buzz, relationship)
  const releasedSong = finalSongs.find((s) => s.id === songId);
  let updatedRelationships = state.artistRelationships ?? [];
  if (releasedSong?.featuredArtistId) {
    const featureEffects = applyFeatureReleaseEffects(
      { ...state, artists: updatedArtists, artistRelationships: updatedRelationships },
      releasedSong
    );
    updatedArtists = featureEffects.artists;
    updatedRelationships = featureEffects.relationships;
  }

  return {
    ...state,
    reputation: clamp(state.reputation + repDelta, 0, 100),
    artists: updatedArtists,
    songs: finalSongs,
    artistRelationships: updatedRelationships,
  };
}

// ── Chart logic ───────────────────────────────────────────────────────────────

// Phased decay: full strength 0-6, gradual 7-16 (-3%/turn), steep 17+ (-7%/turn)
function chartDecay(age: number): number {
  if (age <= 6) return 1.0;
  if (age <= 16) return Math.max(0, 1.0 - (age - 6) * 0.03);
  return Math.max(0, 0.70 - (age - 16) * 0.07);
}

// Quality penalty: weak songs are punished on charts
function chartQualityPenalty(quality: number): number {
  if (quality >= 50) return 1.0;
  if (quality >= 35) return 0.7;
  return 0.4;
}

// Quality floor for stream generation
function streamQualityFloor(quality: number): number {
  if (quality >= 60) return 1.0;
  if (quality >= 45) return 0.6;
  if (quality >= 30) return 0.3;
  return 0.1;
}

function buildChart(state: GameState): ChartEntry[] {
  type ScoredEntry = { entry: ChartEntry; score: number };
  const entries: ScoredEntry[] = [];

  // Player songs
  for (const s of state.songs.filter((s) => s.released)) {
    const artist = state.artists.find((a) => a.id === s.artistId);
    const age = state.turn - s.turnReleased;
    const decayFactor = chartDecay(age);
    if (decayFactor <= 0) continue;

    const featBonus = featureChartBonus(s, state);
    const baseScore = s.viralPotential * 0.30
      + s.quality * 0.25
      + (artist?.momentum ?? 0) * 0.20
      + (artist?.popularity ?? 0) * 0.15
      + (artist?.buzz ?? 0) * 0.10
      + featBonus;

    const qualPenalty = chartQualityPenalty(s.quality);

    // Release saturation: flooding the market cannibalizes your own chart performance
    const recentReleases = state.songs.filter((rs) => rs.released && state.turn - rs.turnReleased <= 4 && rs.id !== s.id).length;
    const releaseSatPenalty = recentReleases <= 1 ? 1.0 : recentReleases <= 3 ? 0.85 : recentReleases <= 5 ? 0.7 : 0.55;

    // Freshness: newer songs get a boost, capped at 25% of base
    const recency = Math.max(0, 12 - age);
    const freshnessBonus = Math.min(recency * 1.0, baseScore * 0.25);

    // Bidirectional randomness for natural chart movement
    const chartRandomness = (Math.random() - 0.5) * 10; // -5 to +5

    const longevityMod = 1 + featureLongevityBonus(s);
    const score = (baseScore + freshnessBonus + chartRandomness) * decayFactor * longevityMod * qualPenalty * releaseSatPenalty;

    // Streams: balanced across viral discovery, fanbase, and quality retention
    const qualFloor = streamQualityFloor(s.quality);
    const streams = Math.floor(
      (s.viralPotential * 3000 + (artist?.fanbase ?? 0) * 0.35 + s.quality * 800) * qualFloor * (0.9 + Math.random() * 0.35)
    );

    entries.push({
      score,
      entry: {
        position: 0,
        songId: s.id,
        title: s.title,
        artistName: artist?.name ?? "Unknown",
        labelName: state.labelName,
        weeksOnChart: s.weeksOnChart + 1,
        streams,
        isPlayerSong: true,
        genre: s.genre,
        featuredArtistName: s.featuredArtistName,
      },
    });
  }

  // Industry songs (rival labels) — same formula as player songs using stored artist stats
  for (const song of state.industrySongs) {
    const age = state.turn - song.turnReleased;
    const decayFactor = chartDecay(age);
    if (decayFactor <= 0) continue;

    const artMom = song.artistMomentum ?? 30;
    const artPop = song.artistPopularity ?? 30;
    const artBuzz = song.artistBuzz ?? 20;
    const artFanbase = song.artistFanbase ?? 40000;

    const baseScore = song.viralPotential * 0.30
      + song.quality * 0.25
      + artMom * 0.20
      + artPop * 0.15
      + artBuzz * 0.10;

    const recency = Math.max(0, 12 - age);
    const freshnessBonus = Math.min(recency * 1.0, baseScore * 0.25);
    const chartRandomness = (Math.random() - 0.5) * 10;

    const score = (baseScore + freshnessBonus + chartRandomness) * decayFactor * chartQualityPenalty(song.quality);

    const qualFloor = streamQualityFloor(song.quality);
    const streams = Math.floor(
      (song.viralPotential * 3000 + artFanbase * 0.35 + song.quality * 800) * qualFloor * (0.9 + Math.random() * 0.35)
    );

    entries.push({
      score,
      entry: {
        position: 0,
        songId: "",
        title: song.title,
        artistName: song.artistName,
        labelName: song.labelName,
        weeksOnChart: song.weeksOnChart + 1,
        streams,
        isPlayerSong: false,
        genre: song.genre,
        featuredArtistName: song.featuredArtistName,
      },
    });
  }

  entries.sort((a, b) => b.score - a.score);

  return entries.slice(0, 20).map((e, i) => ({ ...e.entry, position: i + 1 }));
}

// ── Events ────────────────────────────────────────────────────────────────────

function generateEvents(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  const pr = PR_DATA[state.prLevel];

  for (const artist of state.artists.filter((a) => a.signed && !a.jailed)) {
    // Reputation spiral: low label rep increases scandal frequency and reduces viral luck
    const repSpiralMult = state.reputation < 20 ? 1.5 : 1.0;
    const viralChance = state.reputation < 20 ? 0.03 : 0.06;

    // Scandal — PR reduces both frequency and damage; severity scales with artist popularity
    // Early-game protection: new labels (first 20 turns) have reduced scandal impact — nobody knows you yet
    // Reduced by 40% since the hip-hop event system now handles tiered controversies
    const earlyGameShield = state.turn <= 20 ? 0.4 : state.turn <= 40 ? 0.7 : 1.0;
    const scandalChance = artist.traits.controversyRisk * 0.06 * (1 - pr.scandalFreqReduction) * repSpiralMult * earlyGameShield;
    if (Math.random() * 100 < scandalChance) {
      // Higher-profile artists create bigger scandals — a nobody's drama barely registers
      const popScale = 0.5 + (artist.popularity / 100) * 1.5; // 0.5x at pop 0, 2.0x at pop 100
      const rawDmg = Math.round(rand(3, 10) * popScale * earlyGameShield);
      const dmg = Math.max(1, Math.round(rawDmg * (1 - pr.scandalDamageReduction)));
      const fanLoss = Math.round(rand(500, 2000) * popScale + artist.fanbase * 0.005); // also scale with fanbase
      events.push({
        id: uid(),
        turn: state.turn,
        type: "scandal",
        title: `${artist.name} Scandal`,
        description: `${artist.name} caused controversy online. Reputation hit.`,
        artistId: artist.id,
        moneyDelta: -dmg * 300,
        reputationDelta: -dmg,
        fanbaseDelta: -fanLoss,
        popularityDelta: -rand(2, Math.round(4 + artist.popularity * 0.06)),
        resolved: true,
      });
    }

    // Viral moment — scales with existing fanbase so big artists benefit more
    if (Math.random() < viralChance) {
      const viralFans = clamp(Math.floor(artist.fanbase * rand(1, 5) / 100), 500, 25000);
      events.push({
        id: uid(),
        turn: state.turn,
        type: "viral_moment",
        title: `${artist.name} Goes Viral`,
        description: `${artist.name} had a viral moment this week!`,
        artistId: artist.id,
        moneyDelta: rand(500, 2000),
        reputationDelta: rand(1, 5),
        fanbaseDelta: viralFans,
        popularityDelta: rand(2, 6),
        resolved: true,
      });
    }

    // Award nomination
    if (artist.popularity > 60 && Math.random() < 0.08) {
      events.push({
        id: uid(),
        turn: state.turn,
        type: "award_nomination",
        title: `${artist.name} Nominated!`,
        description: `${artist.name} received an award nomination.`,
        artistId: artist.id,
        moneyDelta: 5000,
        reputationDelta: rand(5, 15),
        fanbaseDelta: rand(2000, 8000),
        popularityDelta: rand(5, 12),
        resolved: true,
      });
    }

    // Burnout
    if (artist.fatigue > 75 && Math.random() < 0.15) {
      events.push({
        id: uid(),
        turn: state.turn,
        type: "burnout",
        title: `${artist.name} Needs a Break`,
        description: `${artist.name} is burned out and less productive.`,
        artistId: artist.id,
        moneyDelta: 0,
        reputationDelta: -rand(0, 2),
        fanbaseDelta: -rand(200, 1000),
        popularityDelta: -rand(1, 5),
        resolved: true,
      });
    }
  }

  // Chart surge (random)
  const releasedSongs = state.songs.filter((s) => s.released);
  if (releasedSongs.length > 0 && Math.random() < 0.1) {
    const song = releasedSongs[Math.floor(Math.random() * releasedSongs.length)];
    const artist = state.artists.find((a) => a.id === song.artistId);
    events.push({
      id: uid(),
      turn: state.turn,
      type: "chart_surge",
      title: `"${song.title}" Chart Surge`,
      description: `"${song.title}" by ${artist?.name} is surging on the charts!`,
      artistId: song.artistId,
      moneyDelta: rand(3000, 12000),
      reputationDelta: rand(3, 10),
      fanbaseDelta: rand(1000, 8000),
      resolved: true,
    });
  }

  return events;
}

// ── Tour ──────────────────────────────────────────────────────────────────────

export const TOUR_DATA: Record<TourSize, {
  weeks: number;
  label: string;
  revPerWeek: number;
  fanPerWeek: number;
  fatiguePerWeek: number;
  reputationGain: number;
  requiresHQ: boolean;
  cooldown: number; // turns before this tier (or higher) can be booked again; 0 = none
  bookingCost: number; // flat upfront fee deducted when tour is booked
}> = {
  club_tour: {
    weeks: 4,
    label: "Club Tour",
    revPerWeek: 6000,
    fanPerWeek: 800,
    fatiguePerWeek: 3,   // total: +12
    reputationGain: 3,
    requiresHQ: false,
    cooldown: 4,
    bookingCost: 1500,
  },
  regional_tour: {
    weeks: 6,
    label: "Regional Tour",
    revPerWeek: 18000,
    fanPerWeek: 2500,
    fatiguePerWeek: 4,   // total: +24
    reputationGain: 5,
    requiresHQ: false,
    cooldown: 6,
    bookingCost: 8000,
  },
  national_tour: {
    weeks: 10,
    label: "National Tour",
    revPerWeek: 40000,
    fanPerWeek: 5000,
    fatiguePerWeek: 5,   // total: +50
    reputationGain: 8,
    requiresHQ: false,
    cooldown: 14,
    bookingCost: 25000,
  },
  major_tour: {
    weeks: 16,
    label: "Major Tour",
    revPerWeek: 80000,
    fanPerWeek: 9000,
    fatiguePerWeek: 4,   // total: +64
    reputationGain: 12,
    requiresHQ: true,
    cooldown: 20,
    bookingCost: 60000,
  },
  world_tour: {
    weeks: 22,
    label: "World Tour",
    revPerWeek: 150000,
    fanPerWeek: 15000,
    fatiguePerWeek: 3,   // total: +66
    reputationGain: 16,
    requiresHQ: true,
    cooldown: 22,
    bookingCost: 150000,
  },
};

export function getTourEstimates(artist: Artist, tourType: TourSize) {
  const t = TOUR_DATA[tourType];
  const popMult = 0.5 + artist.popularity / 100;
  const totalRevenue = Math.floor(t.revPerWeek * t.weeks * popMult);
  return {
    totalRevenue,
    totalFanGain: Math.floor(t.fanPerWeek * t.weeks * popMult),
    totalFatigue: t.fatiguePerWeek * t.weeks,
    reputationGain: t.reputationGain,
    weeks: t.weeks,
    bookingCost: t.bookingCost,
    netRevenue: totalRevenue - t.bookingCost,
  };
}

export function sendOnTour(
  state: GameState,
  artistId: string,
  tourType: TourSize
): { newState: GameState; error?: string } {
  const artist = state.artists.find((a) => a.id === artistId);
  if (!artist || !artist.signed) return { newState: state, error: "Artist not found or not signed." };
  if (artist.jailed) return { newState: state, error: "Artist is currently incarcerated." };
  if (artist.legalState?.stage === "charges_filed") return { newState: state, error: "Artist has pending charges and cannot tour." };
  if (artist.onTour) return { newState: state, error: "Artist is already on tour." };
  if (artist.fatigue > 75) return { newState: state, error: "Artist is too fatigued to tour." };

  const t = TOUR_DATA[tourType];
  if (t.requiresHQ && state.studioLevel < 7)
    return { newState: state, error: `Need Studio Level 7+ to book a ${t.label}.` };

  // National/Major/World tours have a cooldown tracked via lastMajorTourTurn
  if (t.cooldown > 0 && artist.lastMajorTourTurn > 0) {
    const turnsSince = state.turn - artist.lastMajorTourTurn;
    if (turnsSince < t.cooldown)
      return { newState: state, error: `${t.label} on cooldown for ${t.cooldown - turnsSince} more weeks.` };
  }

  if (t.bookingCost > 0 && state.money < t.bookingCost)
    return { newState: state, error: `Need $${t.bookingCost.toLocaleString()} upfront to book a ${t.label}.` };

  return {
    newState: {
      ...state,
      money: state.money - t.bookingCost,
      // Tour rep gain scales with artist popularity; diminishing returns at high rep
      reputation: clamp(state.reputation + dimRep(state.reputation, Math.floor(t.reputationGain * 0.35) + Math.floor(artist.popularity / 100)), 0, 100),
      artists: state.artists.map((a) =>
        a.id === artistId
          ? {
              ...a,
              onTour: true,
              tourTurnsLeft: t.weeks,
              tourType,
              lastMajorTourTurn: t.cooldown > 0 ? state.turn : a.lastMajorTourTurn,
            }
          : a
      ),
    },
  };
}

// ── Industry: simulate rival label releases ────────────────────────────────────

// Prestige-driven producer quality range: higher prestige = access to better producers
function rivalProducerQuality(prestige: number): number {
  // Base range: prestige 50 → ~35-65, prestige 80 → ~55-90
  const floor = Math.floor(prestige * 0.5 + 10);
  const ceil = Math.floor(prestige * 0.7 + 30);
  return clamp(rand(floor, ceil), 20, 95);
}

// Prestige-driven simulated studio bonus (rivals don't have literal studio levels)
function rivalStudioBonus(prestige: number): number {
  if (prestige >= 75) return rand(3, 5);
  if (prestige >= 55) return rand(1, 3);
  return rand(0, 1);
}

function simulateRivalReleases(state: GameState): { songs: IndustrySong[]; labels: RivalLabel[] } {
  const songs = [...state.industrySongs];
  const templates = RIVAL_LABEL_TEMPLATES;
  const labels = state.rivalLabels.map((l) => ({ ...l }));

  for (const label of labels) {
    const template = templates.find((t) => t.name === label.name);
    if (!template) continue;

    // ── Release chance: activity-based with strategy modifier ──
    const strategy = label.releaseStrategy ?? "balanced";
    const stratMod = strategy === "aggressive" ? 1.15 : strategy === "selective" ? 0.80 : 1.0;
    const releaseChance = (label.activityLevel / 200) * stratMod;
    if (Math.random() > releaseChance) continue;

    // ── Pick artist from roster ──
    const rosterArtist = label.rosterArtists.length > 0
      ? label.rosterArtists[Math.floor(Math.random() * label.rosterArtists.length)]
      : null;
    const artistName = rosterArtist?.name
      ?? template.artistNames[Math.floor(Math.random() * template.artistNames.length)];

    // ── Song quality: same formula as player (artist OVR + producer quality + genre + studio) ──
    const artOvr = rosterArtist?.overallRating ?? rand(35, 55);
    // Early-game nerf: reduce effective prestige for producer access in first 20 turns
    const effectivePrestige = state.turn <= 20 ? label.prestige - 20 : label.prestige;
    const prodQuality = rivalProducerQuality(effectivePrestige);
    const genreBonus = (rosterArtist?.genre ?? label.primaryGenre) === label.primaryGenre ? 6 : 0;
    const studioBonus = rivalStudioBonus(effectivePrestige);
    // Selective labels get a small quality bonus (more time on each release)
    const selectiveBonus = strategy === "selective" ? 3 : 0;
    // Producer consistency: prestige correlates with more consistent producers
    const prodConsistency = clamp(rand(effectivePrestige - 20, effectivePrestige + 10), 10, 90);
    const variance = Math.round(10 * (1 - prodConsistency / 200));

    const baseQuality = artOvr * 0.42 + prodQuality * 0.48 + genreBonus + studioBonus + selectiveBonus;
    const quality = clamp(rand(Math.round(baseQuality) - variance, Math.round(baseQuality) + variance), 1, 100);

    // ── Viral potential ──
    const artBuzz = rosterArtist?.buzz ?? rand(10, 30 + Math.floor(label.prestige * 0.3));
    const artMom = rosterArtist?.momentum ?? rand(15, 40 + Math.floor(label.prestige * 0.4));
    const artPop = rosterArtist?.popularity ?? rand(20, 50 + Math.floor(label.prestige * 0.3));
    const artFanbase = rosterArtist?.fanbase ?? rand(10000, 50000 + label.prestige * 1000);

    const hmBonus = Math.round(prodQuality / 15); // simulated hitmaking from producer quality
    let viralPotential = clamp(
      rand(quality - 20 + rivalStudioBonus(label.prestige), quality + 15 + hmBonus),
      1, 100
    );

    // ── Breakout hits: trait-driven instead of flat 5% ──
    // Base 2% + buzz/momentum/fanbase contribution
    const buzzFactor = (artBuzz / 100) * 0.04;     // +0 to +4%
    const momFactor = (artMom / 100) * 0.03;        // +0 to +3%
    const fanFactor = Math.min(0.02, artFanbase / 5000000); // +0 to +2%
    const hmFactor = (prodQuality / 100) * 0.02;    // +0 to +2%
    const breakoutChance = 0.02 + buzzFactor + momFactor + fanFactor + hmFactor;
    if (Math.random() < breakoutChance) {
      viralPotential = clamp(viralPotential + rand(15, 35), 1, 100);
    }

    const newSong: IndustrySong = {
      id: uid(),
      title: generateSongTitle(),
      artistName,
      labelId: label.id,
      labelName: label.name,
      genre: label.primaryGenre,
      quality,
      viralPotential,
      turnReleased: state.turn,
      weeksOnChart: 0,
      streamsTotal: 0,
      artistPopularity: artPop,
      artistMomentum: artMom,
      artistBuzz: artBuzz,
      artistFanbase: artFanbase,
    };
    songs.push(newSong);
    label.totalSongsReleased += 1;
  }

  // Age out songs older than 35 turns, cap total at 60
  const active = songs.filter((s) => state.turn - s.turnReleased <= 35);
  return { songs: active.slice(-60), labels };
}

// ── Pre-populate industry history (6-12 months of rival activity) ─────────────

export function generateIndustryHistory(state: GameState): { industrySongs: IndustrySong[]; rivalLabels: RivalLabel[]; chart: ChartEntry[] } {
  const songs: IndustrySong[] = [];
  const labels = state.rivalLabels.map((l) => ({ ...l }));
  const templates = RIVAL_LABEL_TEMPLATES;
  // Simulate 26-48 turns of past activity (6-12 months)
  const historyTurns = rand(26, 48);

  for (let pastTurn = -historyTurns; pastTurn < 0; pastTurn++) {
    // Map negative turns to positive offsets from turn 1
    // A song released at pastTurn=-5 is treated as turnReleased = 1 - 5 = -4
    // This means at turn 1, its age = 1 - (-4) = 5 weeks — recent enough to chart
    const simulatedTurn = pastTurn;

    for (const label of labels) {
      const template = templates.find((t) => t.name === label.name);
      if (!template) continue;

      const releaseChance = label.activityLevel / 200;
      if (Math.random() > releaseChance) continue;

      const rosterArtist = label.rosterArtists.length > 0
        ? label.rosterArtists[Math.floor(Math.random() * label.rosterArtists.length)]
        : null;
      const artistName = rosterArtist?.name
        ?? template.artistNames[Math.floor(Math.random() * template.artistNames.length)];

      // Same artist+producer quality formula as live releases
      const artOvr = rosterArtist?.overallRating ?? rand(35, 55);
      const prodQuality = rivalProducerQuality(label.prestige);
      const genreBonus = (rosterArtist?.genre ?? label.primaryGenre) === label.primaryGenre ? 6 : 0;
      const studioBonus = rivalStudioBonus(label.prestige);
      const prodConsistency = clamp(rand(label.prestige - 20, label.prestige + 10), 10, 90);
      const variance = Math.round(10 * (1 - prodConsistency / 200));
      const baseQuality = artOvr * 0.42 + prodQuality * 0.48 + genreBonus + studioBonus;
      const quality = clamp(rand(Math.round(baseQuality) - variance, Math.round(baseQuality) + variance), 1, 100);

      const hmBonus = Math.round(prodQuality / 15);
      const viralPotential = clamp(rand(quality - 20 + rivalStudioBonus(label.prestige), quality + 15 + hmBonus), 1, 100);

      const artPop = rosterArtist?.popularity ?? rand(20, 50 + Math.floor(label.prestige * 0.3));
      const artMom = rosterArtist?.momentum ?? rand(15, 40 + Math.floor(label.prestige * 0.4));
      const artBuzz = rosterArtist?.buzz ?? rand(10, 30 + Math.floor(label.prestige * 0.3));
      const artFanbase = rosterArtist?.fanbase ?? rand(10000, 50000 + label.prestige * 1000);

      const newSong: IndustrySong = {
        id: uid(),
        title: generateSongTitle(),
        artistName,
        labelId: label.id,
        labelName: label.name,
        genre: label.primaryGenre,
        quality,
        viralPotential,
        turnReleased: simulatedTurn,
        weeksOnChart: rand(1, Math.min(12, -simulatedTurn)),
        streamsTotal: Math.floor(rand(200000, 2000000) * (quality / 60)),
        artistPopularity: artPop,
        artistMomentum: artMom,
        artistBuzz: artBuzz,
        artistFanbase: artFanbase,
      };
      songs.push(newSong);
      label.totalSongsReleased += 1;
      label.totalStreams += newSong.streamsTotal;
      if (quality >= 70) label.chartHits += 1;
    }
  }

  // Keep only songs recent enough to still chart at turn 1 (age <= 35)
  const active = songs.filter((s) => (1 - s.turnReleased) <= 35);
  const capped = active.slice(-60);

  // Update label activeSongs
  const updatedLabels = labels.map((label) => ({
    ...label,
    activeSongs: capped.filter((s) => s.labelId === label.id),
  }));

  // Build an initial chart from the pre-populated songs so charts aren't empty on turn 1
  const chartEntries: { entry: ChartEntry; score: number }[] = [];
  for (const song of capped) {
    const age = 1 - song.turnReleased; // age at turn 1
    const decayFactor = chartDecay(age);
    if (decayFactor <= 0) continue;

    const artMom = song.artistMomentum ?? 30;
    const artPop = song.artistPopularity ?? 30;
    const artBuzz = song.artistBuzz ?? 20;
    const artFanbase = song.artistFanbase ?? 40000;

    const baseScore = song.viralPotential * 0.30
      + song.quality * 0.25
      + artMom * 0.20
      + artPop * 0.15
      + artBuzz * 0.10;
    const recency = Math.max(0, 12 - age);
    const freshnessBonus = Math.min(recency * 1.0, baseScore * 0.25);
    const chartRandomness = (Math.random() - 0.5) * 10;
    const score = (baseScore + freshnessBonus + chartRandomness) * decayFactor * chartQualityPenalty(song.quality);

    const qualFloor = streamQualityFloor(song.quality);
    const streams = Math.floor(
      (song.viralPotential * 3000 + artFanbase * 0.35 + song.quality * 800) * qualFloor * (0.9 + Math.random() * 0.35)
    );
    chartEntries.push({
      score,
      entry: {
        position: 0,
        songId: "",
        title: song.title,
        artistName: song.artistName,
        labelName: song.labelName,
        weeksOnChart: song.weeksOnChart,
        streams,
        isPlayerSong: false,
        genre: song.genre,
      },
    });
  }
  chartEntries.sort((a, b) => b.score - a.score);
  const chart = chartEntries.slice(0, 20).map((e, i) => ({ ...e.entry, position: i + 1 }));

  return { industrySongs: capped, rivalLabels: updatedLabels, chart };
}

// ── Rival labels sign free agents periodically ───────────────────────────────

function simulateRivalSignings(state: GameState): { freeAgentPool: Artist[]; rivalLabels: RivalLabel[] } {
  let pool = [...state.freeAgentPool];
  const labels = state.rivalLabels.map((l) => ({ ...l, rosterArtists: [...l.rosterArtists] }));

  for (const label of labels) {
    // Roster cap scales with prestige: low prestige = 4-6, high prestige = 8-12
    const rosterCap = Math.floor(4 + (label.prestige / 100) * 8); // 4 at 0 prestige, 12 at 100

    // Higher sign chance; labels with roster room are more aggressive
    const roomFactor = label.rosterArtists.length < rosterCap ? 1.5 : 0.3;
    const signChance = ((label.prestige / 600) + (label.activityLevel / 800)) * roomFactor;

    // Labels can attempt to sign up to 2 artists per turn at high prestige
    const maxSignings = label.prestige >= 70 ? 2 : 1;
    let signed = 0;

    while (signed < maxSignings && Math.random() < signChance && pool.length >= 10) {
      // Composite interest scoring: OVR + potential + momentum + buzz + age + genre fit
      const minOvr = Math.floor(label.prestige * 0.4 + 20);
      const candidates = pool
        .filter((a) => a.overallRating >= Math.min(35, minOvr))
        .map((a) => {
          let score = a.overallRating * 0.25 + (a.potential ?? a.overallRating) * 0.20
                    + (a.momentum ?? 30) * 0.20 + (a.buzz ?? 20) * 0.15;
          score += a.age <= 22 ? 15 : a.age <= 26 ? 10 : a.age <= 30 ? 5 : a.age <= 33 ? 0 : -10;
          const stage = a.careerPhase ?? "unknown";
          score += stage === "buzzing" ? 12 : stage === "breakout" ? 15 : stage === "emerging" ? 10 : stage === "unknown" ? 5 : stage === "established" ? 15 : stage === "peak" ? 10 : stage === "legacy" ? -5 : -15;
          if (a.genre === label.primaryGenre) score += 8;
          // Signing imperfection: add random variance so labels don't always pick optimally
          score += (Math.random() - 0.5) * 16;
          return { artist: a, score };
        })
        .filter((c) => c.score > 40)
        .sort((a, b) => b.score - a.score);
      const target = candidates.length > 0
        ? candidates[Math.floor(Math.random() * Math.min(3, candidates.length))].artist
        : null;
      if (!target) break;

      label.rosterArtists.push({ ...target, signed: true });
      pool = pool.filter((a) => a.id !== target.id);
      signed++;
    }

    // Drop weakest artists if over roster cap
    while (label.rosterArtists.length > rosterCap) {
      let worstIdx = 0;
      let worstScore = Infinity;
      for (let i = 0; i < label.rosterArtists.length; i++) {
        const ra = label.rosterArtists[i];
        const mom = ra.momentum ?? 20;
        const ovr = ra.overallRating ?? 40;
        const age = ra.age ?? 25;
        const stage = ra.careerPhase ?? "unknown";
        const stagePenalty = stage === "washed" ? -20 : stage === "declining" ? -10 : stage === "legacy" ? -5 : 0;
        const dropScore = ovr * 0.3 + mom * 0.4 + (40 - Math.max(0, age - 25)) * 0.3 + stagePenalty;
        if (dropScore < worstScore) {
          worstScore = dropScore;
          worstIdx = i;
        }
      }
      label.rosterArtists.splice(worstIdx, 1);
    }
  }

  return { freeAgentPool: pool, rivalLabels: labels };
}

// ── Grammy-style award ceremony ────────────────────────────────────────────────

// Triggers at turn 48 and every 52 turns after (year-end boundaries)
export function shouldRunAwardCeremony(turn: number): boolean {
  if (turn < 48) return false;
  return (turn - 48) % 52 === 0;
}

export function computeAwardCeremony(state: GameState): AwardCeremony {
  const year = Math.floor((state.turn - 48) / 52) + 1;
  const eligibilityWindow = 52; // songs released within the past 52 turns are eligible

  function makeNominee(
    category: AwardCategory,
    name: string,
    artistName: string | undefined,
    isPlayer: boolean,
    score: number
  ): AwardNominee {
    return { category, name, artistName, isPlayer, score };
  }

  const nominees: AwardNominee[] = [];

  // Buzz factor: random swing applied to ALL nominees for unpredictability
  const buzzSwing = () => (Math.random() - 0.4) * 20; // -8 to +12

  // ── Song of the Year ─────────────────────────────────────────────────────
  // Unified formula: quality + viral×0.5 + min(50, streams/200k) + buzzSwing
  const eligibleSongs = state.songs.filter(
    (s) => s.released && state.turn - s.turnReleased <= eligibilityWindow
  );
  const rankedSongs = [...eligibleSongs].sort(
    (a, b) => (b.quality + b.viralPotential + b.streamsTotal / 100000) - (a.quality + a.viralPotential + a.streamsTotal / 100000)
  );
  for (const s of rankedSongs.slice(0, 2)) {
    const artist = state.artists.find((a) => a.id === s.artistId);
    const score = s.quality + s.viralPotential * 0.5 + Math.min(50, s.streamsTotal / 200000) + buzzSwing();
    nominees.push(makeNominee("song_of_year", s.title, artist?.name, true, score));
  }
  // 3 industry nominees — same formula, no year bonus
  const industryEligible = state.industrySongs.filter(
    (s) => state.turn - s.turnReleased <= eligibilityWindow
  );
  const topIndustry = [...industryEligible].sort(
    (a, b) => (b.quality + b.viralPotential + b.streamsTotal / 100000) - (a.quality + a.viralPotential + a.streamsTotal / 100000)
  ).slice(0, 3);
  for (const s of topIndustry) {
    const score = s.quality + s.viralPotential * 0.5 + Math.min(50, s.streamsTotal / 200000) + buzzSwing();
    nominees.push(makeNominee("song_of_year", s.title, s.artistName, false, score));
  }

  // ── Album of the Year ────────────────────────────────────────────────────
  // Player albums: qualityScore + min(40, streams/500k) + rand(0,15) + buzzSwing
  const eligibleAlbums = state.albums.filter(
    (al) => al.status === "released" && state.turn - al.turnReleased <= eligibilityWindow
  );
  for (const al of eligibleAlbums.slice(0, 2)) {
    const artist = state.artists.find((a) => a.id === al.artistId);
    const score = al.qualityScore + Math.min(40, al.totalStreams / 500000) + rand(0, 15) + buzzSwing();
    nominees.push(makeNominee("album_of_year", al.title, artist?.name, true, score));
  }
  // Rival album nominees: derive virtual albums from each label's eligible songs
  // Group songs by label, take top 5-10 songs as an "album", score with same formula
  const rivalAlbumCandidates: { label: RivalLabel; albumQuality: number; albumStreams: number; artistName: string }[] = [];
  for (const label of state.rivalLabels) {
    const labelSongs = industryEligible
      .filter((s) => s.labelId === label.id)
      .sort((a, b) => b.quality - a.quality);
    if (labelSongs.length < 3) continue; // need at least 3 songs for an album
    const albumTracks = labelSongs.slice(0, Math.min(10, labelSongs.length));
    const albumQuality = albumTracks.reduce((sum, s) => sum + s.quality, 0) / albumTracks.length;
    const albumStreams = albumTracks.reduce((sum, s) => sum + s.streamsTotal, 0);
    // Pick the artist with the most songs on this virtual album
    const artistCounts: Record<string, number> = {};
    for (const s of albumTracks) artistCounts[s.artistName] = (artistCounts[s.artistName] ?? 0) + 1;
    const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? label.name;
    rivalAlbumCandidates.push({ label, albumQuality, albumStreams, artistName: topArtist });
  }
  // Sort by album quality + streams, take top 3
  rivalAlbumCandidates.sort((a, b) => (b.albumQuality + b.albumStreams / 500000) - (a.albumQuality + a.albumStreams / 500000));
  for (const ra of rivalAlbumCandidates.slice(0, 3)) {
    const score = ra.albumQuality + Math.min(40, ra.albumStreams / 500000) + rand(0, 15) + buzzSwing();
    nominees.push(makeNominee("album_of_year", `${ra.label.name} LP`, ra.artistName, false, score));
  }

  // ── Artist of the Year ───────────────────────────────────────────────────
  // Unified formula: popularity + OVR×0.25 + min(30, fanbase/50k) + momentum×0.20 + rand(0,10) + buzzSwing
  const signedArtists = state.artists.filter((a) => a.signed);
  for (const a of signedArtists.slice(0, 2)) {
    const score = a.popularity + a.overallRating * 0.25 + Math.min(30, a.fanbase / 50000) + a.momentum * 0.20 + rand(0, 10) + buzzSwing();
    nominees.push(makeNominee("artist_of_year", a.name, undefined, true, score));
  }
  // Rival artist nominees — same formula, sorted by yearly performance not raw OVR
  const rivalArtistCandidates = state.rivalLabels.flatMap((l) =>
    l.rosterArtists.map((a) => ({ artist: a, label: l }))
  ).sort((a, b) =>
    (b.artist.popularity + b.artist.momentum) - (a.artist.popularity + a.artist.momentum)
  ).slice(0, 3);
  for (const { artist: ra } of rivalArtistCandidates) {
    const score = ra.popularity + ra.overallRating * 0.25 + Math.min(30, ra.fanbase / 50000) + ra.momentum * 0.20 + rand(0, 10) + buzzSwing();
    nominees.push(makeNominee("artist_of_year", ra.name, undefined, false, score));
  }

  // ── Best New Artist ──────────────────────────────────────────────────────
  // Unified formula: potential + popularity×0.4 + momentum×0.25 + rand(0,15) + buzzSwing
  const newArtists = state.artists.filter((a) => a.signed && a.age <= 25);
  for (const a of newArtists.slice(0, 2)) {
    const score = a.potential + a.popularity * 0.4 + a.momentum * 0.25 + rand(0, 15) + buzzSwing();
    nominees.push(makeNominee("best_new_artist", a.name, undefined, true, score));
  }
  // Rival young artists — same formula
  const rivalYoung = state.rivalLabels.flatMap((l) =>
    l.rosterArtists.filter((a) => a.age <= 25).map((a) => ({ artist: a, label: l }))
  ).sort((a, b) =>
    (b.artist.popularity + b.artist.momentum) - (a.artist.popularity + a.artist.momentum)
  ).slice(0, 3);
  for (const { artist: ra } of rivalYoung) {
    const score = ra.potential + ra.popularity * 0.4 + ra.momentum * 0.25 + rand(0, 15) + buzzSwing();
    nominees.push(makeNominee("best_new_artist", ra.name, undefined, false, score));
  }
  // Fallback: if fewer than 2 rival young artists, add template-based nominees
  if (rivalYoung.length < 2) {
    for (const t of RIVAL_LABEL_TEMPLATES.slice(0, 3 - rivalYoung.length)) {
      const score = rand(40, 75) + buzzSwing();
      nominees.push(makeNominee("best_new_artist", t.artistNames[Math.floor(Math.random() * t.artistNames.length)], undefined, false, score));
    }
  }

  // ── Label of the Year ────────────────────────────────────────────────────
  // Unified formula: reputation/prestige×0.35 + chart performance + fanbase/streams + buzzSwing
  const playerChartSongs = state.chart.filter((e) => e.isPlayerSong).length;
  const playerTotalStreams = state.songs.filter((s) => s.released && state.turn - s.turnReleased <= eligibilityWindow)
    .reduce((sum, s) => sum + s.streamsTotal, 0);
  const labelScore = state.reputation * 0.35 + playerChartSongs * 5 + Math.min(30, state.fanbase / 50000) + Math.min(20, playerTotalStreams / 1000000) + rand(0, 10) + buzzSwing();
  nominees.push(makeNominee("label_of_year", state.labelName, undefined, true, labelScore));
  for (const label of [...state.rivalLabels].sort((a, b) =>
    (b.chartHits + b.totalStreams / 1000000) - (a.chartHits + a.totalStreams / 1000000)
  ).slice(0, 4)) {
    const rivalChartSongs = state.chart.filter((e) => !e.isPlayerSong && e.labelName === label.name).length;
    const rivalYearStreams = industryEligible.filter((s) => s.labelId === label.id).reduce((sum, s) => sum + s.streamsTotal, 0);
    const score = label.prestige * 0.35 + rivalChartSongs * 5 + label.chartHits * 3 + Math.min(20, rivalYearStreams / 1000000) + rand(0, 10) + buzzSwing();
    nominees.push(makeNominee("label_of_year", label.name, undefined, false, score));
  }

  // ── Determine winners ────────────────────────────────────────────────────
  const categories: AwardCategory[] = ["song_of_year", "album_of_year", "artist_of_year", "best_new_artist", "label_of_year"];
  const winners: AwardNominee[] = [];
  const playerWins: AwardCategory[] = [];

  for (const cat of categories) {
    const catNominees = nominees.filter((n) => n.category === cat);
    if (catNominees.length === 0) continue;
    const winner = catNominees.reduce((best, n) => n.score > best.score ? n : best);
    winners.push(winner);
    if (winner.isPlayer) playerWins.push(cat);
  }

  // Award money scales with year — endgame ceremonies are bigger
  const moneyReward = playerWins.length * (50000 + year * 25000);
  const reputationReward = playerWins.length * 5 + (playerWins.length > 0 ? 3 : 0);

  return {
    id: uid(),
    year,
    turn: state.turn,
    nominees,
    winners,
    playerWins,
    moneyReward,
    reputationReward,
  };
}

// ── Milestone tracking ────────────────────────────────────────────────────────

function makeMilestone(turn: number, type: MilestoneType, title: string, description: string): LabelMilestone {
  return { id: uid(), turn, type, title, description };
}

// ── Advance turn ──────────────────────────────────────────────────────────────

export function advanceTurn(state: GameState): GameState {
  let s = { ...state, turn: state.turn + 1 };

  // Simulate rival label releases before building chart
  const rivalResult = simulateRivalReleases(s);
  s = { ...s, industrySongs: rivalResult.songs };

  // Update rival labels' activeSongs list and stats
  const updatedRivalLabels = rivalResult.labels.map((label) => ({
    ...label,
    activeSongs: rivalResult.songs.filter((song) => song.labelId === label.id),
  }));
  s = { ...s, rivalLabels: updatedRivalLabels };

  // Rival labels periodically sign free agents from the pool
  if (s.turn % 3 === 0) { // check every 3 turns to avoid too much churn
    const signingResult = simulateRivalSignings(s);
    s = { ...s, freeAgentPool: signingResult.freeAgentPool, rivalLabels: signingResult.rivalLabels };
  }

  // ── Generate new free agents each turn (2-5 artists) ──────────────────────
  {
    const newCount = rand(2, 5);
    const newAgents: Artist[] = [];
    for (let i = 0; i < newCount; i++) {
      newAgents.push(generateArtist(`pool_gen_${s.turn}_${i}`));
    }
    // Every 13 turns (~quarterly), inject a guaranteed quality prospect (OVR 65+)
    // to ensure the pool doesn't become all low-tier over time
    if (s.turn % 13 === 0) {
      let qualityProspect = generateArtist(`pool_quality_${s.turn}`);
      let attempts = 0;
      while (qualityProspect.overallRating < 65 && attempts < 20) {
        qualityProspect = generateArtist(`pool_quality_${s.turn}_${attempts}`);
        attempts++;
      }
      newAgents.push(qualityProspect);
    }
    // Every 52 turns (yearly), inject a star-caliber free agent (OVR 80+)
    if (s.turn % 52 === 26) {
      let starProspect = generateArtist(`pool_star_${s.turn}`);
      let attempts = 0;
      while (starProspect.overallRating < 80 && attempts < 50) {
        starProspect = generateArtist(`pool_star_${s.turn}_${attempts}`);
        attempts++;
      }
      newAgents.push(starProspect);
    }

    // ── Yearly pool refresh: replace 10-15% of pool with fresh blood ──────
    // Simulates new talent entering the scene each year
    if (s.turn % 52 === 0 && s.turn > 0) {
      const currentPool = s.freeAgentPool;
      const refreshPct = 0.10 + Math.random() * 0.05; // 10-15%
      const refreshCount = Math.floor(currentPool.length * refreshPct);

      // Remove the weakest/most stalled artists (low momentum + low OVR)
      const scored = currentPool.map((a, idx) => ({
        idx,
        score: (a.momentum ?? 10) * 0.4 + a.overallRating * 0.3 + (a.potential ?? a.overallRating) * 0.2 - (a.age > 35 ? 20 : 0),
      }));
      scored.sort((a, b) => a.score - b.score);
      const removeIdxs = new Set(scored.slice(0, refreshCount).map((s) => s.idx));
      const trimmedPool = currentPool.filter((_, i) => !removeIdxs.has(i));

      // Generate fresh replacements
      const freshAgents: Artist[] = [];
      for (let i = 0; i < refreshCount; i++) {
        freshAgents.push(generateArtist(`pool_refresh_${s.turn}_${i}`));
      }

      s = { ...s, freeAgentPool: [...trimmedPool, ...freshAgents, ...newAgents] };
    } else {
      let pool = [...s.freeAgentPool, ...newAgents];
      // Cap the pool at 500 — trim oldest entries from the front
      if (pool.length > 500) {
        pool = pool.slice(pool.length - 500);
      }
      s = { ...s, freeAgentPool: pool };
    }
  }

  // ── Free agent retirement: momentum-based + age backup ────────────────────
  {
    const pool = s.freeAgentPool.filter((a) => {
      const mom = a.momentum ?? 30;
      const lowTurns = a.turnsAtLowMomentum ?? 0;
      // Momentum collapse retirement
      if (mom <= 5 && lowTurns > 26 && Math.random() < 0.40) return false;
      if (mom <= 15 && lowTurns > 16 && Math.random() < 0.15) return false;
      // Age backup: 38+ with low momentum
      if (a.age >= 38) {
        const ageRisk = (a.age - 37) * 0.04;
        const momProtection = mom > 40 ? 0.5 : 1.0;
        if (Math.random() < ageRisk * momProtection) return false;
      }
      // Low morale + low momentum
      if (a.morale < 15 && mom < 20 && Math.random() < 0.10) return false;
      return true;
    });
    // Age and decay momentum/buzz for pool artists each turn
    const agedPool = pool.map((a) => {
      let mom = a.momentum ?? 30;
      let bz = a.buzz ?? 20;
      let lowTurns = a.turnsAtLowMomentum ?? 0;
      const dur = a.durability ?? "solid";
      // Idle decay for free agents (they're not active, but slower than signed artists)
      const decay = dur === "flash" ? 0.8 : dur === "solid" ? 0.5 : 0.25;
      mom = Math.max(0, Math.round(mom - decay));
      bz = Math.max(0, Math.round(bz - 0.3));
      if (mom < 25) lowTurns += 1; else lowTurns = 0;
      // Age every 52 turns
      let age = a.age;
      if (s.turn % 52 === 0) age += 1;
      return { ...a, momentum: mom, buzz: bz, turnsAtLowMomentum: lowTurns, age };
    });
    s = { ...s, freeAgentPool: agedPool };
  }

  // ── Rival label artist lifecycle: drop low-momentum artists ──────────────
  if (s.turn % 8 === 0) {
    const retiredRivals = s.rivalLabels.map((label) => {
      if (label.rosterArtists.length === 0) return label;
      // Drop artists with collapsed momentum or very low value
      const kept = label.rosterArtists.filter((ra) => {
        const mom = ra.momentum ?? 30;
        if (mom <= 10 && Math.random() < 0.35) return false; // drop washed artists
        if (ra.age >= 36 && mom < 30 && Math.random() < 0.20) return false;
        if (Math.random() < 0.08) return false; // small random churn
        return true;
      });
      // Age and decay momentum for rival roster artists
      const aged = kept.map((ra) => {
        let mom = ra.momentum ?? 30;
        const dur = ra.durability ?? "solid";
        const decay = dur === "flash" ? 0.8 : dur === "solid" ? 0.4 : 0.2;
        mom = Math.max(0, Math.round(mom - decay));
        // Rival artists get some momentum from label activity
        if (Math.random() < label.activityLevel / 200) mom = Math.min(100, mom + rand(2, 6));
        let age = ra.age;
        if (s.turn % 52 === 0) age += 1;
        return { ...ra, momentum: mom, age };
      });
      return { ...label, rosterArtists: aged };
    });
    s = { ...s, rivalLabels: retiredRivals };
  }

  // Chart
  const newChart = buildChart(s);
  const revMult = getRevenueMult(s);

  // Stream revenue & chart positions
  // Market heat: random weekly conditions (0.75x to 1.25x) — adds revenue variance
  const marketHeat = 0.75 + Math.random() * 0.50;
  // Label recognition multiplier: new labels earn less from streaming until they build rep
  // Floor raised to 0.5 so early labels still earn meaningful streaming income
  // At rep 10: 0.58x, rep 30: 0.74x, rep 50: 0.90x, rep 70+: ~1.0x
  const labelRecognition = clamp(0.5 + (s.reputation / 100) * 0.5, 0.5, 1.0);
  // Chart saturation: diminishing returns when dominating the chart
  // First 3 songs: 100%, 4-6: 80%, 7-10: 60%, 11+: 40%
  const playerChartCount = newChart.filter((c) => c.isPlayerSong).length;
  const saturationMult = playerChartCount <= 3 ? 1.0 : playerChartCount <= 6 ? 0.80 : playerChartCount <= 10 ? 0.60 : 0.40;
  let streamRevenue = 0;
  // Streaming revenue cap: only applies once label is established (total streaming > $100K)
  // Prevents snowball in mid/late game while letting early-game revenue flow freely
  const totalHistoricStreaming = s.revenueHistory.streaming;
  const applyStreamCap = (raw: number): number => {
    if (totalHistoricStreaming < 100000) return raw; // no cap for early labels
    if (raw <= 40000) return raw;
    if (raw <= 80000) return 40000 + (raw - 40000) * 0.65;
    return 40000 + 40000 * 0.65 + (raw - 80000) * 0.35;
  };
  // Total label fanbase for base revenue calculations
  const totalLabelFanbase = s.artists.filter(a => a.signed).reduce((sum, a) => sum + a.fanbase, 0) + s.fanbase;
  const updatedSongs = s.songs.map((song) => {
    if (!song.released) return song;
    const entry = newChart.find((c) => c.songId === song.id);

    if (entry) {
      // ── Charting song: amplified revenue ──
      // Exponential position multiplier: #1 = ×2.0, #10 ≈ ×1.14, #20 = ×0.6
      const posMult = 0.6 + 1.4 * Math.pow((20 - entry.position) / 19, 1.5);
      const qualMult = song.quality >= 60
        ? Math.min(1.8, 1.0 + (song.quality - 60) * 0.02)
        : 0.4 + (song.quality / 60) * 0.6;
      const rev = Math.floor(entry.streams * 0.007 * revMult * posMult * qualMult * labelRecognition * saturationMult * marketHeat);
      streamRevenue += rev;
      return {
        ...song,
        chartPosition: entry.position,
        streamsTotal: song.streamsTotal + entry.streams,
        weeksOnChart: song.weeksOnChart + 1,
        revenue: song.revenue + rev,
      };
    }

    // ── Non-charting released song: base / catalog revenue ──
    // All released songs generate some revenue from their existing listener base.
    // Songs that previously charted (catalog songs) earn more than songs that never charted.
    const weeksSinceRelease = s.turn - song.turnReleased;
    if (weeksSinceRelease <= 0) return { ...song, chartPosition: null };

    const isCatalog = song.weeksOnChart > 0; // previously charted = catalog
    const qualFactor = 0.3 + (song.quality / 100) * 0.7; // 0.3 to 1.0

    let baseRev: number;
    if (isCatalog) {
      // Catalog song: persistent income from past chart performance
      // Higher peak = more lasting listeners. Decays slowly over time.
      const peakBonus = 1 + song.weeksOnChart * 0.15; // more chart weeks = bigger catalog
      const catalogDecay = Math.max(0.10, 1 - weeksSinceRelease * 0.02); // -2%/week, floor 10%
      baseRev = Math.floor(totalLabelFanbase * 0.0008 * qualFactor * peakBonus * catalogDecay * labelRecognition * marketHeat);
    } else {
      // Never charted: minimal base revenue from label's fanbase discovering back catalog
      const freshness = Math.max(0.15, 1 - weeksSinceRelease * 0.03); // decays faster, floor 15%
      baseRev = Math.floor(totalLabelFanbase * 0.0003 * qualFactor * freshness * labelRecognition * marketHeat);
    }

    // Minimum floor: every released song earns at least $25/week (prevents $0 outcomes)
    baseRev = Math.max(25, baseRev);
    // Passive streams estimate for tracking
    const passiveStreams = Math.floor(baseRev / 0.005);
    streamRevenue += baseRev;

    return {
      ...song,
      chartPosition: null,
      streamsTotal: song.streamsTotal + passiveStreams,
      revenue: song.revenue + baseRev,
    };
  });
  // Legacy multiplier: total career streams build streaming clout over time (1.0x to 2.0x)
  const totalCareerStreams = s.songs.reduce((sum, song) => sum + song.streamsTotal, 0);
  const legacyMult = 1 + Math.min(1.0, Math.log10(Math.max(1, totalCareerStreams / 1000000)) * 0.15);
  streamRevenue = Math.floor(streamRevenue * legacyMult);
  // Apply streaming revenue cap (diminishing returns at high volumes — only mid/late game)
  streamRevenue = Math.floor(applyStreamCap(streamRevenue));

  // Update album aggregate stats from their songs
  const updatedAlbums = s.albums.map((al) => {
    if (al.status !== "released") return al;
    const albumSongEntries = newChart.filter((c) => al.songIds.includes(c.songId));
    const weekStreams = albumSongEntries.reduce((sum, c) => sum + c.streams, 0);
    const weekRevenue = albumSongEntries.reduce((sum, c) => {
      const pm = 0.6 + 1.4 * Math.pow((20 - c.position) / 19, 1.5);
      const albumSong = updatedSongs.find((ss) => ss.id === c.songId);
      const qm = albumSong && albumSong.quality >= 60
        ? Math.min(1.8, 1.0 + (albumSong.quality - 60) * 0.02)
        : albumSong ? 0.4 + (albumSong.quality / 60) * 0.6 : 1;
      return sum + Math.floor(c.streams * 0.004 * revMult * pm * qm);
    }, 0);
    return {
      ...al,
      totalStreams: al.totalStreams + weekStreams,
      totalRevenue: al.totalRevenue + weekRevenue,
    };
  });

  s = { ...s, songs: updatedSongs, albums: updatedAlbums, chart: newChart };

  // Merch income — scales per artist's fanbase × popularity
  // 3x buff: merch should be a meaningful revenue stream for labels that invest in it
  const merchPerFan = MERCH_DATA[s.merchLevel].revenuePerFan;
  const merchIncome = merchPerFan > 0
    ? Math.floor(s.artists.filter((a) => a.signed).reduce((sum, a) => {
        const popMult = 0.6 + (a.popularity / 60); // stronger popularity scaling
        const fanTier = a.fanbase >= 1000000 ? 4.0 : a.fanbase >= 500000 ? 3.0 : a.fanbase >= 100000 ? 2.0 : a.fanbase >= 25000 ? 1.5 : 1.0;
        return sum + a.fanbase * merchPerFan * popMult * fanTier * 5.0; // 5.0x global merch boost (was 1.8x)
      }, 0) * (0.8 + Math.random() * 0.4))
    : 0;

  // Brand deal / endorsement revenue — unlocks at rep 50+ AND requires meaningful artist roster
  // Requires at least one artist with 25K+ fans or popularity 40+ to attract brand interest
  const hasMarketableArtist = s.artists.some(a => a.signed && (a.fanbase >= 25000 || a.popularity >= 40));
  const brandDealRevenue = s.reputation >= 50 && hasMarketableArtist
    ? Math.floor((s.reputation - 40) * (s.fanbase / 100000) * 150 * (1 + s.turn / 520) * (0.8 + Math.random() * 0.4))
    : 0;

  // Per-week tour payouts + artist updates
  // Higher studio levels have better facilities → faster fatigue recovery
  const studioRecovery =
    s.studioLevel >= 9 ? 12 :
    s.studioLevel >= 7 ? 10 :
    s.studioLevel >= 5 ? 8 : 7;

  const tourEvents: GameEvent[] = [];
  const contractEvents: GameEvent[] = [];
  let tourRevenue = 0;
  let tourFanDelta = 0;
  let tourRepDelta = 0;

  // Artist updates
  const updatedArtists = s.artists.map((a) => {
    if (!a.signed) return a;

    // Jailed artists: only age, skip all touring/morale/walkout processing
    if (a.jailed) {
      let age = a.age;
      let potential = a.potential;
      if (s.turn % 52 === 0) {
        age += 1;
        potential = computePotential(a.overallRating, age);
      }
      return { ...a, age, potential };
    }

    let { fatigue, morale, popularity, fanbase, onTour, tourTurnsLeft, tourType } = a;
    let { age, overallRating, potential, peakAge } = a;
    let signed: boolean = a.signed;
    let lastTourEndTurn = a.lastTourEndTurn;
    let contractAlbumsLeft = a.contractAlbumsLeft;

    // Age advances every 52 turns (one in-game year)
    if (s.turn % 52 === 0) {
      age += 1;
      potential = computePotential(overallRating, age);

      // Retirement warning for artists age 38+
      if (age >= 38 && age < 40) {
        contractEvents.push({
          id: uid(),
          turn: s.turn,
          type: "retirement",
          title: `${a.name} Considering Retirement`,
          description: `${a.name} is ${age} years old and has hinted at retiring in the coming years.`,
          artistId: a.id,
          moneyDelta: 0,
          reputationDelta: 0,
          fanbaseDelta: 0,
          resolved: true,
        });
      }

      // Forced retirement at age 40+: 20% chance per year
      if (age >= 40 && Math.random() < 0.20) {
        if (contractAlbumsLeft > 0) {
          contractAlbumsLeft = 0; // force contract to end
        }
        contractEvents.push({
          id: uid(),
          turn: s.turn,
          type: "retirement",
          title: `${a.name} Announces Retirement`,
          description: `${a.name} has announced their retirement at age ${age}. Their contract will conclude.`,
          artistId: a.id,
          moneyDelta: 0,
          reputationDelta: 1,
          fanbaseDelta: 0,
          resolved: true,
        });
      }
    }

    // Rating development now happens post-album, not weekly (see releaseAlbum)

    // Tour tick — pay out this week's earnings
    if (onTour && tourType) {
      const t = TOUR_DATA[tourType];
      const td = TOURING_DEPT_DATA[s.touringLevel];
      const popMult = 0.5 + popularity / 100;
      const fanbaseMult = 1 + Math.log10(Math.max(1, fanbase / 10000)) * 0.15;
      // Diminishing returns: repeated tours within 20 weeks yield less (min 0.5x)
      const recentTourPenalty = a.lastTourEndTurn > 0 && (s.turn - a.lastTourEndTurn) < 20
        ? Math.max(0.5, 1 - (20 - (s.turn - a.lastTourEndTurn)) * 0.025)
        : 1.0;
      const weekRev = Math.floor(t.revPerWeek * 0.4 * popMult * fanbaseMult * (1 + td.revenueBonusPct / 100) * marketHeat * recentTourPenalty); // 0.4x base nerf + diminishing returns
      const weekFans = Math.floor(t.fanPerWeek * popMult * (1 + td.fanBonusPct / 100));
      tourRevenue += weekRev;
      tourFanDelta += weekFans;
      fanbase = Math.floor(fanbase + weekFans);
      const tourFatigue = Math.max(1, Math.round(t.fatiguePerWeek * (1 - td.fatigueMitigation)));
      fatigue = clamp(fatigue + tourFatigue, 0, 100);

      // Touring builds artist visibility and momentum each week
      popularity = clamp(popularity + (Math.random() < 0.3 ? 1 : 0), 0, 100);

      // Touring builds label reputation over time (not just at booking)
      // ~30% chance per week for +1 rep, scaled by tour size
      const tourRepChance = t.reputationGain >= 8 ? 0.15 : t.reputationGain >= 5 ? 0.10 : 0.06;
      if (Math.random() < tourRepChance) {
        tourRepDelta += 1;
      }

      tourTurnsLeft -= 1;
      if (tourTurnsLeft <= 0) {
        onTour = false;
        tourType = null;
        lastTourEndTurn = s.turn; // track when ANY tour ends (not just major ones)
        tourEvents.push({
          id: uid(),
          turn: s.turn,
          type: "milestone",
          title: `${a.name}'s Tour Wraps`,
          description: `${a.name} completed their tour. Final week earnings: $${weekRev.toLocaleString()}.`,
          artistId: a.id,
          moneyDelta: 0,
          reputationDelta: 0,
          fanbaseDelta: 0,
          resolved: true,
        });
      }
    } else {
      // Natural recovery when not on tour
      fatigue = clamp(fatigue - studioRecovery, 0, 100);
    }

    // Trait-based morale: workEthic raises fatigue tolerance, fameMotivation ties morale to fanbase
    const fatigueThreshold = 40 + a.traits.workEthic * 0.3;
    let moraleDelta = fatigue < fatigueThreshold ? 1 : -2;
    if (a.traits.fameMotivation > 60) moraleDelta += fanbase > 50000 ? 1 : fanbase < 5000 ? -1 : 0;
    // Expired contract: morale decays faster until player renegotiates or drops the artist
    if (a.contractAlbumsLeft === 0 && a.contractAlbumsTotal > 0) moraleDelta -= 3;

    // Inactivity penalty: shelved artists who aren't recording, releasing, or touring lose morale.
    // Find the last turn this artist recorded a song or completed any tour.
    if (!onTour) {
      const lastRecordTurn = s.songs
        .filter((song) => song.artistId === a.id)
        .reduce((max, song) => Math.max(max, song.turnRecorded), 0);
      // lastTourEndTurn covers ALL tours; lastMajorTourTurn is only national+ (for cooldown)
      const lastActiveTurn = Math.max(lastRecordTurn, lastTourEndTurn, a.lastMajorTourTurn);
      const turnsIdle = s.turn - lastActiveTurn;

      if (turnsIdle >= 4) {
        // Penalty scales with how long they've been shelved
        const basePenalty = turnsIdle >= 10 ? 3 : turnsIdle >= 7 ? 2 : 1;
        // Fame-driven and competitive artists get restless faster
        const fameMult = a.traits.fameMotivation > 65 ? 1.5 : a.traits.fameMotivation > 45 ? 1.0 : 0.7;
        const compMult = a.traits.competitiveness > 65 ? 1.3 : 1.0;
        moraleDelta -= Math.round(basePenalty * fameMult * compMult);
      }
    }

    morale = clamp(morale + moraleDelta, 0, 100);

    // Artist walks out when morale collapses under an expired contract
    if (a.contractAlbumsLeft === 0 && a.contractAlbumsTotal > 0 && morale < 20) {
      signed = false;
      contractEvents.push({
        id: uid(),
        turn: s.turn,
        type: "milestone",
        title: `${a.name} Has Left the Label`,
        description: `${a.name}'s contract expired and their morale collapsed. They've walked out.`,
        artistId: a.id,
        moneyDelta: 0,
        reputationDelta: -rand(1, 3),
        fanbaseDelta: 0,
        resolved: true,
      });
    }

    // Mid-contract walkout: artist leaves even with albums remaining if morale hits rock bottom
    // (only after they've been idle long enough for it to feel earned — 5+ turns idle)
    if (signed && a.contractAlbumsLeft > 0 && morale <= 5) {
      const lastRecordTurn = s.songs
        .filter((song) => song.artistId === a.id)
        .reduce((max, song) => Math.max(max, song.turnRecorded), 0);
      const turnsIdle = s.turn - Math.max(lastRecordTurn, lastTourEndTurn, a.lastMajorTourTurn);
      if (turnsIdle >= 5 && Math.random() < 0.4) {
        signed = false;
        contractEvents.push({
          id: uid(),
          turn: s.turn,
          type: "scandal",
          title: `${a.name} Walks Out`,
          description: `${a.name} felt completely shelved and broke their contract. Reputation hit.`,
          artistId: a.id,
          moneyDelta: -rand(5000, 20000),
          reputationDelta: -rand(3, 8),
          fanbaseDelta: -rand(1000, 5000),
          resolved: true,
        });
      }
    }

    popularity = clamp(popularity + (Math.random() < 0.3 ? rand(-2, 3) : 0), 0, 100);
    // Passive fan growth: guaranteed floor of 100/week, capped at 5000/week to prevent runaway scaling
    const passiveGrowth = Math.max(50, Math.min(2500, Math.floor(fanbase * popularity / 5000)));
    // Weekly fan churn: listeners drop off without new content. Idle artists bleed fans faster.
    // Active artists (recently released or touring) are partially shielded from churn.
    const recentRelease = s.songs.some((song) => song.artistId === a.id && song.released && s.turn - song.turnReleased <= 8);
    // Career phase affects churn rate
    const stg = a.careerPhase ?? "unknown";
    const phaseChurnMod = stg === "washed" ? 0.010
                        : stg === "declining" ? 0.008
                        : stg === "legacy" ? 0.005
                        : stg === "peak" || stg === "established" ? 0.002
                        : stg === "breakout" || stg === "buzzing" ? 0.003
                        : stg === "emerging" ? 0.004
                        : 0.005; // unknown
    const churnRate = recentRelease || onTour ? Math.min(phaseChurnMod, 0.002) : phaseChurnMod;
    const churn = Math.floor(fanbase * churnRate);
    fanbase = Math.floor(fanbase + passiveGrowth - churn);

    // ── Momentum update ────────────────────────────────────────────────────
    let momentum = a.momentum ?? 50;
    const dur = a.durability ?? "solid";
    const durDecay = dur === "flash" ? 2.5 : dur === "solid" ? 1.5 : 0.8;

    // Check chart performance this turn
    const artistChartEntries = newChart.filter((c) => c.isPlayerSong && s.songs.find((ss) => ss.id === c.songId && ss.artistId === a.id));
    const hasChartHit = artistChartEntries.some((c) => c.position <= 5);
    const isCharting = artistChartEntries.length > 0;
    const bestPos = isCharting ? Math.min(...artistChartEntries.map((c) => c.position)) : 99;

    // Momentum gains
    if (hasChartHit) {
      const hitGain = dur === "flash" ? rand(25, 35) : dur === "solid" ? rand(15, 22) : rand(10, 18);
      momentum += hitGain;
    } else if (isCharting) {
      momentum += bestPos <= 3 ? 8 : bestPos <= 10 ? 4 : 2;
    }
    if (onTour) momentum += 1;

    // Momentum losses
    const lastRecordTurnMom = s.songs
      .filter((song) => song.artistId === a.id)
      .reduce((max, song) => Math.max(max, song.turnRecorded), 0);
    const lastActiveTurnMom = Math.max(lastRecordTurnMom, lastTourEndTurn, a.lastMajorTourTurn);
    const turnsIdleMom = s.turn - lastActiveTurnMom;
    if (turnsIdleMom > 8) {
      momentum -= durDecay * Math.min(3, Math.floor(turnsIdleMom / 8));
    }
    // Natural decay — slow bleed even when active
    momentum -= durDecay * 0.6;
    // Age modifier for idle older artists
    if (age >= 30 && turnsIdleMom > 4) {
      momentum -= (age - 29) * 0.3;
    }
    momentum = clamp(Math.round(momentum), 0, 100);

    // Track low momentum turns
    let turnsAtLowMomentum = a.turnsAtLowMomentum ?? 0;
    if (momentum < 25) turnsAtLowMomentum += 1;
    else turnsAtLowMomentum = 0;
    const peakMomentum = Math.max(a.peakMomentum ?? 0, momentum);

    // ── Buzz update ────────────────────────────────────────────────────────
    let buzz = a.buzz ?? 30;
    if (isCharting) buzz += bestPos <= 5 ? 5 : 2;
    if (onTour) buzz += 0.5;
    if (turnsIdleMom > 6) buzz -= Math.min(4, Math.floor(turnsIdleMom / 4));
    buzz -= 0.8; // natural decay
    // Marketing department bonus
    const mktBuzz = MARKETING_DATA[s.marketingLevel].fanGrowthPct * 0.1;
    buzz += mktBuzz;
    buzz = clamp(Math.round(buzz), 0, 100);

    // ── Career stage transition ─────────────────────────────────────────────
    let careerPhase = a.careerPhase ?? "unknown";
    const prevPhase = careerPhase;
    const chartHitsTotal = (a.chartHits ?? 0) + (hasChartHit ? 1 : 0);
    const albumsTotal = a.totalAlbumsReleased ?? 0;

    // Peak: top talent at the height of their career
    if (overallRating >= 78 && momentum >= 55 && (chartHitsTotal >= 5 || albumsTotal >= 3)) careerPhase = "peak";
    // Established: strong talent + proven track record
    else if (overallRating >= 70 && momentum >= 40) careerPhase = "established";
    else if (momentum >= 55 && overallRating >= 60 && (chartHitsTotal >= 3 || albumsTotal >= 2)) careerPhase = "established";
    // Breakout: first major success
    else if (momentum >= 45 && overallRating >= 55 && (chartHitsTotal >= 1 || albumsTotal >= 1)) careerPhase = "breakout";
    // Washed: severe momentum collapse — very sticky
    else if (momentum < 8 && turnsAtLowMomentum > 20 && (prevPhase === "washed" || prevPhase === "declining")) careerPhase = "washed";
    // Declining: momentum collapsed — sticky
    else if (momentum < 15 && turnsAtLowMomentum > 12) careerPhase = "declining";
    else if (prevPhase === "declining" && turnsAtLowMomentum > 0) careerPhase = "declining";
    else if (prevPhase === "washed" && momentum < 20) careerPhase = "washed"; // hard to escape
    // Legacy: older artist past prime but still respected
    else if (age >= 32 && overallRating >= 55 && momentum < 30 && (chartHitsTotal >= 3 || albumsTotal >= 2)) careerPhase = "legacy";
    else if (age >= 30 && momentum < 50 && momentum >= 15 && overallRating >= 50) careerPhase = "legacy";
    // Buzzing: real momentum building
    else if ((buzz >= 30 || momentum >= 30) && overallRating >= 45) careerPhase = "buzzing";
    else if (momentum >= 40) careerPhase = "buzzing";
    // Emerging: showing promise
    else if ((buzz >= 15 || momentum >= 15) && overallRating >= 35) careerPhase = "emerging";
    // Unknown: young and unproven
    else if (age <= 24 && chartHitsTotal < 2 && albumsTotal < 1) careerPhase = "unknown";
    // Low momentum older = declining
    else if (momentum < 25 && age >= 28) careerPhase = "declining";

    // ── Momentum-based retirement (replaces pure age-based) ───────────────
    if (momentum <= 5 && turnsAtLowMomentum > 26 && Math.random() < 0.40) {
      if (contractAlbumsLeft > 0) contractAlbumsLeft = 0;
      contractEvents.push({
        id: uid(), turn: s.turn, type: "retirement",
        title: `${a.name} Retires`,
        description: `${a.name}'s career momentum has completely collapsed. They've announced retirement.`,
        artistId: a.id, moneyDelta: 0, reputationDelta: 1, fanbaseDelta: 0, resolved: true,
      });
    } else if (momentum <= 15 && turnsAtLowMomentum > 16 && Math.random() < 0.15) {
      if (contractAlbumsLeft > 0) contractAlbumsLeft = 0;
      contractEvents.push({
        id: uid(), turn: s.turn, type: "retirement",
        title: `${a.name} Steps Away`,
        description: `${a.name} has been fading for a while and has decided to step away from music.`,
        artistId: a.id, moneyDelta: 0, reputationDelta: 0, fanbaseDelta: 0, resolved: true,
      });
    }

    // ── Track yearly stats for yearly progression ──────────────────────────
    const yearlyChartsWeeks = (a.yearlyChartsWeeks ?? 0) + (isCharting ? 1 : 0);
    const yearlyTourWeeks = (a.yearlyTourWeeks ?? 0) + (onTour ? 1 : 0);
    const peakOverallTracked = Math.max(a.peakOverall ?? overallRating, overallRating);

    return {
      ...a, signed, fatigue, morale, popularity, fanbase, onTour, tourTurnsLeft, tourType,
      age, overallRating, potential, peakAge, lastTourEndTurn, contractAlbumsLeft,
      momentum, buzz, careerPhase, turnsAtLowMomentum, peakMomentum,
      chartHits: chartHitsTotal,
      yearlyChartsWeeks,
      yearlyTourWeeks,
      peakOverall: peakOverallTracked,
    };
  });

  // Revenue & merch events
  const incomeEvents: GameEvent[] = [];
  if (streamRevenue > 0) {
    incomeEvents.push({
      id: uid(),
      turn: s.turn,
      type: "revenue",
      title: "Stream Revenue",
      description: `Earned $${streamRevenue.toLocaleString()} from streaming this week.`,
      moneyDelta: streamRevenue,
      reputationDelta: 0,
      fanbaseDelta: 0,
      resolved: true,
    });
  }
  if (merchIncome > 0) {
    incomeEvents.push({
      id: uid(),
      turn: s.turn,
      type: "revenue",
      title: "Merch Sales",
      description: `Earned $${merchIncome.toLocaleString()} from merchandise.`,
      moneyDelta: merchIncome,
      reputationDelta: 0,
      fanbaseDelta: 0,
      resolved: true,
    });
  }
  if (brandDealRevenue > 0) {
    incomeEvents.push({
      id: uid(),
      turn: s.turn,
      type: "revenue",
      title: "Brand Deals",
      description: `Earned $${brandDealRevenue.toLocaleString()} from brand partnerships & endorsements.`,
      moneyDelta: brandDealRevenue,
      reputationDelta: 0,
      fanbaseDelta: 0,
      resolved: true,
    });
  }

  // Milestone events
  const milestoneEvents: GameEvent[] = [];
  // check if any artist crossed a fanbase milestone this turn
  for (const artist of updatedArtists) {
    const prev = state.artists.find((a) => a.id === artist.id);
    if (!prev) continue;
    for (const milestone of [10000, 50000, 100000, 500000, 1000000]) {
      if (prev.fanbase < milestone && artist.fanbase >= milestone) {
        milestoneEvents.push({
          id: uid(),
          turn: s.turn,
          type: "milestone",
          title: `${artist.name} Hits ${milestone >= 1000000 ? `${milestone / 1000000}M` : `${milestone / 1000}K`} Fans!`,
          description: `${artist.name} has reached ${milestone.toLocaleString()} fans — a new milestone!`,
          artistId: artist.id,
          moneyDelta: 0,
          reputationDelta: dimRep(s.reputation, milestone >= 100000 ? 2 : 1),
          fanbaseDelta: 0,
          resolved: true,
        });
      }
    }
  }

  // Add tour revenue event if applicable
  if (tourRevenue > 0) {
    incomeEvents.push({
      id: uid(),
      turn: s.turn,
      type: "revenue",
      title: "Tour Earnings",
      description: `Artists on tour earned $${tourRevenue.toLocaleString()} this week.`,
      moneyDelta: tourRevenue,
      reputationDelta: 0,
      fanbaseDelta: tourFanDelta,
      resolved: true,
    });
  }

  // Events (legacy scandal/viral system)
  const events = generateEvents({ ...s, artists: updatedArtists });
  let repDelta = 0;
  let moneyDelta = streamRevenue + merchIncome + tourRevenue + brandDealRevenue;
  let fanDelta = 0;

  const artistsAfterEvents = updatedArtists.map((a) => {
    let art = { ...a };
    for (const ev of events.filter((e) => e.artistId === a.id)) {
      repDelta += ev.reputationDelta;
      moneyDelta += ev.moneyDelta;
      fanDelta += ev.fanbaseDelta;
      if (ev.popularityDelta) art.popularity = clamp(art.popularity + ev.popularityDelta, 0, 100);
      art.fanbase = Math.max(0, art.fanbase + ev.fanbaseDelta);
      // Momentum/buzz effects from events
      if (ev.type === "scandal") {
        art.momentum = clamp((art.momentum ?? 50) - rand(8, 20), 0, 100);
        art.buzz = clamp((art.buzz ?? 30) + rand(-5, 8), 0, 100); // controversy = attention
        art.yearlyControversies = (art.yearlyControversies ?? 0) + 1;
      } else if (ev.type === "viral_moment") {
        art.momentum = clamp((art.momentum ?? 50) + rand(5, 12), 0, 100);
        art.buzz = clamp((art.buzz ?? 30) + rand(10, 25), 0, 100);
      } else if (ev.type === "award_nomination") {
        art.momentum = clamp((art.momentum ?? 50) + rand(3, 8), 0, 100);
        art.buzz = clamp((art.buzz ?? 30) + rand(5, 15), 0, 100);
      } else if (ev.type === "chart_surge") {
        art.momentum = clamp((art.momentum ?? 50) + rand(4, 10), 0, 100);
        art.buzz = clamp((art.buzz ?? 30) + rand(3, 8), 0, 100);
      } else if (ev.type === "burnout") {
        art.momentum = clamp((art.momentum ?? 50) - rand(3, 8), 0, 100);
      }
    }
    // Apply jail decay for incarcerated artists
    if (art.jailed) {
      art = applyJailDecay(art);
    }
    return art;
  });

  // ── Hip-hop event system: controversy tiers, legal chain, beef, jail ──────
  const hipHopState: GameState = { ...s, artists: artistsAfterEvents };
  const hipHopResult = processHipHopEvents(hipHopState);

  // Apply hip-hop event effects to player artists
  let artistsAfterHipHop = hipHopResult.updatedArtists.map((a) => {
    const playerEvents = hipHopResult.events.filter(e => e.artistId === a.id && !e.isRivalEvent);
    if (playerEvents.length === 0) return a;
    return applyHipHopEventEffects(a, playerEvents);
  });

  // Accumulate hip-hop event money/rep/fan deltas (player events only)
  const hipHopEvents = hipHopResult.events.filter(e => !e.isRivalEvent);
  for (const ev of hipHopEvents) {
    repDelta += ev.reputationDelta;
    moneyDelta += ev.moneyDelta;
    fanDelta += ev.fanbaseDelta;
  }

  // Apply hip-hop event effects to rival artists (buzz/momentum/fanbase on their roster)
  const rivalLabelsAfterHipHop = hipHopResult.updatedRivalLabels.map(label => {
    const rivalEvents = hipHopResult.events.filter(e => e.rivalLabelId === label.id);
    const updatedRoster = label.rosterArtists.map(a => {
      const artistEvents = rivalEvents.filter(e => e.artistId === a.id);
      if (artistEvents.length === 0) return a.jailed ? applyJailDecay(a) : a;
      let updated = applyHipHopEventEffects(a, artistEvents);
      if (updated.jailed) updated = applyJailDecay(updated);
      return updated;
    });
    return { ...label, rosterArtists: updatedRoster };
  });

  // ── Feature system: rival features and incoming requests ──────────────────
  const rivalFeatureResult = simulateRivalFeatures({ ...s, artists: artistsAfterHipHop, rivalLabels: rivalLabelsAfterHipHop, artistRelationships: s.artistRelationships ?? [] });
  let featureRelationships = rivalFeatureResult.relationships;
  const featureEvents = rivalFeatureResult.events;
  const rivalLabelsAfterFeatures = rivalFeatureResult.rivalLabels;

  // Generate incoming feature requests for the player
  const newFeatureRequests = generateIncomingFeatureRequests({ ...s, artists: artistsAfterHipHop, rivalLabels: rivalLabelsAfterFeatures, artistRelationships: featureRelationships, pendingFeatureRequests: s.pendingFeatureRequests ?? [] });
  // Keep existing unexpired requests (max 2 turns old) + new ones, cap at 5
  const existingRequests = (s.pendingFeatureRequests ?? []).filter((r) => s.turn - r.turn <= 2);
  const allFeatureRequests = [...existingRequests, ...newFeatureRequests].slice(0, 5);

  // ── Yearly progression: resolves every 52 turns (1 in-game year) ──────────
  const isYearEnd = s.turn > 0 && s.turn % 52 === 0;
  let artistsPostProgression = artistsAfterHipHop;
  const progressionEvents: GameEvent[] = [];

  if (isYearEnd) {
    // Reset yearly feature counts and decay relationships
    artistsAfterHipHop = resetYearlyFeatureCounts(artistsAfterHipHop);
    featureRelationships = decayRelationships(featureRelationships, s.turn);

    artistsPostProgression = artistsAfterHipHop.map((a) => {
      if (!a.signed) return a;
      // Skip if already progressed this year (safety check)
      if ((a.lastProgressionTurn ?? 0) >= s.turn) return a;

      const result = applyYearlyProgression(a, s.artistDevLevel);

      if (result.delta !== 0) {
        progressionEvents.push({
          id: uid(),
          turn: s.turn,
          type: "milestone",
          title: result.delta > 0
            ? `${a.name} Leveled Up (Year-End)`
            : `${a.name} Showing Wear (Year-End)`,
          description: result.delta > 0
            ? `${a.name}'s overall rating improved from ${a.overallRating} to ${result.overallRating} after a productive year.`
            : `${a.name}'s overall rating slipped from ${a.overallRating} to ${result.overallRating} — age and inactivity are catching up.`,
          artistId: a.id,
          moneyDelta: 0,
          reputationDelta: 0,
          fanbaseDelta: 0,
          resolved: true,
        });
      }

      // Archetype transition event
      if (result.archetype !== a.archetype) {
        progressionEvents.push({
          id: uid(),
          turn: s.turn,
          type: "milestone",
          title: `${a.name}'s Career Evolved`,
          description: `${a.name} is now recognized as a ${result.archetype.replace(/_/g, " ")}.`,
          artistId: a.id,
          moneyDelta: 0,
          reputationDelta: 0,
          fanbaseDelta: 0,
          resolved: true,
        });
      }

      return {
        ...a,
        overallRating: result.overallRating,
        potential: result.potential,
        attributes: result.attributes,
        archetype: result.archetype,
        peakOverall: Math.max(a.peakOverall ?? result.overallRating, result.overallRating),
        lastProgressionTurn: s.turn,
        // Reset yearly tracking for the new year
        yearlyReleasesQuality: [],
        yearlyChartsWeeks: 0,
        yearlyTourWeeks: 0,
        yearlyControversies: 0,
      };
    });
  }

  // Non-artist events
  for (const ev of events.filter((e) => !e.artistId)) {
    repDelta += ev.reputationDelta;
    moneyDelta += ev.moneyDelta;
    fanDelta += ev.fanbaseDelta;
  }

  // Apply milestone rep bonus
  for (const ev of milestoneEvents) {
    repDelta += ev.reputationDelta;
  }

  // Apply contract walkout rep hits
  for (const ev of contractEvents) {
    repDelta += ev.reputationDelta;
    moneyDelta += ev.moneyDelta;
  }

  // Passive reputation decay when the label has gone quiet (no songs released recently)
  // 12-turn freshness window gives album-focused players enough runway to finish an album.
  // Decays only every other turn (-0.5/turn avg) rather than every turn.
  // Disabled below rep 30 — new labels shouldn't be punished before stabilizing.
  const recentlyReleased = s.songs.some((song) => song.released && s.turn - song.turnReleased <= 12);
  if (!recentlyReleased && s.turn > 4 && s.turn % 2 === 0 && s.reputation >= 30) {
    repDelta -= 1;
  }

  // Elite reputation decay: maintaining top status requires ongoing quality output
  // Touring helps but can't fully substitute for releasing quality music
  const currentRep = s.reputation + repDelta + tourRepDelta;
  if (currentRep > 75) {
    const hasRecentQuality = s.songs.some((song) => song.released && song.quality >= 50 && s.turn - song.turnReleased <= 8);
    const hasActiveTouring = updatedArtists.some((a) => a.signed && a.onTour);
    // Base decay chance scales with how far above 75 (rep 80: ~20%, rep 100: ~100%)
    const eliteDecayChance = (currentRep - 75) * 0.04;
    // Quality releases fully shield; touring only partially shields (50% reduction)
    if (hasRecentQuality) {
      // no decay
    } else if (hasActiveTouring) {
      if (Math.random() < eliteDecayChance * 0.5) repDelta -= 1;
    } else {
      if (Math.random() < eliteDecayChance) repDelta -= 1;
    }
    // Above 90: unconditional pressure (~12% chance per turn) — staying at the very top is hard
    if (currentRep > 90 && Math.random() < 0.12) {
      repDelta -= 1;
    }
  }

  // Credibility gate: rep gains halved above 60 until label has 3+ songs that charted 3+ weeks
  const totalChartingSongs = s.songs.filter(song => song.released && song.weeksOnChart >= 3).length;
  if (s.reputation >= 60 && totalChartingSongs < 3) {
    tourRepDelta = Math.floor(tourRepDelta * 0.5);
    repDelta = Math.floor(repDelta * 0.5);
  }

  // Diminishing rep gains: harder to climb as reputation increases (uses dimRep)
  const totalRepGain = repDelta + tourRepDelta;
  if (totalRepGain > 0) {
    const dampened = dimRep(s.reputation, totalRepGain);
    // Redistribute: reduce tourRepDelta first, then repDelta
    const reduction = totalRepGain - dampened;
    if (tourRepDelta > 0 && reduction > 0) {
      const tourReduction = Math.min(tourRepDelta, reduction);
      tourRepDelta -= tourReduction;
      const remaining = reduction - tourReduction;
      if (remaining > 0) repDelta -= remaining;
    } else {
      repDelta -= reduction;
    }
  }

  const newReputation = clamp(s.reputation + repDelta + tourRepDelta, 0, 100);
  const newFanbase = Math.max(0, s.fanbase + fanDelta + tourFanDelta);

  // Weekly operating costs (all ladder departments)
  const deptOverhead =
    STUDIO_DATA[s.studioLevel].weeklyOperatingCost +
    SCOUTING_DATA[s.scoutingLevel].weeklyOperatingCost +
    ARTIST_DEV_DATA[s.artistDevLevel].weeklyOperatingCost +
    TOURING_DEPT_DATA[s.touringLevel].weeklyOperatingCost +
    MARKETING_DATA[s.marketingLevel].weeklyOperatingCost +
    PR_DATA[s.prLevel].weeklyOperatingCost +
    MERCH_DATA[s.merchLevel].weeklyOperatingCost;
  // Per-artist roster salary: each signed artist costs $500/week base, scaling with OVR
  const signedArtists = updatedArtists.filter((a) => a.signed);
  const rosterSalary = signedArtists.reduce((sum, a) => {
    const ovrMult = 0.5 + (a.overallRating / 100) * 1.5; // 0.5x at OVR 0, 2x at OVR 100
    return sum + Math.floor(500 * ovrMult);
  }, 0);
  // Base office rent ($500/week) ensures minimum burn even with no upgrades
  const weeklyOverhead = deptOverhead + rosterSalary + 500;
  const newMoney = s.money + moneyDelta - weeklyOverhead;

  // Generate recording tokens from studio level (cap pool at 10)
  const newTokens = Math.min(10, s.recordingTokens + STUDIO_DATA[s.studioLevel].tokensPerWeek);

  // Dynamic bankruptcy threshold: 8 weeks of overhead buffer (min $15k, max $200k).
  // Gives players enough runway to recover from mistakes without making early game easy.
  const bankruptcyThreshold = -Math.max(15000, Math.min(200000, weeklyOverhead * 8));
  const gameOver = newMoney < bankruptcyThreshold || (s.turn > 26 && newReputation < 10);

  // Update weeksOnChart for industry songs that appeared in this chart
  const chartSongIds = new Set(newChart.filter((e) => !e.isPlayerSong).map((e) => e.title + e.artistName));
  const finalIndustrySongs = s.industrySongs.map((is) => {
    const onChart = chartSongIds.has(is.title + is.artistName);
    return onChart ? { ...is, weeksOnChart: is.weeksOnChart + 1, streamsTotal: is.streamsTotal + Math.floor(Math.random() * 500000 + 200000) } : is;
  });

  // Update rival label aggregate stats from chart performance
  // Merge hip-hop event updates with chart stats for rival labels
  const finalRivalLabels = rivalLabelsAfterFeatures.map((label) => {
    const labelChartSongs = finalIndustrySongs.filter((is) => is.labelId === label.id);
    const totalStreams = labelChartSongs.reduce((sum, is) => sum + is.streamsTotal, 0);
    const chartHits = labelChartSongs.filter((is) => {
      const entry = newChart.find((c) => !c.isPlayerSong && c.title === is.title && c.artistName === is.artistName);
      return entry && entry.position <= 10;
    }).length;
    return { ...label, totalStreams, chartHits, activeSongs: labelChartSongs };
  });

  // ── Milestone tracking ────────────────────────────────────────────────────
  const newMilestones: LabelMilestone[] = [];
  // Chart #1
  const chartLeader = newChart[0];
  if (chartLeader?.isPlayerSong) {
    const prevLeader = state.chart[0];
    if (!prevLeader?.isPlayerSong) {
      newMilestones.push(makeMilestone(s.turn, "chart_number_one",
        `"${chartLeader.title}" Hits #1!`,
        `${chartLeader.artistName} claimed the top spot on the chart.`
      ));
    }
  }
  // First album milestone
  const firstReleasedAlbum = s.albums.find((al) => al.status === "released");
  if (firstReleasedAlbum && !state.labelMilestones.some((m) => m.type === "first_album")) {
    newMilestones.push(makeMilestone(s.turn, "first_album",
      "First Album Released!",
      `${s.labelName} released its debut album.`
    ));
  }
  // Revenue milestone ($1M)
  if (newMoney >= 1000000 && state.money < 1000000) {
    newMilestones.push(makeMilestone(s.turn, "revenue_milestone",
      "Millionaire Status!",
      `${s.labelName} crossed $1,000,000 in cash.`
    ));
  }

  // ── Award ceremony ────────────────────────────────────────────────────────
  let pendingCeremony: AwardCeremony | null = null;
  let awardHistory = s.awardHistory;
  let awardMoneyBonus = 0;
  let awardRepBonus = 0;
  const awardMilestones: LabelMilestone[] = [];

  if (shouldRunAwardCeremony(s.turn)) {
    const ceremony = computeAwardCeremony({ ...s, money: newMoney, reputation: newReputation });
    pendingCeremony = ceremony;
    awardHistory = [ceremony, ...awardHistory];
    awardMoneyBonus = ceremony.moneyReward;
    awardRepBonus = ceremony.reputationReward;
    if (ceremony.playerWins.length > 0) {
      awardMilestones.push(makeMilestone(s.turn, "award_win",
        `${ceremony.playerWins.length} Award${ceremony.playerWins.length > 1 ? "s" : ""} Won!`,
        `${s.labelName} won ${ceremony.playerWins.length} award(s) at the Year ${ceremony.year} ceremony.`
      ));
    }
  }

  const allNewEvents = [...tourEvents, ...contractEvents, ...milestoneEvents, ...events, ...hipHopResult.events, ...featureEvents, ...incomeEvents];
  const allMilestones = [...newMilestones, ...awardMilestones, ...s.labelMilestones];

  // Update revenue history
  const revenueHistory = {
    streaming: (s.revenueHistory?.streaming ?? 0) + streamRevenue,
    touring: (s.revenueHistory?.touring ?? 0) + tourRevenue,
    merch: (s.revenueHistory?.merch ?? 0) + merchIncome,
    brandDeals: (s.revenueHistory?.brandDeals ?? 0) + brandDealRevenue,
    awards: (s.revenueHistory?.awards ?? 0) + awardMoneyBonus,
    weeklyStreaming: streamRevenue,
    weeklyTouring: tourRevenue,
    weeklyMerch: merchIncome,
    weeklyBrandDeals: brandDealRevenue,
    weeklyOverhead: weeklyOverhead,
  };

  // ── Yearly progression for free agents & rival artists ──────────────────
  let finalPool = s.freeAgentPool;
  let yearEndRivals = finalRivalLabels;
  if (isYearEnd) {
    // Free agents: simple age-based progression (no yearly stats, use defaults)
    finalPool = s.freeAgentPool.map((a) => {
      if ((a.lastProgressionTurn ?? 0) >= s.turn) return a;
      const result = applyYearlyProgression(a, 0);
      return {
        ...a,
        overallRating: result.overallRating,
        potential: result.potential,
        attributes: result.attributes,
        archetype: result.archetype,
        peakOverall: Math.max(a.peakOverall ?? result.overallRating, result.overallRating),
        lastProgressionTurn: s.turn,
        yearlyReleasesQuality: [],
        yearlyChartsWeeks: 0,
        yearlyTourWeeks: 0,
        yearlyControversies: 0,
      };
    });

    // Rival label artists
    yearEndRivals = finalRivalLabels.map((label) => ({
      ...label,
      rosterArtists: label.rosterArtists.map((a) => {
        if ((a.lastProgressionTurn ?? 0) >= s.turn) return a;
        // Rival artists get simulated activity based on label prestige
        const simActivity: Artist = {
          ...a,
          yearlyReleasesQuality: Array.from({ length: rand(1, 3) }, () => rand(40, 70 + Math.floor(label.prestige * 0.3))),
          yearlyChartsWeeks: rand(0, Math.floor(label.prestige / 10)),
          yearlyTourWeeks: rand(0, 8),
        };
        const result = applyYearlyProgression(simActivity, 0);
        return {
          ...a,
          overallRating: result.overallRating,
          potential: result.potential,
          attributes: result.attributes,
          archetype: result.archetype,
          peakOverall: Math.max(a.peakOverall ?? result.overallRating, result.overallRating),
          lastProgressionTurn: s.turn,
          yearlyReleasesQuality: [],
          yearlyChartsWeeks: 0,
          yearlyTourWeeks: 0,
          yearlyControversies: 0,
        };
      }),
    }));
  }

  // ── Hall of Fame: process retired artists ─────────────────────────────────
  let hallOfFame = s.hallOfFame ?? [];
  const hofEvents: GameEvent[] = [];
  // Check artists who left the label this turn (contract events with retirement/walkout)
  for (const ev of contractEvents) {
    if (ev.type === "retirement" && ev.artistId) {
      const retiree = artistsPostProgression.find((a) => a.id === ev.artistId);
      if (retiree) {
        const hofResult = processHallOfFame(
          { ...s, artists: artistsPostProgression, hallOfFame, songs: updatedSongs, albums: updatedAlbums, awardHistory },
          retiree
        );
        hallOfFame = hofResult.hallOfFame;
        if (hofResult.event) hofEvents.push(hofResult.event);
      }
    }
  }

  // ── Dynasty tracking (at year-end) ────────────────────────────────────────
  let dynastyYears = s.dynastyYears ?? 0;
  if (isYearEnd) {
    dynastyYears = checkDynasty({ ...s, reputation: clamp(newReputation + awardRepBonus, 0, 100), dynastyYears });
  }

  // ── Achievement checking ──────────────────────────────────────────────────
  const preAchievementState: GameState = {
    ...s,
    money: newMoney + awardMoneyBonus,
    reputation: clamp(newReputation + awardRepBonus, 0, 100),
    fanbase: newFanbase,
    artists: artistsPostProgression,
    songs: updatedSongs,
    albums: updatedAlbums,
    chart: newChart,
    awardHistory,
    rivalLabels: yearEndRivals,
    hallOfFame,
    dynastyYears,
    revenueHistory,
    achievements: s.achievements ?? [],
    activeBeefs: hipHopResult.activeBeefs,
    artistRelationships: featureRelationships,
    pendingFeatureRequests: allFeatureRequests,
  };
  const updatedAchievements = checkAchievements(preAchievementState);

  const finalAllEvents = [...hofEvents, ...progressionEvents, ...allNewEvents, ...s.recentEvents].slice(0, 80);

  return {
    ...s,
    money: newMoney + awardMoneyBonus,
    reputation: clamp(newReputation + awardRepBonus, 0, 100),
    fanbase: newFanbase,
    recordingTokens: newTokens,
    artists: artistsPostProgression,
    recentEvents: finalAllEvents,
    industrySongs: finalIndustrySongs,
    rivalLabels: yearEndRivals,
    freeAgentPool: finalPool,
    pendingAwardCeremony: pendingCeremony,
    awardHistory,
    labelMilestones: allMilestones.slice(0, 100),
    revenueHistory,
    activeBeefs: hipHopResult.activeBeefs,
    artistRelationships: featureRelationships,
    pendingFeatureRequests: allFeatureRequests,
    achievements: updatedAchievements,
    hallOfFame,
    dynastyYears,
    gameOver,
  };
}

// ── Fatigue management ────────────────────────────────────────────────────────

export function restArtist(state: GameState, artistId: string): { newState: GameState; error?: string } {
  const artist = state.artists.find((a) => a.id === artistId);
  if (!artist || !artist.signed) return { newState: state, error: "Artist not found or not signed." };
  if (artist.jailed) return { newState: state, error: "Artist is currently incarcerated." };
  if (artist.onTour) return { newState: state, error: "Artist is currently on tour." };
  // Grants a significant fatigue reduction and morale boost; skips any recording this turn
  return {
    newState: {
      ...state,
      artists: state.artists.map((a) =>
        a.id === artistId
          ? {
              ...a,
              fatigue: clamp(a.fatigue - 20, 0, 100),
              morale: clamp(a.morale + 10, 0, 100),
            }
          : a
      ),
    },
  };
}

export function promoWeek(state: GameState, artistId: string): { newState: GameState; error?: string } {
  const artist = state.artists.find((a) => a.id === artistId);
  if (!artist || !artist.signed) return { newState: state, error: "Artist not found or not signed." };
  if (artist.jailed) return { newState: state, error: "Artist is currently incarcerated." };
  if (artist.onTour) return { newState: state, error: "Artist is currently on tour." };
  // Light press/social push: small popularity and fan gain, minimal fatigue cost
  return {
    newState: {
      ...state,
      artists: state.artists.map((a) =>
        a.id === artistId
          ? {
              ...a,
              fatigue: clamp(a.fatigue + 3, 0, 100),
              popularity: clamp(a.popularity + rand(1, 3), 0, 100),
              fanbase: a.fanbase + rand(200, 800),
              morale: clamp(a.morale + 5, 0, 100),
            }
          : a
      ),
    },
  };
}

// ── Album management ──────────────────────────────────────────────────────────

export function deleteSong(
  state: GameState,
  songId: string
): { newState: GameState; error?: string } {
  const song = state.songs.find((s) => s.id === songId);
  if (!song) return { newState: state, error: "Song not found." };
  if (song.released) return { newState: state, error: "Cannot scrap a released song." };
  return {
    newState: {
      ...state,
      songs: state.songs.filter((s) => s.id !== songId),
      albums: state.albums.map((al) => ({
        ...al,
        songIds: al.songIds.filter((id) => id !== songId),
      })),
    },
  };
}

export function addSongToAlbum(
  state: GameState,
  albumId: string,
  songId: string
): { newState: GameState; error?: string } {
  const album = state.albums.find((al) => al.id === albumId);
  if (!album || album.status !== "recording")
    return { newState: state, error: "Album not found or already released." };

  const song = state.songs.find((s) => s.id === songId);
  if (!song) return { newState: state, error: "Song not found." };
  if (song.artistId !== album.artistId)
    return { newState: state, error: "Song belongs to a different artist." };
  if (album.songIds.includes(songId))
    return { newState: state, error: "Song already on this album." };

  // Eligibility: unreleased songs must be recorded after the artist's last album release.
  // Released singles with albumEligible flag can always be added to an album.
  const artist = state.artists.find((a) => a.id === album.artistId);
  if (artist && artist.lastAlbumReleaseTurn > 0 && song.turnRecorded < artist.lastAlbumReleaseTurn && !song.albumEligible) {
    return { newState: state, error: "Song was recorded before last album release and is not eligible for a new album." };
  }

  // Singles cap: max 4 or 40% of current track count (whichever is lower)
  if (song.released) {
    const currentTrackCount = album.songIds.length + 1; // including this song
    const maxSingles = Math.min(4, Math.floor(currentTrackCount * 0.4));
    const currentSingles = album.songIds.filter(
      (id) => state.songs.find((s) => s.id === id)?.released
    ).length;
    if (currentSingles >= maxSingles) {
      return { newState: state, error: `Singles cap reached (${currentSingles}/${maxSingles}). Too many pre-released singles on this album.` };
    }
  }

  // If song is on another in-progress album, move it
  const prevAlbum = state.albums.find(
    (al) => al.status === "recording" && al.id !== albumId && al.songIds.includes(songId)
  );

  return {
    newState: {
      ...state,
      albums: state.albums.map((al) => {
        if (al.id === albumId) return { ...al, songIds: [...al.songIds, songId] };
        if (prevAlbum && al.id === prevAlbum.id)
          return { ...al, songIds: al.songIds.filter((id) => id !== songId) };
        return al;
      }),
      songs: state.songs.map((s) => (s.id === songId ? { ...s, albumId, albumStatus: "maybe" as const, linkedAlbumId: s.released ? albumId : s.linkedAlbumId } : s)),
    },
  };
}

export function setSongAlbumStatus(
  state: GameState,
  songId: string,
  status: "confirmed" | "maybe" | "scrap"
): GameState {
  return {
    ...state,
    songs: state.songs.map((s) => (s.id === songId ? { ...s, albumStatus: status } : s)),
  };
}

export function removeSongFromAlbum(
  state: GameState,
  albumId: string,
  songId: string
): { newState: GameState; error?: string } {
  const album = state.albums.find((al) => al.id === albumId);
  if (!album || album.status !== "recording")
    return { newState: state, error: "Album not found or already released." };
  if (!album.songIds.includes(songId))
    return { newState: state, error: "Song not on this album." };

  return {
    newState: {
      ...state,
      albums: state.albums.map((al) =>
        al.id === albumId ? { ...al, songIds: al.songIds.filter((id) => id !== songId) } : al
      ),
      songs: state.songs.map((s) =>
        s.id === songId ? { ...s, albumId: undefined, albumStatus: undefined } : s
      ),
    },
  };
}

export const ALBUM_CYCLE_TURNS = 5;       // minimum turns after album release before new project / renegotiation
export const ALBUM_YEAR_TURNS = 52;
export const HIGH_WORK_ETHIC_THRESHOLD = 75; // workEthic needed for 2 albums/year

export function startAlbum(
  state: GameState,
  artistId: string
): { newState: GameState; album: Album | null; error?: string } {
  const artist = state.artists.find((a) => a.id === artistId);
  if (!artist || !artist.signed) return { newState: state, album: null, error: "Artist not signed." };

  const alreadyRecording = state.albums.find(
    (al) => al.artistId === artistId && al.status === "recording"
  );
  if (alreadyRecording) return { newState: state, album: null, error: "Artist already has an album in progress." };

  // Album cycle requirement: must complete previous cycle before starting a new project
  if (artist.lastAlbumReleaseTurn > 0) {
    const turnsSinceLastAlbum = state.turn - artist.lastAlbumReleaseTurn;
    if (turnsSinceLastAlbum < ALBUM_CYCLE_TURNS) {
      const weeksLeft = ALBUM_CYCLE_TURNS - turnsSinceLastAlbum;
      return { newState: state, album: null, error: `${artist.name} must complete their album cycle first. ${weeksLeft} week(s) remaining (release → sales → promo → touring).` };
    }
    // Album frequency limit: one per year; high work ethic allows a second
    const canDoSecond = artist.traits.workEthic >= HIGH_WORK_ETHIC_THRESHOLD;
    const yearCooldown = canDoSecond ? Math.floor(ALBUM_YEAR_TURNS / 2) : ALBUM_YEAR_TURNS;
    if (turnsSinceLastAlbum < yearCooldown) {
      const weeksLeft = yearCooldown - turnsSinceLastAlbum;
      const reason = canDoSecond
        ? `High work ethic allows two albums per year, but needs ${weeksLeft} more week(s).`
        : `Artists can release one album per year. ${weeksLeft} week(s) remaining.`;
      return { newState: state, album: null, error: reason };
    }
  }

  const album: Album = {
    id: uid(),
    artistId,
    title: generateAlbumTitle(),
    songIds: [],
    status: "recording",
    turnStarted: state.turn,
    turnReleased: 0,
    qualityScore: 0,
    totalStreams: 0,
    totalRevenue: 0,
    marketingBudget: 0,
  };

  return {
    newState: { ...state, albums: [...state.albums, album] },
    album,
  };
}

export function releaseAlbum(
  state: GameState,
  albumId: string,
  marketingBudget: number = 0
): { newState: GameState; error?: string } {
  const album = state.albums.find((al) => al.id === albumId);
  if (!album || album.status !== "recording")
    return { newState: state, error: "Album not found or already released." };
  const confirmedCount = state.songs.filter(
    (s) => album.songIds.includes(s.id) && (s.albumStatus === "confirmed" || !s.albumStatus)
  ).length;
  if (confirmedCount < EP_MIN_TRACKS)
    return { newState: state, error: `Need at least ${EP_MIN_TRACKS} confirmed tracks (${confirmedCount} confirmed). ${EP_MIN_TRACKS}-6 = EP, ${ALBUM_MIN_TRACKS}+ = Album.` };
  if (state.money < marketingBudget)
    return { newState: state, error: "Not enough money for marketing budget." };

  // Only confirmed songs count toward quality and release; maybe/scrap are excluded
  const allAlbumSongs = state.songs.filter((s) => album.songIds.includes(s.id));
  const albumSongs = allAlbumSongs.filter((s) => s.albumStatus === "confirmed" || !s.albumStatus);
  const artist = state.artists.find((a) => a.id === album.artistId);

  // Compute base quality score
  const avgQuality =
    albumSongs.reduce((sum, s) => sum + s.quality, 0) / albumSongs.length;
  const marketingBonus = Math.min(20, Math.floor((marketingBudget / 10000)));
  const baseQualityScore = clamp(
    Math.floor(
      avgQuality * 0.5 +
        (artist?.popularity ?? 0) * 0.25 +
        state.reputation * 0.15 +
        marketingBonus
    ),
    1,
    100
  );

  // Apply album length strategy modifiers based on artist personality
  const strategy = artist
    ? computeAlbumStrategy(albumSongs.length, artist.traits)
    : { qualityBonus: 0, repBonus: 0, viralMult: 1.0, fits: [], clashes: [], category: "Medium" as const };

  // Album approval check — apply morale penalty for mismatched expectations
  const approval = artist ? evaluateAlbumApproval(artist, albumSongs, strategy) : null;

  // Stockpile bonus: reward albums where most songs were saved (never released as singles)
  const unreleasedCount = albumSongs.filter((s) => !s.released).length;
  const stockpileBonus = unreleasedCount >= 5 ? rand(5, 15) : unreleasedCount >= 3 ? rand(2, 6) : 0;

  // Album hype: accumulated from pre-release singles performance
  const preReleaseSingles = albumSongs.filter((s) => s.released);
  const hypeScore = preReleaseSingles.reduce((sum, s) => {
    const chartWeight = s.chartPosition ? Math.max(0, 21 - s.chartPosition) : 0;
    const qualWeight = s.quality * 0.3;
    const streamWeight = Math.min(20, s.streamsTotal / 100000);
    return sum + chartWeight + qualWeight + streamWeight;
  }, 0);
  const hypeBonus = Math.min(10, Math.floor(hypeScore / 10));

  const qualityScore = clamp(baseQualityScore + strategy.qualityBonus + stockpileBonus + hypeBonus, 1, 100);

  // Viral potential: base boost from quality + strategy multiplier
  const baseViralBoost = Math.floor(qualityScore * 0.15);

  // Release all songs with boosted viral potential; lock album songs
  const updatedSongs = state.songs.map((s) =>
    album.songIds.includes(s.id)
      ? {
          ...s,
          released: true,
          turnReleased: s.released ? s.turnReleased : state.turn, // keep original release date for pre-released singles
          viralPotential: clamp(
            Math.floor((s.viralPotential + baseViralBoost) * strategy.viralMult),
            1,
            100
          ),
          albumStatus: "confirmed" as const, // lock all album tracks
        }
      : s
  );

  // Post-album development check (age-based curve)
  const devResult = artist ? applyAlbumDevelopment(artist, state.artistDevLevel) : null;
  const devEvent: GameEvent | null = devResult && artist && devResult.overallRating !== artist.overallRating
    ? {
        id: uid(),
        turn: state.turn,
        type: "milestone",
        title: devResult.overallRating > (artist.overallRating) ? `${artist.name} Leveled Up` : `${artist.name} Showing Wear`,
        description:
          devResult.overallRating > (artist.overallRating)
            ? `${artist.name}'s overall rating improved to ${devResult.overallRating} after this album cycle.`
            : `${artist.name}'s overall rating slipped to ${devResult.overallRating} — age is a factor.`,
        artistId: artist.id,
        moneyDelta: 0,
        reputationDelta: 0,
        fanbaseDelta: 0,
        resolved: true,
      }
    : null;

  // Decrement contractAlbumsLeft; update popularity, overallRating, morale, and album release turn
  // Recalculate minSongQuality when OVR changes so standards stay realistic
  const updatedArtists = state.artists.map((a) => {
    if (a.id !== album.artistId) return a;
    const newOvr = devResult ? devResult.overallRating : a.overallRating;
    return {
      ...a,
      contractAlbumsLeft: Math.max(0, a.contractAlbumsLeft - 1),
      popularity: clamp(a.popularity + Math.floor(qualityScore * 0.1), 0, 100),
      overallRating: newOvr,
      potential: devResult ? devResult.potential : a.potential,
      attributes: devResult ? devResult.attributes : a.attributes,
      morale: clamp(a.morale + (approval?.moralePenalty ?? 0), 0, 100),
      lastAlbumReleaseTurn: state.turn,
      minSongQuality: Math.floor(newOvr * (0.50 + a.traits.competitiveness / 200)),
      totalAlbumsReleased: (a.totalAlbumsReleased ?? 0) + 1,
      momentum: clamp((a.momentum ?? 50) + Math.floor(qualityScore * 0.15), 0, 100),
      buzz: clamp((a.buzz ?? 30) + Math.floor(qualityScore * 0.10), 0, 100),
      yearlyReleasesQuality: [...(a.yearlyReleasesQuality ?? []), qualityScore],
    };
  });

  // Update album
  const updatedAlbums = state.albums.map((al) =>
    al.id === albumId
      ? { ...al, status: "released" as const, turnReleased: state.turn, qualityScore, marketingBudget, hypeScore }
      : al
  );

  // Album release event
  const strategyLabel = strategy.category === "Short"
    ? " Short album rep bonus applied."
    : strategy.category === "Long"
    ? " Long album stream boost applied."
    : "";
  const albumEvent: GameEvent = {
    id: uid(),
    turn: state.turn,
    type: "album_release",
    title: `"${album.title}" Drops`,
    description: `${artist?.name ?? "Unknown"}'s album "${album.title}" released (${strategy.category}, ${qualityScore}/100 score). ${albumSongs.length} tracks drop.${strategyLabel}`,
    artistId: album.artistId,
    moneyDelta: -marketingBudget,
    reputationDelta: dimRep(state.reputation, (qualityScore >= 60 ? rand(2, 5) : qualityScore >= 40 ? rand(1, 2) : rand(0, 1)) + strategy.repBonus + (stockpileBonus > 0 ? rand(1, 2) : 0)),
    fanbaseDelta: Math.floor(qualityScore * 200 * (1 + MARKETING_DATA[state.marketingLevel].fanGrowthPct / 100)),
    popularityDelta: Math.floor(qualityScore * 0.1),
    resolved: true,
  };

  const repGain = albumEvent.reputationDelta;
  const fanGain = albumEvent.fanbaseDelta;

  return {
    newState: {
      ...state,
      money: state.money - marketingBudget,
      reputation: clamp(state.reputation + repGain, 0, 100),
      fanbase: state.fanbase + fanGain,
      songs: updatedSongs,
      albums: updatedAlbums,
      artists: updatedArtists,
      recentEvents: [albumEvent, ...(devEvent ? [devEvent] : []), ...state.recentEvents].slice(0, 60),
    },
  };
}

// ── Deluxe album: add bonus tracks after release ─────────────────────────────

export function addDeluxeTrack(
  state: GameState,
  albumId: string,
  songId: string
): { newState: GameState; error?: string } {
  const album = state.albums.find((al) => al.id === albumId);
  if (!album) return { newState: state, error: "Album not found." };
  if (album.status !== "released") return { newState: state, error: "Album must be released first." };

  const song = state.songs.find((s) => s.id === songId);
  if (!song) return { newState: state, error: "Song not found." };
  if (song.artistId !== album.artistId) return { newState: state, error: "Song belongs to a different artist." };
  if (song.released) return { newState: state, error: "Song is already released." };
  if (album.songIds.includes(songId)) return { newState: state, error: "Song already on this album." };

  const existingDeluxe = album.deluxeTrackIds ?? [];
  if (existingDeluxe.length >= 5) return { newState: state, error: "Deluxe edition can have at most 5 bonus tracks." };

  // Must be within 12 turns of album release
  if (state.turn - album.turnReleased > 12) return { newState: state, error: "Too late to add deluxe tracks (must be within 12 weeks of release)." };

  return {
    newState: {
      ...state,
      albums: state.albums.map((al) =>
        al.id === albumId
          ? {
              ...al,
              isDeluxe: true,
              deluxeTrackIds: [...existingDeluxe, songId],
              songIds: [...al.songIds, songId],
            }
          : al
      ),
      songs: state.songs.map((s) =>
        s.id === songId
          ? { ...s, albumId, albumStatus: "confirmed" as const, released: true, turnReleased: state.turn }
          : s
      ),
    },
  };
}

// ── Sign / release artist ─────────────────────────────────────────────────────

export function signArtist(
  state: GameState,
  artistId: string,
  signingFee: number,
  albumCount: 1 | 2 | 3
): { newState: GameState; error?: string } {
  // Roster cap based on studio level
  const rosterCap = STUDIO_DATA[state.studioLevel].rosterCap;
  const currentSigned = state.artists.filter((a) => a.signed).length;
  if (currentSigned >= rosterCap) {
    return { newState: state, error: `Roster full (${currentSigned}/${rosterCap}). Upgrade your studio to sign more artists.` };
  }
  if (state.money < signingFee) return { newState: state, error: "Not enough money." };

  // Artist may be in artists[] or freeAgentPool[]
  const inRoster = state.artists.find((a) => a.id === artistId);
  const inPool = state.freeAgentPool.find((a) => a.id === artistId);
  const target = inRoster ?? inPool;
  if (!target) return { newState: state, error: "Artist not found." };

  // ── Signing cooldown: prevent re-roll exploitation ──
  const SIGNING_COOLDOWN = 8; // 8 weeks before you can re-approach
  const REP_CHANGE_OVERRIDE = 10; // rep must improve by 10+ to bypass cooldown
  if (target.lastOfferOutcome === "declined" && target.lastOfferTurn) {
    const turnsSince = state.turn - target.lastOfferTurn;
    const repImproved = state.reputation - (target.lastOfferReputation ?? 0);
    if (turnsSince < SIGNING_COOLDOWN && repImproved < REP_CHANGE_OVERRIDE) {
      const weeksLeft = SIGNING_COOLDOWN - turnsSince;
      return { newState: state, error: `${target.name} recently declined your offer. Can re-approach in ${weeksLeft} week${weeksLeft > 1 ? "s" : ""}, or after improving reputation by ${REP_CHANGE_OVERRIDE - repImproved}+ points.` };
    }
  }

  // Willingness check: artist must agree to sign based on label reputation vs their star power
  const willingness = computeWillingness(target, state.reputation);
  const roll = Math.random() * 100;
  if (roll > willingness) {
    // Mark the decline on the artist so they can't be immediately re-approached
    const declinedArtist = { ...target, lastOfferTurn: state.turn, lastOfferOutcome: "declined" as const, lastOfferReputation: state.reputation };
    return {
      newState: {
        ...state,
        artists: inRoster ? state.artists.map((a) => a.id === artistId ? declinedArtist : a) : state.artists,
        freeAgentPool: inPool ? state.freeAgentPool.map((a) => a.id === artistId ? declinedArtist : a) : state.freeAgentPool,
      },
      error: `${target.name} declined your offer (${willingness}% willingness). Can re-approach in ${SIGNING_COOLDOWN} weeks. Build more reputation to attract this caliber of talent.`,
    };
  }

  // Scouting bonus: better scouting department gives signed artists a momentum/buzz boost
  // Represents finding artists at the right moment and providing an initial platform
  const scoutBonus = SCOUTING_DATA[state.scoutingLevel].scoutedPct;
  const momBoost = Math.floor(scoutBonus * 0.15); // 0-15 momentum based on scouting level
  const buzzBoost = Math.floor(scoutBonus * 0.10); // 0-10 buzz
  const signedArtist = {
    ...target,
    signed: true,
    contractAlbumsTotal: albumCount,
    contractAlbumsLeft: albumCount,
    momentum: clamp((target.momentum ?? 0) + momBoost, 0, 100),
    buzz: clamp((target.buzz ?? 0) + buzzBoost, 0, 100),
  };

  return {
    newState: {
      ...state,
      money: state.money - signingFee,
      artists: inPool
        ? [...state.artists, signedArtist]
        : state.artists.map((a) => a.id === artistId ? signedArtist : a),
      freeAgentPool: inPool
        ? state.freeAgentPool.filter((a) => a.id !== artistId)
        : state.freeAgentPool,
    },
  };
}

export function releaseArtist(state: GameState, artistId: string): GameState {
  return {
    ...state,
    artists: state.artists.map((a) =>
      a.id === artistId
        ? { ...a, signed: false, contractAlbumsTotal: 0, contractAlbumsLeft: 0 }
        : a
    ),
  };
}

// ── Contract helpers ───────────────────────────────────────────────────────────

export function computeSigningFee(artist: Artist, albumCount: 1 | 2 | 3): number {
  const ovrFactor = Math.pow(artist.overallRating / 45, 2.8);
  const momentumFactor = 0.7 + ((artist.momentum ?? 50) / 100) * 0.6; // 0.7-1.3x
  const buzzFactor = 0.85 + ((artist.buzz ?? 30) / 100) * 0.3; // 0.85-1.15x

  const base = Math.floor(
    ovrFactor * 12000
    + artist.fanbase * 0.8
    + artist.popularity * 500
    + (artist.momentum ?? 50) * 200
  );

  const moneyMult = 0.8 + (artist.traits.moneyMotivation / 100) * 0.6;
  const albumMult = albumCount === 1 ? 0.65 : albumCount === 2 ? 1.0 : 1.45;
  const ageMult = artist.age <= 22 ? 1.15 : artist.age >= 35 ? 0.65 : artist.age >= 33 ? 0.8 : 1.0;

  // Career phase multiplier
  const phase = artist.careerPhase ?? "unknown";
  const phaseMult = phase === "peak" ? 1.5
                  : phase === "established" ? 1.3
                  : phase === "breakout" ? 1.2
                  : phase === "buzzing" ? 1.1
                  : phase === "emerging" ? 1.0
                  : phase === "declining" ? 0.6
                  : phase === "washed" ? 0.4
                  : phase === "legacy" ? 0.75
                  : 0.85;

  return Math.floor(base * albumMult * moneyMult * ageMult * phaseMult * momentumFactor * buzzFactor);
}

export function computeRenegotiationFee(
  artist: Artist,
  state: GameState,
  albumCount: 1 | 2 | 3
): number {
  // Renegotiation uses the same exponential OVR curve as signing, plus performance factors.
  // Artists who've proven themselves on the label demand more.
  const recentSongs = state.songs
    .filter((s) => s.artistId === artist.id && s.released)
    .slice(-5);
  const avgQuality =
    recentSongs.length > 0
      ? recentSongs.reduce((sum, s) => sum + s.quality, 0) / recentSongs.length
      : 50;
  const ovrFactor = Math.pow(artist.overallRating / 45, 2.8);
  const base = Math.floor(
    ovrFactor * 14000 +
      artist.fanbase * 0.8 +
      artist.popularity * 500 +
      (artist.momentum ?? 50) * 200 +
      state.reputation * 200 +
      avgQuality * 400
  );
  const moneyMult = 0.8 + (artist.traits.moneyMotivation / 100) * 0.6;
  const albumMult = albumCount === 1 ? 0.65 : albumCount === 2 ? 1.0 : 1.45;
  return Math.floor(base * albumMult * moneyMult);
}

export function renegotiateContract(
  state: GameState,
  artistId: string,
  albumCount: 1 | 2 | 3,
  fee: number
): { newState: GameState; error?: string } {
  if (state.money < fee) return { newState: state, error: "Not enough money." };
  return {
    newState: {
      ...state,
      money: state.money - fee,
      artists: state.artists.map((a) =>
        a.id === artistId
          ? { ...a, contractAlbumsTotal: albumCount, contractAlbumsLeft: albumCount }
          : a
      ),
    },
  };
}

export function riskRetaining(
  state: GameState,
  artistId: string
): { newState: GameState; stayed: boolean } {
  const artist = state.artists.find((a) => a.id === artistId);
  if (!artist) return { newState: state, stayed: false };
  // loyalty (0–100) determines chance of staying; random bonus for low-popularity artists
  const stayChance = clamp(artist.traits.loyalty * 0.8 + (100 - artist.popularity) * 0.1, 10, 90);
  const stayed = Math.random() * 100 < stayChance;
  if (stayed) {
    return {
      newState: {
        ...state,
        artists: state.artists.map((a) =>
          a.id === artistId ? { ...a, contractAlbumsLeft: 1 } : a
        ),
      },
      stayed: true,
    };
  }
  return { newState: releaseArtist(state, artistId), stayed: false };
}

// ── Buy standalone upgrade ────────────────────────────────────────────────────

export function buyUpgrade(state: GameState, upgradeId: string): GameState {
  const upgrade = state.upgrades.find((u) => u.id === upgradeId);
  if (!upgrade || upgrade.purchased || state.money < upgrade.cost) return state;
  return {
    ...state,
    money: state.money - upgrade.cost,
    upgrades: state.upgrades.map((u) => (u.id === upgradeId ? { ...u, purchased: true } : u)),
  };
}

// ── Studio ladder upgrade ─────────────────────────────────────────────────────

export function upgradeStudio(state: GameState): { newState: GameState; error?: string } {
  const currentLevel = state.studioLevel;
  if (currentLevel >= 10) return { newState: state, error: "Studio is already at max level." };
  const nextStage = STUDIO_DATA[currentLevel + 1];
  if (state.money < nextStage.unlockCost)
    return { newState: state, error: `Need $${nextStage.unlockCost.toLocaleString()} to upgrade studio to Level ${currentLevel + 1}.` };
  return {
    newState: {
      ...state,
      money: state.money - nextStage.unlockCost,
      studioLevel: currentLevel + 1,
    },
  };
}

// ── Scouting ladder upgrade ───────────────────────────────────────────────────

export function upgradeScouting(state: GameState): { newState: GameState; error?: string } {
  const currentLevel = state.scoutingLevel;
  if (currentLevel >= 10) return { newState: state, error: "Scouting is already at max level." };
  const nextStage = SCOUTING_DATA[currentLevel + 1];
  if (state.money < nextStage.unlockCost)
    return { newState: state, error: `Need $${nextStage.unlockCost.toLocaleString()} to upgrade scouting to Level ${currentLevel + 1}.` };
  return {
    newState: {
      ...state,
      money: state.money - nextStage.unlockCost,
      scoutingLevel: currentLevel + 1,
    },
  };
}

// ── Artist Development ladder upgrade ─────────────────────────────────────────

export function upgradeArtistDev(state: GameState): { newState: GameState; error?: string } {
  const currentLevel = state.artistDevLevel;
  if (currentLevel >= 10) return { newState: state, error: "Artist Development is already at max level." };
  const nextStage = ARTIST_DEV_DATA[currentLevel + 1];
  if (state.money < nextStage.unlockCost)
    return { newState: state, error: `Need $${nextStage.unlockCost.toLocaleString()} to upgrade Artist Development to Level ${currentLevel + 1}.` };
  return {
    newState: {
      ...state,
      money: state.money - nextStage.unlockCost,
      artistDevLevel: currentLevel + 1,
    },
  };
}

// ── Touring Department ladder upgrade ─────────────────────────────────────────

export function upgradeTouringDept(state: GameState): { newState: GameState; error?: string } {
  const currentLevel = state.touringLevel;
  if (currentLevel >= 10) return { newState: state, error: "Touring Department is already at max level." };
  const nextStage = TOURING_DEPT_DATA[currentLevel + 1];
  if (state.money < nextStage.unlockCost)
    return { newState: state, error: `Need $${nextStage.unlockCost.toLocaleString()} to upgrade Touring Department to Level ${currentLevel + 1}.` };
  return {
    newState: {
      ...state,
      money: state.money - nextStage.unlockCost,
      touringLevel: currentLevel + 1,
    },
  };
}

// ── Marketing Department ladder upgrade ───────────────────────────────────────

export function upgradeMarketing(state: GameState): { newState: GameState; error?: string } {
  const currentLevel = state.marketingLevel;
  if (currentLevel >= 10) return { newState: state, error: "Marketing Department is already at max level." };
  const nextStage = MARKETING_DATA[currentLevel + 1];
  if (state.money < nextStage.unlockCost)
    return { newState: state, error: `Need $${nextStage.unlockCost.toLocaleString()} to upgrade Marketing to Level ${currentLevel + 1}.` };
  return {
    newState: { ...state, money: state.money - nextStage.unlockCost, marketingLevel: currentLevel + 1 },
  };
}

// ── PR Department ladder upgrade ──────────────────────────────────────────────

export function upgradePR(state: GameState): { newState: GameState; error?: string } {
  const currentLevel = state.prLevel;
  if (currentLevel >= 10) return { newState: state, error: "PR Department is already at max level." };
  const nextStage = PR_DATA[currentLevel + 1];
  if (state.money < nextStage.unlockCost)
    return { newState: state, error: `Need $${nextStage.unlockCost.toLocaleString()} to upgrade PR to Level ${currentLevel + 1}.` };
  return {
    newState: { ...state, money: state.money - nextStage.unlockCost, prLevel: currentLevel + 1 },
  };
}

// ── Merchandising Department ladder upgrade ───────────────────────────────────

export function upgradeMerch(state: GameState): { newState: GameState; error?: string } {
  const currentLevel = state.merchLevel;
  if (currentLevel >= 10) return { newState: state, error: "Merchandising is already at max level." };
  const nextStage = MERCH_DATA[currentLevel + 1];
  if (state.money < nextStage.unlockCost)
    return { newState: state, error: `Need $${nextStage.unlockCost.toLocaleString()} to upgrade Merchandising to Level ${currentLevel + 1}.` };
  return {
    newState: { ...state, money: state.money - nextStage.unlockCost, merchLevel: currentLevel + 1 },
  };
}
