// ── Achievement & Hall of Fame System ────────────────────────────────────────
//
// Tiered achievements across core categories. All based on player-driven
// outcomes, not random events. Checked each turn in advanceTurn.

import {
  GameState, AchievementDef, AchievementProgress, AchievementCategory,
  HallOfFameEntry, HoFTier, Artist, GameEvent,
} from "./types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ── Achievement Definitions ──────────────────────────────────────────────────

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Streaming ──
  { id: "stream_1", category: "streaming", name: "First Plays", description: "Reach 10M total catalog streams", tier: 1, threshold: 10_000_000 },
  { id: "stream_2", category: "streaming", name: "Rising Catalog", description: "Reach 50M total catalog streams", tier: 2, threshold: 50_000_000 },
  { id: "stream_3", category: "streaming", name: "Streaming Force", description: "Reach 100M total catalog streams", tier: 3, threshold: 100_000_000 },
  { id: "stream_4", category: "streaming", name: "Streaming Giant", description: "Reach 500M total catalog streams", tier: 4, threshold: 500_000_000 },
  { id: "stream_5", category: "streaming", name: "Billion Club", description: "Reach 1B total catalog streams", tier: 5, threshold: 1_000_000_000 },
  { id: "stream_6", category: "streaming", name: "Streaming Empire", description: "Reach 5B total catalog streams", tier: 6, threshold: 5_000_000_000 },
  { id: "stream_7", category: "streaming", name: "All-Time Legend", description: "Reach 10B total catalog streams", tier: 7, threshold: 10_000_000_000 },

  // ── Merch Revenue ──
  { id: "merch_1", category: "merch", name: "Merch Launch", description: "Earn $100K in merch revenue", tier: 1, threshold: 100_000 },
  { id: "merch_2", category: "merch", name: "Merch Machine", description: "Earn $1M in merch revenue", tier: 2, threshold: 1_000_000 },
  { id: "merch_3", category: "merch", name: "Fashion Mogul", description: "Earn $10M in merch revenue", tier: 3, threshold: 10_000_000 },
  { id: "merch_4", category: "merch", name: "Merch Empire", description: "Earn $50M in merch revenue", tier: 4, threshold: 50_000_000 },
  { id: "merch_5", category: "merch", name: "Lifestyle Brand", description: "Earn $100M in merch revenue", tier: 5, threshold: 100_000_000 },

  // ── Tour Revenue ──
  { id: "tour_1", category: "touring", name: "First Tour Money", description: "Earn $100K in tour revenue", tier: 1, threshold: 100_000 },
  { id: "tour_2", category: "touring", name: "Tour Operator", description: "Earn $1M in tour revenue", tier: 2, threshold: 1_000_000 },
  { id: "tour_3", category: "touring", name: "Arena Acts", description: "Earn $5M in tour revenue", tier: 3, threshold: 5_000_000 },
  { id: "tour_4", category: "touring", name: "World Stage", description: "Earn $20M in tour revenue", tier: 4, threshold: 20_000_000 },
  { id: "tour_5", category: "touring", name: "Tour Titan", description: "Earn $50M in tour revenue", tier: 5, threshold: 50_000_000 },

  // ── Cash Balance ──
  { id: "cash_1", category: "cash", name: "Millionaire", description: "Reach $1M cash balance", tier: 1, threshold: 1_000_000 },
  { id: "cash_2", category: "cash", name: "Multi-Millionaire", description: "Reach $10M cash balance", tier: 2, threshold: 10_000_000 },
  { id: "cash_3", category: "cash", name: "Mogul", description: "Reach $50M cash balance", tier: 3, threshold: 50_000_000 },
  { id: "cash_4", category: "cash", name: "Tycoon", description: "Reach $100M cash balance", tier: 4, threshold: 100_000_000 },
  { id: "cash_5", category: "cash", name: "Billionaire", description: "Reach $1B cash balance", tier: 5, threshold: 1_000_000_000 },

  // ── Songs / Charts ──
  { id: "chart_1", category: "charts", name: "Top 10 Debut", description: "Get a song in the Top 10", tier: 1, threshold: 1 },
  { id: "chart_2", category: "charts", name: "Number One", description: "Get a #1 song", tier: 2, threshold: 1 },
  { id: "chart_3", category: "charts", name: "Hit Factory", description: "Accumulate 5 #1 songs", tier: 3, threshold: 5 },
  { id: "chart_4", category: "charts", name: "Chart Dominator", description: "Accumulate 20 #1 songs", tier: 4, threshold: 20 },
  { id: "chart_5", category: "charts", name: "Untouchable", description: "Accumulate 50 #1 songs", tier: 5, threshold: 50 },
  { id: "chart_6", category: "charts", name: "Chart Lockdown", description: "Have 3 songs in the Top 10 simultaneously", tier: 6, threshold: 3 },
  { id: "chart_7", category: "charts", name: "Chart Monopoly", description: "Have 10 songs in the Top 20 simultaneously", tier: 7, threshold: 10 },

  // ── Albums ──
  { id: "album_1", category: "albums", name: "Debut Album", description: "Release your first album", tier: 1, threshold: 1 },
  { id: "album_2", category: "albums", name: "Gold", description: "An album reaches 500K streams", tier: 2, threshold: 500_000 },
  { id: "album_3", category: "albums", name: "Platinum", description: "An album reaches 1M streams", tier: 3, threshold: 1_000_000 },
  { id: "album_4", category: "albums", name: "Multi-Platinum", description: "An album reaches 5M streams", tier: 4, threshold: 5_000_000 },
  { id: "album_5", category: "albums", name: "Diamond", description: "An album reaches 10M streams", tier: 5, threshold: 10_000_000 },
  { id: "album_6", category: "albums", name: "Masterpiece", description: "Release an album with quality score > 90", tier: 6, threshold: 90 },

  // ── Awards ──
  { id: "award_1", category: "awards", name: "First Trophy", description: "Win 1 award", tier: 1, threshold: 1 },
  { id: "award_2", category: "awards", name: "Award Regular", description: "Win 5 awards", tier: 2, threshold: 5 },
  { id: "award_3", category: "awards", name: "Award Magnet", description: "Win 20 awards", tier: 3, threshold: 20 },
  { id: "award_4", category: "awards", name: "Award Legend", description: "Win 50 awards", tier: 4, threshold: 50 },
  { id: "award_5", category: "awards", name: "Clean Sweep", description: "Win all major awards in a single year", tier: 5, threshold: 5 },

  // ── Collaborations ──
  { id: "collab_1", category: "collaborations", name: "First Feature", description: "Release a collaboration song", tier: 1, threshold: 1 },
  { id: "collab_2", category: "collaborations", name: "Superstar Summit", description: "Collaboration between two superstar-tier artists", tier: 2, threshold: 1 },
  { id: "collab_3", category: "collaborations", name: "Collab Hits #1", description: "A collaboration reaches #1 on the chart", tier: 3, threshold: 1 },

  // ── Dynasty ──
  { id: "dynasty_1", category: "dynasty", name: "Top Label", description: "#1 label for 1 year", tier: 1, threshold: 1 },
  { id: "dynasty_2", category: "dynasty", name: "Dynasty Builder", description: "#1 label for 3 consecutive years", tier: 2, threshold: 3 },
  { id: "dynasty_3", category: "dynasty", name: "Era Defining", description: "#1 label for 5 consecutive years", tier: 3, threshold: 5 },
  { id: "dynasty_4", category: "dynasty", name: "Untouchable Dynasty", description: "#1 label for 10 consecutive years", tier: 4, threshold: 10 },

  // ── Hall of Fame (Legacy) ──
  { id: "hof_1", category: "hall_of_fame", name: "First Inductee", description: "Produce 1 Hall of Fame artist", tier: 1, threshold: 1 },
  { id: "hof_2", category: "hall_of_fame", name: "HoF Factory", description: "Produce 5 Hall of Fame artists", tier: 2, threshold: 5 },
  { id: "hof_3", category: "hall_of_fame", name: "Legend Maker", description: "Produce 10 Hall of Fame artists", tier: 3, threshold: 10 },
  { id: "hof_4", category: "hall_of_fame", name: "Mount Rushmore", description: "Produce 25 Hall of Fame artists", tier: 4, threshold: 25 },

  // ── Narrative ──
  { id: "narrative_1", category: "narrative", name: "First Day Out", description: "Artist returns from jail and releases a hit song", tier: 1, threshold: 1 },
];

