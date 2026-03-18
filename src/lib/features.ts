// ── Feature / Collaboration System ──────────────────────────────────────────
//
// Handles artist features: acceptance logic, pricing, chemistry, song impact,
// fan crossover, relationship building, incoming requests, and AI behavior.

import {
  GameState, Artist, Genre, MarketTier, ArtistRelationship, FeatureRequest,
  FeatureSynergy, FeatureTag, GameEvent, Song, RivalLabel,
} from "./types";
import { STUDIO_DATA, isProducerUnlocked, generateSongTitle } from "./data";

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

// ── Genre compatibility ──────────────────────────────────────────────────────

const GENRE_COMPAT: Record<Genre, Record<Genre, "same" | "adjacent" | "neutral" | "mismatch">> = {
  "trap":         { "trap": "same", "drill": "adjacent", "pop-rap": "adjacent", "r-and-b": "neutral", "boom-bap": "neutral", "experimental": "neutral" },
  "drill":        { "drill": "same", "trap": "adjacent", "boom-bap": "adjacent", "pop-rap": "neutral", "r-and-b": "neutral", "experimental": "neutral" },
  "boom-bap":     { "boom-bap": "same", "drill": "adjacent", "experimental": "adjacent", "trap": "neutral", "pop-rap": "neutral", "r-and-b": "neutral" },
  "r-and-b":      { "r-and-b": "same", "pop-rap": "adjacent", "trap": "neutral", "boom-bap": "neutral", "drill": "neutral", "experimental": "neutral" },
  "pop-rap":      { "pop-rap": "same", "r-and-b": "adjacent", "trap": "adjacent", "boom-bap": "neutral", "drill": "neutral", "experimental": "neutral" },
  "experimental": { "experimental": "same", "boom-bap": "adjacent", "trap": "neutral", "drill": "neutral", "pop-rap": "neutral", "r-and-b": "neutral" },
};

export function getGenreCompat(g1: Genre, g2: Genre): "same" | "adjacent" | "neutral" | "mismatch" {
  return GENRE_COMPAT[g1]?.[g2] ?? "neutral";
}

function genreCompatScore(g1: Genre, g2: Genre): number {
  const compat = getGenreCompat(g1, g2);
  switch (compat) {
    case "same": return 10;
    case "adjacent": return 5;
    case "neutral": return 0;
    case "mismatch": return -5;
  }
}

// ── Market tiers ─────────────────────────────────────────────────────────────

export function getMarketTier(artist: Artist): MarketTier {
  const score = artist.popularity * 0.35 + artist.fanbase / 20000 * 0.25
    + (artist.momentum ?? 30) * 0.20 + artist.overallRating * 0.10
    + (artist.chartHits ?? 0) * 2;
  if (score >= 70) return "superstar";
  if (score >= 55) return "star";
  if (score >= 40) return "major";
  if (score >= 25) return "mid-tier";
  if (score >= 12) return "emerging";
  return "underground";
}

const TIER_RANK: Record<MarketTier, number> = {
  "underground": 0, "emerging": 1, "mid-tier": 2, "major": 3, "star": 4, "superstar": 5,
};

function tierGap(requesting: MarketTier, featured: MarketTier): number {
  return TIER_RANK[featured] - TIER_RANK[requesting];
}

// ── Relationship helpers ─────────────────────────────────────────────────────

export function getRelationship(state: GameState, id1: string, id2: string): ArtistRelationship | undefined {
  return state.artistRelationships.find(
    (r) => (r.artistId1 === id1 && r.artistId2 === id2) || (r.artistId1 === id2 && r.artistId2 === id1)
  );
}

export function getRelationshipScore(state: GameState, id1: string, id2: string): number {
  return getRelationship(state, id1, id2)?.score ?? 0;
}

