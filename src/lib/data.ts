import { Artist, ArtistAppearance, ArtistAttributes, Producer, Upgrade, Genre, GameState, MallItem, RivalLabel, RivalReleaseStrategy, CareerStage, ArtistArchetype, DurabilityType } from "./types";

// ── Name pools ───────────────────────────────────────────────────────────────

const NAME_PREFIXES = [
  "Lil", "Young", "Big", "DJ", "MC", "King", "Queen", "Bad", "Rich", "Dark",
  "Ice", "Gold", "Jet", "Sky", "Ace", "Rex", "Cash", "Sage", "Nix", "Zane",
  "Mox", "Kai", "Jay", "Blu", "Tee", "Von", "Kha", "Ro", "Sha", "Dub",
  "Tre", "Zo", "Ne", "Lo", "Cee",
];

const NAME_MONIKERS = [
  "Blaze", "Phantom", "Sovereign", "Echo", "Nova", "Vex", "Cipher", "Rogue", "Apex", "Flux",
  "Ghost", "Reign", "Slick", "Steele", "Prime", "Storm", "Frost", "Blade", "Cross", "Lyric",
  "Verse", "Vibes", "Wave", "Crest", "Crown", "Stone", "Banks", "Gates", "Styles", "Chase",
  "Kane", "Lane", "Vance", "Knox", "Pierce", "Quinn", "Rhodes", "Shaw", "Thorn", "Vale",
  "Miles", "Briggs", "Cole", "Daze", "Fenn", "Grime", "Haze", "Jinx", "Kade", "Layne",
  "Maze", "Noir", "Onyx", "Pace", "Quill", "Riff", "Sable", "Tusk", "Urge", "Volt",
];

// Solo-name artists (no prefix)
const SOLO_NAMES = [
  "Phantom", "Cipher", "Eclipse", "Vortex", "Mirage", "Abyss", "Zenith", "Obsidian",
  "Torque", "Nexus", "Fracture", "Specter", "Halo", "Ravage", "Crypt", "Surge",
  "Axiom", "Dusk", "Wraith", "Flux", "Scion", "Omen", "Pulsar", "Reverie", "Glyph",
];

const NAME_INITIALS = ["A.", "B.", "C.", "D.", "J.", "K.", "L.", "M.", "N.", "P.", "R.", "T.", "V.", "Z."];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Appearance palettes ───────────────────────────────────────────────────────

export const HAIR_COLORS = [
  "#111111", "#3d2b1f", "#6b4226", "#8b5e3c", "#c19a6b", "#d4a853",
  "#b22222", "#cc4444", "#ff6b35", "#9b9b9b", "#d8d8d8", "#ffffff",
  "#6b2d8b", "#2d6b8b", "#cc4488", "#2d8b44",
];

export const SKIN_TONES = [
  "#fde8d3", "#f5cba7", "#e8a87c", "#d4895a",
  "#c17a3a", "#a0622e", "#7d4a1e", "#5c3317",
];

export const SHIRT_COLORS = [
  "#e74c3c", "#c0392b", "#e67e22", "#f39c12", "#f1c40f",
  "#2ecc71", "#27ae60", "#1abc9c", "#3498db", "#2980b9",
  "#9b59b6", "#8e44ad", "#e91e8c", "#ffffff", "#95a5a6", "#2c3e50",
];

function randomAppearance(): ArtistAppearance {
  return {
    hairColor:  pick(HAIR_COLORS),
    skinTone:   pick(SKIN_TONES),
    shirtColor: pick(SHIRT_COLORS),
  };
}

// ── Attribute generation ──────────────────────────────────────────────────────

function clampAttr(v: number, cap = 100): number {
  return Math.max(1, Math.min(cap, v));
}

export function generateAttributes(base: number, cap = 100): ArtistAttributes {
  const g = () => clampAttr(Math.round(base + (Math.random() - 0.5) * 40), cap);
  return {
    lyricism: g(), wordplay: g(), storytelling: g(), creativity: g(), originality: g(),
    flow: g(), delivery: g(), technique: g(), micPresence: g(), versatility: g(),
    songwriting: g(), hookability: g(), beatSelection: g(), hitmaking: g(), charisma: g(),
  };
}

// Hip-hop weighted OVR — weights sum to 1.0
const OVR_WEIGHTS: Record<keyof ArtistAttributes, number> = {
  flow:         0.12,
  delivery:     0.10,
  hitmaking:    0.09,
  lyricism:     0.08,
  hookability:  0.08,
  micPresence:  0.07,
  wordplay:     0.06,
  technique:    0.06,
  songwriting:  0.06,
  storytelling: 0.05,
  creativity:   0.05,
  versatility:  0.05,
  beatSelection:0.05,
  originality:  0.04,
  charisma:     0.04,
};

export function computeOverall(attributes: ArtistAttributes): number {
  let weighted = 0;
  for (const key of Object.keys(OVR_WEIGHTS) as (keyof ArtistAttributes)[]) {
    weighted += attributes[key] * OVR_WEIGHTS[key];
  }
  return Math.round(weighted);
}

export function computePotential(ovr: number, age: number, baseOVR?: number): number {
  if (baseOVR !== undefined) {
    // New system: potential based on talent ceiling
    const ageGrowthFactor = Math.max(0, (28 - age) / 10);
    const potential = ovr + ageGrowthFactor * (baseOVR - ovr) * 0.8;
    return Math.min(99, Math.round(potential));
  }
  // Legacy fallback
  const raw = ovr + Math.max(0, (28 - age) / 10) * (99 - ovr) * 0.6;
  return Math.min(99, Math.round(raw));
}

// ── Studio ladder (10 stages) ─────────────────────────────────────────────────

export interface StudioStageData {
  qualityBonusFlat: number;     // flat additive bonus to song base quality (0–5)
  tokensPerWeek: number;        // bonus recording sessions generated each turn
  floorBonus: number;           // raises viralPotential lower bound
  ceilBonus: number;            // raises viralPotential upper bound
  weeklyOperatingCost: number;
  unlockCost: number;
  producerTierUnlocked: 0 | 1 | 2 | 3; // highest producer tier accessible
  rosterCap: number;            // max signed artists at this studio level
}

// Index = stage (0 = no studio, 1–10 = purchased stages)
export const STUDIO_DATA: StudioStageData[] = [
  { qualityBonusFlat: 0, tokensPerWeek: 0, floorBonus: 0,  ceilBonus: 0, weeklyOperatingCost: 0,     unlockCost: 0,      producerTierUnlocked: 0, rosterCap: 2 },
  { qualityBonusFlat: 1, tokensPerWeek: 0, floorBonus: 1,  ceilBonus: 0, weeklyOperatingCost: 210,   unlockCost: 12000,  producerTierUnlocked: 0, rosterCap: 3 },
  { qualityBonusFlat: 1, tokensPerWeek: 0, floorBonus: 2,  ceilBonus: 0, weeklyOperatingCost: 490,   unlockCost: 27000,  producerTierUnlocked: 0, rosterCap: 4 },
  { qualityBonusFlat: 2, tokensPerWeek: 1, floorBonus: 3,  ceilBonus: 1, weeklyOperatingCost: 2080,  unlockCost: 53000,  producerTierUnlocked: 0, rosterCap: 5 },
  { qualityBonusFlat: 2, tokensPerWeek: 1, floorBonus: 5,  ceilBonus: 2, weeklyOperatingCost: 3770,  unlockCost: 98000,  producerTierUnlocked: 1, rosterCap: 6 },
  { qualityBonusFlat: 3, tokensPerWeek: 2, floorBonus: 6,  ceilBonus: 3, weeklyOperatingCost: 7700,  unlockCost: 165000, producerTierUnlocked: 1, rosterCap: 8 },
  { qualityBonusFlat: 3, tokensPerWeek: 2, floorBonus: 7,  ceilBonus: 4, weeklyOperatingCost: 10800, unlockCost: 255000, producerTierUnlocked: 1, rosterCap: 9 },
  { qualityBonusFlat: 4, tokensPerWeek: 3, floorBonus: 8,  ceilBonus: 5, weeklyOperatingCost: 11200, unlockCost: 375000, producerTierUnlocked: 2, rosterCap: 11 },
  { qualityBonusFlat: 4, tokensPerWeek: 3, floorBonus: 9,  ceilBonus: 6, weeklyOperatingCost: 16500, unlockCost: 525000, producerTierUnlocked: 2, rosterCap: 12 },
  { qualityBonusFlat: 5, tokensPerWeek: 4, floorBonus: 10, ceilBonus: 7, weeklyOperatingCost: 22000, unlockCost: 720000, producerTierUnlocked: 3, rosterCap: 14 },
  { qualityBonusFlat: 5, tokensPerWeek: 4, floorBonus: 11, ceilBonus: 7, weeklyOperatingCost: 28500, unlockCost: 975000, producerTierUnlocked: 3, rosterCap: 15 },
];

