/**
 * Strategy Balance Simulation
 * Tests different player strategies over multi-year runs to identify
 * balance issues, dominant strategies, and pain points.
 *
 * Strategies tested:
 * 1. VOLUME GRINDER — Sign cheap artists, release tons of low-quality singles
 * 2. QUALITY FOCUSED — Invest in studio/producers, fewer but better releases
 * 3. TOUR HEAVY — Focus on touring revenue as primary income
 * 4. BALANCED — Mix of everything
 * 5. EARLY SCOUT — Rush scouting to find best free agents early
 * 6. MERCH EMPIRE — Rush merch + fanbase growth for passive income
 */

import { generateArtist, generateAttributes, computeOverall, STUDIO_DATA, SCOUTING_DATA, ARTIST_DEV_DATA, TOURING_DEPT_DATA, MARKETING_DATA, PR_DATA, MERCH_DATA } from "../src/lib/data";
import type { Artist, CareerPhase, DurabilityType, TourSize } from "../src/lib/types";

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMPLIFIED ECONOMY MODEL
// Simulates weekly income/expenses/reputation without full engine dependency
// ═══════════════════════════════════════════════════════════════════════════════

interface SimArtist {
  ovr: number;
  age: number;
  popularity: number;
  fanbase: number;
  momentum: number;
  durability: DurabilityType;
  fatigue: number;
  onTour: boolean;
  tourWeeksLeft: number;
  tourType: TourSize | null;
  lastTourEndTurn: number;
  contractAlbumsLeft: number;
  weeklySongQuality: number; // avg quality of songs this artist produces
  signed: boolean;
}

interface SimState {
  money: number;
  reputation: number;
  fanbase: number;
  turn: number;
  studioLevel: number;
  scoutingLevel: number;
  artistDevLevel: number;
  touringLevel: number;
  marketingLevel: number;
  prLevel: number;
  merchLevel: number;
  artists: SimArtist[];
  songsOnChart: number;
  recentReleaseTurns: number[]; // turns when songs were released (for saturation)
  totalSongsReleased: number;
  totalAlbumsReleased: number;
  totalRevenue: number;
  totalExpenses: number;
  peakMoney: number;
  peakReputation: number;
  turnsBankrupt: number; // if goes negative
  gameOver: boolean;
  gameOverReason: string;
  awardWins: number;
  // tracking
  revenueBySource: { streaming: number; touring: number; merch: number; awards: number; brandDeals: number };
  totalCareerStreams: number;
  chartingSongs3Weeks: number;
  expensesBySource: { overhead: number; salary: number; upgrades: number; signing: number; touring: number; producers: number };
}

const TOUR_DATA: Record<TourSize, { weeks: number; revPerWeek: number; fanPerWeek: number; fatiguePerWeek: number; repGain: number; bookingCost: number; cooldown: number; requiresStudio7: boolean }> = {
  club_tour:     { weeks: 4,  revPerWeek: 6000,   fanPerWeek: 800,   fatiguePerWeek: 3, repGain: 3,  bookingCost: 1500,   cooldown: 4,  requiresStudio7: false },
  regional_tour: { weeks: 6,  revPerWeek: 18000,  fanPerWeek: 2500,  fatiguePerWeek: 4, repGain: 5,  bookingCost: 8000,   cooldown: 6,  requiresStudio7: false },
  national_tour: { weeks: 10, revPerWeek: 40000,  fanPerWeek: 5000,  fatiguePerWeek: 5, repGain: 8,  bookingCost: 25000,  cooldown: 14, requiresStudio7: false },
  major_tour:    { weeks: 16, revPerWeek: 80000,  fanPerWeek: 9000,  fatiguePerWeek: 4, repGain: 12, bookingCost: 60000,  cooldown: 20, requiresStudio7: true },
  world_tour:    { weeks: 22, revPerWeek: 150000, fanPerWeek: 15000, fatiguePerWeek: 3, repGain: 16, bookingCost: 150000, cooldown: 22, requiresStudio7: true },
};

function createInitialState(): SimState {
  return {
    money: 75000,
    reputation: 30,
    fanbase: 10000,
    turn: 1,
    studioLevel: 0,
    scoutingLevel: 0,
    artistDevLevel: 0,
    touringLevel: 0,
    marketingLevel: 0,
    prLevel: 0,
    merchLevel: 0,
    artists: [],
    songsOnChart: 0,
    recentReleaseTurns: [],
    totalSongsReleased: 0,
    totalAlbumsReleased: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    peakMoney: 75000,
    peakReputation: 30,
    turnsBankrupt: 0,
    gameOver: false,
    gameOverReason: "",
    awardWins: 0,
    revenueBySource: { streaming: 0, touring: 0, merch: 0, awards: 0, brandDeals: 0 },
    totalCareerStreams: 0,
    chartingSongs3Weeks: 0,
    expensesBySource: { overhead: 0, salary: 0, upgrades: 0, signing: 0, touring: 0, producers: 0 },
  };
}

function createStarterArtist(ovr: number): SimArtist {
  return {
    ovr, age: rand(19, 22), popularity: rand(5, 15), fanbase: rand(500, 3000),
    momentum: rand(10, 25), durability: "solid", fatigue: 0, onTour: false,
    tourWeeksLeft: 0, tourType: null, lastTourEndTurn: 0, contractAlbumsLeft: 2,
    weeklySongQuality: 0, signed: true,
  };
}

function getDeptOverhead(s: SimState): number {
  return STUDIO_DATA[s.studioLevel].weeklyOperatingCost +
    SCOUTING_DATA[s.scoutingLevel].weeklyOperatingCost +
    ARTIST_DEV_DATA[s.artistDevLevel].weeklyOperatingCost +
    TOURING_DEPT_DATA[s.touringLevel].weeklyOperatingCost +
    MARKETING_DATA[s.marketingLevel].weeklyOperatingCost +
    PR_DATA[s.prLevel].weeklyOperatingCost +
    MERCH_DATA[s.merchLevel].weeklyOperatingCost;
}

function getRosterSalary(s: SimState): number {
  return s.artists.filter(a => a.signed).reduce((sum, a) => {
    const ovrMult = 0.5 + (a.ovr / 100) * 1.5;
    return sum + Math.floor(500 * ovrMult);
  }, 0);
}

function getLabelRecognition(rep: number): number {
  return clamp(0.2 + (rep / 100) * 0.8, 0.2, 1.0);
}

function getRevenueMult(marketingLevel: number): number {
  return 1 + MARKETING_DATA[marketingLevel].revenuePct / 100;
}

// Simplified song quality calculation
function calcSongQuality(artistOvr: number, studioLevel: number, producerQuality: number): number {
  const studio = STUDIO_DATA[studioLevel];
  const base = artistOvr * 0.42 + producerQuality * 0.48 + studio.qualityBonusFlat;
  const variance = 10;
  return clamp(rand(Math.round(base) - variance, Math.round(base) + variance), 1, 100);
}