function upsertRelationship(
  relationships: ArtistRelationship[],
  id1: string, id2: string,
  delta: number,
  collabDelta: number,
  turn: number
): ArtistRelationship[] {
  const [a, b] = id1 < id2 ? [id1, id2] : [id2, id1];
  const existing = relationships.find((r) => r.artistId1 === a && r.artistId2 === b);
  if (existing) {
    return relationships.map((r) =>
      r.artistId1 === a && r.artistId2 === b
        ? {
            ...r,
            score: clamp(r.score + delta, -100, 100),
            collabCount: r.collabCount + collabDelta,
            lastCollabTurn: collabDelta > 0 ? turn : r.lastCollabTurn,
          }
        : r
    );
  }
  return [
    ...relationships,
    {
      artistId1: a, artistId2: b,
      score: clamp(delta, -100, 100),
      collabCount: Math.max(0, collabDelta),
      lastCollabTurn: collabDelta > 0 ? turn : 0,
    },
  ];
}

// ── Feature fee calculation ──────────────────────────────────────────────────

export function computeFeatureFee(
  featuredArtist: Artist,
  requestingArtist: Artist,
  state: GameState
): number {
  const tier = getMarketTier(featuredArtist);
  const reqTier = getMarketTier(requestingArtist);

  // Base fee by tier
  const baseFees: Record<MarketTier, number> = {
    "underground": 2000,
    "emerging": 5000,
    "mid-tier": 15000,
    "major": 40000,
    "star": 80000,
    "superstar": 150000,
  };
  let fee = baseFees[tier];

  // Momentum premium: hot artists charge more
  const mom = featuredArtist.momentum ?? 30;
  if (mom >= 70) fee *= 1.4;
  else if (mom >= 50) fee *= 1.2;
  else if (mom < 20) fee *= 0.7;

  // Scarcity: busy artists charge more
  const featCount = featuredArtist.featureCount ?? 0;
  if (featCount >= 4) fee *= 1.3;
  else if (featCount >= 2) fee *= 1.1;

  // Same label discount: free for underground/emerging, heavily discounted otherwise
  const sameLabel = state.artists.some((a) => a.id === featuredArtist.id && a.signed);
  if (sameLabel) {
    if (TIER_RANK[tier] <= 1) return 0; // free internal feature
    fee *= 0.3; // 70% discount
  }

  // Relationship discount
  const rel = getRelationshipScore(state, featuredArtist.id, requestingArtist.id);
  if (rel >= 50) fee *= 0.7;
  else if (rel >= 25) fee *= 0.85;

  // Tier gap premium: requesting from much bigger artist costs more
  const gap = tierGap(reqTier, tier);
  if (gap >= 3) fee *= 1.5;
  else if (gap >= 2) fee *= 1.25;

  return Math.round(fee);
}

// ── Feature acceptance logic ─────────────────────────────────────────────────

export interface AcceptanceResult {
  accepted: boolean;
  chance: number;       // 0–100
  synergy: FeatureSynergy;
  fee: number;
}

