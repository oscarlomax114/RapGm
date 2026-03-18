/**
 * Milestone & Pacing Simulation
 * Answers: How long to max out? When can you win awards? How/when do you fail?
 * Runs 200 trials of Balanced strategy over 20 years (1040 turns).
 */

import { STUDIO_DATA, SCOUTING_DATA, ARTIST_DEV_DATA, TOURING_DEPT_DATA, MARKETING_DATA, PR_DATA, MERCH_DATA } from "../src/lib/data";
import type { TourSize } from "../src/lib/types";

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
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
  recentReleaseTurns: number[];
  totalSongsReleased: number;
  totalRevenue: number;
  totalExpenses: number;
  peakMoney: number;
  peakReputation: number;
  gameOver: boolean;
  gameOverReason: string;
  awardWins: number;
  revenueBySource: { streaming: number; touring: number; merch: number; awards: number; brandDeals: number };
  totalCareerStreams: number;
  chartingSongs3Weeks: number; // songs that charted 3+ weeks (for credibility gate)
  // Milestone tracking
  firstAwardTurn: number;
  firstMillionTurn: number;
  first10MillionTurn: number;
  first100MillionTurn: number;
  firstBillionTurn: number;
  maxRepTurn: number;  // first turn hitting rep 95+
  allDeptMaxTurn: number;  // first turn all depts at level 10
  rosterFullTurn: number;  // first turn hitting roster cap 15
}

interface SimArtist {
  ovr: number;
  age: number;
  popularity: number;
  fanbase: number;
  momentum: number;
  fatigue: number;
  onTour: boolean;
  tourWeeksLeft: number;
  tourType: TourSize | null;
  lastTourEndTurn: number;
  signed: boolean;
}

const TOUR_DATA: Record<TourSize, { weeks: number; revPerWeek: number; fanPerWeek: number; fatiguePerWeek: number; repGain: number; bookingCost: number; cooldown: number }> = {
  club_tour:     { weeks: 4,  revPerWeek: 6000,   fanPerWeek: 800,   fatiguePerWeek: 3, repGain: 3,  bookingCost: 1500,   cooldown: 4 },
  regional_tour: { weeks: 6,  revPerWeek: 18000,  fanPerWeek: 2500,  fatiguePerWeek: 4, repGain: 5,  bookingCost: 8000,   cooldown: 6 },
  national_tour: { weeks: 10, revPerWeek: 40000,  fanPerWeek: 5000,  fatiguePerWeek: 5, repGain: 8,  bookingCost: 25000,  cooldown: 14 },
  major_tour:    { weeks: 16, revPerWeek: 80000,  fanPerWeek: 9000,  fatiguePerWeek: 4, repGain: 12, bookingCost: 60000,  cooldown: 20 },
  world_tour:    { weeks: 22, revPerWeek: 150000, fanPerWeek: 15000, fatiguePerWeek: 3, repGain: 16, bookingCost: 150000, cooldown: 22 },
};

function createState(): SimState {
  return {
    money: 75000, reputation: 30, fanbase: 10000, turn: 1,
    studioLevel: 0, scoutingLevel: 0, artistDevLevel: 0, touringLevel: 0,
    marketingLevel: 0, prLevel: 0, merchLevel: 0,
    artists: [
      { ovr: rand(30, 42), age: rand(19, 22), popularity: rand(5, 15), fanbase: rand(500, 3000), momentum: rand(10, 25), fatigue: 0, onTour: false, tourWeeksLeft: 0, tourType: null, lastTourEndTurn: 0, signed: true },
      { ovr: rand(28, 38), age: rand(19, 22), popularity: rand(5, 15), fanbase: rand(500, 3000), momentum: rand(10, 25), fatigue: 0, onTour: false, tourWeeksLeft: 0, tourType: null, lastTourEndTurn: 0, signed: true },
    ],
    songsOnChart: 0, recentReleaseTurns: [], totalSongsReleased: 0,
    totalRevenue: 0, totalExpenses: 0, peakMoney: 75000, peakReputation: 30,
    gameOver: false, gameOverReason: "",
    awardWins: 0,
    revenueBySource: { streaming: 0, touring: 0, merch: 0, awards: 0, brandDeals: 0 },
    totalCareerStreams: 0, chartingSongs3Weeks: 0,
    firstAwardTurn: 0, firstMillionTurn: 0, first10MillionTurn: 0,
    first100MillionTurn: 0, firstBillionTurn: 0,
    maxRepTurn: 0, allDeptMaxTurn: 0, rosterFullTurn: 0,
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
    return sum + Math.floor(500 * (0.5 + (a.ovr / 100) * 1.5));
  }, 0);
}

