/**
 * Artist Ecosystem Simulation v6
 * Tests generation distributions, progression, momentum, pool health,
 * career phases, and willingness with real-world expectations.
 */

import { generateArtist, generateAttributes, computeOverall, computePotential } from "../src/lib/data";
import { applyAlbumDevelopment } from "../src/lib/engine";
import type { Artist, CareerStage, DurabilityType } from "../src/lib/types";

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 1: GENERATION DISTRIBUTION (2000 artists)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("═══════════════════════════════════════════════════════════════");
console.log("TEST 1: GENERATION DISTRIBUTION (2000 artists)");
console.log("═══════════════════════════════════════════════════════════════\n");

const artists: Artist[] = [];
for (let i = 0; i < 2000; i++) {
  artists.push(generateArtist(`test_${i}`));
}

// Age distribution
const ageBuckets: Record<string, number> = {
  "18-20": 0, "21-23": 0, "24-26": 0, "27-29": 0, "30-32": 0, "33+": 0,
};
for (const a of artists) {
  if (a.age <= 20) ageBuckets["18-20"]++;
  else if (a.age <= 23) ageBuckets["21-23"]++;
  else if (a.age <= 26) ageBuckets["24-26"]++;
  else if (a.age <= 29) ageBuckets["27-29"]++;
  else if (a.age <= 32) ageBuckets["30-32"]++;
  else ageBuckets["33+"]++;
}
console.log("Age Distribution:");
for (const [bucket, count] of Object.entries(ageBuckets)) {
  console.log(`  ${bucket}: ${count} (${(count / 20).toFixed(1)}%)`);
}

// OVR distribution
const ovrBuckets: Record<string, number> = {
  "25-34": 0, "35-44": 0, "45-54": 0, "55-64": 0, "65-74": 0, "75+": 0,
};
for (const a of artists) {
  if (a.overallRating < 35) ovrBuckets["25-34"]++;
  else if (a.overallRating < 45) ovrBuckets["35-44"]++;
  else if (a.overallRating < 55) ovrBuckets["45-54"]++;
  else if (a.overallRating < 65) ovrBuckets["55-64"]++;
  else if (a.overallRating < 75) ovrBuckets["65-74"]++;
  else ovrBuckets["75+"]++;
}
console.log("\nOVR Distribution (current, after age modifier):");
for (const [bucket, count] of Object.entries(ovrBuckets)) {
  console.log(`  ${bucket}: ${count} (${(count / 20).toFixed(1)}%)`);
}

// Potential distribution
const potBuckets: Record<string, number> = {
  "<40": 0, "40-54": 0, "55-69": 0, "70-84": 0, "85+": 0,
};
for (const a of artists) {
  if (a.potential < 40) potBuckets["<40"]++;
  else if (a.potential < 55) potBuckets["40-54"]++;
  else if (a.potential < 70) potBuckets["55-69"]++;
  else if (a.potential < 85) potBuckets["70-84"]++;
  else potBuckets["85+"]++;
}
console.log("\nPotential Distribution:");
for (const [bucket, count] of Object.entries(potBuckets)) {
  console.log(`  ${bucket}: ${count} (${(count / 20).toFixed(1)}%)`);
}

// Durability
const durCounts: Record<string, number> = { flash: 0, solid: 0, durable: 0 };
for (const a of artists) durCounts[a.durability || "solid"]++;
console.log("\nDurability Distribution:");
for (const [d, c] of Object.entries(durCounts)) {
  console.log(`  ${d}: ${c} (${(c / 20).toFixed(1)}%)`);
}

// Career phase
const phaseCounts: Record<string, number> = {
  prospect: 0, emerging: 0, established: 0, veteran: 0, declining: 0,
};
for (const a of artists) phaseCounts[a.careerPhase || "unknown"]++;
console.log("\nCareer Phase Distribution:");
for (const [p, c] of Object.entries(phaseCounts)) {
  console.log(`  ${p}: ${c} (${(c / 20).toFixed(1)}%)`);
}

// Momentum
const momBuckets: Record<string, number> = {
  "0-10": 0, "11-20": 0, "21-30": 0, "31-45": 0, "46+": 0,
};
for (const a of artists) {
  const m = a.momentum ?? 0;
  if (m <= 10) momBuckets["0-10"]++;
  else if (m <= 20) momBuckets["11-20"]++;
  else if (m <= 30) momBuckets["21-30"]++;
  else if (m <= 45) momBuckets["31-45"]++;
  else momBuckets["46+"]++;
}
console.log("\nMomentum Distribution:");
for (const [bucket, count] of Object.entries(momBuckets)) {
  console.log(`  ${bucket}: ${count} (${(count / 20).toFixed(1)}%)`);
}

