/**
 * Awards System Balance Simulation
 * Tests 5 player strategies over 10 years (520 turns), 200 trials each.
 * Reports per-category win rates, score gaps, and identifies imbalances.
 *
 * Strategies:
 * 1. VOLUME GRINDER — Many cheap releases, low quality
 * 2. QUALITY FOCUSED — Few releases, high studio/producer investment
 * 3. TOUR HEAVY — Touring-first, builds popularity/fanbase fast
 * 4. BALANCED — Mix of everything
 * 5. STAR BUILDER — Rush scouting, sign elite artists, develop them
 */

import { STUDIO_DATA, SCOUTING_DATA, ARTIST_DEV_DATA, TOURING_DEPT_DATA, MARKETING_DATA, PR_DATA, MERCH_DATA, RIVAL_LABEL_TEMPLATES } from "../src/lib/data";
import type { TourSize } from "../src/lib/types";

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIMULATION MODEL
// ═══════════════════════════════════════════════════════════════════════════════

interface SimArtist {
  name?: string;
  ovr: number;
  age: number;
  potential: number;
  popularity: number;
  fanbase: number;
  momentum: number;
  buzz: number;
  fatigue: number;
  onTour: boolean;
  tourWeeksLeft: number;
  tourType: TourSize | null;
  lastTourEndTurn: number;
  signed: boolean;
}

interface SimSong {
  quality: number;
  viralPotential: number;
  streamsTotal: number;
  turnReleased: number;
  artistName: string;
  isPlayer: boolean;
  labelName: string;
  labelId: string;
  weeksOnChart: number;
}

interface SimAlbum {
  qualityScore: number;
  totalStreams: number;
  turnReleased: number;
  artistName: string;
  isPlayer: boolean;
}

interface SimRivalLabel {
  id: string;
  name: string;
  prestige: number;
  activityLevel: number;
  releaseStrategy: "aggressive" | "balanced" | "selective";
  chartHits: number;
  totalStreams: number;
  rosterArtists: SimArtist[];
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
  songs: SimSong[];         // all released songs (player + industry)
  albums: SimAlbum[];       // player albums
  rivalLabels: SimRivalLabel[];
  songsOnChart: number;
  totalSongsReleased: number;
  gameOver: boolean;
  labelName: string;
  // Award tracking
  awardResults: AwardResult[];
}

interface AwardResult {
  year: number;
  turn: number;
  categories: CategoryResult[];
}

interface CategoryResult {
  category: string;
  playerScore: number;
  bestRivalScore: number;
  playerWon: boolean;
  playerNominees: number;
  rivalNominees: number;
  gap: number; // positive = player ahead
}

const TOUR_DATA: Record<TourSize, { weeks: number; revPerWeek: number; fanPerWeek: number; fatiguePerWeek: number; repGain: number; bookingCost: number; cooldown: number }> = {
  club_tour:     { weeks: 4,  revPerWeek: 6000,   fanPerWeek: 800,   fatiguePerWeek: 3, repGain: 3,  bookingCost: 1500,   cooldown: 4 },
  regional_tour: { weeks: 6,  revPerWeek: 18000,  fanPerWeek: 2500,  fatiguePerWeek: 4, repGain: 5,  bookingCost: 8000,   cooldown: 6 },
  national_tour: { weeks: 10, revPerWeek: 40000,  fanPerWeek: 5000,  fatiguePerWeek: 5, repGain: 8,  bookingCost: 25000,  cooldown: 14 },
  major_tour:    { weeks: 16, revPerWeek: 80000,  fanPerWeek: 9000,  fatiguePerWeek: 4, repGain: 12, bookingCost: 60000,  cooldown: 20 },
  world_tour:    { weeks: 22, revPerWeek: 150000, fanPerWeek: 15000, fatiguePerWeek: 3, repGain: 16, bookingCost: 150000, cooldown: 22 },
};

function createRivalLabels(): SimRivalLabel[] {
  return RIVAL_LABEL_TEMPLATES.slice(0, 8).map((t, i) => ({
    id: `rival_${i}`,
    name: t.name,
    prestige: t.prestige,
    activityLevel: t.activityLevel,
    releaseStrategy: (t as any).releaseStrategy ?? "balanced",
    chartHits: 0,
    totalStreams: 0,
    rosterArtists: Array.from({ length: rand(2, 4) }, () => ({
      ovr: rand(Math.floor(t.prestige * 0.4 + 15), Math.floor(t.prestige * 0.7 + 25)),
      age: rand(19, 30),
      potential: rand(50, 85),
      popularity: rand(Math.floor(t.prestige * 0.2), Math.floor(t.prestige * 0.6)),
      fanbase: rand(5000, 50000 + t.prestige * 500),
      momentum: rand(15, 40 + Math.floor(t.prestige * 0.3)),
      buzz: rand(10, 30 + Math.floor(t.prestige * 0.3)),
      fatigue: 0, onTour: false, tourWeeksLeft: 0, tourType: null,
      lastTourEndTurn: 0, signed: true,
    })),
  }));
}