function getLabelRecognition(rep: number): number {
  return clamp(0.2 + (rep / 100) * 0.8, 0.2, 1.0);
}

function calcSongQuality(artistOvr: number, studioLevel: number, producerQ: number): number {
  const studio = STUDIO_DATA[studioLevel];
  const base = artistOvr * 0.42 + producerQ * 0.48 + studio.qualityBonusFlat;
  return clamp(rand(Math.round(base) - 10, Math.round(base) + 10), 1, 100);
}

function calcStreamRev(quality: number, viralPot: number, fanbase: number, rep: number, marketingLevel: number, chartCount: number): number {
  const qualFloor = quality >= 60 ? 1.0 : quality >= 45 ? 0.6 : quality >= 30 ? 0.3 : 0.1;
  const streams = Math.floor((viralPot * 3000 + fanbase * 0.35 + quality * 800) * qualFloor * (0.9 + Math.random() * 0.35));
  const posMult = 0.6 + 1.4 * Math.pow((20 - 10) / 19, 1.5);
  const qualMult = quality >= 60 ? Math.min(1.8, 1.0 + (quality - 60) * 0.02) : 0.4 + (quality / 60) * 0.6;
  const labelRec = getLabelRecognition(rep);
  const revMult = 1 + MARKETING_DATA[marketingLevel].revenuePct / 100;
  const satMult = chartCount <= 3 ? 1.0 : chartCount <= 6 ? 0.8 : chartCount <= 10 ? 0.6 : 0.4;
  return Math.floor(streams * 0.004 * revMult * posMult * qualMult * labelRec * satMult);
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
  const currentOverhead = getDeptOverhead(s) + getRosterSalary(s);
  const newWeeklyOverhead = (next as any).weeklyOperatingCost - (getData(current) as any).weeklyOperatingCost;
  const buffer = (currentOverhead + newWeeklyOverhead) * 12 + 15000;
  if (s.money - cost > buffer) {
    s.money -= cost;
    s.totalExpenses += cost;
    setLevel(current + 1);
    return true;
  }
  return false;
}

function signArtist(s: SimState, ovr: number): boolean {
  const fee = Math.floor(Math.pow(ovr / 45, 2.8) * 12000 * 0.65);
  if (s.money < fee + 20000) return false;
  const rosterCap = STUDIO_DATA[s.studioLevel].rosterCap;
  if (s.artists.filter(a => a.signed).length >= rosterCap) return false;
  s.money -= fee;
  s.totalExpenses += fee;
  const scoutBonus = Math.floor(SCOUTING_DATA[s.scoutingLevel].scoutedPct * 0.15);
  s.artists.push({
    ovr, age: rand(18, 24), popularity: rand(3, 15), fanbase: rand(200, 5000),
    momentum: clamp(rand(8, 20) + scoutBonus, 0, 100),
    fatigue: 0, onTour: false, tourWeeksLeft: 0, tourType: null,
    lastTourEndTurn: 0, signed: true,
  });
  return true;
}