// ── Scouting ladder (10 stages) ───────────────────────────────────────────────

export interface ScoutingStageData {
  visibilityPct: number;     // % of unsigned talent pool surfaced
  scoutedPct: number;        // % of visible artists fully scouted (stats revealed)
  weeklyOperatingCost: number;
  unlockCost: number;
  revealedTraits: string[];  // which hidden traits are unlocked for display
}

export const SCOUTING_DATA: ScoutingStageData[] = [
  { visibilityPct: 10,  scoutedPct: 20,  weeklyOperatingCost: 0,     unlockCost: 0,      revealedTraits: [] },
  { visibilityPct: 15,  scoutedPct: 30,  weeklyOperatingCost: 125,   unlockCost: 9000,   revealedTraits: [] },
  { visibilityPct: 22,  scoutedPct: 40,  weeklyOperatingCost: 325,   unlockCost: 23000,  revealedTraits: [] },
  { visibilityPct: 30,  scoutedPct: 50,  weeklyOperatingCost: 1240,  unlockCost: 42000,  revealedTraits: [] },
  { visibilityPct: 45,  scoutedPct: 60,  weeklyOperatingCost: 2080,  unlockCost: 75000,  revealedTraits: ["hitPotential"] },
  { visibilityPct: 60,  scoutedPct: 70,  weeklyOperatingCost: 4400,  unlockCost: 120000, revealedTraits: ["hitPotential", "workEthic"] },
  { visibilityPct: 70,  scoutedPct: 78,  weeklyOperatingCost: 6500,  unlockCost: 180000, revealedTraits: ["hitPotential", "workEthic", "genreFlexibility"] },
  { visibilityPct: 80,  scoutedPct: 85,  weeklyOperatingCost: 6800,  unlockCost: 263000, revealedTraits: ["hitPotential", "workEthic", "genreFlexibility", "controversyRisk"] },
  { visibilityPct: 88,  scoutedPct: 92,  weeklyOperatingCost: 9200,  unlockCost: 360000, revealedTraits: ["hitPotential", "workEthic", "genreFlexibility", "controversyRisk", "allTraits"] },
  { visibilityPct: 95,  scoutedPct: 97,  weeklyOperatingCost: 12500, unlockCost: 480000, revealedTraits: ["hitPotential", "workEthic", "genreFlexibility", "controversyRisk", "allTraits"] },
  { visibilityPct: 100, scoutedPct: 100, weeklyOperatingCost: 17400, unlockCost: 630000, revealedTraits: ["hitPotential", "workEthic", "genreFlexibility", "controversyRisk", "allTraits"] },
];

// Minimum studio level required per producer tier
export const PRODUCER_TIER_MIN_STUDIO: Record<0 | 1 | 2 | 3, number> = { 0: 0, 1: 4, 2: 7, 3: 9 };

// ── Artist Development ladder (10 stages) ─────────────────────────────────────

export interface ArtistDevStageData {
  name: string;
  improveProbBonus: number;   // added to improvement probability threshold (0–0.20)
  regressReduction: number;   // subtracted from regression probability (0–0.25)
  ageDeclineReduction: number;// fraction applied to age-based decline rate (0–0.35)
  weeklyOperatingCost: number;
  unlockCost: number;
}

export const ARTIST_DEV_DATA: ArtistDevStageData[] = [
  { name: "None",                          improveProbBonus: 0,    regressReduction: 0,    ageDeclineReduction: 0,    weeklyOperatingCost: 0,     unlockCost: 0 },
  { name: "Basic Artist Coaching",         improveProbBonus: 0,    regressReduction: 0.02, ageDeclineReduction: 0.03, weeklyOperatingCost: 325,   unlockCost: 15000 },
  { name: "Studio Mentorship Program",     improveProbBonus: 0.02, regressReduction: 0.03, ageDeclineReduction: 0.05, weeklyOperatingCost: 620,   unlockCost: 33000 },
  { name: "Songwriting Workshops",         improveProbBonus: 0.02, regressReduction: 0.05, ageDeclineReduction: 0.07, weeklyOperatingCost: 2080,  unlockCost: 60000 },
  { name: "Performance Coaching",          improveProbBonus: 0.04, regressReduction: 0.07, ageDeclineReduction: 0.10, weeklyOperatingCost: 3250,  unlockCost: 98000 },
  { name: "Creative Direction Team",       improveProbBonus: 0.07, regressReduction: 0.10, ageDeclineReduction: 0.14, weeklyOperatingCost: 6500,  unlockCost: 150000 },
  { name: "Elite Producer Mentorship",     improveProbBonus: 0.10, regressReduction: 0.14, ageDeclineReduction: 0.19, weeklyOperatingCost: 9700,  unlockCost: 218000 },
  { name: "Professional Song Camps",       improveProbBonus: 0.13, regressReduction: 0.17, ageDeclineReduction: 0.24, weeklyOperatingCost: 9800,  unlockCost: 300000 },
  { name: "Major Artist Dev Program",      improveProbBonus: 0.16, regressReduction: 0.20, ageDeclineReduction: 0.29, weeklyOperatingCost: 13500, unlockCost: 405000 },
  { name: "Superstar Coaching Network",    improveProbBonus: 0.18, regressReduction: 0.23, ageDeclineReduction: 0.32, weeklyOperatingCost: 16700, unlockCost: 540000 },
  { name: "Elite Artist Incubator",        improveProbBonus: 0.20, regressReduction: 0.25, ageDeclineReduction: 0.35, weeklyOperatingCost: 20500, unlockCost: 705000 },
];

// ── Touring Department ladder (10 stages) ─────────────────────────────────────

export interface TouringDeptStageData {
  name: string;
  revenueBonusPct: number;    // % boost to tour revenue per week
  fanBonusPct: number;        // % boost to fan growth per week on tour
  fatigueMitigation: number;  // fraction of tour fatigue removed (0 = none, 0.36 = 36% less)
  weeklyOperatingCost: number;
  unlockCost: number;
}

export const TOURING_DEPT_DATA: TouringDeptStageData[] = [
  { name: "None",                               revenueBonusPct: 0,  fanBonusPct: 0,  fatigueMitigation: 0,    weeklyOperatingCost: 0,     unlockCost: 0 },
  { name: "Small Booking Team",                 revenueBonusPct: 3,  fanBonusPct: 0,  fatigueMitigation: 0.04, weeklyOperatingCost: 245,   unlockCost: 14000 },
  { name: "Regional Promoters",                 revenueBonusPct: 6,  fanBonusPct: 2,  fatigueMitigation: 0.07, weeklyOperatingCost: 490,   unlockCost: 30000 },
  { name: "National Booking Network",           revenueBonusPct: 9,  fanBonusPct: 2,  fatigueMitigation: 0.11, weeklyOperatingCost: 1820,  unlockCost: 57000 },
  { name: "Professional Tour Managers",         revenueBonusPct: 12, fanBonusPct: 4,  fatigueMitigation: 0.15, weeklyOperatingCost: 2860,  unlockCost: 93000 },
  { name: "National Tour Coordination",         revenueBonusPct: 15, fanBonusPct: 4,  fatigueMitigation: 0.19, weeklyOperatingCost: 6000,  unlockCost: 143000 },
  { name: "Global Promoter Partnerships",       revenueBonusPct: 18, fanBonusPct: 6,  fatigueMitigation: 0.23, weeklyOperatingCost: 8600,  unlockCost: 210000 },
  { name: "Elite Touring Logistics",            revenueBonusPct: 21, fanBonusPct: 6,  fatigueMitigation: 0.27, weeklyOperatingCost: 9000,  unlockCost: 293000 },
  { name: "International Tour Infrastructure",  revenueBonusPct: 24, fanBonusPct: 8,  fatigueMitigation: 0.30, weeklyOperatingCost: 12000, unlockCost: 398000 },
  { name: "Global Touring Network",             revenueBonusPct: 27, fanBonusPct: 8,  fatigueMitigation: 0.33, weeklyOperatingCost: 16000, unlockCost: 525000 },
  { name: "World-Class Touring Machine",        revenueBonusPct: 30, fanBonusPct: 10, fatigueMitigation: 0.36, weeklyOperatingCost: 21000, unlockCost: 675000 },
];