function createState(labelName: string): SimState {
  return {
    money: 75000, reputation: 30, fanbase: 10000, turn: 1,
    studioLevel: 0, scoutingLevel: 0, artistDevLevel: 0, touringLevel: 0,
    marketingLevel: 0, prLevel: 0, merchLevel: 0,
    artists: [
      { ovr: rand(30, 42), age: rand(19, 22), potential: rand(55, 75), popularity: rand(5, 15), fanbase: rand(500, 3000), momentum: rand(10, 25), buzz: rand(5, 15), fatigue: 0, onTour: false, tourWeeksLeft: 0, tourType: null, lastTourEndTurn: 0, signed: true },
      { ovr: rand(28, 38), age: rand(19, 22), potential: rand(55, 75), popularity: rand(5, 15), fanbase: rand(500, 3000), momentum: rand(10, 25), buzz: rand(5, 15), fatigue: 0, onTour: false, tourWeeksLeft: 0, tourType: null, lastTourEndTurn: 0, signed: true },
    ],
    songs: [],
    albums: [],
    rivalLabels: createRivalLabels(),
    songsOnChart: 0,
    totalSongsReleased: 0,
    gameOver: false,
    labelName: labelName,
    awardResults: [],
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
  return s.artists.filter(a => a.signed).reduce((sum, a) =>
    sum + Math.floor(500 * (0.5 + (a.ovr / 100) * 1.5)), 0);
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
  const buffer = (getDeptOverhead(s) + getRosterSalary(s)) * 12 + 15000;
  if (s.money - cost > buffer) {
    s.money -= cost;
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
  s.artists.push({
    ovr, age: rand(18, 24), potential: rand(60, 85),
    popularity: rand(3, 15), fanbase: rand(200, 5000),
    momentum: rand(10, 25), buzz: rand(5, 15),
    fatigue: 0, onTour: false, tourWeeksLeft: 0, tourType: null,
    lastTourEndTurn: 0, signed: true,
  });
  return true;
}

function calcSongQuality(artistOvr: number, studioLevel: number, producerQ: number): number {
  const studio = STUDIO_DATA[studioLevel];
  const base = artistOvr * 0.42 + producerQ * 0.48 + studio.qualityBonusFlat;
  return clamp(rand(Math.round(base) - 10, Math.round(base) + 10), 1, 100);
}

function recordAndRelease(s: SimState, a: SimArtist, producerQ: number): void {
  const quality = calcSongQuality(a.ovr, s.studioLevel, producerQ);
  const cost = Math.floor(producerQ * 15 + 200);
  if (s.money < cost + 8000) return;
  s.money -= cost;
  s.totalSongsReleased++;
  a.fatigue = Math.min(100, a.fatigue + 6);

  const viralPot = clamp(quality + rand(-10, 15), 20, 100);
  const streams = Math.floor((viralPot * 3000 + a.fanbase * 0.35 + quality * 800) * (0.9 + Math.random() * 0.35));

  // Update artist stats
  a.popularity = clamp(a.popularity + rand(0, 3), 0, 100);
  a.fanbase += rand(100, 800);
  a.momentum = clamp(a.momentum + rand(-2, 5), 0, 100);
  a.buzz = clamp(a.buzz + rand(-3, 6), 0, 100);
  s.fanbase += rand(50, 400);
  if (quality >= 50) s.songsOnChart++;

  // Rep changes
  if (quality >= 60) s.reputation = clamp(s.reputation + rand(1, 3), 0, 100);
  else if (quality < 30) s.reputation = clamp(s.reputation - rand(0, 2), 0, 100);

  s.songs.push({
    quality, viralPotential: viralPot, streamsTotal: streams,
    turnReleased: s.turn, artistName: `Player Artist`,
    isPlayer: true, labelName: s.labelName, labelId: "player",
    weeksOnChart: quality >= 50 ? rand(2, 12) : 0,
  });

  // Accumulate into albums (every 8-12 songs make an album)
  const playerSongs = s.songs.filter(so => so.isPlayer);
  if (playerSongs.length > 0 && playerSongs.length % rand(8, 12) === 0) {
    const albumSongs = playerSongs.slice(-rand(8, 12));
    const avgQ = albumSongs.reduce((sum, so) => sum + so.quality, 0) / albumSongs.length;
    const totalStr = albumSongs.reduce((sum, so) => sum + so.streamsTotal, 0);
    s.albums.push({
      qualityScore: avgQ, totalStreams: totalStr, turnReleased: s.turn,
      artistName: "Player Artist", isPlayer: true,
    });
  }
}

// ── Rival simulation ──
function simulateRivalWeek(s: SimState): void {
  for (const label of s.rivalLabels) {
    const stratMod = label.releaseStrategy === "aggressive" ? 1.15 : label.releaseStrategy === "selective" ? 0.80 : 1.0;
    const releaseChance = (label.activityLevel / 200) * stratMod;
    if (Math.random() > releaseChance) continue;

    const artist = label.rosterArtists[Math.floor(Math.random() * label.rosterArtists.length)];
    if (!artist) continue;

    const prodQ = clamp(rand(Math.floor(label.prestige * 0.5 + 10), Math.floor(label.prestige * 0.7 + 30)), 20, 95);
    const genreBonus = 6;
    const studioBonus = label.prestige >= 75 ? rand(3, 5) : label.prestige >= 55 ? rand(1, 3) : rand(0, 1);
    const selectiveBonus = label.releaseStrategy === "selective" ? 3 : 0;
    const consistency = clamp(rand(label.prestige - 20, label.prestige + 10), 10, 90);
    const variance = Math.round(10 * (1 - consistency / 200));
    const baseQ = artist.ovr * 0.42 + prodQ * 0.48 + genreBonus + studioBonus + selectiveBonus;
    const quality = clamp(rand(Math.round(baseQ) - variance, Math.round(baseQ) + variance), 1, 100);
    const viralPot = clamp(quality + rand(-15, 20), 1, 100);

    const streams = Math.floor((viralPot * 3000 + artist.fanbase * 0.35 + quality * 800) * (0.9 + Math.random() * 0.35));

    s.songs.push({
      quality, viralPotential: viralPot, streamsTotal: streams,
      turnReleased: s.turn, artistName: artist.name ?? label.name,
      isPlayer: false, labelName: label.name, labelId: label.id,
      weeksOnChart: quality >= 50 ? rand(2, 10) : 0,
    });

    label.totalStreams += streams;
    if (quality >= 65) label.chartHits++;

    // Update rival artist stats over time
    artist.popularity = clamp(artist.popularity + rand(-1, 3), 0, 100);
    artist.momentum = clamp(artist.momentum + rand(-3, 5), 0, 100);
    artist.buzz = clamp(artist.buzz + rand(-4, 6), 0, 100);
    artist.fanbase += rand(100, 1500);
  }

  // Age out old songs (keep last 80 turns)
  s.songs = s.songs.filter(so => s.turn - so.turnReleased <= 80);
}

// ── Awards ceremony (mirrors engine.ts computeAwardCeremony) ──
function runAwardCeremony(s: SimState): AwardResult {
  const year = Math.floor((s.turn - 48) / 52) + 1;
  const eligibilityWindow = 52;
  const buzzSwing = () => (Math.random() - 0.4) * 20;

  const eligible = s.songs.filter(so => s.turn - so.turnReleased <= eligibilityWindow);
  const playerSongs = eligible.filter(so => so.isPlayer);
  const industrySongs = eligible.filter(so => !so.isPlayer);

  const categories: CategoryResult[] = [];

  // ── Song of the Year ──
  {
    const playerTop = [...playerSongs].sort((a, b) =>
      (b.quality + b.viralPotential + b.streamsTotal / 100000) - (a.quality + a.viralPotential + a.streamsTotal / 100000)
    ).slice(0, 2);
    const rivalTop = [...industrySongs].sort((a, b) =>
      (b.quality + b.viralPotential + b.streamsTotal / 100000) - (a.quality + a.viralPotential + a.streamsTotal / 100000)
    ).slice(0, 3);

    const playerScores = playerTop.map(so =>
      so.quality + so.viralPotential * 0.5 + Math.min(50, so.streamsTotal / 200000) + buzzSwing()
    );
    const rivalScores = rivalTop.map(so =>
      so.quality + so.viralPotential * 0.5 + Math.min(50, so.streamsTotal / 200000) + buzzSwing()
    );

    const bestPlayer = Math.max(...playerScores, -Infinity);
    const bestRival = Math.max(...rivalScores, -Infinity);
    categories.push({
      category: "song_of_year", playerScore: bestPlayer, bestRivalScore: bestRival,
      playerWon: bestPlayer > bestRival && bestPlayer > -Infinity,
      playerNominees: playerTop.length, rivalNominees: rivalTop.length,
      gap: bestPlayer - bestRival,
    });
  }

  // ── Album of the Year ──
  {
    const playerAlbums = s.albums.filter(al => s.turn - al.turnReleased <= eligibilityWindow);
    const playerAlbumScores = playerAlbums.slice(0, 2).map(al =>
      al.qualityScore + Math.min(40, al.totalStreams / 500000) + rand(0, 15) + buzzSwing()
    );

    // Rival virtual albums from grouped songs
    const rivalAlbumScores: number[] = [];
    for (const label of s.rivalLabels) {
      const labelSongs = industrySongs.filter(so => so.labelId === label.id).sort((a, b) => b.quality - a.quality);
      if (labelSongs.length < 3) continue;
      const albumTracks = labelSongs.slice(0, Math.min(10, labelSongs.length));
      const avgQ = albumTracks.reduce((sum, so) => sum + so.quality, 0) / albumTracks.length;
      const totalStr = albumTracks.reduce((sum, so) => sum + so.streamsTotal, 0);
      rivalAlbumScores.push(avgQ + Math.min(40, totalStr / 500000) + rand(0, 15) + buzzSwing());
    }
    rivalAlbumScores.sort((a, b) => b - a);
    const topRivalAlbum = rivalAlbumScores.slice(0, 3);

    const bestPlayer = Math.max(...playerAlbumScores, -Infinity);
    const bestRival = Math.max(...topRivalAlbum, -Infinity);
    categories.push({
      category: "album_of_year", playerScore: bestPlayer, bestRivalScore: bestRival,
      playerWon: bestPlayer > bestRival && bestPlayer > -Infinity,
      playerNominees: playerAlbums.length, rivalNominees: topRivalAlbum.length,
      gap: bestPlayer - bestRival,
    });
  }

  // ── Artist of the Year ──
  {
    const signedArtists = s.artists.filter(a => a.signed);
    const playerScores = signedArtists.slice(0, 2).map(a =>
      a.popularity + a.ovr * 0.25 + Math.min(30, a.fanbase / 50000) + a.momentum * 0.20 + rand(0, 10) + buzzSwing()
    );

    const rivalArtists = s.rivalLabels.flatMap(l => l.rosterArtists)
      .sort((a, b) => (b.popularity + b.momentum) - (a.popularity + a.momentum))
      .slice(0, 3);
    const rivalScores = rivalArtists.map(a =>
      a.popularity + a.ovr * 0.25 + Math.min(30, a.fanbase / 50000) + a.momentum * 0.20 + rand(0, 10) + buzzSwing()
    );

    const bestPlayer = Math.max(...playerScores, -Infinity);
    const bestRival = Math.max(...rivalScores, -Infinity);
    categories.push({
      category: "artist_of_year", playerScore: bestPlayer, bestRivalScore: bestRival,
      playerWon: bestPlayer > bestRival && bestPlayer > -Infinity,
      playerNominees: signedArtists.length, rivalNominees: rivalArtists.length,
      gap: bestPlayer - bestRival,
    });
  }

  // ── Best New Artist ──
  {
    const newArtists = s.artists.filter(a => a.signed && a.age <= 25);
    const playerScores = newArtists.slice(0, 2).map(a =>
      a.potential + a.popularity * 0.4 + a.momentum * 0.25 + rand(0, 15) + buzzSwing()
    );

    const rivalYoung = s.rivalLabels.flatMap(l => l.rosterArtists.filter(a => a.age <= 25))
      .sort((a, b) => (b.popularity + b.momentum) - (a.popularity + a.momentum))
      .slice(0, 3);
    const rivalScores = rivalYoung.map(a =>
      a.potential + a.popularity * 0.4 + a.momentum * 0.25 + rand(0, 15) + buzzSwing()
    );
    // Fallback nominees
    while (rivalScores.length < 2) {
      rivalScores.push(rand(40, 75) + buzzSwing());
    }

    const bestPlayer = Math.max(...playerScores, -Infinity);
    const bestRival = Math.max(...rivalScores, -Infinity);
    categories.push({
      category: "best_new_artist", playerScore: bestPlayer, bestRivalScore: bestRival,
      playerWon: bestPlayer > bestRival && bestPlayer > -Infinity,
      playerNominees: newArtists.length, rivalNominees: rivalYoung.length,
      gap: bestPlayer - bestRival,
    });
  }

  // ── Label of the Year ──
  {
    const playerChartSongs = s.songs.filter(so =>
      so.isPlayer && so.weeksOnChart > 0 && s.turn - so.turnReleased <= eligibilityWindow
    ).length;
    const playerYearStreams = playerSongs.reduce((sum, so) => sum + so.streamsTotal, 0);
    const playerScore = s.reputation * 0.35 + playerChartSongs * 5 + Math.min(30, s.fanbase / 50000) +
      Math.min(20, playerYearStreams / 1000000) + rand(0, 10) + buzzSwing();

    const rivalScores = s.rivalLabels.slice(0, 4).map(label => {
      const rivalChartSongs = industrySongs.filter(so =>
        so.labelId === label.id && so.weeksOnChart > 0
      ).length;
      const rivalYearStreams = industrySongs.filter(so => so.labelId === label.id)
        .reduce((sum, so) => sum + so.streamsTotal, 0);
      return label.prestige * 0.35 + rivalChartSongs * 5 + label.chartHits * 3 +
        Math.min(20, rivalYearStreams / 1000000) + rand(0, 10) + buzzSwing();
    });

    const bestRival = Math.max(...rivalScores, -Infinity);
    categories.push({
      category: "label_of_year", playerScore, bestRivalScore: bestRival,
      playerWon: playerScore > bestRival,
      playerNominees: 1, rivalNominees: rivalScores.length,
      gap: playerScore - bestRival,
    });
  }

  return { year, turn: s.turn, categories };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGIES
// ═══════════════════════════════════════════════════════════════════════════════

function volumeGrinderAct(s: SimState): void {
  // Release every turn with cheapest producers
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 85)) {
    recordAndRelease(s, a, 25 + s.studioLevel);
  }
  // Cheap tours when available
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 50)) {
    if (s.turn - a.lastTourEndTurn > 6 && s.money > 10000) {
      a.onTour = true; a.tourType = "club_tour"; a.tourWeeksLeft = 4;
      s.money -= 1500;
    }
  }
  // Upgrade studio first, then marketing
  for (const t of [
    { dept: "studio", max: 4 }, { dept: "marketing", max: 3 },
    { dept: "studio", max: 7 }, { dept: "marketing", max: 5 },
    { dept: "studio", max: 10 }, { dept: "marketing", max: 8 },
  ]) { if (tryUpgrade(s, t.dept, t.max)) break; }
  // Sign cheap artists frequently
  if (s.turn % 8 === 0 && s.money > 25000) signArtist(s, rand(28, 42));
}