export function evaluateFeatureAcceptance(
  state: GameState,
  requestingArtist: Artist,
  featuredArtist: Artist,
  feeOffered?: number,
): AcceptanceResult {
  const reqTier = getMarketTier(requestingArtist);
  const featTier = getMarketTier(featuredArtist);
  const gap = tierGap(reqTier, featTier); // positive = featured is bigger
  const sameLabel = state.artists.some((a) => a.id === featuredArtist.id && a.signed)
    && state.artists.some((a) => a.id === requestingArtist.id && a.signed);
  const rel = getRelationshipScore(state, requestingArtist.id, featuredArtist.id);
  const genreFitRaw = getGenreCompat(requestingArtist.genre, featuredArtist.genre);
  const genreScore = genreCompatScore(requestingArtist.genre, featuredArtist.genre);

  // Check beef
  const hasBeef = requestingArtist.activeBeef?.opponentId === featuredArtist.id
    || featuredArtist.activeBeef?.opponentId === requestingArtist.id
    || state.activeBeefs.some(
      (b) => (b.artist1Id === requestingArtist.id && b.artist2Id === featuredArtist.id)
        || (b.artist1Id === featuredArtist.id && b.artist2Id === requestingArtist.id)
    );

  // Check cooldown (4 turn minimum between features)
  const onCooldown = (featuredArtist.lastFeatureTurn ?? 0) > 0
    && state.turn - (featuredArtist.lastFeatureTurn ?? 0) < 4;

  // ── Compute weighted acceptance score ──
  let score = 50; // neutral baseline

  // Tier gap effect (dominant factor)
  if (gap <= 0) score += 15;           // same tier or requesting from smaller
  else if (gap === 1) score -= 5;      // one tier up, mild resistance
  else if (gap === 2) score -= 20;     // two tiers up, significant resistance
  else if (gap === 3) score -= 40;     // three tiers, very resistant
  else score -= 60;                     // huge gap, nearly impossible

  // Same label bonus (very strong)
  if (sameLabel) score += 30;

  // Relationship
  if (rel >= 50) score += 20;
  else if (rel >= 25) score += 10;
  else if (rel >= 10) score += 5;
  else if (rel <= -25) score -= 15;
  else if (rel <= -50) score -= 30;

  // Genre compatibility (modest)
  score += genreScore;

  // Momentum / relevance of requesting artist
  const reqMom = requestingArtist.momentum ?? 30;
  if (reqMom >= 60) score += 10;
  else if (reqMom >= 40) score += 5;
  else if (reqMom < 15) score -= 10;

  // Featured artist's declining status makes them more open
  const featMom = featuredArtist.momentum ?? 30;
  if (featMom < 20) score += 15;
  else if (featMom < 35) score += 5;

  // Fee factor
  const expectedFee = computeFeatureFee(featuredArtist, requestingArtist, state);
  const actualFee = feeOffered ?? expectedFee;
  if (actualFee >= expectedFee * 1.5) score += 15;
  else if (actualFee >= expectedFee) score += 5;
  else if (actualFee < expectedFee * 0.5) score -= 20;
  else if (actualFee < expectedFee) score -= 10;

  // Money motivation of featured artist
  if (featuredArtist.traits.moneyMotivation > 70 && actualFee >= expectedFee * 1.3) score += 10;

  // Beef = hard block
  if (hasBeef) score = Math.min(score, 5);

  // Cooldown penalty
  if (onCooldown) score -= 30;

  // Yearly feature cap (max ~6 features/year)
  if ((featuredArtist.featureCount ?? 0) >= 6) score -= 25;

  const chance = clamp(score, 0, 100);

  // Build synergy object
  const tags: FeatureTag[] = [];
  if (sameLabel) tags.push("same_label");
  if (genreFitRaw === "same" || genreFitRaw === "adjacent") tags.push("strong_fit");
  if (hasBeef) tags.push("beef_blocked");
  if (onCooldown) tags.push("on_cooldown");
  if (actualFee >= expectedFee * 1.3) tags.push("expensive");
  if (chance < 25) tags.push("unlikely");
  if (sameLabel && gap >= 2 && reqMom < 40) tags.push("great_for_growth");
  if (rel <= -10 || genreFitRaw === "mismatch") tags.push("chemistry_risk");

  // Chemistry estimate
  const chemistry = clamp(
    50 + genreScore * 2 + Math.min(30, rel * 0.3) + (sameLabel ? 10 : 0) + rand(-10, 10),
    0, 100
  );

  const synergy: FeatureSynergy = {
    chemistry,
    genreFit: genreFitRaw === "same" ? "strong" : genreFitRaw === "adjacent" ? "compatible" : genreFitRaw as "neutral" | "mismatch",
    tierGap: gap,
    sameLabel,
    tags,
  };

  return {
    accepted: Math.random() * 100 < chance,
    chance,
    synergy,
    fee: actualFee,
  };
}

// ── Record a feature song ────────────────────────────────────────────────────
//
// Called after acceptance. Applies the featured artist's contribution to the
// song quality/viral/commercial metrics, updates relationships.

export interface FeatureRecordResult {
  newState: GameState;
  song: Song | null;
  error?: string;
}

