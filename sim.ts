/**
 * Simulation script for Wrap Label GM — tests balance across 4 strategies over 600 turns.
 * Run with: npx tsx sim.ts
 */

import {
  advanceTurn,
  recordSong,
  releaseSong,
  signArtist,
  sendOnTour,
  upgradeStudio,
  upgradeScouting,
  upgradeArtistDev,
  upgradeTouringDept,
  upgradeMarketing,
  upgradePR,
  upgradeMerch,
  computeSigningFee,
  computeWillingness,
  MIN_SIGNING_WILLINGNESS,
  getVisibleFreeAgents,
  startAlbum,
  releaseAlbum,
  restArtist,
  promoWeek,
  renegotiateContract,
  computeRenegotiationFee,
  TOUR_DATA,
  generateIndustryHistory,
} from "./src/lib/engine";
import {
  generateArtist,
  PRODUCER_ROSTER,
  INITIAL_UPGRADES,
  isProducerUnlocked,
  createRivalLabels,
  STUDIO_DATA,
  SCOUTING_DATA,
  ARTIST_DEV_DATA,
  TOURING_DEPT_DATA,
  MARKETING_DATA,
  PR_DATA,
  MERCH_DATA,
} from "./src/lib/data";
import type { GameState, Artist, TourSize } from "./src/lib/types";

// ── Create initial state (mirrors gameStore.ts) ─────────────────────────────

function createInitialState(labelName: string): GameState {
  const rosterArtists: Artist[] = Array.from({ length: 2 }, (_, i) =>
    generateArtist(`a${i}`, true)
  );
  const freeAgentPool: Artist[] = Array.from({ length: 400 }, (_, i) =>
    generateArtist(`pool_${i}`)
  );
  const producers = PRODUCER_ROSTER;
  const startDate = "2025-01-06";
  const rivalLabels = createRivalLabels();

  const baseState: GameState = {
    labelName,
    money: 100000,
    reputation: 30,
    fanbase: 10000,
    turn: 1,
    startDate,
    artists: rosterArtists,
    producers,
    songs: [],
    albums: [],
    upgrades: INITIAL_UPGRADES,
    chart: [],
    recentEvents: [],
    gameStarted: true,
    gameOver: false,
    lastRefreshTurn: 0,
    studioLevel: 0,
    scoutingLevel: 0,
    artistDevLevel: 0,
    touringLevel: 0,
    marketingLevel: 0,
    prLevel: 0,
    merchLevel: 0,
    recordingTokens: 0,
    vault: [],
    rivalLabels,
    industrySongs: [],
    freeAgentPool,
    awardHistory: [],
    pendingAwardCeremony: null,
    activeBeefs: [],
    artistRelationships: [],
    pendingFeatureRequests: [],
    achievements: [],
    hallOfFame: [],
    dynastyYears: 0,
    labelMilestones: [],
    revenueHistory: {
      streaming: 0, touring: 0, merch: 0, brandDeals: 0, awards: 0,
      weeklyStreaming: 0, weeklyTouring: 0, weeklyMerch: 0, weeklyBrandDeals: 0, weeklyOverhead: 0,
    },
  };

  const history = generateIndustryHistory(baseState);
  return {
    ...baseState,
    industrySongs: history.industrySongs,
    rivalLabels: history.rivalLabels,
    chart: history.chart,
  };
}

// ── Tracking ────────────────────────────────────────────────────────────────

interface TurnSnapshot {
  turn: number;
  money: number;
  reputation: number;
  fanbase: number;
  signedCount: number;
  chartEntries: number;
  playerChartEntries: number;
}

interface PoolAnalysis {
  totalCount: number;
  ageDistribution: Record<string, number>;
  ovrDistribution: Record<string, number>;
  careerPhaseDistribution: Record<string, number>;
  durabilityDistribution: Record<string, number>;
  signableCount: number;
  avgMomentum: number;
}

interface SimTracker {
  totalStreamRevenue: number;
  totalTourRevenue: number;
  totalMerchRevenue: number;
  totalOverheadPaid: number;
  totalSigningFees: number;
  totalProducerCosts: number;
  totalMarketingSpend: number;
  totalUpgradeCosts: number;
  totalArtistsSigned: number;
  songsRecorded: number;
  songsReleased: number;
  albumsReleased: number;
  chartAppearances: number;
  numberOneHits: number;
  awardWins: number;
  firstChartTurn: number;
  firstNumberOneTurn: number;
  firstAwardWinTurn: number;
  hit500k: number;
  hit1m: number;
  hit2m: number;
  hit5m: number;
  minMoney: number;
  minMoneyTurn: number;
  prevMoney: number;
  lossStreakStart: number;
  sustainedLossPeriods: Array<{ start: number; end: number; length: number }>;
  bankruptcyCloseCallTurns: number[];
  momentumDecaySamples: Array<{ artistName: string; turn: number; momentum: number }>;
  careerPhaseTransitions: Array<{ artistName: string; turn: number; from: string; to: string }>;
  prevPhases: Map<string, string>;
  freeAgentAnalysis: {
    turn1: PoolAnalysis | null;
    turn300: PoolAnalysis | null;
    turn600: PoolAnalysis | null;
  };
}

interface SimResult {
  strategyName: string;
  snapshots: TurnSnapshot[];
  finalState: GameState;
  totalStreamRevenue: number;
  totalTourRevenue: number;
  totalMerchRevenue: number;
  totalOverheadPaid: number;
  totalSigningFees: number;
  totalProducerCosts: number;
  totalMarketingSpend: number;
  totalUpgradeCosts: number;
  totalArtistsSigned: number;
  songsRecorded: number;
  songsReleased: number;
  albumsReleased: number;
  chartAppearances: number;
  numberOneHits: number;
  awardWins: number;
  firstChartTurn: number;
  firstNumberOneTurn: number;
  firstAwardWinTurn: number;
  hit500k: number;
  hit1m: number;
  hit2m: number;
  hit5m: number;
  minMoney: number;
  minMoneyTurn: number;
  sustainedLossPeriods: Array<{ start: number; end: number; length: number }>;
  bankruptcyCloseCallTurns: number[];
  freeAgentAnalysis: { turn1: PoolAnalysis | null; turn300: PoolAnalysis | null; turn600: PoolAnalysis | null };
  momentumDecaySamples: Array<{ artistName: string; turn: number; momentum: number }>;
  careerPhaseTransitions: Array<{ artistName: string; turn: number; from: string; to: string }>;
}