function qualityFocusedAct(s: SimState): void {
  // Release every 4 turns with best producers
  if (s.turn % 4 === 0) {
    for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 60)) {
      recordAndRelease(s, a, 60 + s.studioLevel * 3);
    }
  }
  // National+ tours when popularity allows
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 40)) {
    const since = s.turn - a.lastTourEndTurn;
    if (a.popularity > 30 && since > 16 && s.money > 60000) {
      a.onTour = true; a.tourType = "major_tour"; a.tourWeeksLeft = 16;
      s.money -= 60000;
    } else if (a.popularity > 15 && since > 10 && s.money > 25000) {
      a.onTour = true; a.tourType = "national_tour"; a.tourWeeksLeft = 10;
      s.money -= 25000;
    }
  }
  // Rush studio, then artistDev
  for (const t of [
    { dept: "studio", max: 5 }, { dept: "artistDev", max: 3 },
    { dept: "studio", max: 8 }, { dept: "artistDev", max: 6 },
    { dept: "scouting", max: 5 }, { dept: "marketing", max: 5 },
    { dept: "studio", max: 10 }, { dept: "artistDev", max: 10 },
    { dept: "scouting", max: 8 }, { dept: "marketing", max: 8 },
    { dept: "touring", max: 6 }, { dept: "pr", max: 6 },
  ]) { if (tryUpgrade(s, t.dept, t.max)) break; }
  if (s.turn % 15 === 0 && s.money > 40000) signArtist(s, rand(40, 55));
}