export function recordFeatureSong(
  state: GameState,
  artistId: string,
  producerId: string,
  featuredArtistId: string,
  fee: number,
  standalone: boolean,
): FeatureRecordResult {
  const artist = state.artists.find((a) => a.id === artistId);
  const producer = state.producers.find((p) => p.id === producerId);

  if (!artist || !producer) return { newState: state, song: null, error: "Artist or producer not found." };
  if (!artist.signed) return { newState: state, song: null, error: "Artist is not signed." };
  if (artist.jailed) return { newState: state, song: null, error: "Artist is currently incarcerated." };
  if (state.money < fee) return { newState: state, song: null, error: "Not enough money for the feature fee." };

  // Find the featured artist (could be on player roster or in rival label rosters)
  let featuredArtist = state.artists.find((a) => a.id === featuredArtistId);
  let featuredLabelId: string | undefined;
  let featuredArtistName = "";

  if (featuredArtist) {
    featuredArtistName = featuredArtist.name;
  } else {
    // Search rival label rosters
    for (const label of state.rivalLabels) {
      const ra = label.rosterArtists.find((a) => a.id === featuredArtistId);
      if (ra) {
        featuredArtist = ra;
        featuredLabelId = label.id;
        featuredArtistName = ra.name;
        break;
      }
    }
  }

  if (!featuredArtist) return { newState: state, song: null, error: "Featured artist not found." };

  // ── Compute feature contribution ──
  const rel = getRelationshipScore(state, artistId, featuredArtistId);
  const genreScore = genreCompatScore(artist.genre, featuredArtist.genre);

  // Chemistry: relationship + genre + randomness
  const chemistry = clamp(
    50 + genreScore * 2 + Math.min(30, rel * 0.3) + rand(-15, 15),
    0, 100
  );

  // Feature verse quality: based on featured artist's skill + chemistry
  const featSkill = featuredArtist.overallRating * 0.6 + (featuredArtist.attributes?.charisma ?? 50) * 0.2
    + (featuredArtist.attributes?.versatility ?? 50) * 0.2;
  const contribution = clamp(
    Math.round(featSkill * 0.6 + chemistry * 0.3 + rand(-8, 8)),
    10, 100
  );

  // ── Song quality calculation (modified from recordSong) ──
  if (!isProducerUnlocked(producer, state)) {
    return { newState: state, song: null, error: `${producer.name} requires a higher Studio Level.` };
  }
  if (state.money < producer.costPerSong + fee) {
    return { newState: state, song: null, error: "Not enough money for producer + feature fee." };
  }
  if (artist.fatigue >= 90) return { newState: state, song: null, error: "Artist is too fatigued." };

  const studio = STUDIO_DATA[state.studioLevel];
  const genreBonus = artist.genre === producer.specialty ? 6 : 0;
  const studioBonus = studio.qualityBonusFlat;
  const variance = Math.round(10 * (1 - producer.consistency / 200));
  const baseQuality = artist.overallRating * 0.42 + producer.quality * 0.48 + genreBonus + studioBonus;

  // Feature quality modifier: contribution adds modest bonus, bad chemistry can hurt
  const featureQualityMod = chemistry >= 70
    ? contribution * 0.08  // good chemistry: up to +8 quality
    : chemistry >= 40
    ? contribution * 0.04  // decent chemistry: up to +4
    : contribution * 0.01 - 3; // poor chemistry: minimal boost, possible penalty

  const rawQuality = rand(Math.round(baseQuality) - variance, Math.round(baseQuality) + variance) + Math.round(featureQualityMod);
  const quality = clamp(rawQuality, 1, 100);

  // Feature commercial boost: star power of featured artist
  const featTier = getMarketTier(featuredArtist);
  const commercialBoost = TIER_RANK[featTier] * 3 + (chemistry >= 60 ? 5 : 0);

  const fansBonus = artist.fanbase > 100000 ? 10 : 0;
  const featFansBonus = featuredArtist.fanbase > 100000 ? 8 : featuredArtist.fanbase > 50000 ? 4 : 0;
  const hmBonus = Math.round(producer.hitmaking / 10);
  const viralPotential = clamp(
    rand(quality - 20 + studio.floorBonus, quality + 15 + studio.ceilBonus + hmBonus) + fansBonus + featFansBonus + commercialBoost,
    1, 100
  );

  // Auto-assign to album
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
    wasStandalone: !inProgressAlbum,
    featuredArtistId,
    featuredArtistName,
    featuredArtistLabelId: featuredLabelId,
    featureChemistry: chemistry,
    featureContribution: contribution,
  };

  const updatedAlbums = inProgressAlbum
    ? state.albums.map((al) =>
        al.id === inProgressAlbum.id
          ? { ...al, songIds: [...al.songIds, songId] }
          : al
      )
    : state.albums;

  // Fatigue
  const workEthicFactor = 1 - (artist.traits.workEthic / 250);
  const studioFatigueMult = state.studioLevel >= 9 ? 0.6 : state.studioLevel >= 7 ? 0.75 : state.studioLevel >= 5 ? 0.9 : 1.0;
  const fatigueGain = clamp(Math.floor(rand(4, 8) * workEthicFactor * studioFatigueMult), 2, 8);

  // Update artist fatigue + feature tracking
  const updatedArtists = state.artists.map((a) => {
    if (a.id === artistId) return { ...a, fatigue: clamp(a.fatigue + fatigueGain, 0, 100) };
    if (a.id === featuredArtistId) return { ...a, lastFeatureTurn: state.turn, featureCount: (a.featureCount ?? 0) + 1 };
    return a;
  });

  // Update rival label featured artist tracking
  const updatedRivalLabels = state.rivalLabels.map((label) => ({
    ...label,
    rosterArtists: label.rosterArtists.map((a) =>
      a.id === featuredArtistId
        ? { ...a, lastFeatureTurn: state.turn, featureCount: (a.featureCount ?? 0) + 1 }
        : a
    ),
  }));

  // Update relationship (collab builds relationship)
  const updatedRelationships = upsertRelationship(
    state.artistRelationships,
    artistId, featuredArtistId,
    rand(8, 15), // positive relationship boost
    1, // collab count
    state.turn
  );

  return {
    newState: {
      ...state,
      money: state.money - producer.costPerSong - fee,
      artists: updatedArtists,
      songs: [...state.songs, song],
      albums: updatedAlbums,
      rivalLabels: updatedRivalLabels,
      artistRelationships: updatedRelationships,
    },
    song,
  };
}