function recordAndRelease(s: SimState, a: SimArtist, producerQ: number): void {
  const quality = calcSongQuality(a.ovr, s.studioLevel, producerQ);
  const cost = Math.floor(producerQ * 15 + 200);
  if (s.money < cost + 8000) return;
  s.money -= cost;
  s.totalExpenses += cost;
  s.totalSongsReleased++;
  a.fatigue = Math.min(100, a.fatigue + 6);
  a.popularity = Math.min(100, a.popularity + rand(0, 2));
  a.fanbase += rand(100, 600);
  s.fanbase += rand(50, 300);
  const qualPenalty = quality >= 50 ? 1.0 : quality >= 35 ? 0.7 : 0.4;
  const recentReleases = s.recentReleaseTurns.filter(t => s.turn - t <= 4).length;
  const releaseSatPenalty = recentReleases <= 1 ? 1.0 : recentReleases <= 3 ? 0.85 : recentReleases <= 5 ? 0.7 : 0.55;
  const viralPot = clamp(quality + rand(-10, 15), 20, 100);
  const chartChance = (quality / 100 * 0.45 + viralPot / 100 * 0.25) * qualPenalty * releaseSatPenalty;
  s.recentReleaseTurns.push(s.turn);
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

// Balanced strategy — upgrades everything proportionally, mixes releasing/touring/merch
function balancedAct(s: SimState): void {
  if (s.turn % 3 === 0) {
    for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 75)) {
      const producerQ = 40 + s.studioLevel * 2;
      recordAndRelease(s, a, producerQ);
    }
  }
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 45)) {
    const since = s.turn - a.lastTourEndTurn;
    if (s.studioLevel >= 7 && a.popularity > 40 && since > 22 && s.money > 200000) {
      a.onTour = true; a.tourType = "world_tour"; a.tourWeeksLeft = 22;
      s.money -= 150000; s.totalExpenses += 150000;
      s.reputation = Math.min(100, s.reputation + Math.floor(16 * 0.5) + Math.floor(a.popularity / 80));
    } else if (s.studioLevel >= 7 && a.popularity > 25 && since > 20 && s.money > 100000) {
      a.onTour = true; a.tourType = "major_tour"; a.tourWeeksLeft = 16;
      s.money -= 60000; s.totalExpenses += 60000;
      s.reputation = Math.min(100, s.reputation + Math.floor(12 * 0.5) + Math.floor(a.popularity / 80));
    } else if (a.popularity > 20 && since > 14 && s.money > 50000) {
      a.onTour = true; a.tourType = "national_tour"; a.tourWeeksLeft = 10;
      s.money -= 25000; s.totalExpenses += 25000;
      s.reputation = Math.min(100, s.reputation + Math.floor(8 * 0.5) + Math.floor(a.popularity / 80));
    } else if (a.popularity > 10 && since > 6 && s.money > 20000) {
      a.onTour = true; a.tourType = "regional_tour"; a.tourWeeksLeft = 6;
      s.money -= 8000; s.totalExpenses += 8000;
      s.reputation = Math.min(100, s.reputation + Math.floor(5 * 0.5) + Math.floor(a.popularity / 80));
    } else if (since > 4 && s.money > 8000) {
      a.onTour = true; a.tourType = "club_tour"; a.tourWeeksLeft = 4;
      s.money -= 1500; s.totalExpenses += 1500;
      s.reputation = Math.min(100, s.reputation + Math.floor(3 * 0.5) + Math.floor(a.popularity / 80));
    }
  }
  // Balanced upgrade path — all departments
  const targets = [
    { dept: "studio", max: 2 }, { dept: "marketing", max: 2 }, { dept: "touring", max: 2 },
    { dept: "merch", max: 2 }, { dept: "studio", max: 4 }, { dept: "marketing", max: 4 },
    { dept: "touring", max: 4 }, { dept: "artistDev", max: 3 }, { dept: "merch", max: 4 },
    { dept: "pr", max: 3 }, { dept: "scouting", max: 3 },
    { dept: "studio", max: 7 }, { dept: "marketing", max: 6 }, { dept: "touring", max: 6 },
    { dept: "artistDev", max: 5 }, { dept: "merch", max: 6 }, { dept: "pr", max: 5 },
    { dept: "scouting", max: 5 },
    { dept: "studio", max: 10 }, { dept: "marketing", max: 8 }, { dept: "touring", max: 8 },
    { dept: "artistDev", max: 7 }, { dept: "merch", max: 8 }, { dept: "pr", max: 7 },
    { dept: "scouting", max: 7 },
    { dept: "marketing", max: 10 }, { dept: "touring", max: 10 },
    { dept: "artistDev", max: 10 }, { dept: "merch", max: 10 }, { dept: "pr", max: 10 },
    { dept: "scouting", max: 10 },
  ];
  for (const t of targets) {
    if (tryUpgrade(s, t.dept, t.max)) break;
  }
  if (s.turn % 10 === 0 && s.money > 30000) {
    const rosterCap = STUDIO_DATA[s.studioLevel].rosterCap;
    if (s.artists.filter(a => a.signed).length < Math.min(rosterCap, 3 + Math.floor(s.turn / 40))) {
      signArtist(s, rand(35, 50));
    }
  }
}