// ── Achievement checking ─────────────────────────────────────────────────────

export function checkAchievements(state: GameState): AchievementProgress[] {
  const progress = [...(state.achievements ?? [])];
  const unlocked = new Set(progress.filter((p) => p.unlocked).map((p) => p.achievementId));

  function tryUnlock(id: string, condition: boolean) {
    if (unlocked.has(id) || !condition) return;
    const existing = progress.find((p) => p.achievementId === id);
    if (existing) {
      existing.unlocked = true;
      existing.unlockedTurn = state.turn;
    } else {
      progress.push({ achievementId: id, unlocked: true, unlockedTurn: state.turn });
    }
  }

  // ── Streaming ──
  const totalStreams = state.songs.reduce((sum, s) => sum + s.streamsTotal, 0);
  tryUnlock("stream_1", totalStreams >= 10_000_000);
  tryUnlock("stream_2", totalStreams >= 50_000_000);
  tryUnlock("stream_3", totalStreams >= 100_000_000);
  tryUnlock("stream_4", totalStreams >= 500_000_000);
  tryUnlock("stream_5", totalStreams >= 1_000_000_000);
  tryUnlock("stream_6", totalStreams >= 5_000_000_000);
  tryUnlock("stream_7", totalStreams >= 10_000_000_000);

  // ── Merch Revenue ──
  const merchRev = state.revenueHistory?.merch ?? 0;
  tryUnlock("merch_1", merchRev >= 100_000);
  tryUnlock("merch_2", merchRev >= 1_000_000);
  tryUnlock("merch_3", merchRev >= 10_000_000);
  tryUnlock("merch_4", merchRev >= 50_000_000);
  tryUnlock("merch_5", merchRev >= 100_000_000);

  // ── Tour Revenue ──
  const tourRev = state.revenueHistory?.touring ?? 0;
  tryUnlock("tour_1", tourRev >= 100_000);
  tryUnlock("tour_2", tourRev >= 1_000_000);
  tryUnlock("tour_3", tourRev >= 5_000_000);
  tryUnlock("tour_4", tourRev >= 20_000_000);
  tryUnlock("tour_5", tourRev >= 50_000_000);

  // ── Cash Balance ──
  tryUnlock("cash_1", state.money >= 1_000_000);
  tryUnlock("cash_2", state.money >= 10_000_000);
  tryUnlock("cash_3", state.money >= 50_000_000);
  tryUnlock("cash_4", state.money >= 100_000_000);
  tryUnlock("cash_5", state.money >= 1_000_000_000);

  // ── Charts ──
  const playerChartSongs = state.chart.filter((c) => c.isPlayerSong);
  const top10Count = playerChartSongs.filter((c) => c.position <= 10).length;
  const top20Count = playerChartSongs.filter((c) => c.position <= 20).length;
  const hasTop10 = top10Count > 0;
  const hasNumber1 = playerChartSongs.some((c) => c.position === 1);

  // Track cumulative #1s (count songs that have EVER been #1)
  const numberOneSongs = state.songs.filter((s) => s.released && s.chartPosition === 1).length;

  tryUnlock("chart_1", hasTop10);
  tryUnlock("chart_2", hasNumber1);
  tryUnlock("chart_3", numberOneSongs >= 5);
  tryUnlock("chart_4", numberOneSongs >= 20);
  tryUnlock("chart_5", numberOneSongs >= 50);
  tryUnlock("chart_6", top10Count >= 3);
  tryUnlock("chart_7", top20Count >= 10);

  // ── Albums ──
  const releasedAlbums = state.albums.filter((al) => al.status === "released");
  tryUnlock("album_1", releasedAlbums.length >= 1);
  tryUnlock("album_2", releasedAlbums.some((al) => al.totalStreams >= 500_000));
  tryUnlock("album_3", releasedAlbums.some((al) => al.totalStreams >= 1_000_000));
  tryUnlock("album_4", releasedAlbums.some((al) => al.totalStreams >= 5_000_000));
  tryUnlock("album_5", releasedAlbums.some((al) => al.totalStreams >= 10_000_000));
  tryUnlock("album_6", releasedAlbums.some((al) => al.qualityScore > 90));

  // ── Awards ──
  const totalAwardWins = state.awardHistory.reduce((sum, c) => sum + c.playerWins.length, 0);
  tryUnlock("award_1", totalAwardWins >= 1);
  tryUnlock("award_2", totalAwardWins >= 5);
  tryUnlock("award_3", totalAwardWins >= 20);
  tryUnlock("award_4", totalAwardWins >= 50);
  // Clean sweep: all 5 major categories in one ceremony
  const hasCleanSweep = state.awardHistory.some((c) => c.playerWins.length >= 5);
  tryUnlock("award_5", hasCleanSweep);

  // ── Collaborations ──
  const collabSongs = state.songs.filter((s) => s.released && s.featuredArtistId);
  tryUnlock("collab_1", collabSongs.length >= 1);

  // Superstar summit: check if any collab has both artists at superstar tier
  // (We check via market tier helper in features.ts, but here we approximate)
  const hasSuperstarCollab = collabSongs.some((s) => {
    const artist = state.artists.find((a) => a.id === s.artistId);
    const feat = state.artists.find((a) => a.id === s.featuredArtistId)
      ?? state.rivalLabels.flatMap((l) => l.rosterArtists).find((a) => a.id === s.featuredArtistId);
    if (!artist || !feat) return false;
    const artistScore = artist.popularity * 0.35 + artist.fanbase / 20000 * 0.25 + (artist.momentum ?? 30) * 0.20;
    const featScore = feat.popularity * 0.35 + feat.fanbase / 20000 * 0.25 + (feat.momentum ?? 30) * 0.20;
    return artistScore >= 55 && featScore >= 55; // ~star/superstar range
  });
  tryUnlock("collab_2", hasSuperstarCollab);

  // Collab #1
  const collabNumber1 = collabSongs.some((s) => s.chartPosition === 1);
  tryUnlock("collab_3", collabNumber1);

  // ── Dynasty ──
  const dynastyYears = state.dynastyYears ?? 0;
  tryUnlock("dynasty_1", dynastyYears >= 1);
  tryUnlock("dynasty_2", dynastyYears >= 3);
  tryUnlock("dynasty_3", dynastyYears >= 5);
  tryUnlock("dynasty_4", dynastyYears >= 10);

  // ── Hall of Fame ──
  const hofCount = (state.hallOfFame ?? []).length;
  tryUnlock("hof_1", hofCount >= 1);
  tryUnlock("hof_2", hofCount >= 5);
  tryUnlock("hof_3", hofCount >= 10);
  tryUnlock("hof_4", hofCount >= 25);

  // ── Narrative: First Day Out ──
  const firstDayOutHit = state.songs.some((s) => {
    if (!s.released || s.chartPosition === null || s.chartPosition > 10) return false;
    const artist = state.artists.find((a) => a.id === s.artistId);
    return artist && artist.releaseFromJailTurn && artist.releaseFromJailTurn > 0;
  });
  tryUnlock("narrative_1", firstDayOutHit);

  return progress;
}