// ── Feature impact on song release ───────────────────────────────────────────
// Called from releaseSong to apply fan crossover and additional effects.

export function applyFeatureReleaseEffects(
  state: GameState,
  song: Song
): { artists: Artist[]; fanDelta: number; buzzDelta: number; relationships: ArtistRelationship[] } {
  if (!song.featuredArtistId || !song.featuredArtistName) {
    return { artists: state.artists, fanDelta: 0, buzzDelta: 0, relationships: state.artistRelationships };
  }

  const artist = state.artists.find((a) => a.id === song.artistId);
  const featuredArtist = state.artists.find((a) => a.id === song.featuredArtistId)
    ?? state.rivalLabels.flatMap((l) => l.rosterArtists).find((a) => a.id === song.featuredArtistId);

  if (!artist || !featuredArtist) {
    return { artists: state.artists, fanDelta: 0, buzzDelta: 0, relationships: state.artistRelationships };
  }

  const chemistry = song.featureChemistry ?? 50;
  const contribution = song.featureContribution ?? 50;
  const sameLabel = state.artists.some((a) => a.id === song.featuredArtistId && a.signed);
  const featTier = getMarketTier(featuredArtist);
  const reqTier = getMarketTier(artist);
  const gap = tierGap(reqTier, featTier);

  // ── Fan crossover: bigger artist exposes smaller artist to new fans ──
  let fanTransfer = 0;
  if (gap > 0 && song.quality >= 40) {
    // Base transfer: 1-5% of featured artist's fanbase
    const basePct = 0.01 + (chemistry / 100) * 0.04;
    fanTransfer = Math.floor(featuredArtist.fanbase * basePct);

    // Quality multiplier
    const qualMult = song.quality >= 70 ? 1.5 : song.quality >= 55 ? 1.2 : 0.8;
    fanTransfer = Math.round(fanTransfer * qualMult);

    // Same-label co-sign bonus: strongest development tool
    if (sameLabel) fanTransfer = Math.round(fanTransfer * 1.5);

    // Cap at 15% of featured artist's fanbase to prevent instant superstar
    fanTransfer = Math.min(fanTransfer, Math.floor(featuredArtist.fanbase * 0.15));
    // Floor at 500 fans minimum for any collab
    fanTransfer = Math.max(500, fanTransfer);
  }

  // ── Buzz boost from the feature ──
  const buzzBoost = clamp(
    Math.round(TIER_RANK[featTier] * 3 + chemistry * 0.1 + (song.quality >= 60 ? 5 : 0)),
    2, 20
  );

  // ── Update requesting artist (fan gain, buzz, momentum) ──
  const updatedArtists = state.artists.map((a) => {
    if (a.id === song.artistId) {
      return {
        ...a,
        fanbase: a.fanbase + fanTransfer,
        buzz: clamp((a.buzz ?? 30) + buzzBoost, 0, 100),
        momentum: clamp((a.momentum ?? 30) + (song.quality >= 60 ? rand(2, 5) : rand(0, 2)), 0, 100),
      };
    }
    // Featured artist on player roster also gets modest buzz
    if (a.id === song.featuredArtistId) {
      return {
        ...a,
        buzz: clamp((a.buzz ?? 30) + Math.floor(buzzBoost * 0.5), 0, 100),
        fanbase: a.fanbase + Math.floor(fanTransfer * 0.3), // reciprocal but smaller
      };
    }
    return a;
  });

  // Boost relationship from successful release
  const songPerformanceBonus = song.quality >= 60 ? rand(3, 8) : rand(0, 3);
  const updatedRelationships = upsertRelationship(
    state.artistRelationships,
    song.artistId, song.featuredArtistId,
    songPerformanceBonus, 0, state.turn
  );

  return {
    artists: updatedArtists,
    fanDelta: fanTransfer,
    buzzDelta: buzzBoost,
    relationships: updatedRelationships,
  };
}