// Simplified weekly streaming revenue per song on chart
function calcWeeklyStreamRevenue(quality: number, viralPotential: number, artistPop: number, artistFanbase: number, rep: number, marketingLevel: number, playerChartCount: number): number {
  // Quality floor: low-quality songs generate fewer streams
  const qualityFloor = quality >= 60 ? 1.0 : quality >= 45 ? 0.6 : quality >= 30 ? 0.3 : 0.1;
  const streams = Math.floor((viralPotential * 3000 + artistFanbase * 0.35 + quality * 800) * qualityFloor * (0.9 + Math.random() * 0.35));
  const avgPosition = 10;
  const posMult = 0.6 + 1.4 * Math.pow((20 - avgPosition) / 19, 1.5);
  // Quality multiplier: 0.4x at Q0, 1.0x at Q60, capped at 1.8x
  const qualMult = quality >= 60 ? Math.min(1.8, 1.0 + (quality - 60) * 0.02) : 0.4 + (quality / 60) * 0.6;
  const labelRec = getLabelRecognition(rep);
  const revMult = getRevenueMult(marketingLevel);
  // Chart saturation
  const satMult = playerChartCount <= 3 ? 1.0 : playerChartCount <= 6 ? 0.8 : playerChartCount <= 10 ? 0.6 : 0.4;
  return Math.floor(streams * 0.004 * revMult * posMult * qualMult * labelRec * satMult);
}

// How many turns a song stays on chart (approximation based on quality)
function songChartLife(quality: number, viralPotential: number): number {
  const base = Math.floor(quality / 10) + Math.floor(viralPotential / 15);
  return clamp(base + rand(-2, 3), 2, 32);
}

function tryUpgrade(s: SimState, dept: string, maxLevel: number): boolean {
  const getData = (level: number) => {
    switch (dept) {
      case "studio": return STUDIO_DATA[level];
      case "scouting": return SCOUTING_DATA[level];
      case "artistDev": return ARTIST_DEV_DATA[level];
      case "touring": return TOURING_DEPT_DATA[level];
      case "marketing": return MARKETING_DATA[level];
      case "pr": return PR_DATA[level];
      case "merch": return MERCH_DATA[level];
      default: return null;
    }
  };
  const getLevel = () => {
    switch (dept) {
      case "studio": return s.studioLevel;
      case "scouting": return s.scoutingLevel;
      case "artistDev": return s.artistDevLevel;
      case "touring": return s.touringLevel;
      case "marketing": return s.marketingLevel;
      case "pr": return s.prLevel;
      case "merch": return s.merchLevel;
      default: return 0;
    }
  };
  const setLevel = (lvl: number) => {
    switch (dept) {
      case "studio": s.studioLevel = lvl; break;
      case "scouting": s.scoutingLevel = lvl; break;
      case "artistDev": s.artistDevLevel = lvl; break;
      case "touring": s.touringLevel = lvl; break;
      case "marketing": s.marketingLevel = lvl; break;
      case "pr": s.prLevel = lvl; break;
      case "merch": s.merchLevel = lvl; break;
    }
  };

  const current = getLevel();
  if (current >= maxLevel) return false;
  const next = getData(current + 1);
  if (!next) return false;
  const cost = (next as any).unlockCost;
  // Conservative: need 12 weeks of NEW overhead post-upgrade + current overhead as buffer
  const currentOverhead = getDeptOverhead(s) + getRosterSalary(s);
  const newWeeklyOverhead = (next as any).weeklyOperatingCost - (getData(current) as any).weeklyOperatingCost;
  const buffer = (currentOverhead + newWeeklyOverhead) * 12 + 15000; // 12 weeks buffer + safety net
  if (s.money - cost > buffer) {
    s.money -= cost;
    s.expensesBySource.upgrades += cost;
    s.totalExpenses += cost;
    setLevel(current + 1);
    return true;
  }
  return false;
}

function signArtist(s: SimState, ovr: number): SimArtist | null {
  // Signing fee approximation
  const ovrFactor = Math.pow(ovr / 45, 2.8);
  const fee = Math.floor(ovrFactor * 12000 * 0.65); // 1 album deal, no extras
  if (s.money < fee + 20000) return null; // keep buffer
  const rosterCap = STUDIO_DATA[s.studioLevel].rosterCap;
  if (s.artists.filter(a => a.signed).length >= rosterCap) return null;

  s.money -= fee;
  s.expensesBySource.signing += fee;
  s.totalExpenses += fee;

  // Scouting bonus: better scouting gives signed artists momentum/popularity boost
  const scoutBonus = SCOUTING_DATA[s.scoutingLevel].scoutedPct;
  const momBoost = Math.floor(scoutBonus * 0.15);
  const artist: SimArtist = {
    ovr, age: rand(18, 24), popularity: rand(3, 15),
    fanbase: rand(200, 5000), momentum: clamp(rand(8, 20) + momBoost, 0, 100),
    durability: Math.random() < 0.15 ? "durable" : Math.random() < 0.55 ? "solid" : "flash",
    fatigue: 0, onTour: false, tourWeeksLeft: 0, tourType: null,
    lastTourEndTurn: 0, contractAlbumsLeft: 2, weeklySongQuality: 0, signed: true,
  };
  s.artists.push(artist);
  return artist;
}