// ── Marketing Department ladder (10 stages) ───────────────────────────────────

export interface MarketingStageData {
  name: string;
  revenuePct: number;       // % boost to all streaming revenue
  fanGrowthPct: number;     // % boost to fan growth on releases
  weeklyOperatingCost: number;
  unlockCost: number;
}

export const MARKETING_DATA: MarketingStageData[] = [
  { name: "None",                        revenuePct: 0,  fanGrowthPct: 0,  weeklyOperatingCost: 0,     unlockCost: 0 },
  { name: "Basic Online Promotion",      revenuePct: 3,  fanGrowthPct: 2,  weeklyOperatingCost: 165,   unlockCost: 11000 },
  { name: "Social Media Team",           revenuePct: 6,  fanGrowthPct: 4,  weeklyOperatingCost: 370,   unlockCost: 24000 },
  { name: "Digital Ad Campaigns",        revenuePct: 9,  fanGrowthPct: 6,  weeklyOperatingCost: 1300,  unlockCost: 45000 },
  { name: "Influencer Outreach",         revenuePct: 12, fanGrowthPct: 8,  weeklyOperatingCost: 2150,  unlockCost: 75000 },
  { name: "Regional Campaign Network",   revenuePct: 15, fanGrowthPct: 10, weeklyOperatingCost: 4400,  unlockCost: 117000 },
  { name: "National Marketing Division", revenuePct: 18, fanGrowthPct: 12, weeklyOperatingCost: 6200,  unlockCost: 173000 },
  { name: "Playlist Promotion Team",     revenuePct: 21, fanGrowthPct: 14, weeklyOperatingCost: 6000,  unlockCost: 248000 },
  { name: "Global Digital Strategy",     revenuePct: 24, fanGrowthPct: 16, weeklyOperatingCost: 7800,  unlockCost: 338000 },
  { name: "Elite Industry Promotion",    revenuePct: 27, fanGrowthPct: 18, weeklyOperatingCost: 10100, unlockCost: 450000 },
  { name: "Global Marketing Machine",    revenuePct: 30, fanGrowthPct: 20, weeklyOperatingCost: 13200, unlockCost: 585000 },
];

// ── PR Department ladder (10 stages) ─────────────────────────────────────────

export interface PRStageData {
  name: string;
  scandalFreqReduction: number;   // fraction by which scandal chance is reduced (0–0.27)
  scandalDamageReduction: number; // fraction by which scandal damage is reduced (0–0.48)
  weeklyOperatingCost: number;
  unlockCost: number;
}

export const PR_DATA: PRStageData[] = [
  { name: "None",                          scandalFreqReduction: 0,    scandalDamageReduction: 0,    weeklyOperatingCost: 0,     unlockCost: 0 },
  { name: "Basic Press Handling",          scandalFreqReduction: 0,    scandalDamageReduction: 0.05, weeklyOperatingCost: 200,   unlockCost: 12000 },
  { name: "Reputation Monitoring",         scandalFreqReduction: 0.03, scandalDamageReduction: 0.08, weeklyOperatingCost: 405,   unlockCost: 27000 },
  { name: "Social Media Response Team",    scandalFreqReduction: 0.05, scandalDamageReduction: 0.12, weeklyOperatingCost: 1500,  unlockCost: 48000 },
  { name: "Crisis Response Unit",          scandalFreqReduction: 0.08, scandalDamageReduction: 0.18, weeklyOperatingCost: 2280,  unlockCost: 83000 },
  { name: "Media Relationship Management", scandalFreqReduction: 0.11, scandalDamageReduction: 0.23, weeklyOperatingCost: 4600,  unlockCost: 128000 },
  { name: "Legal and PR Advisors",         scandalFreqReduction: 0.14, scandalDamageReduction: 0.28, weeklyOperatingCost: 6500,  unlockCost: 188000 },
  { name: "Celebrity Image Consultants",   scandalFreqReduction: 0.18, scandalDamageReduction: 0.34, weeklyOperatingCost: 6400,  unlockCost: 263000 },
  { name: "National PR Firm",              scandalFreqReduction: 0.21, scandalDamageReduction: 0.39, weeklyOperatingCost: 8400,  unlockCost: 360000 },
  { name: "Elite Crisis Management",       scandalFreqReduction: 0.24, scandalDamageReduction: 0.44, weeklyOperatingCost: 11100, unlockCost: 480000 },
  { name: "Global PR Powerhouse",          scandalFreqReduction: 0.27, scandalDamageReduction: 0.48, weeklyOperatingCost: 14600, unlockCost: 630000 },
];

// ── Merchandising Department ladder (10 stages) ───────────────────────────────

export interface MerchStageData {
  name: string;
  revenuePerFan: number;    // $ earned per fan per turn (dynamic, scales with fanbase)
  weeklyOperatingCost: number;
  unlockCost: number;
}

export const MERCH_DATA: MerchStageData[] = [
  { name: "None",                           revenuePerFan: 0,     weeklyOperatingCost: 0,    unlockCost: 0 },
  { name: "Basic Online Merch Store",       revenuePerFan: 0.008, weeklyOperatingCost: 65,   unlockCost: 8000 },
  { name: "Expanded Product Line",          revenuePerFan: 0.012, weeklyOperatingCost: 130,  unlockCost: 18000 },
  { name: "Tour Merch Integration",         revenuePerFan: 0.016, weeklyOperatingCost: 460,  unlockCost: 33000 },
  { name: "Official Brand Store",           revenuePerFan: 0.020, weeklyOperatingCost: 650,  unlockCost: 57000 },
  { name: "Limited Edition Drops",          revenuePerFan: 0.025, weeklyOperatingCost: 980,  unlockCost: 90000 },
  { name: "Streetwear Collaborations",      revenuePerFan: 0.030, weeklyOperatingCost: 1300, unlockCost: 135000 },
  { name: "Major Brand Partnerships",       revenuePerFan: 0.035, weeklyOperatingCost: 1270, unlockCost: 195000 },
  { name: "Global Distribution",            revenuePerFan: 0.040, weeklyOperatingCost: 1540, unlockCost: 270000 },
  { name: "Premium Merchandising Division", revenuePerFan: 0.046, weeklyOperatingCost: 2030, unlockCost: 360000 },
  { name: "Cultural Brand Empire",          revenuePerFan: 0.052, weeklyOperatingCost: 2700, unlockCost: 473000 },
];

function generateArtistName(): string {
  const pattern = Math.random();
  if (pattern < 0.50) {
    // Most common: Prefix + Moniker  e.g. "Lil Knox"
    return `${pick(NAME_PREFIXES)} ${pick(NAME_MONIKERS)}`;
  } else if (pattern < 0.70) {
    // Solo name: e.g. "Phantom"
    return pick(SOLO_NAMES);
  } else if (pattern < 0.85) {
    // Prefix + Initial + Moniker: e.g. "Young J. Blaze"
    return `${pick(NAME_PREFIXES)} ${pick(NAME_INITIALS)} ${pick(NAME_MONIKERS)}`;
  } else {
    // Two monikers: e.g. "Frost Kane"
    const m1 = pick(NAME_MONIKERS);
    let m2 = pick(NAME_MONIKERS);
    while (m2 === m1) m2 = pick(NAME_MONIKERS);
    return `${m1} ${m2}`;
  }
}

const GENRES: Genre[] = ["trap", "boom-bap", "drill", "r-and-b", "pop-rap", "experimental"];

const PERSONAS = [
  "The Hustler", "The Poet", "The Rebel", "The Showman", "The Ghost",
  "The Legend", "The Prodigy", "The Enigma", "The Titan", "The Visionary",
  "The Grinder", "The Maverick", "The Oracle", "The Wildcard", "The Architect",
];

// ═══════════════════════════════════════════════════════════════════════════════
// ARCHETYPE-BASED ARTIST GENERATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
//
// Each artist is generated from an ARCHETYPE that determines:
// - Age range, OVR range, potential range
// - Starting career stage, momentum, buzz
// - Progression volatility and likely arc
// - Signability expectations
//
// Archetypes are DYNAMIC — they can change after yearly progression.
// Career stages are SEPARATE from archetype and track where they currently are.
// ═══════════════════════════════════════════════════════════════════════════════

// ── Archetype definitions ─────────────────────────────────────────────────────