// ── Feature impact on chart scoring ──────────────────────────────────────────

export function featureChartBonus(song: Song, state: GameState): number {
  if (!song.featuredArtistId) return 0;

  const featuredArtist = state.artists.find((a) => a.id === song.featuredArtistId)
    ?? state.rivalLabels.flatMap((l) => l.rosterArtists).find((a) => a.id === song.featuredArtistId);
  if (!featuredArtist) return 0;

  const tier = getMarketTier(featuredArtist);
  const chemistry = song.featureChemistry ?? 50;

  // Star power chart boost (modest)
  const tierBonus = TIER_RANK[tier] * 2;
  // Chemistry-scaled contribution
  const chemBonus = chemistry >= 70 ? 5 : chemistry >= 50 ? 3 : 0;

  return tierBonus + chemBonus;
}

// ── Feature impact on chart longevity ────────────────────────────────────────

export function featureLongevityBonus(song: Song): number {
  if (!song.featuredArtistId) return 0;
  const chemistry = song.featureChemistry ?? 50;
  const contribution = song.featureContribution ?? 50;
  // Good features extend chart life slightly (0.95-1.15 multiplier on decay)
  if (chemistry >= 70 && contribution >= 60) return 0.15;
  if (chemistry >= 50) return 0.05;
  return 0;
}

// ── Incoming feature requests (from rival labels) ────────────────────────────

export function generateIncomingFeatureRequests(state: GameState): FeatureRequest[] {
  const requests: FeatureRequest[] = [];

  // Only generate if player has artists worth requesting
  const eligiblePlayerArtists = state.artists.filter((a) =>
    a.signed && !a.jailed && !a.onTour
    && (a.lastFeatureTurn ?? 0) === 0 || state.turn - (a.lastFeatureTurn ?? 0) >= 4
  );
  if (eligiblePlayerArtists.length === 0) return [];

  // Each rival label has a chance to request a feature
  for (const label of state.rivalLabels) {
    // Low chance per label per turn (~8%)
    if (Math.random() > 0.08) continue;

    // Pick a requesting artist from this label's roster
    const requesters = label.rosterArtists.filter((a) => !a.jailed && !a.onTour);
    if (requesters.length === 0) continue;
    const requester = requesters[Math.floor(Math.random() * requesters.length)];

    // Pick best target from player roster (prefer genre fit + tier match)
    const scored = eligiblePlayerArtists.map((target) => {
      const genreScore = genreCompatScore(requester.genre, target.genre);
      const tierDiff = Math.abs(tierGap(getMarketTier(requester), getMarketTier(target)));
      return {
        target,
        score: genreScore * 2 + (3 - tierDiff) * 5 + rand(-5, 5) + (target.buzz ?? 0) * 0.1,
      };
    }).sort((a, b) => b.score - a.score);

    const bestTarget = scored[0]?.target;
    if (!bestTarget) continue;

    const fee = computeFeatureFee(bestTarget, requester, state);
    const evalResult = evaluateFeatureAcceptance(state, requester, bestTarget, fee);

    requests.push({
      id: uid(),
      fromArtistId: requester.id,
      fromArtistName: requester.name,
      fromLabelId: label.id,
      fromLabelName: label.name,
      toArtistId: bestTarget.id,
      toArtistName: bestTarget.name,
      toLabelName: state.labelName,
      feeOffered: fee,
      turn: state.turn,
      genre: requester.genre,
      acceptChance: evalResult.chance,
      synergy: evalResult.synergy,
    });
  }

  // Cap at 2 requests per turn
  return requests.slice(0, 2);
}