function tourHeavyAct(s: SimState): void {
  // Release every 3 turns
  if (s.turn % 3 === 0) {
    for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 70)) {
      recordAndRelease(s, a, 40 + s.studioLevel * 2);
    }
  }
  // Tour aggressively
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 45)) {
    const since = s.turn - a.lastTourEndTurn;
    if (a.popularity > 40 && since > 22 && s.money > 150000) {
      a.onTour = true; a.tourType = "world_tour"; a.tourWeeksLeft = 22;
      s.money -= 150000;
    } else if (a.popularity > 25 && since > 16 && s.money > 60000) {
      a.onTour = true; a.tourType = "major_tour"; a.tourWeeksLeft = 16;
      s.money -= 60000;
    } else if (a.popularity > 15 && since > 10 && s.money > 25000) {
      a.onTour = true; a.tourType = "national_tour"; a.tourWeeksLeft = 10;
      s.money -= 25000;
    } else if (since > 4 && s.money > 8000) {
      a.onTour = true; a.tourType = "regional_tour"; a.tourWeeksLeft = 6;
      s.money -= 8000;
    }
  }
  // Rush touring, then studio
  for (const t of [
    { dept: "touring", max: 4 }, { dept: "studio", max: 3 },
    { dept: "touring", max: 7 }, { dept: "studio", max: 5 },
    { dept: "marketing", max: 4 }, { dept: "merch", max: 4 },
    { dept: "touring", max: 10 }, { dept: "studio", max: 8 },
    { dept: "marketing", max: 7 }, { dept: "merch", max: 7 },
  ]) { if (tryUpgrade(s, t.dept, t.max)) break; }
  if (s.turn % 12 === 0 && s.money > 30000) signArtist(s, rand(35, 48));
}