interface ArchetypeConfig {
  ageRange: [number, number];
  baseOVRRange: [number, number];     // talent ceiling range
  currentOVRPct: [number, number];    // how developed (% of ceiling)
  potentialBonus: [number, number];   // potential = OVR + bonus (clamped by age)
  momentumRange: [number, number];
  buzzRange: [number, number];
  durabilityWeights: { flash: number; solid: number; durable: number };
  volatility: number;                 // 0-1: how much variance in progression
  defaultStage: CareerStage;
  ovrPenalty?: [number, number];      // optional OVR reduction (dropped/washed)
}

const ARCHETYPE_CONFIGS: Record<ArtistArchetype, ArchetypeConfig> = {
  raw_young_prospect: {
    ageRange: [16, 21],
    baseOVRRange: [35, 82],
    currentOVRPct: [0.30, 0.60],
    potentialBonus: [15, 35],
    momentumRange: [3, 20],
    buzzRange: [2, 12],
    durabilityWeights: { flash: 0.40, solid: 0.40, durable: 0.20 },
    volatility: 0.8,
    defaultStage: "unknown",
  },
  buzzing_underground: {
    ageRange: [18, 26],
    baseOVRRange: [45, 78],
    currentOVRPct: [0.55, 0.80],
    potentialBonus: [8, 22],
    momentumRange: [18, 45],
    buzzRange: [12, 35],
    durabilityWeights: { flash: 0.35, solid: 0.45, durable: 0.20 },
    volatility: 0.5,
    defaultStage: "buzzing",
  },
  viral_wildcard: {
    ageRange: [18, 28],
    baseOVRRange: [35, 75],
    currentOVRPct: [0.50, 0.80],
    potentialBonus: [5, 25],
    momentumRange: [30, 65],
    buzzRange: [25, 60],
    durabilityWeights: { flash: 0.55, solid: 0.35, durable: 0.10 },
    volatility: 0.9,
    defaultStage: "buzzing",
  },
  polished_midtier: {
    ageRange: [24, 32],
    baseOVRRange: [52, 74],
    currentOVRPct: [0.75, 0.95],
    potentialBonus: [3, 12],
    momentumRange: [15, 35],
    buzzRange: [8, 25],
    durabilityWeights: { flash: 0.25, solid: 0.50, durable: 0.25 },
    volatility: 0.3,
    defaultStage: "established",
  },
  aging_veteran: {
    ageRange: [30, 40],
    baseOVRRange: [55, 82],
    currentOVRPct: [0.80, 1.00],
    potentialBonus: [0, 5],
    momentumRange: [8, 30],
    buzzRange: [5, 20],
    durabilityWeights: { flash: 0.20, solid: 0.45, durable: 0.35 },
    volatility: 0.2,
    defaultStage: "declining",
    ovrPenalty: [0, 8],
  },
  stalled_washed: {
    ageRange: [24, 36],
    baseOVRRange: [38, 68],
    currentOVRPct: [0.60, 0.85],
    potentialBonus: [0, 8],
    momentumRange: [2, 12],
    buzzRange: [2, 10],
    durabilityWeights: { flash: 0.50, solid: 0.35, durable: 0.15 },
    volatility: 0.4,
    defaultStage: "washed",
    ovrPenalty: [3, 12],
  },
  generational_prospect: {
    ageRange: [16, 23],
    baseOVRRange: [78, 99],
    currentOVRPct: [0.35, 0.65],
    potentialBonus: [20, 40],
    momentumRange: [5, 30],
    buzzRange: [3, 20],
    durabilityWeights: { flash: 0.15, solid: 0.40, durable: 0.45 },
    volatility: 0.6,
    defaultStage: "unknown",
  },
};

// ── Pool distribution: what % of the 400 are each archetype ───────────────

const POOL_DISTRIBUTION: { archetype: ArtistArchetype; weight: number }[] = [
  { archetype: "raw_young_prospect",   weight: 0.35 },
  { archetype: "buzzing_underground",  weight: 0.20 },
  { archetype: "viral_wildcard",       weight: 0.15 },
  { archetype: "polished_midtier",     weight: 0.15 },
  { archetype: "stalled_washed",       weight: 0.08 },
  { archetype: "aging_veteran",        weight: 0.06 },
  { archetype: "generational_prospect",weight: 0.01 },
];

function rollArchetype(): ArtistArchetype {
  const roll = Math.random();
  let cumulative = 0;
  for (const { archetype, weight } of POOL_DISTRIBUTION) {
    cumulative += weight;
    if (roll < cumulative) return archetype;
  }
  return "raw_young_prospect";
}

function rollDurability(weights: { flash: number; solid: number; durable: number }): DurabilityType {
  const roll = Math.random();
  if (roll < weights.flash) return "flash";
  if (roll < weights.flash + weights.solid) return "solid";
  return "durable";
}