// ── Accept an incoming feature request ───────────────────────────────────────

export function acceptFeatureRequest(
  state: GameState,
  requestId: string
): { newState: GameState; event: GameEvent | null; error?: string } {
  const request = state.pendingFeatureRequests.find((r) => r.id === requestId);
  if (!request) return { newState: state, event: null, error: "Request not found." };

  const playerArtist = state.artists.find((a) => a.id === request.toArtistId);
  if (!playerArtist) return { newState: state, event: null, error: "Artist not found." };
  if (playerArtist.jailed) return { newState: state, event: null, error: "Artist is incarcerated." };
  if (playerArtist.onTour) return { newState: state, event: null, error: "Artist is on tour." };

  // Find requesting artist
  const requestingArtist = state.rivalLabels
    .flatMap((l) => l.rosterArtists)
    .find((a) => a.id === request.fromArtistId);
  if (!requestingArtist) return { newState: state, event: null, error: "Requesting artist no longer available." };

  const chemistry = clamp(
    50 + genreCompatScore(playerArtist.genre, requestingArtist.genre) * 2
    + Math.min(30, getRelationshipScore(state, playerArtist.id, requestingArtist.id) * 0.3)
    + rand(-15, 15),
    0, 100
  );

  // Update feature tracking
  const updatedArtists = state.artists.map((a) =>
    a.id === playerArtist.id
      ? { ...a, lastFeatureTurn: state.turn, featureCount: (a.featureCount ?? 0) + 1 }
      : a
  );

  // Build relationship
  const updatedRelationships = upsertRelationship(
    state.artistRelationships,
    playerArtist.id, requestingArtist.id,
    rand(5, 12), 1, state.turn
  );

  // Buzz/exposure boost for player artist
  const featTier = getMarketTier(requestingArtist);
  const buzzGain = TIER_RANK[featTier] * 2 + (chemistry >= 60 ? 3 : 0);
  const fanGain = Math.floor(requestingArtist.fanbase * 0.005 * (chemistry / 100));

  const finalArtists = updatedArtists.map((a) =>
    a.id === playerArtist.id
      ? {
          ...a,
          buzz: clamp((a.buzz ?? 30) + buzzGain, 0, 100),
          fanbase: a.fanbase + Math.max(200, fanGain),
        }
      : a
  );

  const event: GameEvent = {
    id: uid(),
    turn: state.turn,
    type: "feature_collab",
    title: `${playerArtist.name} Featured on ${request.fromArtistName}'s Track`,
    description: `${playerArtist.name} was featured on a ${request.fromLabelName} release by ${request.fromArtistName}. Fee: $${request.feeOffered.toLocaleString()}. Chemistry: ${chemistry >= 70 ? "excellent" : chemistry >= 50 ? "solid" : "average"}.`,
    artistId: playerArtist.id,
    moneyDelta: request.feeOffered,
    reputationDelta: chemistry >= 70 ? 1 : 0,
    fanbaseDelta: Math.max(200, fanGain),
    buzzDelta: buzzGain,
    resolved: true,
  };

  // Remove from pending
  const updatedPending = state.pendingFeatureRequests.filter((r) => r.id !== requestId);

  return {
    newState: {
      ...state,
      money: state.money + request.feeOffered,
      artists: finalArtists,
      artistRelationships: updatedRelationships,
      pendingFeatureRequests: updatedPending,
    },
    event,
  };
}

// ── Decline a feature request ────────────────────────────────────────────────

export function declineFeatureRequest(
  state: GameState,
  requestId: string
): GameState {
  return {
    ...state,
    pendingFeatureRequests: state.pendingFeatureRequests.filter((r) => r.id !== requestId),
  };
}