function balancedAct(s: SimState): void {
  if (s.turn % 3 === 0) {
    for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 75)) {
      recordAndRelease(s, a, 40 + s.studioLevel * 2);
    }
  }
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 45)) {
    const since = s.turn - a.lastTourEndTurn;
    if (a.popularity > 40 && since > 22 && s.money > 200000) {
      a.onTour = true; a.tourType = "world_tour"; a.tourWeeksLeft = 22; s.money -= 150000;
    } else if (a.popularity > 25 && since > 16 && s.money > 100000) {
      a.onTour = true; a.tourType = "major_tour"; a.tourWeeksLeft = 16; s.money -= 60000;
    } else if (a.popularity > 15 && since > 10 && s.money > 50000) {
      a.onTour = true; a.tourType = "national_tour"; a.tourWeeksLeft = 10; s.money -= 25000;
    } else if (since > 4 && s.money > 8000) {
      a.onTour = true; a.tourType = "regional_tour"; a.tourWeeksLeft = 6; s.money -= 8000;
    }
  }
  for (const t of [
    { dept: "studio", max: 2 }, { dept: "marketing", max: 2 }, { dept: "touring", max: 2 },
    { dept: "studio", max: 4 }, { dept: "marketing", max: 4 }, { dept: "touring", max: 4 },
    { dept: "artistDev", max: 3 }, { dept: "merch", max: 3 }, { dept: "pr", max: 3 },
    { dept: "scouting", max: 3 },
    { dept: "studio", max: 7 }, { dept: "marketing", max: 6 }, { dept: "touring", max: 6 },
    { dept: "studio", max: 10 }, { dept: "marketing", max: 8 }, { dept: "touring", max: 8 },
    { dept: "artistDev", max: 7 }, { dept: "merch", max: 7 }, { dept: "pr", max: 7 },
    { dept: "scouting", max: 7 },
  ]) { if (tryUpgrade(s, t.dept, t.max)) break; }
  if (s.turn % 10 === 0 && s.money > 30000) signArtist(s, rand(35, 50));
}