// Simulate one week
function simulateWeek(s: SimState, strategy: Strategy): void {
  if (s.gameOver) return;

  // Market heat: random weekly conditions (0.75x to 1.25x)
  const marketHeat = 0.75 + Math.random() * 0.50;

  // ── Revenue ──

  // Streaming: approximate based on songs on chart
  let streamRev = 0;
  for (let i = 0; i < s.songsOnChart; i++) {
    const avgQuality = 45 + s.studioLevel * 3;
    const avgViral = avgQuality + rand(-5, 10);
    const avgFanbase = s.fanbase / Math.max(1, s.artists.filter(a => a.signed).length);
    streamRev += calcWeeklyStreamRevenue(avgQuality, avgViral, 30, avgFanbase, s.reputation, s.marketingLevel, s.songsOnChart);
  }
  // Apply market heat to streams
  streamRev = Math.floor(streamRev * marketHeat);
  // Legacy multiplier: career streams build clout (1.0x to 2.0x)
  const legacyMult = 1 + Math.min(1.0, Math.log10(Math.max(1, s.totalCareerStreams / 1000000)) * 0.15);
  streamRev = Math.floor(streamRev * legacyMult);
  // Streaming revenue cap: diminishing returns above $20K/week (matches engine)
  if (streamRev > 20000) {
    if (streamRev <= 40000) streamRev = 20000 + Math.floor((streamRev - 20000) * 0.6);
    else streamRev = 20000 + Math.floor(20000 * 0.6) + Math.floor((streamRev - 40000) * 0.25);
  }
  s.revenueBySource.streaming += streamRev;
  // Track career streams (approximate)
  s.totalCareerStreams += s.songsOnChart * rand(50000, 200000);

  // Tour revenue
  let tourRev = 0;
  let tourRepDelta = 0;
  for (const a of s.artists) {
    if (a.onTour && a.tourType) {
      const t = TOUR_DATA[a.tourType];
      const td = TOURING_DEPT_DATA[s.touringLevel];
      const popMult = 0.5 + a.popularity / 100;
      const fanMult = 1 + Math.log10(Math.max(1, a.fanbase / 10000)) * 0.3;
      const weekRev = Math.floor(t.revPerWeek * popMult * fanMult * (1 + td.revenueBonusPct / 100) * marketHeat);
      tourRev += weekRev;
      const weekFans = Math.floor(t.fanPerWeek * popMult * (1 + td.fanBonusPct / 100));
      a.fanbase += weekFans;
      s.fanbase += weekFans; // tours also grow label fanbase
      a.fatigue = clamp(a.fatigue + Math.max(1, Math.round(t.fatiguePerWeek * (1 - td.fatigueMitigation))), 0, 100);
      // Reduced tour rep tick chances (was 0.4/0.3/0.2, now 0.20/0.15/0.10)
      const tourRepChance = t.repGain >= 8 ? 0.20 : t.repGain >= 5 ? 0.15 : 0.10;
      if (Math.random() < tourRepChance) tourRepDelta += 1;
      a.tourWeeksLeft--;
      if (a.tourWeeksLeft <= 0) {
        a.onTour = false;
        a.tourType = null;
        a.lastTourEndTurn = s.turn;
      }
    }
  }
  s.revenueBySource.touring += tourRev;

  // Merch revenue (with fanbase tier multiplier and variance)
  const merchPerFan = MERCH_DATA[s.merchLevel].revenuePerFan;
  const merchRev = merchPerFan > 0
    ? Math.floor(s.artists.filter(a => a.signed).reduce((sum, a) => {
        const popMult = 0.5 + (a.popularity / 100);
        const fanTier = a.fanbase >= 1000000 ? 2.5 : a.fanbase >= 500000 ? 1.8 : a.fanbase >= 100000 ? 1.3 : 1.0;
        return sum + a.fanbase * merchPerFan * popMult * fanTier;
      }, 0) * (0.8 + Math.random() * 0.4))
    : 0;
  s.revenueBySource.merch += merchRev;

  // Brand deal revenue — unlocks at rep 70+, scales with time
  const brandDealRev = s.reputation >= 70
    ? Math.floor((s.reputation - 60) * (s.fanbase / 100000) * 200 * (1 + s.turn / 520) * (0.8 + Math.random() * 0.4))
    : 0;
  s.revenueBySource.brandDeals += brandDealRev;

  const totalWeeklyRev = streamRev + tourRev + merchRev + brandDealRev;
  s.totalRevenue += totalWeeklyRev;

  // ── Expenses ──
  const deptOverhead = getDeptOverhead(s);
  const rosterSalary = getRosterSalary(s);
  const baseRent = 500; // base office rent
  s.expensesBySource.overhead += deptOverhead + baseRent;
  s.expensesBySource.salary += rosterSalary;
  s.totalExpenses += deptOverhead + rosterSalary + baseRent;

  s.money += totalWeeklyRev - deptOverhead - rosterSalary - baseRent;

  // ── Song chart decay (songs fall off over time) ──
  // Approximate: lose ~1 song from chart every 6-10 turns
  if (s.songsOnChart > 0 && Math.random() < 0.12) {
    s.songsOnChart = Math.max(0, s.songsOnChart - 1);
  }

  // ── Reputation decay if no recent releases ──
  if (s.turn > 20 && s.totalSongsReleased < s.turn / 12) {
    if (Math.random() < 0.5) s.reputation = Math.max(0, s.reputation - 0.5);
  }

  // Apply tour rep delta with credibility gate + diminishing gains
  if (s.reputation >= 60 && s.chartingSongs3Weeks < 3) {
    tourRepDelta = Math.floor(tourRepDelta * 0.5);
  }
  if (tourRepDelta > 0 && s.reputation >= 50) {
    const dampening = Math.min(0.7, (s.reputation - 50) * 0.014);
    tourRepDelta = Math.max(0, Math.round(tourRepDelta * (1 - dampening)));
  }
  s.reputation = Math.min(100, s.reputation + tourRepDelta);

  // ── Elite reputation decay (threshold 75, stronger decay) ──
  if (s.reputation > 75) {
    const hasActiveTouring = s.artists.some(a => a.signed && a.onTour);
    const hasRecentQuality = s.totalSongsReleased > 0 && s.turn > 0 && (s.turn % 8 !== 0 || s.totalSongsReleased > (s.turn - 8) / 3);
    const eliteDecayChance = (s.reputation - 75) * 0.04;
    if (hasRecentQuality) {
      // no decay
    } else if (hasActiveTouring) {
      if (Math.random() < eliteDecayChance * 0.5) s.reputation = Math.max(0, s.reputation - 1);
    } else {
      if (Math.random() < eliteDecayChance) s.reputation = Math.max(0, s.reputation - 1);
    }
    // Above 90: unconditional 12% pressure
    if (s.reputation > 90 && Math.random() < 0.12) {
      s.reputation = Math.max(0, s.reputation - 1);
    }
  }

  // ── Scandal events (with early-game protection) ──
  const prData = PR_DATA[s.prLevel];
  const earlyShield = s.turn <= 20 ? 0.4 : s.turn <= 40 ? 0.7 : 1.0;
  for (const a of s.artists.filter(a => a.signed)) {
    const scandalChance = 40 * 0.1 * (1 - prData.scandalFreqReduction) * earlyShield;
    if (Math.random() * 100 < scandalChance) {
      const dmg = Math.max(1, Math.round(rand(3, 8) * earlyShield * (1 - prData.scandalDamageReduction)));
      s.reputation = Math.max(0, s.reputation - dmg);
      s.money -= dmg * 300;
    }
  }

  // ── Award ceremony (turn 48, then every 52) — rivals scale with time ──
  if (s.turn >= 48 && (s.turn - 48) % 52 === 0) {
    const year = Math.floor((s.turn - 48) / 52) + 1;
    const yearBonus = Math.min(35, year * 4);
    const buzzSwing = () => (Math.random() - 0.4) * 20;
    // Simulate 5 categories, player can win 0-5
    let wins = 0;
    for (let cat = 0; cat < 5; cat++) {
      const playerScore = s.reputation * 0.7 + Math.min(30, s.fanbase / 50000) + s.songsOnChart * 4 + rand(0, 15) + buzzSwing();
      const rivalScore = rand(70, 110) + yearBonus + buzzSwing();
      if (playerScore > rivalScore) wins++;
    }
    if (wins > 0) {
      s.awardWins += wins;
      const reward = wins * (50000 + year * 25000);
      s.money += reward;
      s.reputation = Math.min(100, s.reputation + wins * 3);
      s.revenueBySource.awards += reward;
    }
  }

  // ── Artist aging (every 52 turns) ──
  if (s.turn % 52 === 0) {
    for (const a of s.artists) {
      a.age++;
      // Simple OVR progression
      if (a.age <= 27) {
        a.ovr = Math.min(99, a.ovr + rand(0, 3));
      } else if (a.age <= 32) {
        a.ovr = clamp(a.ovr + rand(-2, 1), 25, 99);
      } else {
        a.ovr = Math.max(25, a.ovr - rand(1, 4));
      }
    }
  }

  // ── Fatigue recovery for non-touring artists ──
  for (const a of s.artists.filter(a => a.signed && !a.onTour)) {
    a.fatigue = Math.max(0, a.fatigue - 7);
  }

  // ── Update state ──
  s.peakMoney = Math.max(s.peakMoney, s.money);
  s.peakReputation = Math.max(s.peakReputation, s.reputation);

  // ── Check game over ──
  const weeklyOverhead = deptOverhead + rosterSalary + baseRent;
  const bankruptcyThreshold = -Math.max(15000, Math.min(200000, weeklyOverhead * 4));
  if (s.money < bankruptcyThreshold) {
    s.gameOver = true;
    s.gameOverReason = `Bankruptcy at turn ${s.turn} ($${Math.floor(s.money).toLocaleString()})`;
  }
  if (s.turn > 26 && s.reputation < 10) {
    s.gameOver = true;
    s.gameOverReason = `Reputation collapse at turn ${s.turn} (rep ${Math.floor(s.reputation)})`;
  }

  s.turn++;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════════

interface Strategy {
  name: string;
  description: string;
  act: (s: SimState) => void; // called each turn to make decisions
}

// Helper: record and release a song for an artist
function recordAndRelease(s: SimState, a: SimArtist, producerQ: number): void {
  const quality = calcSongQuality(a.ovr, s.studioLevel, producerQ);
  const viralPot = clamp(quality + rand(-10, 15), 20, 100);
  const cost = Math.floor(producerQ * 15 + 200); // scale producer cost with quality
  if (s.money < cost + 8000) return; // keep small buffer
  s.money -= cost;
  s.expensesBySource.producers += cost;
  s.totalExpenses += cost;
  s.totalSongsReleased++;
  a.fatigue = Math.min(100, a.fatigue + 6);
  a.popularity = Math.min(100, a.popularity + rand(0, 2));
  a.fanbase += rand(100, 600);
  s.fanbase += rand(50, 300);
  // Does it chart? Quality penalty for low-quality songs + release saturation
  const qualPenalty = quality >= 50 ? 1.0 : quality >= 35 ? 0.7 : 0.4;
  // Release saturation: flooding the market cannibalizes chart chances
  const recentReleases = s.recentReleaseTurns.filter(t => s.turn - t <= 4).length;
  const releaseSatPenalty = recentReleases <= 1 ? 1.0 : recentReleases <= 3 ? 0.85 : recentReleases <= 5 ? 0.7 : 0.55;
  const chartChance = (quality / 100 * 0.45 + viralPot / 100 * 0.25) * qualPenalty * releaseSatPenalty;
  s.recentReleaseTurns.push(s.turn);
  // Clean up old release timestamps (older than 8 turns)
  s.recentReleaseTurns = s.recentReleaseTurns.filter(t => s.turn - t <= 8);
  if (Math.random() < chartChance) {
    s.songsOnChart++;
    s.chartingSongs3Weeks++; // approximate: count charting songs as having 3+ weeks
  }
  // Reduced rep gains from releases (was 2-4 for quality 60+, now 1-3)
  let songRepDelta = 0;
  if (quality >= 60) songRepDelta = rand(1, 3);
  else if (quality >= 40) songRepDelta = rand(0, 1);
  else if (quality < 25) songRepDelta = -rand(1, 2);
  else if (quality < 35) songRepDelta = -rand(0, 1);
  // Credibility gate: rep gains halved above 60 until 3+ charting songs
  if (s.reputation >= 60 && s.chartingSongs3Weeks < 3 && songRepDelta > 0) songRepDelta = Math.floor(songRepDelta * 0.5);
  // Diminishing rep gains above 50
  if (songRepDelta > 0 && s.reputation >= 50) {
    const dampening = Math.min(0.7, (s.reputation - 50) * 0.014);
    songRepDelta = Math.max(0, Math.round(songRepDelta * (1 - dampening)));
  }
  s.reputation = clamp(s.reputation + songRepDelta, 0, 100);
}

function volumeGrinderAct(s: SimState): void {
  // FIRST: Record and release — every artist every 2 turns with cheap producers
  if (s.turn % 2 === 0) {
    for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 80)) {
      recordAndRelease(s, a, 35);
    }
  }

  // Club tours when available
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 50)) {
    if (s.turn - a.lastTourEndTurn > 6 && s.money > 12000) {
      a.onTour = true; a.tourType = "club_tour"; a.tourWeeksLeft = 4;
      s.money -= 2000; s.expensesBySource.touring += 2000; s.totalExpenses += 2000;
      s.reputation = Math.min(100, s.reputation + Math.floor(3 * 0.5) + Math.floor(a.popularity / 80));
    }
  }

  // THEN: Upgrade only when we have money to spare
  if (s.studioLevel < 3) tryUpgrade(s, "studio", 3);
  else if (s.marketingLevel < 3) tryUpgrade(s, "marketing", 3);
  else if (s.studioLevel < 5) tryUpgrade(s, "studio", 5);
  else if (s.marketingLevel < 5) tryUpgrade(s, "marketing", 5);
  else if (s.studioLevel < 7) tryUpgrade(s, "studio", 7);

  // Sign cheap artists when we can afford it
  if (s.turn % 8 === 0) {
    const rosterCap = STUDIO_DATA[s.studioLevel].rosterCap;
    while (s.artists.filter(a => a.signed).length < rosterCap && s.money > 30000) {
      if (!signArtist(s, rand(28, 45))) break;
    }
  }
}