// ── AI feature behavior (used during advanceTurn for rival labels) ───────────

export function simulateRivalFeatures(state: GameState): {
  industrySongs: (typeof state.industrySongs);
  rivalLabels: RivalLabel[];
  relationships: ArtistRelationship[];
  events: GameEvent[];
} {
  const events: GameEvent[] = [];
  let relationships = [...state.artistRelationships];
  const labels = state.rivalLabels.map((l) => ({
    ...l,
    rosterArtists: l.rosterArtists.map((a) => ({ ...a })),
  }));

  // ~5% chance per label per turn to produce a featured song
  for (const label of labels) {
    if (Math.random() > 0.05) continue;
    if (label.rosterArtists.length < 2) continue;

    // Strategy: use label star to boost developing artist
    const sorted = [...label.rosterArtists]
      .filter((a) => !a.jailed && !a.onTour)
      .sort((a, b) => (b.momentum ?? 0) + b.overallRating - ((a.momentum ?? 0) + a.overallRating));

    if (sorted.length < 2) continue;

    const star = sorted[0];
    const developing = sorted[sorted.length - 1];

    // Only bother if there's a meaningful tier gap
    const starTier = getMarketTier(star);
    const devTier = getMarketTier(developing);
    if (TIER_RANK[starTier] - TIER_RANK[devTier] < 1) continue;

    // Check beef
    const hasBeef = state.activeBeefs.some(
      (b) => (b.artist1Id === star.id && b.artist2Id === developing.id)
        || (b.artist1Id === developing.id && b.artist2Id === star.id)
    );
    if (hasBeef) continue;

    const chemistry = clamp(
      55 + genreCompatScore(star.genre, developing.genre) * 2 + rand(-10, 10),
      0, 100
    );

    // Update feature tracking
    for (const a of label.rosterArtists) {
      if (a.id === star.id) {
        a.lastFeatureTurn = state.turn;
        a.featureCount = (a.featureCount ?? 0) + 1;
      }
    }

    relationships = upsertRelationship(relationships, star.id, developing.id, rand(5, 10), 1, state.turn);

    events.push({
      id: uid(),
      turn: state.turn,
      type: "feature_collab",
      title: `${developing.name} ft. ${star.name}`,
      description: `${label.name} paired ${star.name} with developing artist ${developing.name} for a new collab.`,
      moneyDelta: 0,
      reputationDelta: 0,
      fanbaseDelta: 0,
      isRivalEvent: true,
      rivalLabelId: label.id,
      resolved: true,
    });
  }

  return {
    industrySongs: state.industrySongs,
    rivalLabels: labels,
    relationships,
    events,
  };
}

// ── Get all artists available for features ───────────────────────────────────

export function getAvailableFeatureArtists(state: GameState, requestingArtistId: string): {
  sameLabel: Artist[];
  rivalArtists: { artist: Artist; labelName: string; labelId: string }[];
} {
  const sameLabel = state.artists.filter((a) =>
    a.signed && a.id !== requestingArtistId && !a.jailed && !a.onTour
  );

  const rivalArtists: { artist: Artist; labelName: string; labelId: string }[] = [];
  for (const label of state.rivalLabels) {
    for (const a of label.rosterArtists) {
      if (!a.jailed && !a.onTour) {
        rivalArtists.push({ artist: a, labelName: label.name, labelId: label.id });
      }
    }
  }

  return { sameLabel, rivalArtists };
}

// ── Yearly reset ─────────────────────────────────────────────────────────────

export function resetYearlyFeatureCounts(artists: Artist[]): Artist[] {
  return artists.map((a) => ({ ...a, featureCount: 0 }));
}

// ── Relationship decay (called yearly) ───────────────────────────────────────

export function decayRelationships(relationships: ArtistRelationship[], turn: number): ArtistRelationship[] {
  return relationships
    .map((r) => {
      const turnsSinceCollab = turn - r.lastCollabTurn;
      // Slow decay for inactive relationships
      const decay = turnsSinceCollab > 52 ? 5 : turnsSinceCollab > 26 ? 2 : 0;
      return { ...r, score: clamp(r.score - decay, -100, 100) };
    })
    // Clean up dead relationships
    .filter((r) => Math.abs(r.score) > 1 || r.collabCount > 0);
}