// ── Hall of Fame scoring ─────────────────────────────────────────────────────

export function computeHallOfFameScore(
  artist: Artist,
  state: GameState
): { score: number; tier: HoFTier | null; stats: HallOfFameEntry["stats"] } {
  // Count awards won by this artist
  const awards = state.awardHistory.reduce((sum, ceremony) => {
    return sum + ceremony.winners.filter((w) =>
      w.isPlayer && w.artistName === artist.name
    ).length;
  }, 0);

  // Count #1 songs
  const numberOneSongs = state.songs.filter(
    (s) => s.artistId === artist.id && s.released && s.chartPosition === 1
  ).length;

  // Count platinum albums (1M+ streams)
  const platinumAlbums = state.albums.filter(
    (al) => al.artistId === artist.id && al.status === "released" && al.totalStreams >= 1_000_000
  ).length;

  // Total streams
  const totalStreams = state.songs
    .filter((s) => s.artistId === artist.id)
    .reduce((sum, s) => sum + s.streamsTotal, 0);

  // Career years (from first signed to now)
  const careerYears = Math.max(1, Math.floor((state.turn - (artist.careerStartTurn ?? 1)) / 52));

  const score =
    awards * 5 +
    numberOneSongs * 10 +
    platinumAlbums * 15 +
    Math.floor(totalStreams / 100_000_000) +
    careerYears * 2;

  const stats = {
    awards,
    numberOneSongs,
    platinumAlbums,
    totalStreams,
    careerYears,
    overallRating: artist.overallRating,
  };

  let tier: HoFTier | null = null;
  if (score >= 200) tier = "first_ballot";
  else if (score >= 150) tier = "strong_candidate";
  else if (score >= 100) tier = "eligible";

  return { score, tier, stats };
}