// Buzz
const buzzBuckets: Record<string, number> = {
  "0-10": 0, "11-20": 0, "21-30": 0, "31+": 0,
};
for (const a of artists) {
  const b = a.buzz ?? 0;
  if (b <= 10) buzzBuckets["0-10"]++;
  else if (b <= 20) buzzBuckets["11-20"]++;
  else if (b <= 30) buzzBuckets["21-30"]++;
  else buzzBuckets["31+"]++;
}
console.log("\nBuzz Distribution:");
for (const [bucket, count] of Object.entries(buzzBuckets)) {
  console.log(`  ${bucket}: ${count} (${(count / 20).toFixed(1)}%)`);
}

// Cross-tab: age vs OVR
console.log("\nAge vs OVR Cross-tab:");
const ageGroups = ["18-20", "21-23", "24-26", "27-29", "30-32", "33+"] as const;
for (const ag of ageGroups) {
  const inGroup = artists.filter(a => {
    if (ag === "18-20") return a.age <= 20;
    if (ag === "21-23") return a.age >= 21 && a.age <= 23;
    if (ag === "24-26") return a.age >= 24 && a.age <= 26;
    if (ag === "27-29") return a.age >= 27 && a.age <= 29;
    if (ag === "30-32") return a.age >= 30 && a.age <= 32;
    return a.age >= 33;
  });
  if (inGroup.length === 0) continue;
  const avgOvr = inGroup.reduce((s, a) => s + a.overallRating, 0) / inGroup.length;
  const avgPot = inGroup.reduce((s, a) => s + a.potential, 0) / inGroup.length;
  const avgMom = inGroup.reduce((s, a) => s + (a.momentum ?? 0), 0) / inGroup.length;
  const phases = inGroup.reduce((acc, a) => {
    acc[a.careerPhase || "unknown"] = (acc[a.careerPhase || "unknown"] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topPhase = Object.entries(phases).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p, c]) => `${p}:${c}`).join(", ");
  console.log(`  ${ag}: n=${inGroup.length} avgOVR=${avgOvr.toFixed(1)} avgPot=${avgPot.toFixed(1)} avgMom=${avgMom.toFixed(1)} [${topPhase}]`);
}