function analyzePool(pool: Artist[], labelRep: number): PoolAnalysis {
  const ageDistribution: Record<string, number> = { "18-20": 0, "21-23": 0, "24-26": 0, "27-29": 0, "30-32": 0, "33-35": 0, "36+": 0 };
  const ovrDistribution: Record<string, number> = { "25-39": 0, "40-54": 0, "55-69": 0, "70-79": 0, "80-89": 0, "90+": 0 };
  const careerPhaseDistribution: Record<string, number> = { prospect: 0, emerging: 0, established: 0, veteran: 0, declining: 0 };
  const durabilityDistribution: Record<string, number> = { flash: 0, solid: 0, durable: 0 };
  let signableCount = 0;
  let totalMomentum = 0;
  for (const a of pool) {
    if (a.age <= 20) ageDistribution["18-20"]++; else if (a.age <= 23) ageDistribution["21-23"]++; else if (a.age <= 26) ageDistribution["24-26"]++; else if (a.age <= 29) ageDistribution["27-29"]++; else if (a.age <= 32) ageDistribution["30-32"]++; else if (a.age <= 35) ageDistribution["33-35"]++; else ageDistribution["36+"]++;
    if (a.overallRating < 40) ovrDistribution["25-39"]++; else if (a.overallRating < 55) ovrDistribution["40-54"]++; else if (a.overallRating < 70) ovrDistribution["55-69"]++; else if (a.overallRating < 80) ovrDistribution["70-79"]++; else if (a.overallRating < 90) ovrDistribution["80-89"]++; else ovrDistribution["90+"]++;
    careerPhaseDistribution[a.careerPhase ?? "prospect"]++;
    durabilityDistribution[a.durability ?? "solid"]++;
    if (computeWillingness(a, labelRep) >= MIN_SIGNING_WILLINGNESS) signableCount++;
    totalMomentum += a.momentum ?? 0;
  }
  return { totalCount: pool.length, ageDistribution, ovrDistribution, careerPhaseDistribution, durabilityDistribution, signableCount, avgMomentum: pool.length > 0 ? Math.round(totalMomentum / pool.length) : 0 };
}

function createTracker(): SimTracker {
  return {
    totalStreamRevenue: 0, totalTourRevenue: 0, totalMerchRevenue: 0, totalOverheadPaid: 0,
    totalSigningFees: 0, totalProducerCosts: 0, totalMarketingSpend: 0, totalUpgradeCosts: 0,
    totalArtistsSigned: 0, songsRecorded: 0, songsReleased: 0, albumsReleased: 0,
    chartAppearances: 0, numberOneHits: 0, awardWins: 0,
    firstChartTurn: 0, firstNumberOneTurn: 0, firstAwardWinTurn: 0,
    hit500k: 0, hit1m: 0, hit2m: 0, hit5m: 0,
    minMoney: 100000, minMoneyTurn: 1, prevMoney: 100000,
    lossStreakStart: 0, sustainedLossPeriods: [], bankruptcyCloseCallTurns: [],
    momentumDecaySamples: [], careerPhaseTransitions: [], prevPhases: new Map(),
    freeAgentAnalysis: { turn1: null, turn300: null, turn600: null },
  };
}

function getWeeklyOverhead(state: GameState): number {
  return STUDIO_DATA[state.studioLevel].weeklyOperatingCost +
    SCOUTING_DATA[state.scoutingLevel].weeklyOperatingCost +
    ARTIST_DEV_DATA[state.artistDevLevel].weeklyOperatingCost +
    TOURING_DEPT_DATA[state.touringLevel].weeklyOperatingCost +
    MARKETING_DATA[state.marketingLevel].weeklyOperatingCost +
    PR_DATA[state.prLevel].weeklyOperatingCost +
    MERCH_DATA[state.merchLevel].weeklyOperatingCost;
}