function simulateWeek(s: SimState): void {
  if (s.gameOver) return;

  // Market heat: random weekly conditions (0.75x to 1.25x)
  const marketHeat = 0.75 + Math.random() * 0.50;

  // Streaming
  let streamRev = 0;
  for (let i = 0; i < s.songsOnChart; i++) {
    const avgQ = 45 + s.studioLevel * 3;
    const avgV = avgQ + rand(-5, 10);
    const avgFan = s.fanbase / Math.max(1, s.artists.filter(a => a.signed).length);
    streamRev += calcStreamRev(avgQ, avgV, avgFan, s.reputation, s.marketingLevel, s.songsOnChart);
  }
  // Apply market heat to streams
  streamRev = Math.floor(streamRev * marketHeat);
  // Legacy multiplier: career streams build clout (1.0x to 2.0x)
  const legacyMult = 1 + Math.min(1.0, Math.log10(Math.max(1, s.totalCareerStreams / 1000000)) * 0.15);
  streamRev = Math.floor(streamRev * legacyMult);
  // Stream cap
  if (streamRev > 20000) {
    if (streamRev <= 40000) streamRev = 20000 + Math.floor((streamRev - 20000) * 0.6);
    else streamRev = 20000 + Math.floor(20000 * 0.6) + Math.floor((streamRev - 40000) * 0.25);
  }
  s.revenueBySource.streaming += streamRev;
  // Track career streams (approximate)
  s.totalCareerStreams += s.songsOnChart * rand(50000, 200000);

  // Touring
  let tourRev = 0;
  let tourRepDelta = 0;
  for (const a of s.artists) {
    if (a.onTour && a.tourType) {
      const t = TOUR_DATA[a.tourType];
      const td = TOURING_DEPT_DATA[s.touringLevel];
      const popMult = 0.5 + a.popularity / 100;
      const fanMult = 1 + Math.log10(Math.max(1, a.fanbase / 10000)) * 0.3;
      tourRev += Math.floor(t.revPerWeek * popMult * fanMult * (1 + td.revenueBonusPct / 100) * marketHeat);
      const weekFans = Math.floor(t.fanPerWeek * popMult * (1 + td.fanBonusPct / 100));
      a.fanbase += weekFans;
      s.fanbase += weekFans; // tours also grow label fanbase
      a.fatigue = clamp(a.fatigue + Math.max(1, Math.round(t.fatiguePerWeek * (1 - td.fatigueMitigation))), 0, 100);
      // Reduced tour rep tick chances (was 0.4/0.3/0.2, now 0.20/0.15/0.10)
      const tourRepChance = t.repGain >= 8 ? 0.20 : t.repGain >= 5 ? 0.15 : 0.10;
      if (Math.random() < tourRepChance) tourRepDelta += 1;
      a.popularity = clamp(a.popularity + (Math.random() < 0.3 ? 1 : 0), 0, 100);
      a.tourWeeksLeft--;
      if (a.tourWeeksLeft <= 0) { a.onTour = false; a.tourType = null; a.lastTourEndTurn = s.turn; }
    }
  }
  s.revenueBySource.touring += tourRev;

  // Merch (with fanbase tier multiplier and variance)
  const merchPerFan = MERCH_DATA[s.merchLevel].revenuePerFan;
  const merchRev = merchPerFan > 0
    ? Math.floor(s.artists.filter(a => a.signed).reduce((sum, a) => {
        const popMult = 0.5 + a.popularity / 100;
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

  const totalRev = streamRev + tourRev + merchRev + brandDealRev;
  s.totalRevenue += totalRev;
  const overhead = getDeptOverhead(s);
  const salary = getRosterSalary(s);
  const baseRent = 500; // base office rent
  s.totalExpenses += overhead + salary + baseRent;
  s.money += totalRev - overhead - salary - baseRent;

  // Chart decay
  if (s.songsOnChart > 0 && Math.random() < 0.12) s.songsOnChart = Math.max(0, s.songsOnChart - 1);

  // Apply tour rep delta with credibility gate
  if (s.reputation >= 60 && s.chartingSongs3Weeks < 3) {
    tourRepDelta = Math.floor(tourRepDelta * 0.5);
  }
  // Diminishing rep gains above 50
  if (tourRepDelta > 0 && s.reputation >= 50) {
    const dampening = Math.min(0.7, (s.reputation - 50) * 0.014);
    tourRepDelta = Math.max(0, Math.round(tourRepDelta * (1 - dampening)));
  }
  s.reputation = Math.min(100, s.reputation + tourRepDelta);

  // Rep decay
  if (s.turn > 20 && s.totalSongsReleased < s.turn / 12) {
    if (Math.random() < 0.5) s.reputation = Math.max(0, s.reputation - 0.5);
  }
  // Elite rep decay (threshold lowered from 85 to 75, stronger decay)
  if (s.reputation > 75) {
    const hasRecentQuality = s.totalSongsReleased > 0 && s.turn > 0 && (s.turn % 8 !== 0 || s.totalSongsReleased > (s.turn - 8) / 3);
    const hasActiveTouring = s.artists.some(a => a.signed && a.onTour);
    const chance = (s.reputation - 75) * 0.04;
    if (hasRecentQuality) { /* no decay */ }
    else if (hasActiveTouring) { if (Math.random() < chance * 0.5) s.reputation = Math.max(0, s.reputation - 1); }
    else { if (Math.random() < chance) s.reputation = Math.max(0, s.reputation - 1); }
    // Above 90: unconditional 12% pressure
    if (s.reputation > 90 && Math.random() < 0.12) s.reputation = Math.max(0, s.reputation - 1);
  }

  // Scandals
  const prData = PR_DATA[s.prLevel];
  const earlyShield = s.turn <= 20 ? 0.4 : s.turn <= 40 ? 0.7 : 1.0;
  for (const a of s.artists.filter(a => a.signed)) {
    if (Math.random() * 100 < 40 * 0.1 * (1 - prData.scandalFreqReduction) * earlyShield) {
      const dmg = Math.max(1, Math.round(rand(3, 8) * earlyShield * (1 - prData.scandalDamageReduction)));
      s.reputation = Math.max(0, s.reputation - dmg);
      s.money -= dmg * 300;
    }
  }

  // Awards (turn 48, then every 52) — rivals much stronger now
  if (s.turn >= 48 && (s.turn - 48) % 52 === 0) {
    const year = Math.floor((s.turn - 48) / 52) + 1;
    const yearBonus = Math.min(35, year * 4);
    const buzzSwing = () => (Math.random() - 0.4) * 20;
    // Simulate 5 categories, player can win 0-5
    let wins = 0;
    for (let cat = 0; cat < 5; cat++) {
      const playerScore = s.reputation * 0.7 + Math.min(30, s.fanbase / 50000) + s.songsOnChart * 4 + rand(0, 15) + buzzSwing();
      // Rival scores based on prestige range 48-82 + year scaling + buzz
      const rivalScore = rand(70, 110) + yearBonus + buzzSwing();
      if (playerScore > rivalScore) wins++;
    }
    if (wins > 0) {
      s.awardWins += wins;
      const reward = wins * (50000 + year * 25000);
      s.money += reward;
      s.reputation = Math.min(100, s.reputation + wins * 3);
      s.revenueBySource.awards += reward;
      if (s.firstAwardTurn === 0) s.firstAwardTurn = s.turn;
    }
  }

  // Aging (yearly)
  if (s.turn % 52 === 0) {
    for (const a of s.artists) {
      a.age++;
      if (a.age <= 27) a.ovr = Math.min(99, a.ovr + rand(0, 3));
      else if (a.age <= 32) a.ovr = clamp(a.ovr + rand(-2, 1), 25, 99);
      else a.ovr = Math.max(25, a.ovr - rand(1, 4));
    }
  }

  // Fatigue recovery
  for (const a of s.artists.filter(a => a.signed && !a.onTour)) a.fatigue = Math.max(0, a.fatigue - 7);

  // Track milestones
  s.peakMoney = Math.max(s.peakMoney, s.money);
  s.peakReputation = Math.max(s.peakReputation, s.reputation);
  if (s.firstMillionTurn === 0 && s.money >= 1_000_000) s.firstMillionTurn = s.turn;
  if (s.first10MillionTurn === 0 && s.money >= 10_000_000) s.first10MillionTurn = s.turn;
  if (s.first100MillionTurn === 0 && s.money >= 100_000_000) s.first100MillionTurn = s.turn;
  if (s.firstBillionTurn === 0 && s.money >= 1_000_000_000) s.firstBillionTurn = s.turn;
  if (s.maxRepTurn === 0 && s.reputation >= 95) s.maxRepTurn = s.turn;
  if (s.allDeptMaxTurn === 0 && s.studioLevel >= 10 && s.scoutingLevel >= 10 && s.artistDevLevel >= 10 &&
      s.touringLevel >= 10 && s.marketingLevel >= 10 && s.prLevel >= 10 && s.merchLevel >= 10) {
    s.allDeptMaxTurn = s.turn;
  }
  if (s.rosterFullTurn === 0 && s.artists.filter(a => a.signed).length >= 15) s.rosterFullTurn = s.turn;

  // Game over
  const weeklyOverhead = overhead + salary + baseRent;
  const bankruptcyThreshold = -Math.max(15000, Math.min(200000, weeklyOverhead * 4));
  if (s.money < bankruptcyThreshold) { s.gameOver = true; s.gameOverReason = `Bankruptcy`; }
  if (s.turn > 26 && s.reputation < 10) { s.gameOver = true; s.gameOverReason = `Rep collapse`; }

  s.turn++;
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════════

const TURNS = 1040; // 20 years
const TRIALS = 200;

interface TrialResult {
  survived: boolean;
  gameOverTurn: number;
  gameOverReason: string;
  finalMoney: number;
  finalRep: number;
  totalRev: number;
  awardWins: number;
  firstAwardTurn: number;
  firstMillionTurn: number;
  first10MillionTurn: number;
  first100MillionTurn: number;
  firstBillionTurn: number;
  maxRepTurn: number;
  allDeptMaxTurn: number;
  rosterFullTurn: number;
  moneyAtYears: number[];
  repAtYears: number[];
}

const results: TrialResult[] = [];

for (let trial = 0; trial < TRIALS; trial++) {
  const s = createState();
  const moneyAtYears: number[] = [];
  const repAtYears: number[] = [];

  for (let t = 0; t < TURNS; t++) {
    if (s.gameOver) break;
    balancedAct(s);
    simulateWeek(s);
    // Yearly snapshots
    if ((s.turn - 1) % 52 === 0) {
      moneyAtYears.push(s.money);
      repAtYears.push(s.reputation);
    }
  }

  // Pad arrays if game ended early
  while (moneyAtYears.length < 20) moneyAtYears.push(s.money);
  while (repAtYears.length < 20) repAtYears.push(s.reputation);

  results.push({
    survived: !s.gameOver,
    gameOverTurn: s.gameOver ? s.turn : 0,
    gameOverReason: s.gameOverReason,
    finalMoney: s.money,
    finalRep: s.reputation,
    totalRev: s.totalRevenue,
    awardWins: s.awardWins,
    firstAwardTurn: s.firstAwardTurn,
    firstMillionTurn: s.firstMillionTurn,
    first10MillionTurn: s.first10MillionTurn,
    first100MillionTurn: s.first100MillionTurn,
    firstBillionTurn: s.firstBillionTurn,
    maxRepTurn: s.maxRepTurn,
    allDeptMaxTurn: s.allDeptMaxTurn,
    rosterFullTurn: s.rosterFullTurn,
    moneyAtYears,
    repAtYears,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════════════════════════════

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.floor(n)}`;
}

function turnToTime(turn: number): string {
  const years = Math.floor(turn / 52);
  const weeks = turn % 52;
  if (years === 0) return `${weeks} weeks`;
  if (weeks === 0) return `${years}y`;
  return `${years}y ${weeks}w`;
}

const survived = results.filter(r => r.survived);
const failed = results.filter(r => !r.survived);

console.log("═══════════════════════════════════════════════════════════════");
console.log(`MILESTONE & PACING ANALYSIS (Balanced Strategy)`);
console.log(`${TURNS} turns (${TURNS/52} years) × ${TRIALS} trials`);
console.log("═══════════════════════════════════════════════════════════════\n");

console.log(`Survival rate: ${(survived.length / TRIALS * 100).toFixed(0)}% (${survived.length}/${TRIALS})\n`);

// ── Failure analysis ──
if (failed.length > 0) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("HOW & WHEN DO YOU FAIL?");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const reasons: Record<string, number[]> = {};
  for (const r of failed) {
    if (!reasons[r.gameOverReason]) reasons[r.gameOverReason] = [];
    reasons[r.gameOverReason].push(r.gameOverTurn);
  }
  for (const [reason, turns] of Object.entries(reasons)) {
    const avg = turns.reduce((s, v) => s + v, 0) / turns.length;
    const min = Math.min(...turns);
    const max = Math.max(...turns);
    const sorted = [...turns].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    console.log(`  ${reason}: ${turns.length} deaths (${(turns.length / TRIALS * 100).toFixed(0)}%)`);
    console.log(`    Average death: ${turnToTime(Math.round(avg))}`);
    console.log(`    Earliest: ${turnToTime(min)} | Latest: ${turnToTime(max)} | Median: ${turnToTime(median)}`);
  }
  console.log();
}

// ── Milestone timing (survivors only) ──
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("MILESTONE TIMING (survivors only)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

function milestoneStats(name: string, values: number[]) {
  const achieved = values.filter(v => v > 0);
  if (achieved.length === 0) {
    console.log(`  ${name}: NEVER achieved in ${TURNS/52} years (0/${values.length})`);
    return;
  }
  const sorted = [...achieved].sort((a, b) => a - b);
  const avg = achieved.reduce((s, v) => s + v, 0) / achieved.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const pct10 = sorted[Math.floor(sorted.length * 0.1)];
  const pct90 = sorted[Math.floor(sorted.length * 0.9)];
  const pct = (achieved.length / values.length * 100).toFixed(0);
  console.log(`  ${name}: ${pct}% achieve it`);
  console.log(`    Median: ${turnToTime(median)} | Avg: ${turnToTime(Math.round(avg))}`);
  console.log(`    Fastest 10%: ${turnToTime(pct10)} | Slowest 10%: ${turnToTime(pct90)}`);
}

milestoneStats("First Award Win (Grammy equivalent)", survived.map(r => r.firstAwardTurn));
console.log();
milestoneStats("Rep 95+ (Elite Status)", survived.map(r => r.maxRepTurn));
console.log();
milestoneStats("$1M Cash", survived.map(r => r.firstMillionTurn));
console.log();
milestoneStats("$10M Cash", survived.map(r => r.first10MillionTurn));
console.log();
milestoneStats("$100M Cash", survived.map(r => r.first100MillionTurn));
console.log();
milestoneStats("$1B Cash (Jay-Z Status)", survived.map(r => r.firstBillionTurn));
console.log();
milestoneStats("Full Roster (15 artists)", survived.map(r => r.rosterFullTurn));
console.log();
milestoneStats("All Departments Maxed (Level 10)", survived.map(r => r.allDeptMaxTurn));
console.log();

// ── Money & rep trajectory over 20 years ──
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("CASH & REP TRAJECTORY (avg of survivors)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const years = [1, 2, 3, 4, 5, 7, 10, 15, 20];
console.log("  Year".padEnd(10) + "Avg Cash".padStart(14) + "Median Cash".padStart(14) + "Avg Rep".padStart(10) + "Awards".padStart(10));
console.log("  " + "─".repeat(56));

for (const y of years) {
  if (y > 20) break;
  const idx = y - 1;
  const moneys = survived.map(r => r.moneyAtYears[idx]).filter(v => v !== undefined);
  const reps = survived.map(r => r.repAtYears[idx]).filter(v => v !== undefined);
  if (moneys.length === 0) continue;
  const avgM = moneys.reduce((s, v) => s + v, 0) / moneys.length;
  const sortedM = [...moneys].sort((a, b) => a - b);
  const medM = sortedM[Math.floor(sortedM.length / 2)];
  const avgR = reps.reduce((s, v) => s + v, 0) / reps.length;
  const avgAwards = survived.filter(r => r.firstAwardTurn > 0 && r.firstAwardTurn <= y * 52).length;
  console.log(
    `  Year ${y}`.padEnd(10) +
    fmt(avgM).padStart(14) +
    fmt(medM).padStart(14) +
    avgR.toFixed(1).padStart(10) +
    `${(avgAwards / survived.length * 100).toFixed(0)}%`.padStart(10)
  );
}

// ── Total awards distribution ──
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("AWARD WINS DISTRIBUTION (over 20 years, survivors)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const awardCounts: Record<number, number> = {};
for (const r of survived) {
  awardCounts[r.awardWins] = (awardCounts[r.awardWins] || 0) + 1;
}
const sortedCounts = Object.entries(awardCounts).sort((a, b) => Number(a[0]) - Number(b[0]));
for (const [count, freq] of sortedCounts) {
  const pct = (freq / survived.length * 100).toFixed(0);
  const bar = "█".repeat(Math.ceil(freq / survived.length * 50));
  console.log(`  ${count.padStart(3)} wins: ${pct.padStart(3)}% ${bar} (${freq})`);
}
const avgAwards = survived.reduce((s, r) => s + r.awardWins, 0) / survived.length;
console.log(`\n  Average: ${avgAwards.toFixed(1)} wins | Max: ${Math.max(...survived.map(r => r.awardWins))}`);

// ── Final state at 20 years ──
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("FINAL STATE AT 20 YEARS (survivors)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const finalMoneys = survived.map(r => r.finalMoney).sort((a, b) => a - b);
const finalRevs = survived.map(r => r.totalRev).sort((a, b) => a - b);
console.log(`  Cash:  Median ${fmt(finalMoneys[Math.floor(finalMoneys.length / 2)])} | Avg ${fmt(finalMoneys.reduce((s, v) => s + v, 0) / finalMoneys.length)}`);
console.log(`         Min ${fmt(finalMoneys[0])} | Max ${fmt(finalMoneys[finalMoneys.length - 1])}`);
console.log(`  Total Rev: Median ${fmt(finalRevs[Math.floor(finalRevs.length / 2)])} | Max ${fmt(finalRevs[finalRevs.length - 1])}`);
console.log(`  Rep:   Avg ${(survived.reduce((s, r) => s + r.finalRep, 0) / survived.length).toFixed(1)}`);

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("SIMULATION COMPLETE");
console.log("═══════════════════════════════════════════════════════════════");