function starBuilderAct(s: SimState): void {
  // Release every 3 turns with decent producers
  if (s.turn % 3 === 0) {
    for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 65)) {
      recordAndRelease(s, a, 50 + s.studioLevel * 3);
    }
  }
  // Tour when ready
  for (const a of s.artists.filter(a => a.signed && !a.onTour && a.fatigue < 40)) {
    const since = s.turn - a.lastTourEndTurn;
    if (a.popularity > 30 && since > 14 && s.money > 60000) {
      a.onTour = true; a.tourType = "major_tour"; a.tourWeeksLeft = 16; s.money -= 60000;
    } else if (a.popularity > 15 && since > 8 && s.money > 25000) {
      a.onTour = true; a.tourType = "national_tour"; a.tourWeeksLeft = 10; s.money -= 25000;
    }
  }
  // Rush scouting + artistDev first, then studio
  for (const t of [
    { dept: "scouting", max: 5 }, { dept: "artistDev", max: 4 }, { dept: "studio", max: 3 },
    { dept: "scouting", max: 8 }, { dept: "artistDev", max: 7 }, { dept: "studio", max: 6 },
    { dept: "marketing", max: 5 }, { dept: "touring", max: 5 },
    { dept: "scouting", max: 10 }, { dept: "artistDev", max: 10 }, { dept: "studio", max: 9 },
    { dept: "marketing", max: 8 }, { dept: "touring", max: 8 },
  ]) { if (tryUpgrade(s, t.dept, t.max)) break; }
  // Sign high-OVR artists more often
  if (s.turn % 8 === 0 && s.money > 40000) signArtist(s, rand(42, 60));
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY TICK
// ═══════════════════════════════════════════════════════════════════════════════