function qualityFocusedAct(s: SimState): void {
  // Record every 3 turns with best producers we can afford
  if (s.turn % 3 === 0) {
    for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 70)) {
      const producerQ = Math.min(80, 45 + s.studioLevel * 4);
      recordAndRelease(s, a, producerQ);
    }
  }

  // Regional tours when popular enough
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 40 && a.popularity > 15)) {
    if (s.turn - a.lastTourEndTurn > 10 && s.money > 30000) {
      a.onTour = true; a.tourType = "regional_tour"; a.tourWeeksLeft = 6;
      s.money -= 12000; s.expensesBySource.touring += 12000; s.totalExpenses += 12000;
      s.reputation = Math.min(100, s.reputation + Math.floor(5 * 0.5) + Math.floor(a.popularity / 80));
    }
  }

  // Upgrade: studio first, then marketing
  if (s.studioLevel < 4) tryUpgrade(s, "studio", 4);
  else if (s.marketingLevel < 3) tryUpgrade(s, "marketing", 3);
  else if (s.artistDevLevel < 3) tryUpgrade(s, "artistDev", 3);
  else if (s.studioLevel < 7) tryUpgrade(s, "studio", 7);
  else if (s.marketingLevel < 6) tryUpgrade(s, "marketing", 6);
  else if (s.artistDevLevel < 5) tryUpgrade(s, "artistDev", 5);
  else if (s.studioLevel < 9) tryUpgrade(s, "studio", 9);
  else if (s.marketingLevel < 8) tryUpgrade(s, "marketing", 8);

  // Sign better artists slowly
  if (s.turn % 12 === 0 && s.money > 40000) {
    const rosterCap = STUDIO_DATA[s.studioLevel].rosterCap;
    if (s.artists.filter(a => a.signed).length < Math.min(rosterCap, 3 + Math.floor(s.turn / 52))) {
      signArtist(s, rand(38, 52));
    }
  }
}