function randRange(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ── Career stage assignment based on archetype + stats ─────────────────────

function assignCareerStage(
  archetype: ArtistArchetype,
  age: number,
  ovr: number,
  momentum: number,
  buzz: number,
): CareerStage {
  // Archetype-driven defaults with stat overrides
  switch (archetype) {
    case "generational_prospect":
      if (buzz >= 30 || momentum >= 35) return "buzzing";
      if (momentum >= 15) return "emerging";
      return "unknown";

    case "raw_young_prospect":
      if (buzz >= 25 || momentum >= 30) return "buzzing";
      if (momentum >= 12 || ovr >= 50) return "emerging";
      return "unknown";

    case "buzzing_underground":
      if (momentum >= 40 && ovr >= 60) return "breakout";
      if (momentum >= 20) return "buzzing";
      return "emerging";

    case "viral_wildcard":
      if (momentum >= 50 && buzz >= 40) return "breakout";
      if (momentum >= 25) return "buzzing";
      return "emerging";

    case "polished_midtier":
      if (ovr >= 70 && momentum >= 35) return "peak";
      if (ovr >= 60) return "established";
      return "buzzing";

    case "aging_veteran":
      if (ovr >= 75 && momentum >= 30) return "peak";
      if (ovr >= 65 && momentum >= 20) return "established";
      if (momentum < 10) return "declining";
      return "established";

    case "stalled_washed":
      if (momentum < 8) return "washed";
      if (momentum < 15) return "declining";
      return "established";
  }
}

// ── Dynamic potential: compresses toward OVR as artists age/decline ────────

export function computeDynamicPotential(
  ovr: number,
  age: number,
  baseOVR: number,
  archetype: ArtistArchetype,
  careerStage: CareerStage,
): number {
  // Young + developing: potential well above current
  if (age <= 22) {
    const growthFactor = Math.max(0, (24 - age) / 8); // 1.0 at 16, 0.25 at 22
    const ceiling = Math.min(99, baseOVR);
    const pot = ovr + growthFactor * (ceiling - ovr) * 0.8;
    return Math.min(99, Math.max(ovr, Math.round(pot)));
  }

  // Mid-development: potential narrows toward ceiling
  if (age <= 27) {
    const growthFactor = Math.max(0, (28 - age) / 10);
    const ceiling = Math.min(99, baseOVR);
    const pot = ovr + growthFactor * (ceiling - ovr) * 0.6;
    return Math.min(99, Math.max(ovr, Math.round(pot)));
  }

  // Peak years: potential very close to current
  if (age <= 32) {
    const buffer = careerStage === "peak" ? 3
                 : careerStage === "established" ? 2
                 : 1;
    return Math.min(99, Math.max(ovr, ovr + buffer));
  }

  // Post-peak: potential compresses to OVR or just below
  if (careerStage === "legacy" || careerStage === "declining" || careerStage === "washed") {
    return ovr; // no upside left
  }

  // Rare veteran still producing: tiny buffer
  return Math.min(99, Math.max(ovr, ovr + 1));
}

// ── OVR cap for free agents (realism: why are they unsigned?) ─────────────

function getFreeAgentOVRCap(age: number, archetype: ArtistArchetype): number {
  // Generational prospects can be any OVR — they're just that rare
  if (archetype === "generational_prospect") return 99;
  // Aging veterans and dropped/troubled can be higher — they WERE signed
  if (archetype === "aging_veteran") return age <= 35 ? 82 : 70;
  // Viral wildcards — their buzz explains their visibility despite low OVR
  if (archetype === "viral_wildcard") return 75;

  const baseCap =
    age <= 19 ? 99 :
    age <= 21 ? 75 :
    age <= 24 ? 65 :
    age <= 27 ? 58 :
    age <= 30 ? 52 :
    45;

  if (archetype === "buzzing_underground") return baseCap + 10;
  if (archetype === "stalled_washed") return baseCap + 5;
  return baseCap;
}

// ── Trait generation by archetype ─────────────────────────────────────────

type ArtistTraitsInput = { loyalty: number; workEthic: number; moneyMotivation: number; competitiveness: number; fameMotivation: number; controversyRisk: number };

function generateTraits(archetype: ArtistArchetype): ArtistTraitsInput {
  // Base ranges
  const traits: ArtistTraitsInput = {
    loyalty:         randRange(35, 80),
    workEthic:       randRange(35, 80),
    moneyMotivation: randRange(20, 80),
    competitiveness: randRange(20, 80),
    fameMotivation:  randRange(20, 80),
    controversyRisk: randRange(10, 60),
  };

  // Archetype-specific adjustments
  switch (archetype) {
    case "raw_young_prospect":
      traits.fameMotivation = Math.min(100, traits.fameMotivation + randRange(5, 15));
      break;
    case "buzzing_underground":
      traits.workEthic = Math.max(traits.workEthic, randRange(55, 80));
      traits.competitiveness = Math.min(100, traits.competitiveness + randRange(5, 15));
      break;
    case "viral_wildcard":
      traits.fameMotivation = Math.min(100, traits.fameMotivation + randRange(10, 25));
      traits.controversyRisk = Math.min(100, traits.controversyRisk + randRange(10, 25));
      traits.loyalty = Math.max(10, traits.loyalty - randRange(5, 15));
      break;
    case "polished_midtier":
      traits.workEthic = Math.max(traits.workEthic, randRange(50, 75));
      traits.controversyRisk = Math.max(5, traits.controversyRisk - randRange(5, 15));
      break;
    case "aging_veteran":
      traits.loyalty = Math.min(100, traits.loyalty + randRange(5, 20));
      traits.moneyMotivation = Math.min(100, traits.moneyMotivation + randRange(5, 15));
      traits.controversyRisk = Math.max(5, traits.controversyRisk - randRange(5, 15));
      break;
    case "stalled_washed":
      traits.workEthic = Math.max(10, traits.workEthic - randRange(5, 20));
      traits.moneyMotivation = Math.min(100, traits.moneyMotivation + randRange(10, 20));
      break;
    case "generational_prospect":
      traits.competitiveness = Math.max(traits.competitiveness, randRange(60, 85));
      traits.workEthic = Math.max(traits.workEthic, randRange(55, 80));
      break;
  }

  return traits;
}

// ── Master artist generation ──────────────────────────────────────────────

export function generateArtist(id: string, signed = false): Artist {
  const genre = pick(GENRES);

  // Determine archetype
  const archetype: ArtistArchetype = signed
    ? (Math.random() < 0.03 ? "generational_prospect" : "raw_young_prospect")
    : rollArchetype();

  const config = ARCHETYPE_CONFIGS[archetype];

  // Age from archetype range
  const age = signed
    ? randRange(18, 21)
    : randRange(config.ageRange[0], config.ageRange[1]);

  const peakAge = randRange(26, 32);

  // Durability
  const durability = rollDurability(config.durabilityWeights);

  // Base OVR (talent ceiling)
  const baseOVR = randRange(config.baseOVRRange[0], config.baseOVRRange[1]);

  // Current OVR = base * development percentage
  const devPct = randFloat(config.currentOVRPct[0], config.currentOVRPct[1]);
  let currentOVR = Math.max(25, Math.round(baseOVR * devPct));

  // Apply OVR penalty for washed/veteran archetypes
  if (config.ovrPenalty) {
    currentOVR = Math.max(25, currentOVR - randRange(config.ovrPenalty[0], config.ovrPenalty[1]));
  }

  // Cap OVR for free agents (realism)
  if (!signed) {
    const cap = getFreeAgentOVRCap(age, archetype);
    currentOVR = Math.min(currentOVR, cap);
  }

  // Decline modifier for older artists
  if (age >= 32) {
    const declineYears = age - 31;
    const declineRate = durability === "flash" ? 0.035 : durability === "solid" ? 0.018 : 0.008;
    const declinePct = Math.max(0.60, 1.0 - declineYears * declineRate);
    currentOVR = Math.max(25, Math.round(currentOVR * declinePct));
  }

  // Traits
  const traits = generateTraits(archetype);

  // Momentum & buzz from archetype config
  let momentum = randRange(config.momentumRange[0], config.momentumRange[1]);
  let buzz = randRange(config.buzzRange[0], config.buzzRange[1]);

  // Signed artists get a boost (label gave them a platform)
  if (signed) {
    momentum = Math.min(100, momentum + randRange(10, 25));
    buzz = Math.min(100, buzz + randRange(5, 15));
  }

  // Viral wildcard: 15% chance of an extra viral spike
  if (archetype === "viral_wildcard" && Math.random() < 0.15) {
    momentum = Math.min(100, momentum + randRange(15, 30));
    buzz = Math.min(100, buzz + randRange(10, 25));
  }

  // Generate attributes around final OVR
  const attrCap = age <= 21 ? Math.min(100, 65 + Math.floor((currentOVR - 25) / 5)) : 100;
  const attributes = generateAttributes(currentOVR, attrCap);
  let overallRating = computeOverall(attributes);

  // Floor: minimum 25
  if (overallRating < 25) {
    const bump = 25 - overallRating;
    const keys = Object.keys(attributes) as (keyof ArtistAttributes)[];
    for (const k of keys) attributes[k] = Math.min(100, attributes[k] + bump);
    overallRating = computeOverall(attributes);
  }

  // Career stage
  const careerStage = assignCareerStage(archetype, age, overallRating, momentum, buzz);

  // Dynamic potential
  const potential = computeDynamicPotential(overallRating, age, baseOVR, archetype, careerStage);

  // Popularity & fanbase scaled by archetype
  let basePopularity: number;
  let baseFanbase: number;

  switch (archetype) {
    case "aging_veteran":
      basePopularity = 15 + randRange(0, 25) + Math.floor(overallRating * 0.15);
      baseFanbase = 10000 + randRange(0, 60000) + overallRating * 500;
      break;
    case "viral_wildcard":
      basePopularity = 10 + randRange(0, 25) + Math.floor(buzz * 0.4);
      baseFanbase = 3000 + randRange(0, 40000) + Math.floor(buzz * 800);
      break;
    case "buzzing_underground":
      basePopularity = 8 + randRange(0, 18) + Math.floor(buzz * 0.25);
      baseFanbase = 2000 + randRange(0, 25000) + overallRating * 200;
      break;
    case "polished_midtier":
      basePopularity = 12 + randRange(0, 20) + Math.floor(overallRating * 0.1);
      baseFanbase = 5000 + randRange(0, 35000) + overallRating * 300;
      break;
    case "stalled_washed":
      basePopularity = 5 + randRange(0, 15);
      baseFanbase = 1000 + randRange(0, 15000);
      break;
    case "generational_prospect":
      basePopularity = 3 + randRange(0, 15) + Math.floor(buzz * 0.3);
      baseFanbase = 500 + randRange(0, 15000);
      break;
    default: // raw_young_prospect
      basePopularity = 2 + randRange(0, 10);
      baseFanbase = 100 + randRange(0, 5000);
      break;
  }

  const moneyMotivation = traits.moneyMotivation;
  const competitiveness = traits.competitiveness;

  return {
    id,
    name: generateArtistName(),
    persona: pick(PERSONAS),
    genre,
    appearance: randomAppearance(),
    spriteIndex: Math.floor(Math.random() * 440),
    popularity: Math.min(100, basePopularity),
    fanbase: baseFanbase,
    attributes,
    overallRating,
    potential,
    age,
    peakAge,
    fatigue: 0,
    morale: 80,
    signed,
    contractAlbumsTotal: signed ? 1 : 0,
    contractAlbumsLeft: signed ? 1 : 0,
    onTour: false,
    tourTurnsLeft: 0,
    tourType: null,
    lastMajorTourTurn: 0,
    lastTourEndTurn: 0,
    lastAlbumReleaseTurn: 0,
    preferredAlbumLength: Math.round(10 + (moneyMotivation / 100) * 20),
    minSongQuality: Math.floor(overallRating * (0.50 + competitiveness / 200)),
    traits,
    // Career ecosystem
    archetype,
    careerPhase: careerStage,
    momentum,
    buzz,
    durability,
    peakMomentum: momentum,
    turnsAtLowMomentum: 0,
    totalSinglesReleased: 0,
    totalAlbumsReleased: 0,
    chartHits: 0,
    flops: 0,
    careerStartTurn: 0,
    // Yearly progression tracking
    yearlyReleasesQuality: [],
    yearlyChartsWeeks: 0,
    yearlyTourWeeks: 0,
    yearlyControversies: 0,
    lastProgressionTurn: 0,
    peakOverall: overallRating,
  };
}

// ── Producer Roster (50 producers across 4 studio tiers) ─────────────────────

type P = Omit<Producer, "available">;
function prod(p: P): Producer { return { ...p, available: true }; }

export const PRODUCER_ROSTER: Producer[] = [
  // ── Underground (studioTierRequired: 0) — studio level 0–3 ─────────────────
  prod({ id: "prod_lo_luke",     name: "Lo-Fi Luke",       specialty: "boom-bap",      quality: 42, hitmaking: 32, consistency: 55, popularity: 25, costPerSong: 3000,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_trap_k",      name: "TrapKing",          specialty: "trap",          quality: 45, hitmaking: 42, consistency: 45, popularity: 30, costPerSong: 4000,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_street_d",    name: "Street Drill",      specialty: "drill",         quality: 40, hitmaking: 38, consistency: 50, popularity: 22, costPerSong: 3500,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_vibes",       name: "Vibes Only",        specialty: "r-and-b",       quality: 38, hitmaking: 28, consistency: 60, popularity: 20, costPerSong: 3000,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_raw_wave",    name: "Raw Wave",          specialty: "experimental",  quality: 36, hitmaking: 44, consistency: 35, popularity: 18, costPerSong: 2500,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_gutter",      name: "Gutter Beats",      specialty: "trap",          quality: 48, hitmaking: 40, consistency: 40, popularity: 32, costPerSong: 4500,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_bloc",        name: "Bloc Boy Prod",     specialty: "drill",         quality: 44, hitmaking: 48, consistency: 42, popularity: 28, costPerSong: 4500,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_soul_steve",  name: "Soulful Steve",     specialty: "boom-bap",      quality: 48, hitmaking: 30, consistency: 65, popularity: 30, costPerSong: 4000,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_neon",        name: "Neon Nights",       specialty: "pop-rap",       quality: 40, hitmaking: 40, consistency: 48, popularity: 26, costPerSong: 3500,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_ug_oracle",   name: "Underground Oracle",specialty: "experimental",  quality: 50, hitmaking: 35, consistency: 55, popularity: 22, costPerSong: 5000,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_grimy",       name: "Grimy Fingers",     specialty: "trap",          quality: 35, hitmaking: 50, consistency: 30, popularity: 20, costPerSong: 3000,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_late_loops",  name: "Late Night Loops",  specialty: "r-and-b",       quality: 44, hitmaking: 32, consistency: 62, popularity: 28, costPerSong: 4000,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_pave_poet",   name: "Pavement Poet",     specialty: "boom-bap",      quality: 52, hitmaking: 38, consistency: 58, popularity: 35, costPerSong: 5000,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_city_snd",    name: "City Sounds",       specialty: "pop-rap",       quality: 42, hitmaking: 44, consistency: 44, popularity: 26, costPerSong: 3500,  tier: "underground", studioTierRequired: 0 }),
  prod({ id: "prod_hollow",      name: "Hollow Drums",      specialty: "drill",         quality: 38, hitmaking: 52, consistency: 32, popularity: 20, costPerSong: 3000,  tier: "underground", studioTierRequired: 0 }),

  // ── Budget Mid-Tier (studioTierRequired: 1) — affordable stepping stone ─────
  prod({ id: "prod_penny_drop",  name: "Penny Drop",        specialty: "trap",          quality: 53, hitmaking: 48, consistency: 58, popularity: 38, costPerSong: 7000,  tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_bare_min",    name: "Bare Minimum",      specialty: "boom-bap",      quality: 55, hitmaking: 45, consistency: 62, popularity: 35, costPerSong: 7500,  tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_cheap_thrills",name: "Cheap Thrills",    specialty: "pop-rap",       quality: 54, hitmaking: 52, consistency: 55, popularity: 40, costPerSong: 8000,  tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_budget_bars", name: "Budget Bars",       specialty: "drill",         quality: 56, hitmaking: 50, consistency: 56, popularity: 36, costPerSong: 8500,  tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_dime_piece",  name: "Dime Piece Beats",  specialty: "r-and-b",       quality: 58, hitmaking: 46, consistency: 64, popularity: 42, costPerSong: 9000,  tier: "mid-tier",    studioTierRequired: 1 }),

  // ── Mid-Tier (studioTierRequired: 1) — studio level 4–6 ────────────────────
  prod({ id: "prod_phantom",     name: "Phantom Beats",     specialty: "trap",          quality: 62, hitmaking: 58, consistency: 65, popularity: 55, costPerSong: 16000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_boom_d",      name: "Boom Dynasty",      specialty: "boom-bap",      quality: 65, hitmaking: 52, consistency: 72, popularity: 58, costPerSong: 18000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_nova",        name: "Nova Sound",        specialty: "pop-rap",       quality: 60, hitmaking: 62, consistency: 60, popularity: 52, costPerSong: 16000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_drill_cmd",   name: "Drill Commander",   specialty: "drill",         quality: 68, hitmaking: 60, consistency: 55, popularity: 60, costPerSong: 21000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_velvet",      name: "Velvet Chords",     specialty: "r-and-b",       quality: 58, hitmaking: 55, consistency: 70, popularity: 50, costPerSong: 14000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_rage_fac",    name: "Rage Factory",      specialty: "experimental",  quality: 55, hitmaking: 68, consistency: 48, popularity: 50, costPerSong: 9000,  tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_craftsman",   name: "The Craftsman",     specialty: "boom-bap",      quality: 64, hitmaking: 50, consistency: 75, popularity: 56, costPerSong: 20000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_midnight_v",  name: "Midnight Vendor",   specialty: "pop-rap",       quality: 60, hitmaking: 65, consistency: 58, popularity: 54, costPerSong: 17000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_freq_lab",    name: "Frequency Lab",     specialty: "experimental",  quality: 63, hitmaking: 58, consistency: 62, popularity: 52, costPerSong: 18000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_grid_iron",   name: "Grid Iron Beats",   specialty: "trap",          quality: 66, hitmaking: 60, consistency: 65, popularity: 58, costPerSong: 20000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_street_sym",  name: "Street Symphony",   specialty: "drill",         quality: 58, hitmaking: 62, consistency: 52, popularity: 50, costPerSong: 15000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_echo_ch",     name: "Echo Chamber",      specialty: "r-and-b",       quality: 62, hitmaking: 60, consistency: 68, popularity: 55, costPerSong: 18000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_golden_era",  name: "Golden Era",        specialty: "boom-bap",      quality: 68, hitmaking: 48, consistency: 78, popularity: 62, costPerSong: 23000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_pop_arch",    name: "Pop Architect",     specialty: "pop-rap",       quality: 64, hitmaking: 66, consistency: 60, popularity: 58, costPerSong: 21000, tier: "mid-tier",    studioTierRequired: 1 }),
  prod({ id: "prod_cross_genre", name: "Cross Genre Co.",   specialty: "r-and-b",       quality: 62, hitmaking: 58, consistency: 65, popularity: 55, costPerSong: 18000, tier: "mid-tier",    studioTierRequired: 1 }),

  // ── High-Tier (studioTierRequired: 2) — studio level 7–8 ───────────────────
  prod({ id: "prod_apex",        name: "Apex Producer",     specialty: "experimental",  quality: 80, hitmaking: 75, consistency: 78, popularity: 72, costPerSong: 65000, tier: "mid-tier",    studioTierRequired: 2 }),
  prod({ id: "prod_vortex",      name: "Vortex Sound",      specialty: "trap",          quality: 78, hitmaking: 80, consistency: 72, popularity: 75, costPerSong: 70000, tier: "mid-tier",    studioTierRequired: 2 }),
  prod({ id: "prod_legacy",      name: "Legacy Maker",      specialty: "boom-bap",      quality: 82, hitmaking: 68, consistency: 85, popularity: 70, costPerSong: 75000, tier: "mid-tier",    studioTierRequired: 2 }),
  prod({ id: "prod_drill_king",  name: "Drill King",        specialty: "drill",         quality: 76, hitmaking: 78, consistency: 70, popularity: 72, costPerSong: 68000, tier: "mid-tier",    studioTierRequired: 2 }),
  prod({ id: "prod_silk_road",   name: "Silk Road Beats",   specialty: "r-and-b",       quality: 80, hitmaking: 72, consistency: 80, popularity: 74, costPerSong: 72000, tier: "mid-tier",    studioTierRequired: 2 }),
  prod({ id: "prod_melodic_emp", name: "Melodic Empire",    specialty: "pop-rap",       quality: 75, hitmaking: 80, consistency: 75, popularity: 76, costPerSong: 70000, tier: "mid-tier",    studioTierRequired: 2 }),
  prod({ id: "prod_chart_asn",   name: "Chart Assassin",    specialty: "pop-rap",       quality: 78, hitmaking: 82, consistency: 72, popularity: 78, costPerSong: 75000, tier: "mid-tier",    studioTierRequired: 2 }),
  prod({ id: "prod_rage_lord",   name: "Rage Lord",         specialty: "experimental",  quality: 72, hitmaking: 85, consistency: 65, popularity: 70, costPerSong: 65000, tier: "mid-tier",    studioTierRequired: 2 }),
  prod({ id: "prod_stu_surg",    name: "Studio Surgeon",    specialty: "boom-bap",      quality: 82, hitmaking: 70, consistency: 88, popularity: 75, costPerSong: 80000, tier: "mid-tier",    studioTierRequired: 2 }),
  prod({ id: "prod_freq_god",    name: "Frequency God",     specialty: "experimental",  quality: 80, hitmaking: 78, consistency: 76, popularity: 74, costPerSong: 78000, tier: "mid-tier",    studioTierRequired: 2 }),
  prod({ id: "prod_trap_mae",    name: "Trap Maestro",      specialty: "trap",          quality: 80, hitmaking: 78, consistency: 74, popularity: 76, costPerSong: 75000, tier: "mid-tier",    studioTierRequired: 2 }),
  prod({ id: "prod_smooth_op",   name: "Smooth Operator",   specialty: "r-and-b",       quality: 78, hitmaking: 72, consistency: 82, popularity: 72, costPerSong: 72000, tier: "mid-tier",    studioTierRequired: 2 }),

  // ── Elite (studioTierRequired: 3) — studio level 9–10 ──────────────────────
  prod({ id: "prod_metro",       name: "Metro Sound",       specialty: "trap",          quality: 88, hitmaking: 88, consistency: 82, popularity: 85, costPerSong: 110000, tier: "elite",      studioTierRequired: 3 }),
  prod({ id: "prod_crown",       name: "Crown Beats",       specialty: "r-and-b",       quality: 90, hitmaking: 82, consistency: 88, popularity: 82, costPerSong: 120000, tier: "elite",      studioTierRequired: 3 }),
  prod({ id: "prod_legend",      name: "Legend Maker",      specialty: "pop-rap",       quality: 92, hitmaking: 90, consistency: 80, popularity: 88, costPerSong: 130000, tier: "elite",      studioTierRequired: 3 }),
  prod({ id: "prod_architect",   name: "The Architect",     specialty: "boom-bap",      quality: 88, hitmaking: 78, consistency: 92, popularity: 82, costPerSong: 115000, tier: "elite",      studioTierRequired: 3 }),
  prod({ id: "prod_limitless",   name: "Limitless Lab",     specialty: "experimental",  quality: 85, hitmaking: 92, consistency: 78, popularity: 84, costPerSong: 105000, tier: "elite",      studioTierRequired: 3 }),
  prod({ id: "prod_diamond_d",   name: "Diamond Drill",     specialty: "drill",         quality: 88, hitmaking: 88, consistency: 80, popularity: 85, costPerSong: 120000, tier: "elite",      studioTierRequired: 3 }),
  prod({ id: "prod_plat_proph",  name: "Platinum Prophet",  specialty: "pop-rap",       quality: 90, hitmaking: 88, consistency: 85, popularity: 88, costPerSong: 125000, tier: "elite",      studioTierRequired: 3 }),
  prod({ id: "prod_hitmaker_s",  name: "Hitmaker Supreme",  specialty: "trap",          quality: 95, hitmaking: 96, consistency: 85, popularity: 95, costPerSong: 150000, tier: "elite",      studioTierRequired: 3 }),
];

export function isProducerUnlocked(producer: Producer, state: Pick<GameState, "studioLevel">): boolean {
  return state.studioLevel >= PRODUCER_TIER_MIN_STUDIO[producer.studioTierRequired];
}

// No standalone one-time upgrades currently — all systems use 10-stage ladders
export const INITIAL_UPGRADES: Upgrade[] = [];

export const SONG_TITLE_PARTS = {
  prefixes: ["Dark", "Golden", "Cold", "Neon", "Broken", "Silent", "Burning", "Lost", "Raw", "Faded"],
  nouns: ["Nights", "Dreams", "Rage", "Throne", "Crown", "Flame", "Echo", "Ghost", "Wave", "Storm"],
};

export function generateSongTitle(): string {
  const p = SONG_TITLE_PARTS.prefixes;
  const n = SONG_TITLE_PARTS.nouns;
  return `${p[Math.floor(Math.random() * p.length)]} ${n[Math.floor(Math.random() * n.length)]}`;
}

const ALBUM_ADJECTIVES = ["Dark", "Golden", "Cold", "Raw", "Lost", "Broken", "Silent", "Eternal", "Neon", "Sovereign"];
const ALBUM_NOUNS = ["Chapter", "Era", "Manifest", "Archive", "Collective", "Testament", "Opus", "Volume", "Legacy", "Protocol"];

export function generateAlbumTitle(): string {
  const adj = ALBUM_ADJECTIVES[Math.floor(Math.random() * ALBUM_ADJECTIVES.length)];
  const noun = ALBUM_NOUNS[Math.floor(Math.random() * ALBUM_NOUNS.length)];
  return `${adj} ${noun}`;
}

// ── Mall Catalog ──────────────────────────────────────────────────────────────

export const MALL_CATALOG: MallItem[] = [
  // Jewelry
  { id: "j1",  name: "Silver Chain",           category: "jewelry",      price: 2500,     icon: "⛓️",  description: "Clean everyday silver chain. Basic but fresh." },
  { id: "j2",  name: "Gold Rope Chain",         category: "jewelry",      price: 15000,    icon: "📿",  description: "Heavy gold Cuban rope chain. Statement piece." },
  { id: "j3",  name: "Diamond Pendant",         category: "jewelry",      price: 40000,    icon: "💎",  description: "Custom diamond pendant — your logo in ice." },
  { id: "j4",  name: "Presidential Rolex",      category: "jewelry",      price: 80000,    icon: "⌚",  description: "All-gold iced-out Presidential. Wrist game certified." },
  { id: "j5",  name: "Diamond Grill",           category: "jewelry",      price: 120000,   icon: "🦷",  description: "Full diamond grillz — top and bottom row." },
  { id: "j6",  name: "Baguette Tennis Bracelet",category: "jewelry",      price: 200000,   icon: "✨",  description: "All baguette-cut diamond tennis bracelet." },
  { id: "j7",  name: "Patek Philippe Nautilus", category: "jewelry",      price: 500000,   icon: "🕰️", description: "Ultra-rare Patek Nautilus. The holy grail of watches." },
  // Cars
  { id: "c1",  name: "Used Civic",              category: "cars",         price: 8000,     icon: "🚗",  description: "Reliable beater. Gets you from A to B." },
  { id: "c2",  name: "Dodge Challenger",        category: "cars",         price: 35000,    icon: "🚙",  description: "Muscle car energy. V8 growl on the highway." },
  { id: "c3",  name: "Mercedes G-Wagon",        category: "cars",         price: 150000,   icon: "🚐",  description: "The label flex of choice. Black on black." },
  { id: "c4",  name: "Rolls-Royce Wraith",      category: "cars",         price: 350000,   icon: "🏎️", description: "Ghost in the paint. Stars in the headliner." },
  { id: "c5",  name: "Lamborghini Urus",        category: "cars",         price: 500000,   icon: "🚀",  description: "The supercar SUV. Sounds like a jet engine." },
  { id: "c6",  name: "Bugatti Chiron",          category: "cars",         price: 3000000,  icon: "⚡",  description: "0–60 in 2.4 seconds. 304 mph top speed. The ceiling." },
  // Homes
  { id: "h1",  name: "Studio Apartment",        category: "homes",        price: 20000,    icon: "🏠",  description: "Small spot near the studio. Gets the job done." },
  { id: "h2",  name: "Condo in the City",       category: "homes",        price: 100000,   icon: "🏢",  description: "High-rise condo with skyline views. Living good." },
  { id: "h3",  name: "Suburban House",          category: "homes",        price: 350000,   icon: "🏡",  description: "4-bed, 2-car garage. The American dream." },
  { id: "h4",  name: "Penthouse Suite",         category: "homes",        price: 1500000,  icon: "🌆",  description: "Top-floor penthouse. Rooftop pool, private elevator." },
  { id: "h5",  name: "Beverly Hills Mansion",   category: "homes",        price: 5000000,  icon: "🏰",  description: "12-bedroom Bel-Air compound. Studio inside." },
  { id: "h6",  name: "Private Island",          category: "homes",        price: 20000000, icon: "🏝️", description: "Your own island in the Caribbean. The ultimate flex." },
  // Clothes
  { id: "cl1", name: "Fresh Tees & Hoodies",   category: "clothes",      price: 500,      icon: "👕",  description: "Basic drip. Fresh and clean every day." },
  { id: "cl2", name: "Designer Streetwear",     category: "clothes",      price: 5000,     icon: "🧥",  description: "Off-White and Chrome Hearts. Street certified." },
  { id: "cl3", name: "Custom Bespoke Suit",     category: "clothes",      price: 20000,    icon: "🎩",  description: "Hand-stitched Savile Row suit. For award season." },
  { id: "cl4", name: "Couture Wardrobe",        category: "clothes",      price: 100000,   icon: "👔",  description: "Full Dior, Balenciaga, and Versace wardrobe." },
  { id: "cl5", name: "Custom Tour Stage Fit",   category: "clothes",      price: 250000,   icon: "🌟",  description: "One-of-one stage outfit by a fashion legend." },
  // Shoes
  { id: "sh1", name: "Fresh Air Force Ones",    category: "shoes",        price: 200,      icon: "👟",  description: "Crispy AF1s. An all-time classic." },
  { id: "sh2", name: "Jordan Retros (DS)",      category: "shoes",        price: 2000,     icon: "🏀",  description: "Deadstock Jordan retros. Still in the box." },
  { id: "sh3", name: "Unreleased Yeezys",       category: "shoes",        price: 8000,     icon: "⚡",  description: "Plug-connect unreleased colorway. Never worn." },
  { id: "sh4", name: "Custom Balenciaga",       category: "shoes",        price: 25000,    icon: "👠",  description: "Hand-painted Balenciaga Triple S. One of one." },
  { id: "sh5", name: "Diamond Sneakers",        category: "shoes",        price: 150000,   icon: "💎",  description: "Diamond-encrusted sneakers by a luxury jeweler." },
  // Accessories
  { id: "a1",  name: "Cartier Buffs",           category: "accessories",  price: 800,      icon: "🕶️", description: "Cartier sunglasses. A power move in any room." },
  { id: "a2",  name: "LV Duffle Bag",           category: "accessories",  price: 3500,     icon: "👜",  description: "Louis Vuitton duffle for touring. Travel in style." },
  { id: "a3",  name: "Hermès Birkin",           category: "accessories",  price: 50000,    icon: "👛",  description: "The Birkin. Near-impossible to get. You got it." },
  { id: "a4",  name: "Luxury Watch Vault",      category: "accessories",  price: 500000,   icon: "🗃️", description: "AP, Patek, and Richard Mille — a full collection." },
  // Exotic Pets
  { id: "ep1", name: "Koi Fish Pond",           category: "exotic_pets",  price: 5000,     icon: "🐟",  description: "Japanese koi pond. Zen energy for the crib." },
  { id: "ep2", name: "African Grey Parrot",     category: "exotic_pets",  price: 15000,    icon: "🦜",  description: "Smart, sassy, and opinionated. Real personality." },
  { id: "ep3", name: "Champion Purebred Dog",   category: "exotic_pets",  price: 25000,    icon: "🐕",  description: "Champion bloodline purebred. The loyalty is real." },
  { id: "ep4", name: "Capuchin Monkey",         category: "exotic_pets",  price: 75000,    icon: "🐒",  description: "Tiny vibes, big energy. The monkey tax." },
  { id: "ep5", name: "White Siberian Tiger",    category: "exotic_pets",  price: 500000,   icon: "🐯",  description: "Full private-zoo energy. The rarest of rare." },
  { id: "ep6", name: "Great White Shark Tank",  category: "exotic_pets",  price: 2000000,  icon: "🦈",  description: "Custom aquarium wing in your mansion. A real one." },
];

// ── Rival Labels ──────────────────────────────────────────────────────────────

const RIVAL_LABEL_TEMPLATES: Array<{
  name: string; primaryGenre: Genre; prestige: number; activityLevel: number;
  releaseStrategy: RivalReleaseStrategy; artistNames: string[];
}> = [
  { name: "Street Vision Records", primaryGenre: "trap",         prestige: 55, activityLevel: 70, releaseStrategy: "aggressive", artistNames: ["Yung Savage", "Lil Dremz", "K-Kold"] },
  { name: "Crown City Music",      primaryGenre: "drill",        prestige: 62, activityLevel: 65, releaseStrategy: "balanced",   artistNames: ["Drill Lord", "Ghost Trigga", "Frenzy B"] },
  { name: "Atlantic Boom Group",   primaryGenre: "boom-bap",     prestige: 72, activityLevel: 48, releaseStrategy: "selective",  artistNames: ["MC Legit", "Verse Architect"] },
  { name: "Neon Pop Records",      primaryGenre: "pop-rap",      prestige: 67, activityLevel: 75, releaseStrategy: "aggressive", artistNames: ["Flex Monroe", "Popstar D", "Melo Haze"] },
  { name: "Velvet Soul Music",     primaryGenre: "r-and-b",      prestige: 60, activityLevel: 55, releaseStrategy: "balanced",   artistNames: ["Smooth Era", "Melodic J"] },
  { name: "Chaos Lab Music",       primaryGenre: "experimental", prestige: 50, activityLevel: 80, releaseStrategy: "aggressive", artistNames: ["X-Pulse", "Static Void", "Glitch King"] },
  { name: "Diamond Empire Rec.",   primaryGenre: "trap",         prestige: 78, activityLevel: 60, releaseStrategy: "balanced",   artistNames: ["Big Floss", "Chain Gang", "Tres Carat"] },
  { name: "OG Collective",         primaryGenre: "boom-bap",     prestige: 82, activityLevel: 38, releaseStrategy: "selective",  artistNames: ["Old School K", "Nostalgia", "Vinyl Prince"] },
  { name: "Southside Sound",       primaryGenre: "trap",         prestige: 48, activityLevel: 72, releaseStrategy: "aggressive", artistNames: ["Trap Messiah", "Bankroll P", "Lil Draco"] },
  { name: "Midnight Wave Records", primaryGenre: "r-and-b",      prestige: 58, activityLevel: 62, releaseStrategy: "balanced",   artistNames: ["Silk Tone", "Luna Vibe", "R.B. King"] },
  { name: "Concrete Jungle Ent.",  primaryGenre: "drill",        prestige: 70, activityLevel: 68, releaseStrategy: "balanced",   artistNames: ["Block Captain", "Grim Reapa", "Slide K"] },
  { name: "Future Classic Music",  primaryGenre: "experimental", prestige: 65, activityLevel: 45, releaseStrategy: "selective",  artistNames: ["Synth Lord", "Pixel Dreams", "Wave Theory"] },
];

export function createRivalLabels(): RivalLabel[] {
  return RIVAL_LABEL_TEMPLATES.map((t, i) => {
    const rosterArtists = t.artistNames.map((name, j) => {
      const artist = generateArtist(`rival_${i}_artist_${j}`, true);
      return { ...artist, name, signed: true };
    });
    return {
      id: `rival_${i}`,
      name: t.name,
      primaryGenre: t.primaryGenre,
      prestige: t.prestige,
      activityLevel: t.activityLevel,
      releaseStrategy: t.releaseStrategy,
      activeSongs: [],
      rosterArtists,
      totalSongsReleased: 0,
      totalStreams: 0,
      chartHits: 0,
      awardWins: 0,
      founded: -(Math.floor(Math.random() * 200) + 52), // founded 1-5 years before game start
      prLevel: Math.min(10, Math.floor(t.prestige / 12)), // PR derived from prestige
    };
  });
}

export { RIVAL_LABEL_TEMPLATES };