function simulateWeek(s: SimState): void {
  if (s.gameOver) return;

  // Revenue (simplified)
  const overhead = getDeptOverhead(s) + getRosterSalary(s) + 500;
  let rev = 0;
  // Streaming from charting songs
  rev += s.songsOnChart * rand(800, 3000) * (1 + s.reputation / 200);
  // Touring
  for (const a of s.artists) {
    if (a.onTour && a.tourType) {
      const t = TOUR_DATA[a.tourType];
      const popMult = 0.5 + a.popularity / 100;
      rev += Math.floor(t.revPerWeek * popMult);
      a.fanbase += Math.floor(t.fanPerWeek * popMult);
      s.fanbase += Math.floor(t.fanPerWeek * popMult * 0.5);
      a.fatigue = clamp(a.fatigue + t.fatiguePerWeek, 0, 100);
      a.popularity = clamp(a.popularity + (Math.random() < 0.25 ? 1 : 0), 0, 100);
      a.tourWeeksLeft--;
      if (a.tourWeeksLeft <= 0) { a.onTour = false; a.tourType = null; a.lastTourEndTurn = s.turn; }
    }
  }
  s.money += rev - overhead;

  // Rival releases
  simulateRivalWeek(s);

  // Update rival artist stats (aging, momentum drift)
  if (s.turn % 52 === 0) {
    for (const label of s.rivalLabels) {
      for (const a of label.rosterArtists) {
        a.age++;
        if (a.age <= 28) a.ovr = clamp(a.ovr + rand(0, 3), 25, 95);
        else if (a.age <= 33) a.ovr = clamp(a.ovr + rand(-2, 1), 25, 95);
        else a.ovr = clamp(a.ovr - rand(1, 3), 25, 95);
        a.popularity = clamp(a.popularity + rand(-5, 8), 0, 100);
        a.momentum = clamp(a.momentum + rand(-8, 8), 0, 100);
        a.buzz = clamp(a.buzz + rand(-10, 10), 0, 100);
        a.fanbase += rand(0, 5000);
      }
    }
    // Player artists age too
    for (const a of s.artists) {
      a.age++;
      if (a.age <= 27) a.ovr = clamp(a.ovr + rand(0, 3), 25, 99);
      else if (a.age <= 32) a.ovr = clamp(a.ovr + rand(-2, 1), 25, 99);
      else a.ovr = clamp(a.ovr - rand(1, 4), 25, 99);
    }
  }

  // Chart decay
  if (s.songsOnChart > 0 && Math.random() < 0.12) s.songsOnChart = Math.max(0, s.songsOnChart - 1);

  // Fatigue recovery
  for (const a of s.artists.filter(a => a.signed && !a.onTour)) a.fatigue = Math.max(0, a.fatigue - 7);

  // Rep decay at high levels
  if (s.reputation > 75 && Math.random() < 0.08) s.reputation = Math.max(0, s.reputation - 1);

  // Awards
  if (s.turn >= 48 && (s.turn - 48) % 52 === 0) {
    const result = runAwardCeremony(s);
    s.awardResults.push(result);
    // Award money
    const wins = result.categories.filter(c => c.playerWon).length;
    if (wins > 0) {
      const year = result.year;
      s.money += wins * (50000 + year * 25000);
      s.reputation = clamp(s.reputation + wins * 3, 0, 100);
    }
  }

  // Game over check
  if (s.money < -50000) { s.gameOver = true; }
  if (s.turn > 26 && s.reputation < 10) { s.gameOver = true; }

  s.turn++;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN SIMULATION
// ═══════════════════════════════════════════════════════════════════════════════

const TURNS = 520; // 10 years
const TRIALS = 200;

type StrategyName = "Volume Grinder" | "Quality Focused" | "Tour Heavy" | "Balanced" | "Star Builder";

const strategies: { name: StrategyName; act: (s: SimState) => void }[] = [
  { name: "Volume Grinder", act: volumeGrinderAct },
  { name: "Quality Focused", act: qualityFocusedAct },
  { name: "Tour Heavy", act: tourHeavyAct },
  { name: "Balanced", act: balancedAct },
  { name: "Star Builder", act: starBuilderAct },
];

interface StrategyResult {
  name: StrategyName;
  survivalRate: number;
  totalWins: number[];          // per trial
  winsByCategory: Record<string, number[]>; // category -> [per year per trial wins]
  winRateByCategory: Record<string, number>;
  winRateByYear: number[];      // per year (averaged across trials)
  avgScoreGap: Record<string, number>; // category -> avg gap
  noNomineePct: Record<string, number>; // % of ceremonies where player had 0 nominees
  yearlyWinRates: Record<string, number[]>; // category -> win rate per year
}

const allResults: StrategyResult[] = [];

for (const strat of strategies) {
  const catNames = ["song_of_year", "album_of_year", "artist_of_year", "best_new_artist", "label_of_year"];
  const totalWins: number[] = [];
  const winsByCategory: Record<string, number[]> = {};
  const scoreGaps: Record<string, number[]> = {};
  const noNominee: Record<string, number> = {};
  const yearlyWins: Record<string, number[][]> = {}; // cat -> year -> [wins across trials]
  for (const c of catNames) {
    winsByCategory[c] = [];
    scoreGaps[c] = [];
    noNominee[c] = 0;
    yearlyWins[c] = Array.from({ length: 10 }, () => []);
  }

  let survived = 0;
  const winRateByYear: number[][] = Array.from({ length: 10 }, () => []);

  for (let trial = 0; trial < TRIALS; trial++) {
    const s = createState("Player Label");
    for (let t = 0; t < TURNS; t++) {
      if (s.gameOver) break;
      strat.act(s);
      simulateWeek(s);
    }
    if (!s.gameOver) survived++;

    let trialWins = 0;
    const trialCatWins: Record<string, number> = {};
    for (const c of catNames) trialCatWins[c] = 0;

    for (const ar of s.awardResults) {
      const yearIdx = ar.year - 1;
      let yearWins = 0;
      for (const cr of ar.categories) {
        scoreGaps[cr.category].push(cr.gap);
        if (cr.playerNominees === 0) noNominee[cr.category]++;
        if (cr.playerWon) {
          trialWins++;
          trialCatWins[cr.category]++;
          yearWins++;
          if (yearIdx < 10) yearlyWins[cr.category][yearIdx].push(1);
        } else {
          if (yearIdx < 10) yearlyWins[cr.category][yearIdx].push(0);
        }
      }
      if (yearIdx < 10) winRateByYear[yearIdx].push(yearWins);
    }

    totalWins.push(trialWins);
    for (const c of catNames) winsByCategory[c].push(trialCatWins[c]);
  }

  const totalCeremonies = TRIALS * 10; // 10 years × 200 trials
  const winRateByCategory: Record<string, number> = {};
  const avgScoreGap: Record<string, number> = {};
  const noNomineePct: Record<string, number> = {};
  const yearlyWinRates: Record<string, number[]> = {};

  for (const c of catNames) {
    const totalCatWins = winsByCategory[c].reduce((s, v) => s + v, 0);
    winRateByCategory[c] = totalCatWins / totalCeremonies * 100;
    avgScoreGap[c] = scoreGaps[c].length > 0 ? scoreGaps[c].reduce((s, v) => s + v, 0) / scoreGaps[c].length : 0;
    noNomineePct[c] = noNominee[c] / totalCeremonies * 100;
    yearlyWinRates[c] = yearlyWins[c].map(arr =>
      arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length * 100 : 0
    );
  }

  allResults.push({
    name: strat.name,
    survivalRate: survived / TRIALS * 100,
    totalWins,
    winsByCategory,
    winRateByCategory,
    winRateByYear: winRateByYear.map(arr =>
      arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
    ),
    avgScoreGap,
    noNomineePct,
    yearlyWinRates,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════

const catLabels: Record<string, string> = {
  song_of_year: "Song OTY",
  album_of_year: "Album OTY",
  artist_of_year: "Artist OTY",
  best_new_artist: "Best New",
  label_of_year: "Label OTY",
};

console.log("═══════════════════════════════════════════════════════════════");
console.log("AWARDS SYSTEM BALANCE SIMULATION");
console.log(`${TURNS} turns (${TURNS / 52} years) × ${TRIALS} trials × ${strategies.length} strategies`);
console.log("═══════════════════════════════════════════════════════════════\n");

// ── Per-Strategy Summary ──
for (const r of allResults) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`${r.name.toUpperCase()} (Survival: ${r.survivalRate.toFixed(0)}%)`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const avgWins = r.totalWins.reduce((s, v) => s + v, 0) / r.totalWins.length;
  const sorted = [...r.totalWins].sort((a, b) => a - b);
  console.log(`  Total award wins over 10 years:`);
  console.log(`    Avg: ${avgWins.toFixed(1)} | Median: ${sorted[Math.floor(sorted.length / 2)]} | Max: ${sorted[sorted.length - 1]}`);
  console.log(`    Zero wins: ${(r.totalWins.filter(w => w === 0).length / TRIALS * 100).toFixed(0)}%\n`);

  console.log(`  Win rate by category:`);
  for (const [cat, label] of Object.entries(catLabels)) {
    const rate = r.winRateByCategory[cat];
    const gap = r.avgScoreGap[cat];
    const noNom = r.noNomineePct[cat];
    const bar = "█".repeat(Math.ceil(rate / 2));
    console.log(`    ${label.padEnd(12)} ${rate.toFixed(1).padStart(5)}%  gap: ${gap >= 0 ? "+" : ""}${gap.toFixed(1).padStart(6)}  no-nom: ${noNom.toFixed(0).padStart(3)}%  ${bar}`);
  }

  console.log(`\n  Win rate progression by year:`);
  console.log(`    Year  ` + Object.values(catLabels).map(l => l.padStart(10)).join("") + "  Total/5".padStart(10));
  for (let y = 0; y < 10; y++) {
    let line = `    Y${(y + 1).toString().padStart(2)}   `;
    for (const cat of Object.keys(catLabels)) {
      line += r.yearlyWinRates[cat][y].toFixed(0).padStart(9) + "%";
    }
    line += r.winRateByYear[y].toFixed(2).padStart(10);
    console.log(line);
  }
  console.log();
}

// ── Cross-Strategy Comparison ──
console.log("═══════════════════════════════════════════════════════════════");
console.log("CROSS-STRATEGY COMPARISON (win rate % per category)");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("  Strategy".padEnd(20) + Object.values(catLabels).map(l => l.padStart(10)).join("") + "  TOTAL".padStart(10));
console.log("  " + "─".repeat(78));
for (const r of allResults) {
  let line = `  ${r.name}`.padEnd(20);
  for (const cat of Object.keys(catLabels)) {
    line += `${r.winRateByCategory[cat].toFixed(1)}%`.padStart(10);
  }
  const totalRate = Object.values(r.winRateByCategory).reduce((s, v) => s + v, 0) / 5;
  line += `${totalRate.toFixed(1)}%`.padStart(10);
  console.log(line);
}

// ── Issues & Observations ──
console.log("\n═══════════════════════════════════════════════════════════════");
console.log("POTENTIAL ISSUES DETECTED");
console.log("═══════════════════════════════════════════════════════════════\n");

const issues: string[] = [];

for (const r of allResults) {
  for (const [cat, label] of Object.entries(catLabels)) {
    const rate = r.winRateByCategory[cat];
    if (rate > 60) issues.push(`[TOO EASY] ${r.name} wins ${label} ${rate.toFixed(0)}% of the time (target: 15-35%)`);
    if (rate < 5) issues.push(`[TOO HARD] ${r.name} wins ${label} only ${rate.toFixed(0)}% of the time`);
    if (r.noNomineePct[cat] > 30) issues.push(`[NO NOMINEES] ${r.name} has no ${label} nominees ${r.noNomineePct[cat].toFixed(0)}% of ceremonies`);

    // Check if category gets easier/harder over time
    const earlyRate = r.yearlyWinRates[cat].slice(0, 3).reduce((s, v) => s + v, 0) / 3;
    const lateRate = r.yearlyWinRates[cat].slice(7, 10).reduce((s, v) => s + v, 0) / 3;
    if (lateRate - earlyRate > 30) issues.push(`[SCALING] ${r.name} ${label} win rate jumps from ${earlyRate.toFixed(0)}% (Y1-3) to ${lateRate.toFixed(0)}% (Y8-10)`);
    if (earlyRate - lateRate > 25) issues.push(`[FALLOFF] ${r.name} ${label} win rate drops from ${earlyRate.toFixed(0)}% (Y1-3) to ${lateRate.toFixed(0)}% (Y8-10)`);
  }

  // Check overall dominance
  const totalRate = Object.values(r.winRateByCategory).reduce((s, v) => s + v, 0) / 5;
  if (totalRate > 45) issues.push(`[DOMINANT] ${r.name} overall win rate ${totalRate.toFixed(0)}% across all categories`);
  if (totalRate < 8) issues.push(`[UNVIABLE] ${r.name} overall win rate only ${totalRate.toFixed(0)}%`);

  // Check score gap direction
  for (const [cat, label] of Object.entries(catLabels)) {
    const gap = r.avgScoreGap[cat];
    if (gap > 30) issues.push(`[GAP] ${r.name} ${label} avg score gap +${gap.toFixed(0)} (player consistently dominates)`);
    if (gap < -30) issues.push(`[GAP] ${r.name} ${label} avg score gap ${gap.toFixed(0)} (player consistently outscored)`);
  }
}

// Check cross-strategy balance
const categoryRates = Object.keys(catLabels).map(cat => ({
  cat,
  label: catLabels[cat],
  rates: allResults.map(r => r.winRateByCategory[cat]),
}));
for (const cr of categoryRates) {
  const min = Math.min(...cr.rates);
  const max = Math.max(...cr.rates);
  if (max - min > 35) {
    const bestStrat = allResults[cr.rates.indexOf(max)].name;
    const worstStrat = allResults[cr.rates.indexOf(min)].name;
    issues.push(`[SPREAD] ${cr.label} has ${(max - min).toFixed(0)}pp spread: ${bestStrat} (${max.toFixed(0)}%) vs ${worstStrat} (${min.toFixed(0)}%)`);
  }
}

if (issues.length === 0) {
  console.log("  No major issues detected.");
} else {
  for (const issue of issues) {
    console.log(`  ${issue}`);
  }
}

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("SIMULATION COMPLETE");
console.log("═══════════════════════════════════════════════════════════════");