// High-OVR reality check: should be almost no 70+ OVR free agents over age 24
console.log("\n── Free Agent Reality Check ──");
const highOvrOld = artists.filter(a => a.overallRating >= 65 && a.age >= 25);
console.log(`  OVR 65+ age 25+: ${highOvrOld.length} of ${artists.length} (${(highOvrOld.length / artists.length * 100).toFixed(1)}%)`);
for (const a of highOvrOld.slice(0, 8)) {
  console.log(`    ${a.name}: age=${a.age} OVR=${a.overallRating} pot=${a.potential} mom=${a.momentum} phase=${a.careerPhase}`);
}
const veryHighOvr = artists.filter(a => a.overallRating >= 75);
console.log(`  OVR 75+: ${veryHighOvr.length} (${(veryHighOvr.length / artists.length * 100).toFixed(1)}%) — these should all be young or dropped/troubled`);
for (const a of veryHighOvr.slice(0, 5)) {
  console.log(`    ${a.name}: age=${a.age} OVR=${a.overallRating} phase=${a.careerPhase} mom=${a.momentum}`)
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 2: ALBUM DEVELOPMENT (with proper attribute-matched artists)
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("TEST 2: ALBUM DEVELOPMENT (10 albums, realistic aging)");
console.log("═══════════════════════════════════════════════════════════════\n");

interface DevProfile { desc: string; ovrRange: [number, number]; startAge: number; dur: DurabilityType; momRange: [number, number]; }
const devProfiles: DevProfile[] = [
  { desc: "Raw prospect (19yo, OVR ~30)", ovrRange: [25, 38], startAge: 19, dur: "solid", momRange: [8, 18] },
  { desc: "Rising talent (22yo, OVR ~50)", ovrRange: [45, 58], startAge: 22, dur: "solid", momRange: [15, 28] },
  { desc: "Star (26yo, OVR ~75)", ovrRange: [70, 82], startAge: 26, dur: "solid", momRange: [30, 50] },
  { desc: "Flash one-hit-wonder (23yo, OVR ~55)", ovrRange: [50, 62], startAge: 23, dur: "flash", momRange: [40, 60] },
  { desc: "Durable legend (25yo, OVR ~80)", ovrRange: [75, 88], startAge: 25, dur: "durable", momRange: [35, 55] },
  { desc: "Vet flash (30yo, OVR ~60)", ovrRange: [55, 68], startAge: 30, dur: "flash", momRange: [15, 30] },
  { desc: "Vet durable (30yo, OVR ~60)", ovrRange: [55, 68], startAge: 30, dur: "durable", momRange: [20, 35] },
];

for (const prof of devProfiles) {
  const trials = 80;
  const startOvrs: number[] = [];
  const finalOvrs: number[] = [];
  const events: Record<string, number> = { improvement: 0, stagnation: 0, decline: 0 };

  for (let t = 0; t < trials; t++) {
    // Build artist directly with target OVR — bypasses generation age caps
    const targetOvr = rand(prof.ovrRange[0], prof.ovrRange[1]);
    const attributes = generateAttributes(targetOvr);
    const overallRating = computeOverall(attributes);
    const potential = Math.min(99, overallRating + rand(10, 25));
    let artist: Artist = {
      id: `dev_${t}`, name: `Test ${t}`, persona: "trap-star", genre: "trap",
      appearance: { hairColor: "#000", skinTone: "#8B6914", shirtColor: "#333" }, spriteIndex: 0,
      popularity: 30, fanbase: 5000, attributes, overallRating, potential,
      baseOVR: Math.min(99, overallRating + rand(10, 25)),
      age: prof.startAge, peakAge: 28, fatigue: 0, morale: 80,
      signed: true, contractAlbumsTotal: 1, contractAlbumsLeft: 1,
      onTour: false, tourTurnsLeft: 0, tourType: null,
      lastMajorTourTurn: 0, lastTourEndTurn: 0, lastAlbumReleaseTurn: 0,
      preferredAlbumLength: 14, minSongQuality: 30,
      durability: prof.dur, momentum: rand(prof.momRange[0], prof.momRange[1]),
      buzz: 20, careerPhase: "emerging" as CareerStage,
      peakMomentum: 50, turnsAtLowMomentum: 0,
      totalSinglesReleased: 0, totalAlbumsReleased: 0,
      chartHits: 0, flops: 0, careerStartTurn: 0,
      archetype: "buzzing_underground",
      yearlyReleasesQuality: [], yearlyChartsWeeks: 0, yearlyTourWeeks: 0,
      yearlyControversies: 0, lastProgressionTurn: 0, peakOverall: overallRating,
      traits: { loyalty: 60, workEthic: 70, moneyMotivation: 50, competitiveness: 50, fameMotivation: 50, controversyRisk: 30 },
    };
    startOvrs.push(artist.overallRating);

    for (let album = 0; album < 10; album++) {
      const result = applyAlbumDevelopment(artist, 0);
      events[result.event] = (events[result.event] || 0) + 1;
      artist = { ...artist, overallRating: result.overallRating, potential: result.potential, attributes: result.attributes, age: artist.age + 1 };
    }
    finalOvrs.push(artist.overallRating);
  }

  const avgStart = startOvrs.reduce((s, v) => s + v, 0) / startOvrs.length;
  const avgFinal = finalOvrs.reduce((s, v) => s + v, 0) / finalOvrs.length;
  const totalEvents = trials * 10;
  console.log(`  ${prof.desc}:`);
  console.log(`    OVR ${avgStart.toFixed(1)} → Avg ${avgFinal.toFixed(1)} (min=${Math.min(...finalOvrs)}, max=${Math.max(...finalOvrs)})`);
  console.log(`    improve ${((events.improvement / totalEvents) * 100).toFixed(0)}% | stagnate ${((events.stagnation / totalEvents) * 100).toFixed(0)}% | decline ${((events.decline / totalEvents) * 100).toFixed(0)}%`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 3: MOMENTUM DECAY
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("TEST 3: MOMENTUM DECAY (idle artist, no activity)");
console.log("═══════════════════════════════════════════════════════════════\n");

function simulateMomentumDecay(startMom: number, dur: DurabilityType, age: number, turns: number) {
  const durDecay = dur === "flash" ? 2.5 : dur === "solid" ? 1.5 : 0.8;
  let momentum = startMom;
  const snapshots: string[] = [];
  for (let t = 1; t <= turns; t++) {
    if (t > 8) momentum -= durDecay * Math.min(3, Math.floor(t / 8));
    momentum -= durDecay * 0.6;
    if (age >= 30 && t > 4) momentum -= (age - 29) * 0.3;
    momentum = Math.max(0, Math.round(momentum));
    if ([4, 8, 13, 20, 26, 35, 52].includes(t)) snapshots.push(`T${t}:${momentum}`);
  }
  return snapshots.join(" → ");
}

const decayProfiles = [
  { desc: "Flash, 25yo, start 70", dur: "flash" as DurabilityType, age: 25, mom: 70 },
  { desc: "Solid, 25yo, start 70", dur: "solid" as DurabilityType, age: 25, mom: 70 },
  { desc: "Durable, 25yo, start 70", dur: "durable" as DurabilityType, age: 25, mom: 70 },
  { desc: "Flash, 30yo, start 50", dur: "flash" as DurabilityType, age: 30, mom: 50 },
  { desc: "Solid, 30yo, start 50", dur: "solid" as DurabilityType, age: 30, mom: 50 },
  { desc: "Durable, 30yo, start 50", dur: "durable" as DurabilityType, age: 30, mom: 50 },
];

for (const p of decayProfiles) {
  console.log(`  ${p.desc}: ${simulateMomentumDecay(p.mom, p.dur, p.age, 52)}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 4: FREE AGENT POOL OVER TIME
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("TEST 4: FREE AGENT POOL (104 turns = 2 years)");
console.log("═══════════════════════════════════════════════════════════════\n");

let pool: Artist[] = [];
for (let i = 0; i < 100; i++) pool.push(generateArtist(`pool_${i}`));

function poolStats(pool: Artist[], label: string) {
  const avgOvr = pool.reduce((s, a) => s + a.overallRating, 0) / pool.length;
  const avgMom = pool.reduce((s, a) => s + (a.momentum ?? 0), 0) / pool.length;
  const high = pool.filter(a => a.overallRating >= 60).length;
  const star = pool.filter(a => a.overallRating >= 75).length;
  const phases: Record<string, number> = {};
  for (const a of pool) phases[a.careerPhase || "unknown"] = (phases[a.careerPhase || "unknown"] || 0) + 1;
  const phaseStr = Object.entries(phases).sort((a, b) => b[1] - a[1]).map(([p, c]) => `${p}:${c}`).join(" ");
  console.log(`  ${label}: n=${pool.length} avgOVR=${avgOvr.toFixed(1)} avgMom=${avgMom.toFixed(1)} 60+=${high} 75+=${star} | ${phaseStr}`);
}

poolStats(pool, "Turn 0");

for (let turn = 1; turn <= 104; turn++) {
  const newCount = rand(2, 5);
  for (let i = 0; i < newCount; i++) pool.push(generateArtist(`pg_${turn}_${i}`));
  if (turn % 13 === 0) {
    let q = generateArtist(`pq_${turn}`);
    let a = 0;
    while (q.overallRating < 65 && a < 20) { q = generateArtist(`pq_${turn}_${a}`); a++; }
    pool.push(q);
  }
  if (turn % 52 === 26) {
    let s = generateArtist(`ps_${turn}`);
    let a = 0;
    while (s.overallRating < 80 && a < 50) { s = generateArtist(`ps_${turn}_${a}`); a++; }
    pool.push(s);
  }

  pool = pool.filter((a) => {
    const mom = a.momentum ?? 30;
    const lowTurns = a.turnsAtLowMomentum ?? 0;
    if (mom <= 5 && lowTurns > 26 && Math.random() < 0.40) return false;
    if (mom <= 15 && lowTurns > 16 && Math.random() < 0.15) return false;
    if (a.age >= 38 && Math.random() < (a.age - 37) * 0.04 * (mom > 40 ? 0.5 : 1.0)) return false;
    if (a.morale < 15 && mom < 20 && Math.random() < 0.10) return false;
    return true;
  });

  pool = pool.map((a) => {
    let mom = a.momentum ?? 30;
    let bz = a.buzz ?? 20;
    let lowTurns = a.turnsAtLowMomentum ?? 0;
    const dur = (a.durability ?? "solid") as DurabilityType;
    const decay = dur === "flash" ? 0.8 : dur === "solid" ? 0.5 : 0.25;
    mom = Math.max(0, Math.round(mom - decay));
    bz = Math.max(0, Math.round(bz - 0.3));
    if (mom < 25) lowTurns += 1; else lowTurns = 0;
    let age = a.age;
    if (turn % 52 === 0) age += 1;
    return { ...a, momentum: mom, buzz: bz, turnsAtLowMomentum: lowTurns, age };
  });

  if (pool.length > 500) pool = pool.slice(pool.length - 500);
  if ([13, 26, 52, 78, 104].includes(turn)) poolStats(pool, `Turn ${turn}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 5: WILLINGNESS TO SIGN — THE CRITICAL TEST
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("TEST 5: WILLINGNESS TO SIGN");
console.log("═══════════════════════════════════════════════════════════════\n");

function testWill(desc: string, ovr: number, pot: number, pop: number, mom: number, buzz: number, phase: CareerStage, loyalty: number, rep: number): string {
  const artistExpectation = ovr * 0.5 + pot * 0.3 + mom * 0.2;
  const gap = artistExpectation - rep;

  let w: number;
  if (gap <= -30) w = 90 + Math.floor(Math.random() * 8);
  else if (gap <= -15) w = 75 + Math.floor(Math.random() * 10);
  else if (gap <= 0) w = 55 + Math.floor(-gap);
  else if (gap <= 15) w = 40 - Math.floor(gap * 1.5);
  else if (gap <= 30) w = 15 - Math.floor((gap - 15) * 0.7);
  else w = Math.max(0, 5 - Math.floor((gap - 30) * 0.3));

  if (phase === "washed") w += 30;
  else if (phase === "declining") w += 30;
  else if (phase === "legacy") w += 20;
  else if (phase === "unknown") w += 12;
  else if (phase === "emerging") w += 5;
  else if (phase === "buzzing") w += 0;
  else if (phase === "breakout") w -= 5;
  else if (phase === "established") w -= 15;
  else if (phase === "peak") w -= 25;

  if (mom <= 5) w += 25;
  else if (mom <= 12) w += 15;
  else if (mom <= 20) w += 8;
  else if (mom >= 50) w -= 15;
  else if (mom >= 35) w -= 5;

  w += Math.floor((loyalty - 50) * 0.10);

  // Hard floors
  if (ovr >= 80 && rep < 40 && phase !== "declining" && phase !== "washed" && phase !== "legacy") w = Math.min(w, 3);
  if (ovr >= 70 && rep < 30 && phase !== "declining" && phase !== "washed") w = Math.min(w, 8);
  if (ovr >= 60 && rep < 20 && phase !== "declining" && phase !== "washed" && phase !== "legacy") w = Math.min(w, 12);

  w = Math.max(0, Math.min(100, Math.round(w)));
  return `  ${desc}: ${w}% (expect=${artistExpectation.toFixed(0)}, gap=${gap.toFixed(0)})`;
}

console.log("── At Rep 30 (new/small label) ──");
console.log(testWill("Raw prospect (OVR 28, pot 42)", 28, 42, 8, 12, 6, "unknown", 55, 30));
console.log(testWill("Decent prospect (OVR 38, pot 55)", 38, 55, 12, 15, 10, "unknown", 55, 30));
console.log(testWill("Rising talent (OVR 50, pot 65)", 50, 65, 20, 22, 15, "emerging", 55, 30));
console.log(testWill("Good talent (OVR 60, pot 75)", 60, 75, 25, 20, 18, "emerging", 55, 30));
console.log(testWill("THE PROBLEM: 22yo 67 OVR 77 pot", 67, 77, 30, 22, 20, "emerging", 55, 30));
console.log(testWill("Star (OVR 80, pot 90)", 80, 90, 45, 35, 30, "established", 55, 30));
console.log(testWill("Declining vet (OVR 52, pot 55)", 52, 55, 18, 8, 5, "declining", 55, 30));
console.log(testWill("Washed vet (OVR 40, pot 42)", 40, 42, 10, 5, 3, "declining", 55, 30));

console.log("\n── At Rep 50 (mid-tier label) ──");
console.log(testWill("Rising talent (OVR 50, pot 65)", 50, 65, 20, 22, 15, "emerging", 55, 50));
console.log(testWill("Good talent (OVR 60, pot 75)", 60, 75, 25, 20, 18, "emerging", 55, 50));
console.log(testWill("67 OVR 77 pot at rep 50", 67, 77, 30, 22, 20, "emerging", 55, 50));
console.log(testWill("Star (OVR 80, pot 90)", 80, 90, 45, 35, 30, "established", 55, 50));

console.log("\n── At Rep 75 (major label) ──");
console.log(testWill("Good talent (OVR 60, pot 75)", 60, 75, 25, 20, 18, "emerging", 55, 75));
console.log(testWill("67 OVR 77 pot at rep 75", 67, 77, 30, 22, 20, "emerging", 55, 75));
console.log(testWill("Star (OVR 80, pot 90)", 80, 90, 45, 35, 30, "established", 55, 75));
console.log(testWill("Superstar (OVR 92, pot 97)", 92, 97, 70, 60, 55, "established", 50, 75));

console.log("\n── At Rep 90 (elite label) ──");
console.log(testWill("Star (OVR 80, pot 90)", 80, 90, 45, 35, 30, "established", 55, 90));
console.log(testWill("Superstar (OVR 92, pot 97)", 92, 97, 70, 60, 55, "established", 50, 90));

// ═══════════════════════════════════════════════════════════════════════════════
// TEST 6: CAREER ARC NARRATIVES
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("TEST 6: CAREER ARC NARRATIVES (durability impact)");
console.log("═══════════════════════════════════════════════════════════════\n");

function buildTestArtist(id: string, ovr: number, age: number, dur: DurabilityType, mom: number): Artist {
  const attributes = generateAttributes(ovr);
  const overallRating = computeOverall(attributes);
  return {
    id, name: `Test ${id}`, persona: "trap-star", genre: "trap",
    appearance: { hairColor: "#000", skinTone: "#8B6914", shirtColor: "#333" }, spriteIndex: 0,
    popularity: 30, fanbase: 5000, attributes, overallRating,
    potential: Math.min(99, overallRating + 20),
    baseOVR: Math.min(99, overallRating + 20),
    age, peakAge: 28, fatigue: 0, morale: 80,
    signed: true, contractAlbumsTotal: 1, contractAlbumsLeft: 1,
    onTour: false, tourTurnsLeft: 0, tourType: null,
    lastMajorTourTurn: 0, lastTourEndTurn: 0, lastAlbumReleaseTurn: 0,
    preferredAlbumLength: 14, minSongQuality: 30,
    durability: dur, momentum: mom, buzz: 20,
    careerPhase: "emerging" as CareerStage,
    peakMomentum: 50, turnsAtLowMomentum: 0,
    totalSinglesReleased: 0, totalAlbumsReleased: 0,
    chartHits: 0, flops: 0, careerStartTurn: 0,
    archetype: "buzzing_underground",
    yearlyReleasesQuality: [], yearlyChartsWeeks: 0, yearlyTourWeeks: 0,
    yearlyControversies: 0, lastProgressionTurn: 0, peakOverall: overallRating,
    traits: { loyalty: 60, workEthic: 70, moneyMotivation: 50, competitiveness: 50, fameMotivation: 50, controversyRisk: 30 },
  };
}

// Test: early career (ages 23-25) and late career (ages 30-35) for different durabilities
const arcScenarios = [
  { label: "Early career (23-25, OVR ~55)", startAge: 23, albums: 3, targetOvr: 55, momRange: [25, 45] as [number, number] },
  { label: "Late career (30-35, OVR ~70)", startAge: 30, albums: 5, targetOvr: 70, momRange: [20, 35] as [number, number] },
];

for (const scenario of arcScenarios) {
  console.log(`  ${scenario.label}:`);
  for (const dur of ["flash", "solid", "durable"] as DurabilityType[]) {
    const trials = 200;
    const outcomes = { grew: 0, stable: 0, declined: 0 };

    for (let t = 0; t < trials; t++) {
      let artist = buildTestArtist(`arc_${dur}_${t}`, scenario.targetOvr, scenario.startAge, dur, rand(scenario.momRange[0], scenario.momRange[1]));
      const startOvr = artist.overallRating;

      for (let album = 0; album < scenario.albums; album++) {
        const result = applyAlbumDevelopment(artist, 0);
        artist = { ...artist, overallRating: result.overallRating, potential: result.potential, attributes: result.attributes, age: artist.age + 1 };
      }

      const delta = artist.overallRating - startOvr;
      if (delta >= 5) outcomes.grew++;
      else if (delta <= -5) outcomes.declined++;
      else outcomes.stable++;
    }

    console.log(`    ${dur}: Grew 5+: ${((outcomes.grew / trials) * 100).toFixed(0)}% | Stable: ${((outcomes.stable / trials) * 100).toFixed(0)}% | Declined 5+: ${((outcomes.declined / trials) * 100).toFixed(0)}%`);
  }
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("SIMULATION COMPLETE");
console.log("═══════════════════════════════════════════════════════════════");
