/**
 * Game Balance Simulation — 20 games across 10 strategies (2 each)
 * Run: npx tsx sim.ts
 */
import { GameState, Artist, TourSize } from "./src/lib/types";
import {
  advanceTurn, recordSong, releaseSong, signArtist,
  upgradeStudio, upgradeScouting, upgradeArtistDev, upgradeTouringDept,
  upgradeMarketing, upgradePR, upgradeMerch, sendOnTour,
  startAlbum, releaseAlbum, computeSigningFee, computeWillingness,
  getVisibleFreeAgents, MIN_SIGNING_WILLINGNESS, restArtist, promoWeek,
  TOUR_DATA, generateIndustryHistory, computeRenegotiationFee, renegotiateContract,
} from "./src/lib/engine";
import {
  generateArtist, PRODUCER_ROSTER, INITIAL_UPGRADES, createRivalLabels,
  STUDIO_DATA, SCOUTING_DATA, ARTIST_DEV_DATA, TOURING_DEPT_DATA,
  MARKETING_DATA, PR_DATA, MERCH_DATA, isProducerUnlocked,
} from "./src/lib/data";

// ── Create initial state (mirrors gameStore.ts createInitialState) ──────────

function createState(labelName: string): GameState {
  const freeAgentPool = Array.from({ length: 400 }, (_, i) => generateArtist(`pool_${i}`));
  const rivalLabels = createRivalLabels();
  const base: GameState = {
    labelName, money: 120000, reputation: 20, fanbase: 5000,
    turn: 1, startDate: "2025-01-06",
    artists: [], producers: PRODUCER_ROSTER, songs: [], albums: [],
    upgrades: INITIAL_UPGRADES, chart: [], recentEvents: [],
    gameStarted: true, gameOver: false, lastRefreshTurn: 0,
    studioLevel: 0, scoutingLevel: 0, artistDevLevel: 0,
    touringLevel: 0, marketingLevel: 0, prLevel: 0, merchLevel: 0,
    recordingTokens: 0, vault: [], rivalLabels, industrySongs: [],
    freeAgentPool, awardHistory: [], pendingAwardCeremony: null,
    activeBeefs: [], artistRelationships: [], pendingFeatureRequests: [],
    achievements: [], hallOfFame: [], globalHallOfFame: [],
    transactions: [], dynastyYears: 0, labelMilestones: [],
    revenueHistory: {
      streaming: 0, touring: 0, merch: 0, brandDeals: 0, awards: 0,
      weeklyStreaming: 0, weeklyTouring: 0, weeklyMerch: 0, weeklyBrandDeals: 0, weeklyOverhead: 0,
    },
  };
  const history = generateIndustryHistory(base);
  return { ...base, industrySongs: history.industrySongs, rivalLabels: history.rivalLabels, chart: history.chart };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function signed(s: GameState): Artist[] { return s.artists.filter(a => a.signed); }

function bestProducer(s: GameState, maxCost: number) {
  const unlocked = s.producers.filter(p => isProducerUnlocked(p, s) && p.costPerSong <= maxCost);
  return unlocked.sort((a, b) => b.quality - a.quality)[0] ?? null;
}

function cheapProducer(s: GameState) {
  const unlocked = s.producers.filter(p => isProducerUnlocked(p, s));
  return unlocked.sort((a, b) => a.costPerSong - b.costPerSong)[0] ?? null;
}

function trySign(s: GameState, maxFee: number, minOvr: number, albumCount: 1|2|3): GameState {
  const cap = STUDIO_DATA[s.studioLevel].rosterCap;
  if (signed(s).length >= cap) return s;
  const visible = getVisibleFreeAgents(s);
  const candidates = visible
    .filter(a => computeWillingness(a, s.reputation) >= MIN_SIGNING_WILLINGNESS && a.overallRating >= minOvr)
    .sort((a, b) => b.overallRating - a.overallRating);
  for (const c of candidates.slice(0, 5)) {
    const fee = computeSigningFee(c, albumCount);
    if (fee <= maxFee && fee <= s.money * 0.5) {
      const r = signArtist(s, c.id, fee, albumCount);
      if (!r.error) return r.newState;
    }
  }
  return s;
}

function tryUpg(s: GameState, fn: (s: GameState) => { newState: GameState; error?: string }): GameState {
  const r = fn(s);
  return r.error ? s : r.newState;
}

function handleExpired(s: GameState, maxFee: number): GameState {
  for (const a of signed(s).filter(a => a.contractAlbumsLeft === 0)) {
    if (a.overallRating < 30) continue;
    const fee = computeRenegotiationFee(a, s, 2);
    if (fee <= maxFee && fee <= s.money * 0.3) {
      const r = renegotiateContract(s, a.id, 2, fee);
      if (!r.error) s = r.newState;
    }
  }
  return s;
}

// ── Strategy definitions ────────────────────────────────────────────────────

type StrategyFn = (s: GameState) => GameState;

function stratBalanced(s: GameState): GameState {
  if (s.turn <= 5 || s.turn % 4 === 0) s = trySign(s, 30000, 30, 2);
  s = handleExpired(s, 25000);
  if (s.studioLevel < 3 && s.money > 60000) s = tryUpg(s, upgradeStudio);
  if (s.scoutingLevel < 2 && s.money > 30000) s = tryUpg(s, upgradeScouting);
  if (s.marketingLevel < 2 && s.money > 30000) s = tryUpg(s, upgradeMarketing);
  if (s.touringLevel < 2 && s.money > 30000) s = tryUpg(s, upgradeTouringDept);
  if (s.studioLevel < 5 && s.money > 150000) s = tryUpg(s, upgradeStudio);
  if (s.merchLevel < 3 && s.money > 50000) s = tryUpg(s, upgradeMerch);
  for (const a of signed(s)) {
    if (a.fatigue > 70 || a.onTour || a.jailed) continue;
    const p = bestProducer(s, Math.min(s.money * 0.3, 15000));
    if (!p) continue;
    const r = recordSong(s, a.id, p.id, true);
    if (r.song) { s = r.newState; s = releaseSong(s, r.song.id); }
  }
  for (const a of signed(s)) {
    if (!a.onTour && a.fatigue < 50 && a.popularity > 15) {
      const t: TourSize = a.popularity > 50 ? "regional_tour" : "club_tour";
      const r = sendOnTour(s, a.id, t);
      if (!r.error) s = r.newState;
    }
  }
  return s;
}

function stratStudioRush(s: GameState): GameState {
  if (s.studioLevel < 5 && s.money > 20000) s = tryUpg(s, upgradeStudio);
  if (s.studioLevel < 7 && s.money > 250000) s = tryUpg(s, upgradeStudio);
  if (s.turn <= 3 || s.turn % 3 === 0) s = trySign(s, 25000, 25, 2);
  s = handleExpired(s, 20000);
  for (const a of signed(s)) {
    if (a.fatigue > 75 || a.onTour || a.jailed) continue;
    const p = bestProducer(s, Math.min(s.money * 0.4, 25000));
    if (!p) continue;
    const r = recordSong(s, a.id, p.id, true);
    if (r.song) { s = r.newState; s = releaseSong(s, r.song.id); }
  }
  for (const a of signed(s)) {
    if (!a.onTour && a.fatigue < 50) {
      const r = sendOnTour(s, a.id, "club_tour");
      if (!r.error) s = r.newState;
    }
  }
  return s;
}

function stratMassSigning(s: GameState): GameState {
  if (s.studioLevel < 4 && s.money > 30000) s = tryUpg(s, upgradeStudio);
  if (s.studioLevel < 6 && s.money > 150000) s = tryUpg(s, upgradeStudio);
  for (let i = 0; i < 3; i++) s = trySign(s, 15000, 20, 1);
  s = handleExpired(s, 10000);
  for (const a of signed(s)) {
    if (a.fatigue > 75 || a.onTour || a.jailed) continue;
    const p = cheapProducer(s);
    if (!p || s.money < 3000) continue;
    const r = recordSong(s, a.id, p.id, true);
    if (r.song) { s = r.newState; s = releaseSong(s, r.song.id); }
  }
  return s;
}

function stratSingleStar(s: GameState): GameState {
  if (signed(s).length === 0) s = trySign(s, 50000, 35, 3);
  if (s.studioLevel < 4 && s.money > 40000) s = tryUpg(s, upgradeStudio);
  if (s.marketingLevel < 3 && s.money > 40000) s = tryUpg(s, upgradeMarketing);
  if (s.artistDevLevel < 3 && s.money > 40000) s = tryUpg(s, upgradeArtistDev);
  s = handleExpired(s, 50000);
  const star = signed(s)[0];
  if (star && !star.onTour && !star.jailed && star.fatigue < 70) {
    const p = bestProducer(s, Math.min(s.money * 0.5, 20000));
    if (p) { const r = recordSong(s, star.id, p.id, true); if (r.song) { s = r.newState; s = releaseSong(s, r.song.id); } }
  }
  if (star && !star.onTour && star.fatigue < 50 && star.popularity > 20) {
    const t: TourSize = star.popularity > 60 ? "national_tour" : star.popularity > 30 ? "regional_tour" : "club_tour";
    const r = sendOnTour(s, star.id, t); if (!r.error) s = r.newState;
  }
  if (star && star.fatigue > 60 && !star.onTour) { const r = restArtist(s, star.id); if (!r.error) s = r.newState; }
  return s;
}

function stratTourHeavy(s: GameState): GameState {
  if (s.touringLevel < 4 && s.money > 30000) s = tryUpg(s, upgradeTouringDept);
  if (s.touringLevel < 7 && s.money > 200000) s = tryUpg(s, upgradeTouringDept);
  if (s.studioLevel < 3 && s.money > 50000) s = tryUpg(s, upgradeStudio);
  if (s.turn <= 3 || s.turn % 5 === 0) s = trySign(s, 25000, 30, 2);
  s = handleExpired(s, 20000);
  for (const a of signed(s)) {
    if (a.fatigue > 75 || a.onTour || a.jailed) continue;
    const p = cheapProducer(s);
    if (!p || s.money < 3000) continue;
    const r = recordSong(s, a.id, p.id, true);
    if (r.song) { s = r.newState; s = releaseSong(s, r.song.id); }
  }
  for (const a of signed(s)) {
    if (!a.onTour && a.fatigue < 60) {
      const t: TourSize = a.popularity > 60 ? "national_tour" : a.popularity > 30 ? "regional_tour" : "club_tour";
      const r = sendOnTour(s, a.id, t); if (!r.error) s = r.newState;
    }
  }
  return s;
}

function stratAlbumFactory(s: GameState): GameState {
  if (s.studioLevel < 4 && s.money > 40000) s = tryUpg(s, upgradeStudio);
  if (s.turn <= 4 || s.turn % 6 === 0) s = trySign(s, 30000, 30, 3);
  s = handleExpired(s, 30000);
  for (const a of signed(s)) {
    if (a.fatigue > 80 || a.onTour || a.jailed) continue;
    let album = s.albums.find(al => al.artistId === a.id && al.status === "recording");
    if (!album) {
      const sa = startAlbum(s, a.id);
      if (!sa.error && sa.album) { s = sa.newState; album = sa.album; }
    }
    if (album) {
      const p = bestProducer(s, Math.min(s.money * 0.3, 15000));
      if (p) { const r = recordSong(s, a.id, p.id, false); if (r.song) s = r.newState; }
      const cnt = s.songs.filter(song => album!.songIds.includes(song.id)).length;
      if (cnt >= 7) {
        const ra = releaseAlbum(s, album.id, Math.min(5000, s.money * 0.1));
        if (!ra.error) s = ra.newState;
      }
    } else {
      const p = cheapProducer(s);
      if (p && s.money >= 3000) { const r = recordSong(s, a.id, p.id, true); if (r.song) { s = r.newState; s = releaseSong(s, r.song.id); } }
    }
  }
  for (const a of signed(s)) {
    if (!a.onTour && a.fatigue < 40 && a.popularity > 20 && s.turn % 8 === 0) {
      const r = sendOnTour(s, a.id, "club_tour"); if (!r.error) s = r.newState;
    }
  }
  return s;
}

function stratMarketingFirst(s: GameState): GameState {
  if (s.marketingLevel < 4 && s.money > 20000) s = tryUpg(s, upgradeMarketing);
  if (s.marketingLevel < 7 && s.money > 200000) s = tryUpg(s, upgradeMarketing);
  if (s.studioLevel < 3 && s.money > 50000) s = tryUpg(s, upgradeStudio);
  if (s.turn <= 3 || s.turn % 4 === 0) s = trySign(s, 25000, 30, 2);
  s = handleExpired(s, 20000);
  for (const a of signed(s)) {
    if (a.fatigue > 70 || a.onTour || a.jailed) continue;
    const p = bestProducer(s, Math.min(s.money * 0.3, 15000));
    if (!p) continue;
    const r = recordSong(s, a.id, p.id, true);
    if (r.song) { s = r.newState; s = releaseSong(s, r.song.id); }
  }
  for (const a of signed(s)) {
    if (!a.onTour && a.fatigue < 60) { const r = promoWeek(s, a.id); if (!r.error) s = r.newState; }
  }
  return s;
}

function stratMerchEmpire(s: GameState): GameState {
  if (s.merchLevel < 5 && s.money > 20000) s = tryUpg(s, upgradeMerch);
  if (s.merchLevel < 8 && s.money > 150000) s = tryUpg(s, upgradeMerch);
  if (s.studioLevel < 3 && s.money > 50000) s = tryUpg(s, upgradeStudio);
  if (s.turn <= 3 || s.turn % 4 === 0) s = trySign(s, 25000, 30, 2);
  s = handleExpired(s, 20000);
  for (const a of signed(s)) {
    if (a.fatigue > 70 || a.onTour || a.jailed) continue;
    const p = cheapProducer(s);
    if (!p || s.money < 3000) continue;
    const r = recordSong(s, a.id, p.id, true);
    if (r.song) { s = r.newState; s = releaseSong(s, r.song.id); }
  }
  for (const a of signed(s)) {
    if (!a.onTour && a.fatigue < 55) {
      const r = sendOnTour(s, a.id, "club_tour"); if (!r.error) s = r.newState;
    }
  }
  return s;
}

function stratScoutHeavy(s: GameState): GameState {
  if (s.scoutingLevel < 4 && s.money > 20000) s = tryUpg(s, upgradeScouting);
  if (s.scoutingLevel < 7 && s.money > 150000) s = tryUpg(s, upgradeScouting);
  if (s.studioLevel < 3 && s.money > 50000) s = tryUpg(s, upgradeStudio);
  if (s.turn <= 5 || s.turn % 3 === 0) s = trySign(s, 35000, 35, 2);
  s = handleExpired(s, 25000);
  for (const a of signed(s)) {
    if (a.fatigue > 70 || a.onTour || a.jailed) continue;
    const p = bestProducer(s, Math.min(s.money * 0.3, 15000));
    if (!p) continue;
    const r = recordSong(s, a.id, p.id, true);
    if (r.song) { s = r.newState; s = releaseSong(s, r.song.id); }
  }
  for (const a of signed(s)) {
    if (!a.onTour && a.fatigue < 50 && a.popularity > 15) {
      const r = sendOnTour(s, a.id, "club_tour"); if (!r.error) s = r.newState;
    }
  }
  return s;
}

function stratConservative(s: GameState): GameState {
  if (signed(s).length === 0 && s.turn <= 8) s = trySign(s, 15000, 20, 1);
  if (s.money > 150000 && s.turn % 10 === 0) s = trySign(s, 20000, 30, 1);
  if (s.studioLevel < 2 && s.money > 100000) s = tryUpg(s, upgradeStudio);
  s = handleExpired(s, 15000);
  for (const a of signed(s)) {
    if (a.fatigue > 60 || a.onTour || a.jailed) continue;
    const p = cheapProducer(s);
    if (!p || s.money < 5000) continue;
    const r = recordSong(s, a.id, p.id, true);
    if (r.song) { s = r.newState; s = releaseSong(s, r.song.id); }
  }
  return s;
}

// ── Run simulation ──────────────────────────────────────────────────────────

interface GameResult {
  strategy: string; run: number; finalTurn: number;
  survived: boolean; gameOverTurn: number | null; gameOverReason: string;
  finalMoney: number; peakMoney: number; lowestMoney: number;
  finalRep: number; peakRep: number; finalFanbase: number;
  totalSongs: number; totalAlbums: number; totalArtistsSigned: number;
  chartsAppearances: number;
  streamingRev: number; touringRev: number; merchRev: number; brandDeals: number;
  studioLvl: number; scoutingLvl: number; marketingLvl: number;
  touringLvl: number; merchLvl: number; artistDevLvl: number; prLvl: number;
  moneyAt52: number; repAt52: number; moneyAt104: number; repAt104: number;
  totalRevenue: number;
  turnsProfitable: number; turnsNegCash: number;
  // Revenue snapshots
  weeklyRevSamples: { turn: number; streaming: number; touring: number; merch: number; overhead: number }[];
}

const STRATEGIES: { name: string; fn: StrategyFn }[] = [
  { name: "Balanced", fn: stratBalanced },
  { name: "Studio Rush", fn: stratStudioRush },
  { name: "Mass Signing", fn: stratMassSigning },
  { name: "Single Star", fn: stratSingleStar },
  { name: "Tour Heavy", fn: stratTourHeavy },
  { name: "Album Factory", fn: stratAlbumFactory },
  { name: "Marketing First", fn: stratMarketingFirst },
  { name: "Merch Empire", fn: stratMerchEmpire },
  { name: "Scout Heavy", fn: stratScoutHeavy },
  { name: "Conservative", fn: stratConservative },
];

const TOTAL_TURNS = 156; // 3 years

function runGame(strat: { name: string; fn: StrategyFn }, run: number): GameResult {
  let s = createState(`${strat.name}_${run}`);
  let peakMoney = s.money, lowestMoney = s.money, peakRep = s.reputation;
  let gameOverTurn: number | null = null, gameOverReason = "";
  let moneyAt52 = 0, repAt52 = 0, moneyAt104 = 0, repAt104 = 0;
  let turnsProfitable = 0, turnsNegCash = 0;
  const weeklyRevSamples: GameResult["weeklyRevSamples"] = [];

  for (let t = 0; t < TOTAL_TURNS; t++) {
    if (s.gameOver) {
      if (!gameOverTurn) {
        gameOverTurn = s.turn;
        gameOverReason = s.money < -15000 ? "bankruptcy" : "reputation_collapse";
      }
      break;
    }
    const moneyBefore = s.money;
    s = strat.fn(s);
    s = advanceTurn(s);
    if (s.money - moneyBefore > 0) turnsProfitable++;
    if (s.money < 0) turnsNegCash++;
    if (s.money > peakMoney) peakMoney = s.money;
    if (s.money < lowestMoney) lowestMoney = s.money;
    if (s.reputation > peakRep) peakRep = s.reputation;
    if (s.turn === 52) { moneyAt52 = s.money; repAt52 = s.reputation; }
    if (s.turn === 104) { moneyAt104 = s.money; repAt104 = s.reputation; }
    if (s.turn % 26 === 0) {
      weeklyRevSamples.push({
        turn: s.turn,
        streaming: s.revenueHistory.weeklyStreaming,
        touring: s.revenueHistory.weeklyTouring,
        merch: s.revenueHistory.weeklyMerch,
        overhead: s.revenueHistory.weeklyOverhead,
      });
    }
  }

  const released = s.songs.filter(song => song.released);
  return {
    strategy: strat.name, run, finalTurn: s.turn,
    survived: !s.gameOver, gameOverTurn, gameOverReason,
    finalMoney: s.money, peakMoney, lowestMoney,
    finalRep: s.reputation, peakRep, finalFanbase: s.fanbase,
    totalSongs: released.length, totalAlbums: s.albums.filter(a => a.status === "released").length,
    totalArtistsSigned: s.artists.length,
    chartsAppearances: released.filter(song => song.chartPosition && song.chartPosition <= 20).length,
    streamingRev: s.revenueHistory.streaming, touringRev: s.revenueHistory.touring,
    merchRev: s.revenueHistory.merch, brandDeals: s.revenueHistory.brandDeals,
    studioLvl: s.studioLevel, scoutingLvl: s.scoutingLevel, marketingLvl: s.marketingLevel,
    touringLvl: s.touringLevel, merchLvl: s.merchLevel, artistDevLvl: s.artistDevLevel, prLvl: s.prLevel,
    moneyAt52: moneyAt52 || s.money, repAt52: repAt52 || s.reputation,
    moneyAt104: moneyAt104 || s.money, repAt104: repAt104 || s.reputation,
    totalRevenue: s.revenueHistory.streaming + s.revenueHistory.touring + s.revenueHistory.merch + s.revenueHistory.brandDeals + s.revenueHistory.awards,
    turnsProfitable, turnsNegCash,
    weeklyRevSamples,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log("Running 20-game simulation (10 strategies × 2 runs, 156 turns / 3 years each)...\n");
const results: GameResult[] = [];

for (const strat of STRATEGIES) {
  for (let run = 1; run <= 2; run++) {
    process.stdout.write(`  ${strat.name} #${run}...`);
    const r = runGame(strat, run);
    results.push(r);
    console.log(` ${r.survived ? "OK" : "DEAD t" + r.gameOverTurn} | $${(r.finalMoney/1000).toFixed(0)}K | Rep ${r.finalRep} | ${r.totalSongs} songs | ${(r.finalFanbase/1000).toFixed(0)}K fans`);
  }
}

// ── Detailed Table ──────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(140));
console.log("DETAILED RESULTS");
console.log("═".repeat(140));

const hdr = (s: string, w: number) => s.padEnd(w);
const num = (n: number, w: number) => String(n).padStart(w);
const $k = (n: number, w: number) => ("$" + (n/1000).toFixed(0) + "K").padStart(w);

console.log("");
console.log(
  hdr("Strategy", 18) + hdr("Res", 5) + hdr("Final$", 10) + hdr("Peak$", 10) + hdr("Low$", 10) +
  hdr("Rep", 6) + hdr("Fans", 9) + hdr("Songs", 6) + hdr("Albums", 7) + hdr("Artists", 8) +
  hdr("Stream$", 10) + hdr("Tour$", 10) + hdr("Merch$", 9) + hdr("Brand$", 9) + hdr("TotalRev", 10)
);
console.log("─".repeat(140));

for (const r of results) {
  const status = r.survived ? " OK " : `D${r.gameOverTurn}`;
  console.log(
    hdr(r.strategy + " #" + r.run, 18) + hdr(status, 5) +
    $k(r.finalMoney, 10) + $k(r.peakMoney, 10) + $k(r.lowestMoney, 10) +
    num(r.finalRep, 4) + "/" + num(r.peakRep, -1).padEnd(1) + " " +
    ((r.finalFanbase/1000).toFixed(0) + "K").padStart(8) + " " +
    num(r.totalSongs, 5) + " " + num(r.totalAlbums, 6) + " " + num(r.totalArtistsSigned, 7) + " " +
    $k(r.streamingRev, 10) + $k(r.touringRev, 10) + $k(r.merchRev, 9) + $k(r.brandDeals, 9) + $k(r.totalRevenue, 10)
  );
}

// ── Upgrade levels ──────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(100));
console.log("FINAL UPGRADE LEVELS");
console.log("═".repeat(100));
console.log(hdr("Strategy", 18) + hdr("Studio", 8) + hdr("Scout", 8) + hdr("ArtDev", 8) + hdr("Tour", 8) + hdr("Mktg", 8) + hdr("PR", 8) + hdr("Merch", 8));
console.log("─".repeat(100));
for (const r of results) {
  console.log(
    hdr(r.strategy + " #" + r.run, 18) +
    num(r.studioLvl, 5) + "   " + num(r.scoutingLvl, 5) + "   " + num(r.artistDevLvl, 5) + "   " +
    num(r.touringLvl, 5) + "   " + num(r.marketingLvl, 5) + "   " + num(r.prLvl, 5) + "   " + num(r.merchLvl, 5)
  );
}

// ── Year-by-year ────────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(80));
console.log("YEAR-BY-YEAR PROGRESSION");
console.log("═".repeat(80));
console.log(hdr("Strategy", 18) + hdr("Y1 Money", 12) + hdr("Y1 Rep", 8) + hdr("Y2 Money", 12) + hdr("Y2 Rep", 8) + hdr("Y3 Money", 12) + hdr("Y3 Rep", 8));
console.log("─".repeat(80));
for (const r of results) {
  console.log(
    hdr(r.strategy + " #" + r.run, 18) +
    $k(r.moneyAt52, 12) + num(r.repAt52, 6) + "  " +
    $k(r.moneyAt104, 12) + num(r.repAt104, 6) + "  " +
    $k(r.finalMoney, 12) + num(r.finalRep, 6)
  );
}

// ── Profitability ───────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(80));
console.log("PROFITABILITY & CASH HEALTH");
console.log("═".repeat(80));
console.log(hdr("Strategy", 18) + hdr("Profit Turns", 14) + hdr("Neg Cash Turns", 16) + hdr("Profit %", 10));
console.log("─".repeat(80));
for (const r of results) {
  const pct = r.survived ? ((r.turnsProfitable / TOTAL_TURNS) * 100).toFixed(0) + "%" : "N/A";
  console.log(
    hdr(r.strategy + " #" + r.run, 18) +
    num(r.turnsProfitable, 10) + "    " +
    num(r.turnsNegCash, 12) + "    " +
    hdr(pct, 10)
  );
}

// ── Revenue snapshots (every 26 weeks) ──────────────────────────────────────

console.log("\n" + "═".repeat(100));
console.log("WEEKLY REVENUE SNAPSHOTS (every 6 months)");
console.log("═".repeat(100));
for (const r of results.filter((_, i) => i % 2 === 0)) { // just first run of each
  console.log(`\n  ${r.strategy}:`);
  console.log("    " + hdr("Turn", 6) + hdr("Stream$/wk", 12) + hdr("Tour$/wk", 12) + hdr("Merch$/wk", 12) + hdr("Overhead$/wk", 14));
  for (const s of r.weeklyRevSamples) {
    console.log("    " + num(s.turn, 4) + "  " + $k(s.streaming, 12) + $k(s.touring, 12) + $k(s.merch, 12) + $k(s.overhead, 14));
  }
}

// ── Aggregate ───────────────────────────────────────────────────────────────

console.log("\n" + "═".repeat(100));
console.log("AGGREGATE BY STRATEGY (avg of 2 runs)");
console.log("═".repeat(100));

for (const name of STRATEGIES.map(s => s.name)) {
  const runs = results.filter(r => r.strategy === name);
  const surv = runs.filter(r => r.survived).length;
  const avg = (fn: (r: GameResult) => number) => runs.reduce((s, r) => s + fn(r), 0) / runs.length;

  console.log(`\n── ${name} (${surv}/2 survived) ──`);
  console.log(`  Money:   Final $${(avg(r=>r.finalMoney)/1000).toFixed(0)}K | Peak $${(avg(r=>r.peakMoney)/1000).toFixed(0)}K | Low $${(avg(r=>r.lowestMoney)/1000).toFixed(0)}K`);
  console.log(`  Rep:     Final ${avg(r=>r.finalRep).toFixed(0)} | Peak ${avg(r=>r.peakRep).toFixed(0)} | Y1 ${avg(r=>r.repAt52).toFixed(0)} → Y2 ${avg(r=>r.repAt104).toFixed(0)} → Y3 ${avg(r=>r.finalRep).toFixed(0)}`);
  console.log(`  Fans:    ${(avg(r=>r.finalFanbase)/1000).toFixed(0)}K`);
  console.log(`  Content: ${avg(r=>r.totalSongs).toFixed(0)} songs | ${avg(r=>r.totalAlbums).toFixed(0)} albums | ${avg(r=>r.totalArtistsSigned).toFixed(0)} artists signed`);
  const totalRev = avg(r => r.totalRevenue);
  const sRev = avg(r => r.streamingRev);
  const tRev = avg(r => r.touringRev);
  const mRev = avg(r => r.merchRev);
  const bRev = avg(r => r.brandDeals);
  console.log(`  Revenue: Stream $${(sRev/1000).toFixed(0)}K | Tour $${(tRev/1000).toFixed(0)}K | Merch $${(mRev/1000).toFixed(0)}K | Brands $${(bRev/1000).toFixed(0)}K | Total $${(totalRev/1000).toFixed(0)}K`);
  if (totalRev > 0) {
    console.log(`  Rev Mix: Stream ${(sRev/totalRev*100).toFixed(0)}% | Tour ${(tRev/totalRev*100).toFixed(0)}% | Merch ${(mRev/totalRev*100).toFixed(0)}% | Brands ${(bRev/totalRev*100).toFixed(0)}%`);
  }
  console.log(`  Health:  ${avg(r=>r.turnsProfitable).toFixed(0)}/${TOTAL_TURNS} profitable turns | ${avg(r=>r.turnsNegCash).toFixed(0)} turns negative cash`);
}

// ── Signing difficulty check ────────────────────────────────────────────────

console.log("\n" + "═".repeat(80));
console.log("SIGNING DIFFICULTY BY REPUTATION LEVEL");
console.log("═".repeat(80));
const testPool = Array.from({ length: 1000 }, (_, i) => generateArtist(`test_${i}`));
for (const rep of [10, 20, 30, 40, 50, 60, 70, 80]) {
  let total = 0, above50 = 0, above60 = 0, above70 = 0;
  for (const a of testPool) {
    const w = computeWillingness(a, rep);
    if (w >= MIN_SIGNING_WILLINGNESS) { total++; }
    if (a.overallRating >= 50 && w >= MIN_SIGNING_WILLINGNESS) above50++;
    if (a.overallRating >= 60 && w >= MIN_SIGNING_WILLINGNESS) above60++;
    if (a.overallRating >= 70 && w >= MIN_SIGNING_WILLINGNESS) above70++;
  }
  const pool50 = testPool.filter(a => a.overallRating >= 50).length;
  const pool60 = testPool.filter(a => a.overallRating >= 60).length;
  const pool70 = testPool.filter(a => a.overallRating >= 70).length;
  console.log(`  Rep ${String(rep).padStart(2)}: ${total}/1000 willing (${(total/10).toFixed(0)}%) | OVR50+: ${above50}/${pool50} | OVR60+: ${above60}/${pool60} | OVR70+: ${above70}/${pool70}`);
}

console.log("\nSimulation complete.\n");