function tourHeavyAct(s: SimState): void {
  // Record to build popularity + maintain rep (every 3 turns, all artists)
  if (s.turn % 3 === 0) {
    for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 70)) {
      recordAndRelease(s, a, 40);
    }
  }

  // Aggressive touring: start with club tours, escalate as you grow
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 50)) {
    const since = s.turn - a.lastTourEndTurn;
    if (s.studioLevel >= 7 && a.popularity > 30 && since > 22 && s.money > 250000) {
      a.onTour = true; a.tourType = "world_tour"; a.tourWeeksLeft = 22;
      s.money -= 150000; s.expensesBySource.touring += 150000; s.totalExpenses += 150000;
      s.reputation = Math.min(100, s.reputation + Math.floor(16 * 0.5) + Math.floor(a.popularity / 80));
    } else if (s.studioLevel >= 7 && since > 20 && s.money > 120000) {
      a.onTour = true; a.tourType = "major_tour"; a.tourWeeksLeft = 16;
      s.money -= 60000; s.expensesBySource.touring += 60000; s.totalExpenses += 60000;
      s.reputation = Math.min(100, s.reputation + Math.floor(12 * 0.5) + Math.floor(a.popularity / 80));
    } else if (since > 14 && s.money > 50000) {
      a.onTour = true; a.tourType = "national_tour"; a.tourWeeksLeft = 10;
      s.money -= 25000; s.expensesBySource.touring += 25000; s.totalExpenses += 25000;
      s.reputation = Math.min(100, s.reputation + Math.floor(8 * 0.5) + Math.floor(a.popularity / 80));
    } else if (since > 6 && s.money > 20000) {
      a.onTour = true; a.tourType = "regional_tour"; a.tourWeeksLeft = 6;
      s.money -= 8000; s.expensesBySource.touring += 8000; s.totalExpenses += 8000;
      s.reputation = Math.min(100, s.reputation + Math.floor(5 * 0.5) + Math.floor(a.popularity / 80));
    } else if (since > 4 && s.money > 8000) {
      a.onTour = true; a.tourType = "club_tour"; a.tourWeeksLeft = 4;
      s.money -= 1500; s.expensesBySource.touring += 1500; s.totalExpenses += 1500;
      s.reputation = Math.min(100, s.reputation + Math.floor(3 * 0.5) + Math.floor(a.popularity / 80));
    }
  }

  // Upgrade: touring first, studio to unlock major tours
  if (s.touringLevel < 3) tryUpgrade(s, "touring", 3);
  else if (s.studioLevel < 3) tryUpgrade(s, "studio", 3);
  else if (s.touringLevel < 5) tryUpgrade(s, "touring", 5);
  else if (s.studioLevel < 7) tryUpgrade(s, "studio", 7);
  else if (s.touringLevel < 8) tryUpgrade(s, "touring", 8);
  else if (s.marketingLevel < 4) tryUpgrade(s, "marketing", 4);
  else if (s.touringLevel < 10) tryUpgrade(s, "touring", 10);

  // Sign artists for touring
  if (s.turn % 10 === 0 && s.money > 30000) {
    const rosterCap = STUDIO_DATA[s.studioLevel].rosterCap;
    if (s.artists.filter(a => a.signed).length < Math.min(rosterCap, 3 + Math.floor(s.turn / 52))) {
      signArtist(s, rand(35, 50));
    }
  }
}

function balancedAct(s: SimState): void {
  // Record every 3 turns
  if (s.turn % 3 === 0) {
    for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 75)) {
      const producerQ = 40 + s.studioLevel * 2;
      recordAndRelease(s, a, producerQ);
    }
  }

  // Tour: mix of club and regional
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 45)) {
    const since = s.turn - a.lastTourEndTurn;
    if (a.popularity > 20 && since > 10 && s.money > 30000) {
      a.onTour = true; a.tourType = "regional_tour"; a.tourWeeksLeft = 6;
      s.money -= 12000; s.expensesBySource.touring += 12000; s.totalExpenses += 12000;
      s.reputation = Math.min(100, s.reputation + Math.floor(5 * 0.5) + Math.floor(a.popularity / 80));
    } else if (since > 6 && s.money > 10000) {
      a.onTour = true; a.tourType = "club_tour"; a.tourWeeksLeft = 4;
      s.money -= 2000; s.expensesBySource.touring += 2000; s.totalExpenses += 2000;
      s.reputation = Math.min(100, s.reputation + Math.floor(3 * 0.5) + Math.floor(a.popularity / 80));
    }
  }

  // Balanced upgrades
  const targets = [
    { dept: "studio", max: 2 }, { dept: "marketing", max: 2 }, { dept: "touring", max: 2 },
    { dept: "merch", max: 2 }, { dept: "studio", max: 4 }, { dept: "marketing", max: 4 },
    { dept: "touring", max: 4 }, { dept: "artistDev", max: 3 }, { dept: "merch", max: 4 },
    { dept: "pr", max: 3 }, { dept: "studio", max: 7 }, { dept: "marketing", max: 6 },
    { dept: "touring", max: 6 }, { dept: "artistDev", max: 5 }, { dept: "merch", max: 6 },
    { dept: "studio", max: 9 }, { dept: "marketing", max: 8 }, { dept: "touring", max: 8 },
  ];
  for (const t of targets) {
    if (tryUpgrade(s, t.dept, t.max)) break;
  }

  // Sign artists
  if (s.turn % 10 === 0 && s.money > 30000) {
    const rosterCap = STUDIO_DATA[s.studioLevel].rosterCap;
    if (s.artists.filter(a => a.signed).length < Math.min(rosterCap, 3 + Math.floor(s.turn / 40))) {
      signArtist(s, rand(35, 50));
    }
  }
}