// ── Process retirements for Hall of Fame eligibility ─────────────────────────
// Called when an artist retires or is dropped after a long career.

export function processHallOfFame(
  state: GameState,
  retiringArtist: Artist
): { hallOfFame: HallOfFameEntry[]; event: GameEvent | null } {
  const hallOfFame = [...(state.hallOfFame ?? [])];

  // Already inducted?
  if (hallOfFame.some((h) => h.artistId === retiringArtist.id)) {
    return { hallOfFame, event: null };
  }

  const { score, tier, stats } = computeHallOfFameScore(retiringArtist, state);
  if (!tier) return { hallOfFame, event: null };

  const yearNumber = Math.floor(state.turn / 52) + 1;
  const entry: HallOfFameEntry = {
    artistId: retiringArtist.id,
    artistName: retiringArtist.name,
    inductionTurn: state.turn,
    inductionYear: yearNumber,
    tier,
    score,
    stats,
  };
  hallOfFame.push(entry);

  const tierLabel = tier === "first_ballot" ? "First Ballot" : tier === "strong_candidate" ? "Strong Candidate" : "Eligible";
  const event: GameEvent = {
    id: uid(),
    turn: state.turn,
    type: "milestone",
    title: `${retiringArtist.name} Inducted into Hall of Fame`,
    description: `${retiringArtist.name} has been inducted into the Hall of Fame as a ${tierLabel} (score: ${score}). ${stats.numberOneSongs} #1 songs, ${stats.platinumAlbums} platinum albums, ${stats.awards} awards.`,
    artistId: retiringArtist.id,
    moneyDelta: 0,
    reputationDelta: tier === "first_ballot" ? 5 : tier === "strong_candidate" ? 3 : 2,
    fanbaseDelta: 0,
    resolved: true,
  };

  return { hallOfFame, event };
}

// ── Dynasty checking (called at year-end award ceremonies) ───────────────────

export function checkDynasty(state: GameState): number {
  // Compare player label score vs all rival labels
  const playerScore = state.reputation * 0.3
    + state.chart.filter((c) => c.isPlayerSong).length * 5
    + Math.min(30, state.fanbase / 100000)
    + state.songs.filter((s) => s.released && state.turn - s.turnReleased <= 52)
      .reduce((sum, s) => sum + s.streamsTotal, 0) / 1_000_000;

  let isTop = true;
  for (const label of state.rivalLabels) {
    const rivalScore = label.prestige * 0.3
      + label.chartHits * 5
      + Math.min(30, label.totalStreams / 1_000_000);
    if (rivalScore > playerScore) {
      isTop = false;
      break;
    }
  }

  return isTop ? (state.dynastyYears ?? 0) + 1 : 0;
}