function updateTracker(state: GameState, prevState: GameState, tracker: SimTracker, turn: number): void {
  for (const ev of state.recentEvents) {
    if (ev.turn !== state.turn) continue;
    if (ev.type === "revenue") {
      if (ev.title === "Stream Revenue") tracker.totalStreamRevenue += ev.moneyDelta;
      else if (ev.title === "Tour Earnings") tracker.totalTourRevenue += ev.moneyDelta;
      else if (ev.title === "Merch Sales") tracker.totalMerchRevenue += ev.moneyDelta;
    }
  }
  tracker.totalOverheadPaid += getWeeklyOverhead(state);
  const playerChartCount = state.chart.filter((c) => c.isPlayerSong).length;
  if (playerChartCount > 0) { tracker.chartAppearances += playerChartCount; if (tracker.firstChartTurn === 0) tracker.firstChartTurn = turn; }
  if (state.chart.length > 0 && state.chart[0].isPlayerSong) { tracker.numberOneHits++; if (tracker.firstNumberOneTurn === 0) tracker.firstNumberOneTurn = turn; }
  if (state.pendingAwardCeremony?.playerWins?.length) { tracker.awardWins += state.pendingAwardCeremony.playerWins.length; if (tracker.firstAwardWinTurn === 0) tracker.firstAwardWinTurn = turn; }
  if (tracker.hit500k === 0 && state.money >= 500000) tracker.hit500k = turn;
  if (tracker.hit1m === 0 && state.money >= 1000000) tracker.hit1m = turn;
  if (tracker.hit2m === 0 && state.money >= 2000000) tracker.hit2m = turn;
  if (tracker.hit5m === 0 && state.money >= 5000000) tracker.hit5m = turn;
  if (state.money < tracker.minMoney) { tracker.minMoney = state.money; tracker.minMoneyTurn = turn; }
  if (state.money < 0) tracker.bankruptcyCloseCallTurns.push(turn);
  if (state.money < tracker.prevMoney) { if (tracker.lossStreakStart === 0) tracker.lossStreakStart = turn; } else { if (tracker.lossStreakStart > 0) { const len = turn - tracker.lossStreakStart; if (len >= 8) tracker.sustainedLossPeriods.push({ start: tracker.lossStreakStart, end: turn - 1, length: len }); tracker.lossStreakStart = 0; } }
  tracker.prevMoney = state.money;
  if (turn % 50 === 0) for (const a of state.artists.filter((a) => a.signed)) tracker.momentumDecaySamples.push({ artistName: a.name, turn, momentum: a.momentum ?? 0 });
  for (const a of state.artists.filter((a) => a.signed)) { const prev = tracker.prevPhases.get(a.id); const cur = a.careerPhase ?? "prospect"; if (prev && prev !== cur) tracker.careerPhaseTransitions.push({ artistName: a.name, turn, from: prev, to: cur }); tracker.prevPhases.set(a.id, cur); }
  if (turn === 1) tracker.freeAgentAnalysis.turn1 = analyzePool(state.freeAgentPool, state.reputation);
  if (turn === 300) tracker.freeAgentAnalysis.turn300 = analyzePool(state.freeAgentPool, state.reputation);
  if (turn === 600) tracker.freeAgentAnalysis.turn600 = analyzePool(state.freeAgentPool, state.reputation);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

type UpgradeFn = (state: GameState) => { newState: GameState; error?: string };

function tryUpgrade(state: GameState, fn: UpgradeFn, keepReserve: number): { state: GameState; upgraded: boolean; cost: number } {
  if (state.money < keepReserve) return { state, upgraded: false, cost: 0 };
  const before = state.money;
  const result = fn(state);
  if (result.error) return { state, upgraded: false, cost: 0 };
  // Check we still have reserve after upgrade
  if (result.newState.money < keepReserve * 0.5) return { state, upgraded: false, cost: 0 };
  return { state: result.newState, upgraded: true, cost: before - result.newState.money };
}

function getBestAffordableProducer(state: GameState, maxCost: number) {
  const unlocked = state.producers.filter((p) => isProducerUnlocked(p, state) && p.costPerSong <= maxCost);
  if (unlocked.length === 0) return null;
  return unlocked.sort((a, b) => b.quality - a.quality)[0];
}

function getCheapestProducer(state: GameState) {
  const unlocked = state.producers.filter((p) => isProducerUnlocked(p, state));
  if (unlocked.length === 0) return null;
  return unlocked.sort((a, b) => a.costPerSong - b.costPerSong)[0];
}

function trySignFromPool(state: GameState, filter: (a: Artist) => boolean, maxFee: number): { state: GameState; signed: boolean; fee: number } {
  const rosterCap = STUDIO_DATA[state.studioLevel].rosterCap;
  const currentSigned = state.artists.filter((a) => a.signed).length;
  if (currentSigned >= rosterCap) return { state, signed: false, fee: 0 };
  const visible = getVisibleFreeAgents(state);
  const candidates = visible
    .filter((a) => computeWillingness(a, state.reputation) >= MIN_SIGNING_WILLINGNESS && filter(a))
    .sort((a, b) => b.overallRating - a.overallRating);
  for (const c of candidates.slice(0, 8)) {
    const fee = computeSigningFee(c, 1);
    if (fee > maxFee || fee > state.money) continue;
    const result = signArtist(state, c.id, fee, 1);
    if (!result.error) return { state: result.newState, signed: true, fee };
  }
  return { state, signed: false, fee: 0 };
}

function trySendOnTour(state: GameState, artistId: string, preferred: TourSize): { state: GameState; sent: boolean } {
  const artist = state.artists.find((a) => a.id === artistId);
  if (!artist || !artist.signed || artist.onTour || artist.fatigue > 75) return { state, sent: false };
  const allTours: TourSize[] = ["world_tour", "major_tour", "national_tour", "regional_tour", "club_tour"];
  const idx = allTours.indexOf(preferred);
  const toTry = allTours.slice(idx);
  for (const tt of toTry) {
    const t = TOUR_DATA[tt];
    if (t.bookingCost > state.money * 0.5) continue; // don't spend more than half on booking
    const result = sendOnTour(state, artistId, tt);
    if (!result.error) return { state: result.newState, sent: true };
  }
  return { state, sent: false };
}

function handleExpiredContracts(state: GameState, maxFee: number): GameState {
  let s = state;
  for (const artist of s.artists.filter((a) => a.signed && a.contractAlbumsLeft === 0 && a.contractAlbumsTotal > 0)) {
    if (artist.overallRating < 30) continue; // let bad artists leave
    const fee = computeRenegotiationFee(artist, s, 1);
    if (fee <= maxFee && fee <= s.money * 0.3) {
      const result = renegotiateContract(s, artist.id, 1, fee);
      if (!result.error) s = result.newState;
    }
  }
  return s;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── STRATEGIES ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

type StrategyFn = (state: GameState, turn: number, tracker: SimTracker) => GameState;

// ── Strategy A: Singles Factory ─────────────────────────────────────────────
// Focus: sign young cheap artists, record cheap singles, release immediately, club tours.
// Upgrade studio & scouting when flush. Never make albums.

function singlesFactory(state: GameState, turn: number, tracker: SimTracker): GameState {
  let s = state;
  const overhead = getWeeklyOverhead(s);
  const safeReserve = Math.max(20000, overhead * 12);

  // STEP 1: Record and release singles with existing artists FIRST (revenue before spending)
  const cheapProd = getCheapestProducer(s);
  if (cheapProd) {
    for (const artist of s.artists.filter((a) => a.signed && !a.onTour)) {
      if (artist.fatigue >= 75) {
        const rr = restArtist(s, artist.id);
        if (!rr.error) s = rr.newState;
        continue;
      }
      if (artist.fatigue >= 85 || s.money < cheapProd.costPerSong + safeReserve) continue;
      const rec = recordSong(s, artist.id, cheapProd.id, true);
      if (rec.song) {
        s = rec.newState;
        tracker.songsRecorded++;
        tracker.totalProducerCosts += cheapProd.costPerSong;
        s = releaseSong(s, rec.song.id);
        tracker.songsReleased++;
      }
    }
  }

  // STEP 2: Send available artists on club tours
  for (const artist of s.artists.filter((a) => a.signed && !a.onTour && a.fatigue <= 55)) {
    if (s.money < TOUR_DATA.club_tour.bookingCost + safeReserve) break;
    const r = trySendOnTour(s, artist.id, "club_tour");
    if (r.sent) s = r.state;
  }

  // STEP 3: Handle expired contracts (cheap)
  s = handleExpiredContracts(s, 15000);

  // STEP 4: Sign new young cheap artists when flush
  const signedCount = s.artists.filter((a) => a.signed).length;
  const rosterCap = STUDIO_DATA[s.studioLevel].rosterCap;
  if (signedCount < rosterCap && s.money > safeReserve + 20000) {
    const r = trySignFromPool(s, (a) => a.age <= 24 && a.overallRating >= 30, Math.min(s.money - safeReserve, 25000));
    if (r.signed) { s = r.state; tracker.totalSigningFees += r.fee; tracker.totalArtistsSigned++; }
  }

  // STEP 5: Upgrade only when well above reserve (studio > scouting > marketing > merch)
  if (s.money > safeReserve * 2) {
    for (const fn of [upgradeStudio, upgradeScouting, upgradeMarketing, upgradeMerch] as UpgradeFn[]) {
      const r = tryUpgrade(s, fn, safeReserve * 1.5);
      if (r.upgraded) { s = r.state; tracker.totalUpgradeCosts += r.cost; break; }
    }
  }

  return s;
}

// ── Strategy B: Album Builder ───────────────────────────────────────────────
// Focus: 2-3 mid-level artists, invest in artist dev, record 10+ track albums, tour after.

function albumBuilder(state: GameState, turn: number, tracker: SimTracker): GameState {
  let s = state;
  const overhead = getWeeklyOverhead(s);
  const safeReserve = Math.max(25000, overhead * 12);

  // STEP 1: For signed artists not on tour, work on albums
  const bestProd = getBestAffordableProducer(s, Math.min(s.money * 0.08, 25000));
  if (bestProd) {
    for (const artist of s.artists.filter((a) => a.signed && !a.onTour)) {
      if (artist.fatigue >= 70) {
        const rr = restArtist(s, artist.id);
        if (!rr.error) s = rr.newState;
        continue;
      }
      if (artist.fatigue >= 85) continue;

      // Get or start album
      let album = s.albums.find((al) => al.artistId === artist.id && al.status === "recording");
      if (!album) {
        const startRes = startAlbum(s, artist.id);
        if (!startRes.error && startRes.album) {
          s = startRes.newState;
          album = startRes.album;
        }
      }

      if (album && s.money >= bestProd.costPerSong + safeReserve) {
        const rec = recordSong(s, artist.id, bestProd.id, false);
        if (rec.song) {
          s = rec.newState;
          tracker.songsRecorded++;
          tracker.totalProducerCosts += bestProd.costPerSong;
        }

        // Check if album has enough tracks to release
        const albumSongCount = s.songs.filter((song) => album!.songIds.includes(song.id)).length;
        if (albumSongCount >= 12) {
          const mktBudget = Math.min(Math.floor(s.money * 0.08), 30000);
          const relRes = releaseAlbum(s, album.id, mktBudget);
          if (!relRes.error) {
            s = relRes.newState;
            tracker.albumsReleased++;
            tracker.totalMarketingSpend += mktBudget;
            tracker.songsReleased += albumSongCount;
          }
        }
      } else if (!album) {
        // No album possible — record a standalone single as filler
        if (s.money >= bestProd.costPerSong + safeReserve) {
          const rec = recordSong(s, artist.id, bestProd.id, true);
          if (rec.song) {
            s = rec.newState;
            tracker.songsRecorded++;
            tracker.totalProducerCosts += bestProd.costPerSong;
            s = releaseSong(s, rec.song.id);
            tracker.songsReleased++;
          }
        }
      }
    }
  }

  // STEP 2: Tour after album release
  for (const artist of s.artists.filter((a) => a.signed && !a.onTour && a.fatigue <= 55)) {
    const recentAlbum = s.albums.find((al) => al.artistId === artist.id && al.status === "released" && s.turn - al.turnReleased <= 20);
    if (!recentAlbum && s.turn > 30) continue; // only tour after an album (or early game for income)
    if (s.money < TOUR_DATA.regional_tour.bookingCost + safeReserve) {
      // Fall back to club tour
      if (s.money < TOUR_DATA.club_tour.bookingCost + safeReserve) break;
      const r = trySendOnTour(s, artist.id, "club_tour");
      if (r.sent) s = r.state;
    } else {
      const r = trySendOnTour(s, artist.id, "regional_tour");
      if (r.sent) s = r.state;
    }
  }

  // STEP 3: Handle expired contracts
  s = handleExpiredContracts(s, 30000);

  // STEP 4: Sign mid-level artists (target 3)
  const signedCount = s.artists.filter((a) => a.signed).length;
  if (signedCount < 3 && s.money > safeReserve + 30000) {
    const r = trySignFromPool(s, (a) => a.overallRating >= 38 && a.overallRating <= 75 && a.age >= 20 && a.age <= 28, Math.min(s.money - safeReserve, 40000));
    if (r.signed) { s = r.state; tracker.totalSigningFees += r.fee; tracker.totalArtistsSigned++; }
  }

  // STEP 5: Balanced upgrades when flush
  if (s.money > safeReserve * 2.5) {
    const fns = [upgradeStudio, upgradeArtistDev, upgradeMarketing, upgradeScouting, upgradeTouringDept, upgradeMerch, upgradePR] as UpgradeFn[];
    const fn = fns[turn % fns.length];
    const r = tryUpgrade(s, fn, safeReserve * 2);
    if (r.upgraded) { s = r.state; tracker.totalUpgradeCosts += r.cost; }
  }

  return s;
}

// ── Strategy C: Star Chaser ─────────────────────────────────────────────────
// Focus: Save early, upgrade scouting & studio to find/afford high-OVR artists. Quality > quantity.

function starChaser(state: GameState, turn: number, tracker: SimTracker): GameState {
  let s = state;
  const overhead = getWeeklyOverhead(s);
  const safeReserve = Math.max(30000, overhead * 15);

  // STEP 1: Record with best available producers for existing artists
  const maxProdCost = Math.min(s.money * 0.1, 20000);
  const prod = getBestAffordableProducer(s, maxProdCost);
  if (prod) {
    for (const artist of s.artists.filter((a) => a.signed && !a.onTour)) {
      if (artist.fatigue >= 65) {
        const rr = restArtist(s, artist.id);
        if (!rr.error) s = rr.newState;
        continue;
      }
      if (artist.fatigue >= 80 || s.money < prod.costPerSong + safeReserve) continue;

      // Work on albums when possible
      let album = s.albums.find((al) => al.artistId === artist.id && al.status === "recording");
      if (!album) {
        const startRes = startAlbum(s, artist.id);
        if (!startRes.error && startRes.album) { s = startRes.newState; album = startRes.album; }
      }

      if (album) {
        const rec = recordSong(s, artist.id, prod.id, false);
        if (rec.song) {
          s = rec.newState;
          tracker.songsRecorded++;
          tracker.totalProducerCosts += prod.costPerSong;
        }
        const albumSongCount = s.songs.filter((song) => album!.songIds.includes(song.id)).length;
        if (albumSongCount >= 10) {
          const mktBudget = Math.min(Math.floor(s.money * 0.1), 50000);
          const relRes = releaseAlbum(s, album.id, mktBudget);
          if (!relRes.error) {
            s = relRes.newState;
            tracker.albumsReleased++;
            tracker.totalMarketingSpend += mktBudget;
            tracker.songsReleased += albumSongCount;
          }
        }
      } else {
        // Record standalone singles
        const rec = recordSong(s, artist.id, prod.id, true);
        if (rec.song) {
          s = rec.newState;
          tracker.songsRecorded++;
          tracker.totalProducerCosts += prod.costPerSong;
          s = releaseSong(s, rec.song.id);
          tracker.songsReleased++;
        }
      }
    }
  }

  // STEP 2: Selective touring
  for (const artist of s.artists.filter((a) => a.signed && !a.onTour && a.fatigue <= 50)) {
    if (s.money < safeReserve + 5000) break;
    const r = trySendOnTour(s, artist.id, "regional_tour");
    if (r.sent) s = r.state;
  }

  // STEP 3: Handle contracts
  s = handleExpiredContracts(s, 40000);

  // STEP 4: Sign high-OVR only (fewer but better) — wait until scouting is decent
  const signedCount = s.artists.filter((a) => a.signed).length;
  const targetRoster = Math.min(4, STUDIO_DATA[s.studioLevel].rosterCap);
  if (signedCount < targetRoster && s.money > safeReserve + 50000) {
    const minOvr = s.scoutingLevel >= 3 ? 55 : 42;
    const r = trySignFromPool(s, (a) => a.overallRating >= minOvr, Math.min(s.money - safeReserve, 60000));
    if (r.signed) { s = r.state; tracker.totalSigningFees += r.fee; tracker.totalArtistsSigned++; }
  }

  // STEP 5: Aggressive scouting & studio upgrades when flush
  if (s.money > safeReserve * 2) {
    for (const fn of [upgradeScouting, upgradeStudio, upgradeArtistDev, upgradeMarketing, upgradePR] as UpgradeFn[]) {
      const r = tryUpgrade(s, fn, safeReserve * 1.5);
      if (r.upgraded) { s = r.state; tracker.totalUpgradeCosts += r.cost; break; }
    }
  }

  return s;
}

// ── Strategy D: Touring Machine ─────────────────────────────────────────────
// Focus: Upgrade touring early, send artists on tours ASAP, use tour revenue to grow.

function touringMachine(state: GameState, turn: number, tracker: SimTracker): GameState {
  let s = state;
  const overhead = getWeeklyOverhead(s);
  const safeReserve = Math.max(20000, overhead * 10);

  // STEP 1: Record cheap singles for artists not on tour (need content for charts)
  const cheapProd = getCheapestProducer(s);
  if (cheapProd) {
    for (const artist of s.artists.filter((a) => a.signed && !a.onTour)) {
      if (artist.fatigue >= 70) {
        const rr = restArtist(s, artist.id);
        if (!rr.error) s = rr.newState;
        continue;
      }
      if (artist.fatigue >= 80 || s.money < cheapProd.costPerSong + safeReserve) continue;
      const rec = recordSong(s, artist.id, cheapProd.id, true);
      if (rec.song) {
        s = rec.newState;
        tracker.songsRecorded++;
        tracker.totalProducerCosts += cheapProd.costPerSong;
        s = releaseSong(s, rec.song.id);
        tracker.songsReleased++;
      }
    }
  }

  // STEP 2: Send EVERY available artist on tour (the core strategy)
  for (const artist of s.artists.filter((a) => a.signed && !a.onTour && a.fatigue <= 65)) {
    if (s.money < TOUR_DATA.club_tour.bookingCost + safeReserve * 0.5) break;
    const preferred: TourSize = s.touringLevel >= 5 ? "national_tour" : s.touringLevel >= 2 ? "regional_tour" : "club_tour";
    const r = trySendOnTour(s, artist.id, preferred);
    if (r.sent) s = r.state;
  }

  // STEP 3: Handle contracts
  s = handleExpiredContracts(s, 20000);

  // STEP 4: Sign more artists for touring (more = more tour revenue)
  const signedCount = s.artists.filter((a) => a.signed).length;
  const rosterCap = STUDIO_DATA[s.studioLevel].rosterCap;
  if (signedCount < rosterCap && s.money > safeReserve + 15000) {
    const r = trySignFromPool(s, (a) => a.overallRating >= 30 && a.age <= 30, Math.min(s.money - safeReserve, 20000));
    if (r.signed) { s = r.state; tracker.totalSigningFees += r.fee; tracker.totalArtistsSigned++; }
  }

  // STEP 5: Upgrade touring > studio > merch > marketing
  if (s.money > safeReserve * 2) {
    for (const fn of [upgradeTouringDept, upgradeStudio, upgradeMerch, upgradeMarketing, upgradePR] as UpgradeFn[]) {
      const r = tryUpgrade(s, fn, safeReserve * 1.5);
      if (r.upgraded) { s = r.state; tracker.totalUpgradeCosts += r.cost; break; }
    }
  }

  return s;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── SIMULATION RUNNER ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function runSimulation(strategyName: string, strategyFn: StrategyFn): SimResult {
  let state = createInitialState(strategyName);
  const tracker = createTracker();
  const snapshots: TurnSnapshot[] = [];
  tracker.totalArtistsSigned = 2;
  for (let turn = 1; turn <= 600; turn++) {
    const prevState = state;
    state = strategyFn(state, turn, tracker);
    state = advanceTurn(state);
    updateTracker(state, prevState, tracker, turn);
    if (turn % 10 === 0 || turn === 1 || turn === 600) {
      snapshots.push({ turn, money: state.money, reputation: state.reputation, fanbase: state.fanbase, signedCount: state.artists.filter((a) => a.signed).length, chartEntries: state.chart.length, playerChartEntries: state.chart.filter((c) => c.isPlayerSong).length });
    }
    if (state.gameOver) {
      console.log(`  [${strategyName}] GAME OVER at turn ${turn} (money: $${state.money.toLocaleString()}, rep: ${state.reputation})`);
      for (let t = turn + 10; t <= 600; t += 10) snapshots.push({ turn: t, money: state.money, reputation: state.reputation, fanbase: state.fanbase, signedCount: 0, chartEntries: 0, playerChartEntries: 0 });
      break;
    }
  }
  return {
    strategyName, snapshots, finalState: state,
    totalStreamRevenue: tracker.totalStreamRevenue, totalTourRevenue: tracker.totalTourRevenue, totalMerchRevenue: tracker.totalMerchRevenue,
    totalOverheadPaid: tracker.totalOverheadPaid, totalSigningFees: tracker.totalSigningFees, totalProducerCosts: tracker.totalProducerCosts,
    totalMarketingSpend: tracker.totalMarketingSpend, totalUpgradeCosts: tracker.totalUpgradeCosts,
    totalArtistsSigned: tracker.totalArtistsSigned, songsRecorded: tracker.songsRecorded,
    songsReleased: Math.max(state.songs.filter((s) => s.released).length, tracker.songsReleased),
    albumsReleased: Math.max(state.albums.filter((al) => al.status === "released").length, tracker.albumsReleased),
    chartAppearances: tracker.chartAppearances, numberOneHits: tracker.numberOneHits, awardWins: tracker.awardWins,
    firstChartTurn: tracker.firstChartTurn, firstNumberOneTurn: tracker.firstNumberOneTurn, firstAwardWinTurn: tracker.firstAwardWinTurn,
    hit500k: tracker.hit500k, hit1m: tracker.hit1m, hit2m: tracker.hit2m, hit5m: tracker.hit5m,
    minMoney: tracker.minMoney, minMoneyTurn: tracker.minMoneyTurn,
    sustainedLossPeriods: tracker.sustainedLossPeriods, bankruptcyCloseCallTurns: tracker.bankruptcyCloseCallTurns,
    freeAgentAnalysis: { turn1: tracker.freeAgentAnalysis.turn1, turn300: tracker.freeAgentAnalysis.turn300, turn600: tracker.freeAgentAnalysis.turn600 },
    momentumDecaySamples: tracker.momentumDecaySamples, careerPhaseTransitions: tracker.careerPhaseTransitions,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// ── OUTPUT ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function printStrategyReport(r: SimResult): void {
  const s = r.finalState;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  STRATEGY: ${r.strategyName}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`\n  Final State (Turn ${s.turn}):`);
  console.log(`    Money:      $${s.money.toLocaleString()}`);
  console.log(`    Reputation: ${s.reputation}`);
  console.log(`    Fanbase:    ${s.fanbase.toLocaleString()}`);
  console.log(`    Game Over:  ${s.gameOver ? "YES (turn " + s.turn + ")" : "NO"}`);
  console.log(`\n  Department Levels:`);
  console.log(`    Studio: ${s.studioLevel}/10 | Scouting: ${s.scoutingLevel}/10 | ArtistDev: ${s.artistDevLevel}/10 | Touring: ${s.touringLevel}/10`);
  console.log(`    Marketing: ${s.marketingLevel}/10 | PR: ${s.prLevel}/10 | Merch: ${s.merchLevel}/10`);
  console.log(`\n  Revenue Breakdown:`);
  console.log(`    Streaming:  $${r.totalStreamRevenue.toLocaleString()}`);
  console.log(`    Touring:    $${r.totalTourRevenue.toLocaleString()}`);
  console.log(`    Merch:      $${r.totalMerchRevenue.toLocaleString()}`);
  const totalRev = r.totalStreamRevenue + r.totalTourRevenue + r.totalMerchRevenue;
  console.log(`    TOTAL REV:  $${totalRev.toLocaleString()}`);
  console.log(`\n  Expenses:`);
  console.log(`    Overhead:   $${r.totalOverheadPaid.toLocaleString()}`);
  console.log(`    Signing:    $${r.totalSigningFees.toLocaleString()}`);
  console.log(`    Producers:  $${r.totalProducerCosts.toLocaleString()}`);
  console.log(`    Marketing:  $${r.totalMarketingSpend.toLocaleString()}`);
  console.log(`    Upgrades:   $${r.totalUpgradeCosts.toLocaleString()}`);
  const totalExp = r.totalOverheadPaid + r.totalSigningFees + r.totalProducerCosts + r.totalMarketingSpend + r.totalUpgradeCosts;
  console.log(`    TOTAL EXP:  $${totalExp.toLocaleString()}`);
  console.log(`\n  Activity:`);
  console.log(`    Artists Signed: ${r.totalArtistsSigned} | Songs Recorded: ${r.songsRecorded} | Songs Released: ${r.songsReleased} | Albums Released: ${r.albumsReleased}`);
  console.log(`    Currently Signed: ${s.artists.filter((a) => a.signed).length}`);
  console.log(`\n  Chart Performance:`);
  console.log(`    Chart Appearances: ${r.chartAppearances} | #1 Hits: ${r.numberOneHits} | Awards Won: ${r.awardWins}`);
  console.log(`\n  Key Milestones (turn #):`);
  console.log(`    First Chart: ${r.firstChartTurn || "never"} | First #1: ${r.firstNumberOneTurn || "never"} | First Award: ${r.firstAwardWinTurn || "never"}`);
  console.log(`    Hit $500K: ${r.hit500k || "never"} | Hit $1M: ${r.hit1m || "never"} | Hit $2M: ${r.hit2m || "never"} | Hit $5M: ${r.hit5m || "never"}`);
  console.log(`\n  Financial Health:`);
  console.log(`    Lowest Cash: $${r.minMoney.toLocaleString()} (turn ${r.minMoneyTurn}) | Below $0: ${r.bankruptcyCloseCallTurns.length} turns`);
  if (r.sustainedLossPeriods.length > 0) {
    console.log(`    Sustained Loss Periods (8+ turns): ${r.sustainedLossPeriods.length}`);
    for (const p of r.sustainedLossPeriods.slice(0, 3)) console.log(`      Turns ${p.start}-${p.end} (${p.length} turns)`);
  }
  console.log(`\n  Cash Flow Trajectory:`);
  for (const t of [1, 50, 100, 150, 200, 300, 400, 500, 600]) {
    const snap = r.snapshots.find((s) => s.turn === t) ?? r.snapshots[r.snapshots.length - 1];
    if (snap) console.log(`    Turn ${String(t).padStart(3)}: $${snap.money.toLocaleString().padStart(14)} | Rep: ${String(snap.reputation).padStart(3)} | Fans: ${snap.fanbase.toLocaleString().padStart(12)} | Signed: ${snap.signedCount} | Chart: ${snap.playerChartEntries}`);
  }
  console.log(`\n  Current Roster:`);
  for (const a of s.artists.filter((a) => a.signed).slice(0, 10)) {
    console.log(`    ${a.name.padEnd(22)} Age ${String(a.age).padStart(2)} | OVR ${String(a.overallRating).padStart(2)} | Pop ${String(a.popularity).padStart(3)} | Mom ${String(a.momentum).padStart(3)} | Phase: ${a.careerPhase.padEnd(11)} | Dur: ${a.durability}`);
  }
}

function printComparison(results: SimResult[]): void {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  CROSS-STRATEGY COMPARISON`);
  console.log(`${"=".repeat(70)}`);
  const headers = ["Metric", ...results.map((r) => r.strategyName.substring(0, 18))];
  const rows: string[][] = [];
  function addRow(l: string, fn: (r: SimResult) => string | number) { rows.push([l, ...results.map((r) => String(fn(r)))]); }
  addRow("Final Money", (r) => "$" + r.finalState.money.toLocaleString());
  addRow("Final Rep", (r) => r.finalState.reputation);
  addRow("Final Fanbase", (r) => r.finalState.fanbase.toLocaleString());
  addRow("Game Over?", (r) => r.finalState.gameOver ? `YES (t${r.finalState.turn})` : "NO");
  addRow("Total Revenue", (r) => "$" + (r.totalStreamRevenue + r.totalTourRevenue + r.totalMerchRevenue).toLocaleString());
  addRow("Stream Rev", (r) => "$" + r.totalStreamRevenue.toLocaleString());
  addRow("Tour Rev", (r) => "$" + r.totalTourRevenue.toLocaleString());
  addRow("Merch Rev", (r) => "$" + r.totalMerchRevenue.toLocaleString());
  addRow("Total Overhead", (r) => "$" + r.totalOverheadPaid.toLocaleString());
  addRow("Artists Signed", (r) => r.totalArtistsSigned);
  addRow("Songs Released", (r) => r.songsReleased);
  addRow("Albums Released", (r) => r.albumsReleased);
  addRow("Chart Appear.", (r) => r.chartAppearances);
  addRow("#1 Hits", (r) => r.numberOneHits);
  addRow("Awards Won", (r) => r.awardWins);
  addRow("First Chart", (r) => r.firstChartTurn || "never");
  addRow("First #1", (r) => r.firstNumberOneTurn || "never");
  addRow("Hit $1M Turn", (r) => r.hit1m || "never");
  addRow("Hit $5M Turn", (r) => r.hit5m || "never");
  addRow("Lowest Cash", (r) => "$" + r.minMoney.toLocaleString());
  addRow("Below $0 Turns", (r) => r.bankruptcyCloseCallTurns.length);
  const colWidths = headers.map((_, i) => Math.max(headers[i].length, ...rows.map((r) => r[i].length)) + 2);
  console.log("\n  " + headers.map((h, i) => h.padEnd(colWidths[i])).join("|"));
  console.log("  " + colWidths.map((w) => "-".repeat(w)).join("+"));
  for (const row of rows) console.log("  " + row.map((c, i) => c.padEnd(colWidths[i])).join("|"));
}

function printPoolAnalysis(label: string, pa: PoolAnalysis | null): void {
  if (!pa) { console.log(`  ${label}: [no data]`); return; }
  console.log(`\n  ${label} (${pa.totalCount} artists, avg momentum: ${pa.avgMomentum}):`);
  console.log(`    Signable (willingness >= 25): ${pa.signableCount} (${Math.round(pa.signableCount / Math.max(1, pa.totalCount) * 100)}%)`);
  console.log(`    Age:   ${JSON.stringify(pa.ageDistribution)}`);
  console.log(`    OVR:   ${JSON.stringify(pa.ovrDistribution)}`);
  console.log(`    Phase: ${JSON.stringify(pa.careerPhaseDistribution)}`);
  console.log(`    Dur:   ${JSON.stringify(pa.durabilityDistribution)}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── MAIN ────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

console.log("Starting simulation of 4 strategies x 600 turns...\n");

const strategies: Array<{ name: string; fn: StrategyFn }> = [
  { name: "A: Singles Factory", fn: singlesFactory },
  { name: "B: Album Builder", fn: albumBuilder },
  { name: "C: Star Chaser", fn: starChaser },
  { name: "D: Touring Machine", fn: touringMachine },
];

const results: SimResult[] = [];
for (const { name, fn } of strategies) {
  console.log(`Running ${name}...`);
  const result = runSimulation(name, fn);
  results.push(result);
  console.log(`  Done. Final money: $${result.finalState.money.toLocaleString()}, Game Over: ${result.finalState.gameOver}`);
}

for (const r of results) printStrategyReport(r);
printComparison(results);

// Free Agent Pool Analysis
console.log(`\n${"=".repeat(70)}`);
console.log(`  FREE AGENT POOL ANALYSIS`);
console.log(`${"=".repeat(70)}`);
const poolResult = results.find((r) => !r.finalState.gameOver) ?? results[0];
printPoolAnalysis("Turn 1 Pool", poolResult.freeAgentAnalysis.turn1);
printPoolAnalysis("Turn 300 Pool", poolResult.freeAgentAnalysis.turn300);
printPoolAnalysis("Turn 600 Pool", poolResult.freeAgentAnalysis.turn600);

// Momentum Decay Analysis
console.log(`\n${"=".repeat(70)}`);
console.log(`  MOMENTUM DECAY ANALYSIS (sampled every 50 turns)`);
console.log(`${"=".repeat(70)}`);
for (const r of results) {
  console.log(`\n  ${r.strategyName}:`);
  const byTurn = new Map<number, number[]>();
  for (const s of r.momentumDecaySamples) { const arr = byTurn.get(s.turn) || []; arr.push(s.momentum); byTurn.set(s.turn, arr); }
  for (const [turn, moms] of [...byTurn.entries()].sort((a, b) => a[0] - b[0])) {
    const avg = Math.round(moms.reduce((a, b) => a + b, 0) / moms.length);
    console.log(`    Turn ${String(turn).padStart(3)}: avg=${avg}, min=${Math.min(...moms)}, max=${Math.max(...moms)}, artists=${moms.length}`);
  }
  if (byTurn.size === 0) console.log("    [no data - game ended too early]");
}

// Career Phase Transitions
console.log(`\n${"=".repeat(70)}`);
console.log(`  CAREER PHASE TRANSITIONS`);
console.log(`${"=".repeat(70)}`);
for (const r of results) {
  console.log(`\n  ${r.strategyName}: ${r.careerPhaseTransitions.length} total transitions`);
  const counts: Record<string, number> = {};
  for (const t of r.careerPhaseTransitions) { const key = `${t.from} -> ${t.to}`; counts[key] = (counts[key] || 0) + 1; }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sorted.slice(0, 15)) console.log(`    ${key}: ${count}`);
  if (sorted.length === 0) console.log("    [none]");
}

// Signing Difficulty
console.log(`\n${"=".repeat(70)}`);
console.log(`  SIGNING DIFFICULTY AT DIFFERENT REPUTATION LEVELS`);
console.log(`${"=".repeat(70)}`);
const testPool = Array.from({ length: 1000 }, (_, i) => generateArtist(`test_${i}`));
for (const rep of [10, 20, 30, 40, 50, 60, 70, 80, 90]) {
  let signable = 0, ovrAbove60Signable = 0, ovrAbove60Total = 0;
  for (const a of testPool) {
    const w = computeWillingness(a, rep);
    if (w >= MIN_SIGNING_WILLINGNESS) signable++;
    if (a.overallRating >= 60) { ovrAbove60Total++; if (w >= MIN_SIGNING_WILLINGNESS) ovrAbove60Signable++; }
  }
  console.log(`  Rep ${String(rep).padStart(2)}: ${signable}/1000 signable (${Math.round(signable/10)}%) | OVR 60+: ${ovrAbove60Signable}/${ovrAbove60Total} (${Math.round(ovrAbove60Signable/Math.max(1,ovrAbove60Total)*100)}%)`);
}

console.log(`\n${"=".repeat(70)}`);
console.log(`  SIMULATION COMPLETE`);
console.log(`${"=".repeat(70)}\n`);