function merchEmpireAct(s: SimState): void {
  // Record regularly — need releases to grow fanbase
  if (s.turn % 3 === 0) {
    for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 75)) {
      recordAndRelease(s, a, 40);
    }
  }

  // Tours for fanbase growth (regional focus)
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 50)) {
    const since = s.turn - a.lastTourEndTurn;
    if (since > 8 && s.money > 25000) {
      a.onTour = true; a.tourType = "regional_tour"; a.tourWeeksLeft = 6;
      s.money -= 12000; s.expensesBySource.touring += 12000; s.totalExpenses += 12000;
      s.reputation = Math.min(100, s.reputation + Math.floor(5 * 0.5) + Math.floor(a.popularity / 80));
    } else if (since > 6 && s.money > 10000) {
      a.onTour = true; a.tourType = "club_tour"; a.tourWeeksLeft = 4;
      s.money -= 2000; s.expensesBySource.touring += 2000; s.totalExpenses += 2000;
      s.reputation = Math.min(100, s.reputation + Math.floor(3 * 0.5) + Math.floor(a.popularity / 80));
    }
  }

  // Upgrade: merch first, then studio+marketing for growth
  if (s.merchLevel < 3) tryUpgrade(s, "merch", 3);
  else if (s.studioLevel < 3) tryUpgrade(s, "studio", 3);
  else if (s.marketingLevel < 3) tryUpgrade(s, "marketing", 3);
  else if (s.merchLevel < 6) tryUpgrade(s, "merch", 6);
  else if (s.touringLevel < 3) tryUpgrade(s, "touring", 3);
  else if (s.studioLevel < 5) tryUpgrade(s, "studio", 5);
  else if (s.merchLevel < 8) tryUpgrade(s, "merch", 8);
  else if (s.marketingLevel < 6) tryUpgrade(s, "marketing", 6);
  else if (s.merchLevel < 10) tryUpgrade(s, "merch", 10);
  else if (s.touringLevel < 6) tryUpgrade(s, "touring", 6);

  // Sign artists
  if (s.turn % 10 === 0 && s.money > 25000) {
    const rosterCap = STUDIO_DATA[s.studioLevel].rosterCap;
    if (s.artists.filter(a => a.signed).length < Math.min(rosterCap, 3 + Math.floor(s.turn / 52))) {
      signArtist(s, rand(30, 45));
    }
  }
}

function earlyScoutAct(s: SimState): void {
  // Record every 3 turns
  if (s.turn % 3 === 0) {
    for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 70)) {
      const producerQ = 40 + s.studioLevel * 2;
      recordAndRelease(s, a, producerQ);
    }
  }

  // Regional tours
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 45)) {
    const since = s.turn - a.lastTourEndTurn;
    if (since > 8 && s.money > 25000) {
      a.onTour = true; a.tourType = "regional_tour"; a.tourWeeksLeft = 6;
      s.money -= 12000; s.expensesBySource.touring += 12000; s.totalExpenses += 12000;
      s.reputation = Math.min(100, s.reputation + Math.floor(5 * 0.5) + Math.floor(a.popularity / 80));
    } else if (since > 6 && s.money > 10000) {
      a.onTour = true; a.tourType = "club_tour"; a.tourWeeksLeft = 4;
      s.money -= 2000; s.expensesBySource.touring += 2000; s.totalExpenses += 2000;
      s.reputation = Math.min(100, s.reputation + Math.floor(3 * 0.5) + Math.floor(a.popularity / 80));
    }
  }

  // Upgrade: scouting rush, then studio, artistDev
  if (s.scoutingLevel < 3) tryUpgrade(s, "scouting", 3);
  else if (s.studioLevel < 3) tryUpgrade(s, "studio", 3);
  else if (s.scoutingLevel < 5) tryUpgrade(s, "scouting", 5);
  else if (s.artistDevLevel < 3) tryUpgrade(s, "artistDev", 3);
  else if (s.studioLevel < 5) tryUpgrade(s, "studio", 5);
  else if (s.marketingLevel < 4) tryUpgrade(s, "marketing", 4);
  else if (s.scoutingLevel < 7) tryUpgrade(s, "scouting", 7);
  else if (s.studioLevel < 7) tryUpgrade(s, "studio", 7);
  else if (s.artistDevLevel < 6) tryUpgrade(s, "artistDev", 6);

  // Sign better artists (higher scouting finds better talent)
  if (s.turn % 8 === 0 && s.money > 30000) {
    const rosterCap = STUDIO_DATA[s.studioLevel].rosterCap;
    if (s.artists.filter(a => a.signed).length < Math.min(rosterCap, 3 + Math.floor(s.turn / 40))) {
      const maxPoolOvr = 35 + s.scoutingLevel * 3;
      signArtist(s, rand(30, Math.min(55, maxPoolOvr)));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN SIMULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const strategies: Strategy[] = [
  { name: "Volume Grinder",  description: "Sign cheap, release lots of singles", act: volumeGrinderAct },
  { name: "Quality Focused", description: "Studio/producers first, fewer quality releases", act: qualityFocusedAct },
  { name: "Tour Heavy",      description: "Touring dept + revenue as primary income", act: tourHeavyAct },
  { name: "Balanced",        description: "Proportional upgrades, mixed approach", act: balancedAct },
  { name: "Merch Empire",    description: "Rush merch + fanbase for passive income", act: merchEmpireAct },
  { name: "Early Scout",     description: "Rush scouting + artist dev for talent edge", act: earlyScoutAct },
];

const TURNS_TO_SIM = 260; // 5 years
const TRIALS_PER_STRATEGY = 50;

console.log("═══════════════════════════════════════════════════════════════");
console.log("STRATEGY BALANCE SIMULATION");
console.log(`${TURNS_TO_SIM} turns (${(TURNS_TO_SIM / 52).toFixed(1)} years) × ${TRIALS_PER_STRATEGY} trials per strategy`);
console.log("═══════════════════════════════════════════════════════════════\n");

interface StratResult {
  name: string;
  survivalRate: number;
  avgMoney: number;
  medianMoney: number;
  avgRep: number;
  avgPeakMoney: number;
  avgPeakRep: number;
  avgSongsReleased: number;
  avgAwardWins: number;
  avgFanbase: number;
  avgStreamRev: number;
  avgTourRev: number;
  avgMerchRev: number;
  avgAwardRev: number;
  avgBrandDealRev: number;
  avgOverheadExp: number;
  avgSalaryExp: number;
  avgUpgradeExp: number;
  avgSigningExp: number;
  avgTourExp: number;
  avgProducerExp: number;
  avgTotalRev: number;
  avgTotalExp: number;
  avgRosterSize: number;
  avgGameOverTurn: number;
  gameOverReasons: Record<string, number>;
  moneyAtTurns: Record<number, number>;
  repAtTurns: Record<number, number>;
}

const results: StratResult[] = [];

for (const strat of strategies) {
  let survived = 0;
  const finalMoneys: number[] = [];
  const finalReps: number[] = [];
  const peakMoneys: number[] = [];
  const peakReps: number[] = [];
  const songsReleased: number[] = [];
  const awardWins: number[] = [];
  const fanbases: number[] = [];
  const streamRevs: number[] = [];
  const tourRevs: number[] = [];
  const merchRevs: number[] = [];
  const awardRevs: number[] = [];
  const brandDealRevs: number[] = [];
  const overheadExps: number[] = [];
  const salaryExps: number[] = [];
  const upgradeExps: number[] = [];
  const signingExps: number[] = [];
  const tourExps: number[] = [];
  const producerExps: number[] = [];
  const totalRevs: number[] = [];
  const totalExps: number[] = [];
  const rosterSizes: number[] = [];
  const gameOverTurns: number[] = [];
  const gameOverReasons: Record<string, number> = {};
  const moneyAtTurns: Record<number, number[]> = { 26: [], 52: [], 104: [], 156: [], 208: [], 260: [] };
  const repAtTurns: Record<number, number[]> = { 26: [], 52: [], 104: [], 156: [], 208: [], 260: [] };

  for (let trial = 0; trial < TRIALS_PER_STRATEGY; trial++) {
    const s = createInitialState();
    // Start with 2 random starter artists
    s.artists.push(createStarterArtist(rand(30, 42)));
    s.artists.push(createStarterArtist(rand(28, 38)));

    for (let t = 0; t < TURNS_TO_SIM; t++) {
      if (s.gameOver) break;
      strat.act(s);
      simulateWeek(s, strat);

      // Snapshots
      if (moneyAtTurns[s.turn - 1] !== undefined) {
        moneyAtTurns[s.turn - 1]?.push(s.money);
        repAtTurns[s.turn - 1]?.push(s.reputation);
      }
    }

    if (!s.gameOver) survived++;
    else {
      gameOverTurns.push(s.turn);
      const reason = s.gameOverReason.includes("Bankruptcy") ? "Bankruptcy" : "Rep collapse";
      gameOverReasons[reason] = (gameOverReasons[reason] || 0) + 1;
    }

    finalMoneys.push(s.money);
    finalReps.push(s.reputation);
    peakMoneys.push(s.peakMoney);
    peakReps.push(s.peakReputation);
    songsReleased.push(s.totalSongsReleased);
    awardWins.push(s.awardWins);
    fanbases.push(s.fanbase);
    streamRevs.push(s.revenueBySource.streaming);
    tourRevs.push(s.revenueBySource.touring);
    merchRevs.push(s.revenueBySource.merch);
    awardRevs.push(s.revenueBySource.awards);
    brandDealRevs.push(s.revenueBySource.brandDeals);
    overheadExps.push(s.expensesBySource.overhead);
    salaryExps.push(s.expensesBySource.salary);
    upgradeExps.push(s.expensesBySource.upgrades);
    signingExps.push(s.expensesBySource.signing);
    tourExps.push(s.expensesBySource.touring);
    producerExps.push(s.expensesBySource.producers);
    totalRevs.push(s.totalRevenue);
    totalExps.push(s.totalExpenses);
    rosterSizes.push(s.artists.filter(a => a.signed).length);
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  };
  const avgTurns = (rec: Record<number, number[]>) => {
    const result: Record<number, number> = {};
    for (const [k, v] of Object.entries(rec)) {
      result[Number(k)] = avg(v);
    }
    return result;
  };

  results.push({
    name: strat.name,
    survivalRate: (survived / TRIALS_PER_STRATEGY) * 100,
    avgMoney: avg(finalMoneys),
    medianMoney: median(finalMoneys),
    avgRep: avg(finalReps),
    avgPeakMoney: avg(peakMoneys),
    avgPeakRep: avg(peakReps),
    avgSongsReleased: avg(songsReleased),
    avgAwardWins: avg(awardWins),
    avgFanbase: avg(fanbases),
    avgStreamRev: avg(streamRevs),
    avgTourRev: avg(tourRevs),
    avgMerchRev: avg(merchRevs),
    avgAwardRev: avg(awardRevs),
    avgBrandDealRev: avg(brandDealRevs),
    avgOverheadExp: avg(overheadExps),
    avgSalaryExp: avg(salaryExps),
    avgUpgradeExp: avg(upgradeExps),
    avgSigningExp: avg(signingExps),
    avgTourExp: avg(tourExps),
    avgProducerExp: avg(producerExps),
    avgTotalRev: avg(totalRevs),
    avgTotalExp: avg(totalExps),
    avgRosterSize: avg(rosterSizes),
    avgGameOverTurn: avg(gameOverTurns),
    gameOverReasons,
    moneyAtTurns: avgTurns(moneyAtTurns),
    repAtTurns: avgTurns(repAtTurns),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT RESULTS
// ═══════════════════════════════════════════════════════════════════════════════

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.floor(n)}`;
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("OVERVIEW");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const header = "Strategy".padEnd(20) + "Survive%".padStart(10) + "Avg $".padStart(12) + "Median $".padStart(12) +
  "Avg Rep".padStart(10) + "Peak $".padStart(12) + "Peak Rep".padStart(10) + "Songs".padStart(8) + "Awards".padStart(8) + "Fanbase".padStart(12);
console.log(header);
console.log("─".repeat(header.length));

for (const r of results) {
  console.log(
    r.name.padEnd(20) +
    `${r.survivalRate.toFixed(0)}%`.padStart(10) +
    fmt(r.avgMoney).padStart(12) +
    fmt(r.medianMoney).padStart(12) +
    r.avgRep.toFixed(1).padStart(10) +
    fmt(r.avgPeakMoney).padStart(12) +
    r.avgPeakRep.toFixed(1).padStart(10) +
    r.avgSongsReleased.toFixed(0).padStart(8) +
    r.avgAwardWins.toFixed(1).padStart(8) +
    fmt(r.avgFanbase).padStart(12)
  );
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("REVENUE BREAKDOWN (avg per strategy over 5 years)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const revHeader = "Strategy".padEnd(20) + "Total Rev".padStart(12) + "Streaming".padStart(12) + "Touring".padStart(12) + "Merch".padStart(12) + "Brand Deals".padStart(12) + "Awards".padStart(12);
console.log(revHeader);
console.log("─".repeat(revHeader.length));
for (const r of results) {
  console.log(
    r.name.padEnd(20) +
    fmt(r.avgTotalRev).padStart(12) +
    fmt(r.avgStreamRev).padStart(12) +
    fmt(r.avgTourRev).padStart(12) +
    fmt(r.avgMerchRev).padStart(12) +
    fmt(r.avgBrandDealRev).padStart(12) +
    fmt(r.avgAwardRev).padStart(12)
  );
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("EXPENSE BREAKDOWN (avg per strategy over 5 years)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const expHeader = "Strategy".padEnd(20) + "Total Exp".padStart(12) + "Overhead".padStart(12) + "Salary".padStart(12) + "Upgrades".padStart(12) + "Signing".padStart(12) + "Tour Book".padStart(12) + "Producers".padStart(12);
console.log(expHeader);
console.log("─".repeat(expHeader.length));
for (const r of results) {
  console.log(
    r.name.padEnd(20) +
    fmt(r.avgTotalExp).padStart(12) +
    fmt(r.avgOverheadExp).padStart(12) +
    fmt(r.avgSalaryExp).padStart(12) +
    fmt(r.avgUpgradeExp).padStart(12) +
    fmt(r.avgSigningExp).padStart(12) +
    fmt(r.avgTourExp).padStart(12) +
    fmt(r.avgProducerExp).padStart(12)
  );
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("PROFIT MARGIN & NET");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const netHeader = "Strategy".padEnd(20) + "Total Rev".padStart(12) + "Total Exp".padStart(12) + "Net P/L".padStart(12) + "Margin".padStart(10) + "Roster".padStart(8);
console.log(netHeader);
console.log("─".repeat(netHeader.length));
for (const r of results) {
  const net = r.avgTotalRev - r.avgTotalExp;
  const margin = r.avgTotalRev > 0 ? (net / r.avgTotalRev * 100) : 0;
  console.log(
    r.name.padEnd(20) +
    fmt(r.avgTotalRev).padStart(12) +
    fmt(r.avgTotalExp).padStart(12) +
    fmt(net).padStart(12) +
    `${margin.toFixed(1)}%`.padStart(10) +
    r.avgRosterSize.toFixed(1).padStart(8)
  );
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("CASH TRAJECTORY (avg $ at key turns)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const trajHeader = "Strategy".padEnd(20) + "6 months".padStart(12) + "1 year".padStart(12) + "2 years".padStart(12) + "3 years".padStart(12) + "4 years".padStart(12) + "5 years".padStart(12);
console.log(trajHeader);
console.log("─".repeat(trajHeader.length));
for (const r of results) {
  console.log(
    r.name.padEnd(20) +
    fmt(r.moneyAtTurns[26] ?? 0).padStart(12) +
    fmt(r.moneyAtTurns[52] ?? 0).padStart(12) +
    fmt(r.moneyAtTurns[104] ?? 0).padStart(12) +
    fmt(r.moneyAtTurns[156] ?? 0).padStart(12) +
    fmt(r.moneyAtTurns[208] ?? 0).padStart(12) +
    fmt(r.moneyAtTurns[260] ?? 0).padStart(12)
  );
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("REPUTATION TRAJECTORY (avg rep at key turns)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const repTrajHeader = "Strategy".padEnd(20) + "6 months".padStart(10) + "1 year".padStart(10) + "2 years".padStart(10) + "3 years".padStart(10) + "4 years".padStart(10) + "5 years".padStart(10);
console.log(repTrajHeader);
console.log("─".repeat(repTrajHeader.length));
for (const r of results) {
  console.log(
    r.name.padEnd(20) +
    (r.repAtTurns[26] ?? 0).toFixed(1).padStart(10) +
    (r.repAtTurns[52] ?? 0).toFixed(1).padStart(10) +
    (r.repAtTurns[104] ?? 0).toFixed(1).padStart(10) +
    (r.repAtTurns[156] ?? 0).toFixed(1).padStart(10) +
    (r.repAtTurns[208] ?? 0).toFixed(1).padStart(10) +
    (r.repAtTurns[260] ?? 0).toFixed(1).padStart(10)
  );
}

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("FAILURE ANALYSIS");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

for (const r of results) {
  if (r.survivalRate < 100) {
    const reasons = Object.entries(r.gameOverReasons).map(([k, v]) => `${k}: ${v}`).join(", ");
    console.log(`  ${r.name}: ${(100 - r.survivalRate).toFixed(0)}% failure rate | Avg death at turn ${r.avgGameOverTurn.toFixed(0)} | ${reasons}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BALANCE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("BALANCE ANALYSIS & IDENTIFIED ISSUES");
console.log("═══════════════════════════════════════════════════════════════\n");

// Find dominant strategy
const sortedByMoney = [...results].sort((a, b) => b.avgMoney - a.avgMoney);
const sortedBySurvival = [...results].sort((a, b) => b.survivalRate - a.survivalRate);

// Check for dominant strategy
const bestMoney = sortedByMoney[0];
const worstMoney = sortedByMoney[sortedByMoney.length - 1];
if (bestMoney.avgMoney > worstMoney.avgMoney * 3) {
  console.log(`⚠ DOMINANT STRATEGY: "${bestMoney.name}" earns ${(bestMoney.avgMoney / Math.max(1, worstMoney.avgMoney)).toFixed(1)}x more money than "${worstMoney.name}"`);
}

// Check survival variance
const maxSurvival = Math.max(...results.map(r => r.survivalRate));
const minSurvival = Math.min(...results.map(r => r.survivalRate));
if (maxSurvival - minSurvival > 30) {
  const worst = results.find(r => r.survivalRate === minSurvival)!;
  console.log(`⚠ SURVIVAL IMBALANCE: "${worst.name}" has ${worst.survivalRate.toFixed(0)}% survival vs ${maxSurvival.toFixed(0)}% best`);
}

// Check revenue source balance
for (const r of results) {
  const total = r.avgStreamRev + r.avgTourRev + r.avgMerchRev + r.avgAwardRev + r.avgBrandDealRev;
  if (total > 0) {
    const streamPct = r.avgStreamRev / total * 100;
    const tourPct = r.avgTourRev / total * 100;
    const merchPct = r.avgMerchRev / total * 100;
    const brandPct = r.avgBrandDealRev / total * 100;
    if (streamPct > 80) console.log(`⚠ "${r.name}": Streaming is ${streamPct.toFixed(0)}% of revenue — other sources may be too weak`);
    if (tourPct > 80) console.log(`⚠ "${r.name}": Touring is ${tourPct.toFixed(0)}% of revenue — may be overtuned`);
    if (merchPct > 50) console.log(`⚠ "${r.name}": Merch is ${merchPct.toFixed(0)}% of revenue — may be too strong for passive income`);
    if (brandPct > 50) console.log(`⚠ "${r.name}": Brand deals are ${brandPct.toFixed(0)}% of revenue — may be overtuned`);
    if (merchPct < 1 && r.avgMerchRev === 0) console.log(`⚠ "${r.name}": Merch is only ${merchPct.toFixed(1)}% of revenue — may be undertuned`);
  }
}

// Check early game difficulty
for (const r of results) {
  if (r.moneyAtTurns[26] && r.moneyAtTurns[26] < 20000) {
    console.log(`⚠ EARLY GAME CRUNCH: "${r.name}" averages only ${fmt(r.moneyAtTurns[26])} at 6 months — may be too punishing`);
  }
}

// Check rep progression
for (const r of results) {
  if (r.repAtTurns[104] && r.repAtTurns[104] < 35) {
    console.log(`⚠ REP STAGNATION: "${r.name}" only reaches rep ${r.repAtTurns[104].toFixed(0)} after 2 years — progression may be too slow`);
  }
  if (r.repAtTurns[52] && r.repAtTurns[52] > 70) {
    console.log(`⚠ REP TOO FAST: "${r.name}" reaches rep ${r.repAtTurns[52].toFixed(0)} after 1 year — may be too easy`);
  }
}

// Check overhead vs revenue balance
for (const r of results) {
  if (r.avgOverheadExp > r.avgTotalRev * 0.6) {
    console.log(`⚠ OVERHEAD CRUSHING: "${r.name}" spends ${((r.avgOverheadExp / r.avgTotalRev) * 100).toFixed(0)}% of revenue on overhead alone`);
  }
}

// Check if any strategy has negative net
for (const r of results) {
  const net = r.avgTotalRev - r.avgTotalExp;
  if (net < 0) {
    console.log(`⚠ UNPROFITABLE: "${r.name}" loses money on average (net ${fmt(net)})`);
  }
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("SIMULATION COMPLETE");
console.log("═══════════════════════════════════════════════════════════════");
