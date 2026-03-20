export type Genre = "trap" | "boom-bap" | "drill" | "r-and-b" | "pop-rap" | "experimental";

export type ProducerTier = "underground" | "mid-tier" | "elite";

// ── Character appearance (customizable sprite colors) ─────────────────────────

export interface ArtistAppearance {
  hairColor: string;
  skinTone: string;
  shirtColor: string;
}

// ── Skill attributes (15 values; overallRating = their average) ──────────────

export interface ArtistAttributes {
  // Lyricism
  lyricism: number;
  wordplay: number;
  storytelling: number;
  creativity: number;
  originality: number;
  // Flow
  flow: number;
  delivery: number;
  technique: number;
  micPresence: number;
  versatility: number;
  // Songwriting
  songwriting: number;
  hookability: number;
  beatSelection: number;
  hitmaking: number;
  charisma: number;
}

export const ATTRIBUTE_GROUPS: Record<string, (keyof ArtistAttributes)[]> = {
  Lyricism:   ["lyricism", "wordplay", "storytelling", "creativity", "originality"],
  Flow:       ["flow", "delivery", "technique", "micPresence", "versatility"],
  Songwriting: ["songwriting", "hookability", "beatSelection", "hitmaking", "charisma"],
};

export const ATTRIBUTE_LABELS: Record<keyof ArtistAttributes, string> = {
  lyricism: "Lyricism", wordplay: "Wordplay", storytelling: "Storytelling",
  creativity: "Creativity", originality: "Originality",
  flow: "Flow", delivery: "Delivery", technique: "Technique",
  micPresence: "Mic Presence", versatility: "Versatility",
  songwriting: "Songwriting", hookability: "Hookability", beatSelection: "Beat Sel.",
  hitmaking: "Hitmaking", charisma: "Charisma",
};

// ── Personality traits (control behavior, morale, contract expectations) ──────
export interface ArtistTraits {
  loyalty: number;          // 0–100: willingness to re-sign, patience during weak periods
  workEthic: number;        // 0–100: fatigue tolerance
  moneyMotivation: number;  // 0–100: demands higher contracts when high
  competitiveness: number;  // 0–100: cares about quality, charts, awards
  fameMotivation: number;   // 0–100: morale tied to fan growth and exposure
  controversyRisk: number;  // 0–100: likelihood of scandal events
}

export interface Artist {
  id: string;
  name: string;
  persona: string;
  genre: Genre;

  // ── Public presence ────────────────────────────────────────────
  popularity: number;       // public recognition (0–100); driven by releases/tours
  fanbase: number;

  // ── Appearance ────────────────────────────────────────────────
  appearance: ArtistAppearance;
  spriteIndex: number;           // index into /sprites/0..439.png

  // ── Talent system (independent from personality) ───────────────
  attributes: ArtistAttributes; // 15 skill attributes
  overallRating: number;    // average of all 15 attributes; drives song quality
  potential: number;        // talent ceiling (0–100)
  baseOVR: number;          // immutable talent ceiling set at generation (drives potential)
  age: number;
  peakAge: number;          // age at which talent peaks (26–32)

  // ── Scouting state ───────────────────────────────────────────
  scouted?: boolean;

  // ── State ─────────────────────────────────────────────────────
  fatigue: number;
  morale: number;
  signed: boolean;
  contractAlbumsTotal: number;
  contractAlbumsLeft: number;
  onTour: boolean;
  tourTurnsLeft: number;
  tourType: TourSize | null;
  lastMajorTourTurn: number;
  lastTourEndTurn: number;       // turn any tour (including club/regional) last completed
  lastAlbumReleaseTurn: number;  // turn the most recent album dropped; 0 if none

  // ── Personality traits ────────────────────────────────────────
  traits: ArtistTraits;

  // ── Derived personality preferences (computed, not displayed directly) ────
  preferredAlbumLength: number;   // 10–30; driven by moneyMotivation
  minSongQuality: number;          // 0–100; driven by competitiveness

  // ── Career ecosystem ────────────────────────────────────────────
  archetype: ArtistArchetype; // what kind of artist (dynamic, can change)
  careerPhase: CareerStage;   // where they are in their arc
  momentum: number;           // 0–100: career health & trajectory
  buzz: number;               // 0–100: public visibility & market attention
  durability: DurabilityType; // career longevity archetype
  peakMomentum: number;       // highest momentum ever reached
  turnsAtLowMomentum: number; // consecutive turns with momentum < 25
  totalSinglesReleased: number;
  totalAlbumsReleased: number;
  chartHits: number;          // times charted in top 10
  flops: number;              // released songs that never charted or fell off in < 3 weeks
  careerStartTurn: number;    // turn when first signed or entered pool

  // ── Yearly progression tracking ────────────────────────────────
  yearlyReleasesQuality: number[];  // avg quality of releases this year (reset each year)
  yearlyChartsWeeks: number;        // total weeks on chart this year
  yearlyTourWeeks: number;          // total weeks touring this year
  yearlyControversies: number;      // scandals/beefs this year
  lastProgressionTurn: number;      // last turn yearly progression was applied
  peakOverall: number;              // highest OVR ever reached (for decline detection)

  // ── Rating change indicators (temporary UI display) ──────────
  ovrChangeDelta?: number;       // most recent OVR change magnitude (+/-)
  ovrChangeTurn?: number;        // turn when the change happened
  potChangeDelta?: number;       // most recent potential change magnitude (+/-)
  potChangeTurn?: number;        // turn when the change happened

  // ── Legal / Jail state ──────────────────────────────────────────
  legalState?: LegalState;          // undefined = no legal trouble
  jailed?: boolean;                 // true while serving sentence
  jailTurnsLeft?: number;           // turns remaining in sentence
  jailSentenceType?: SentenceType;  // type of sentence being served
  legalHistory?: number;            // count of past legal incidents (affects court outcomes)
  releaseFromJailTurn?: number;     // turn released from jail (for comeback spike)
  comebackBonusTurns?: number;      // turns remaining for "first day out" viral bonus on next release

  // ── Signing negotiation state ───────────────────────────────────
  lastOfferTurn?: number;           // turn of last signing offer
  lastOfferOutcome?: "declined";    // outcome of that offer
  lastOfferReputation?: number;     // label rep at time of offer

  // ── Beef state ──────────────────────────────────────────────────
  activeBeef?: BeefState;           // current active beef (undefined = no beef)

  // ── Feature / collaboration state ─────────────────────────────────
  lastFeatureTurn?: number;         // cooldown tracking: last turn this artist did a feature
  featureCount?: number;            // total features done this year (reset yearly)
}

export interface Producer {
  id: string;
  name: string;
  specialty: Genre;
  quality: number;       // 0–100: base quality contribution to songs
  hitmaking: number;     // 0–100: biases viral potential upward
  consistency: number;   // 0–100: tightens quality variance
  popularity: number;
  costPerSong: number;
  available: boolean;
  tier: ProducerTier;
  studioTierRequired: 0 | 1 | 2 | 3; // 0=underground 1=mid 2=high 3=elite
}

export interface Song {
  id: string;
  title: string;
  artistId: string;
  producerId: string;
  genre: Genre;
  quality: number;
  viralPotential: number;
  chartPosition: number | null;
  streamsTotal: number;
  released: boolean;
  turnRecorded: number;  // turn the song was recorded (for weekly productivity limits)
  turnReleased: number;
  weeksOnChart: number;
  revenue: number;
  albumId?: string;            // set if this song belongs to an album
  albumStatus?: "confirmed" | "maybe" | "scrap";  // curation status within the album
  wasStandalone?: boolean;     // true if recorded as a standalone single (not directly for an album)
  albumEligible?: boolean;     // true if this released single can still be added to an album
  linkedAlbumId?: string;      // album this single was later added to (post-release)
  // ── Feature / collaboration ──────────────────────────────────────────
  featuredArtistId?: string;       // id of featured artist (player roster or rival)
  featuredArtistName?: string;     // display name (always set if feature exists)
  featuredArtistLabelId?: string;  // rival label id if external feature
  featureChemistry?: number;       // 0–100: how well the collab worked
  featureContribution?: number;    // 0–100: quality of the featured verse/hook
}

export interface Album {
  id: string;
  artistId: string;
  title: string;
  songIds: string[];             // ordered list of song IDs on this album
  status: "recording" | "released";
  turnStarted: number;
  turnReleased: number;
  qualityScore: number;          // computed on release (0–100)
  totalStreams: number;          // accumulated post-release
  totalRevenue: number;          // accumulated post-release
  marketingBudget: number;       // optional spend before release
  // ── Album hype & deluxe ───────────────────────────────────────────
  hypeScore?: number;            // accumulated from pre-release singles performance
  isDeluxe?: boolean;            // true if deluxe tracks have been added post-release
  deluxeTrackIds?: string[];     // additional tracks added after release (max 5)
}

export type UpgradeId = string; // reserved for future one-time standalone purchases

export interface Upgrade {
  id: UpgradeId;
  name: string;
  description: string;
  cost: number;
  purchased: boolean;
  effect: string;
}

export type EventType =
  | "scandal"
  | "viral_moment"
  | "award_nomination"
  | "burnout"
  | "beef"
  | "label_deal"
  | "chart_surge"
  | "radio_play"
  | "revenue"
  | "milestone"
  | "album_release"
  | "retirement"
  | "minor_controversy"
  | "major_controversy"
  | "legal_incident"
  | "charges_filed"
  | "court_case"
  | "jail_sentence"
  | "release_from_jail"
  | "beef_tension"
  | "beef_open"
  | "beef_diss_track"
  | "beef_resolution"
  | "feature_collab";

// ── Market tiers ──────────────────────────────────────────────────────────
export type MarketTier = "underground" | "emerging" | "mid-tier" | "major" | "star" | "superstar";

// ── Feature / Collaboration types ─────────────────────────────────────────

export interface ArtistRelationship {
  artistId1: string;
  artistId2: string;
  score: number;        // -100 to 100 (negative = hostile, positive = friendly)
  collabCount: number;  // successful collaborations together
  lastCollabTurn: number;
}

export interface FeatureRequest {
  id: string;
  fromArtistId: string;
  fromArtistName: string;
  fromLabelId?: string;       // undefined = player label
  fromLabelName: string;
  toArtistId: string;
  toArtistName: string;
  toLabelId?: string;
  toLabelName: string;
  feeOffered: number;
  turn: number;
  genre: Genre;
  // Computed display hints
  acceptChance: number;       // 0–100
  synergy: FeatureSynergy;
}

export interface FeatureSynergy {
  chemistry: number;          // 0–100
  genreFit: "strong" | "compatible" | "neutral" | "mismatch";
  tierGap: number;            // positive = requesting from bigger artist
  sameLabel: boolean;
  tags: FeatureTag[];
}

export type FeatureTag =
  | "strong_fit"
  | "same_label"
  | "expensive"
  | "unlikely"
  | "great_for_growth"
  | "chemistry_risk"
  | "beef_blocked"
  | "on_cooldown";

// ── Legal system types ─────────────────────────────────────────────────────

export type LegalStage = "incident" | "charges_filed" | "court_case" | "resolved";
export type SentenceType = "dismissed" | "probation" | "short" | "medium" | "long" | "life";

export interface LegalState {
  stage: LegalStage;
  offense: string;           // description of offense
  severity: number;          // 1-10 scale
  turnStarted: number;       // turn incident happened
  turnChargesFiled?: number; // turn charges were filed
  turnCourtCase?: number;    // turn court case resolved
  sentence?: SentenceType;
  sentenceTurns?: number;    // total turns of sentence (if jail)
}

// ── Beef system types ──────────────────────────────────────────────────────

export type BeefStage = "tension" | "open" | "diss_track" | "escalation";

export interface BeefState {
  stage: BeefStage;
  opponentName: string;      // name of the other artist
  opponentId?: string;       // id if they're a real artist in the game
  opponentLabelName?: string;
  turnStarted: number;
  dissTrackCount: number;    // how many diss tracks exchanged
  playerIsWinning?: boolean; // who appears to be winning (undefined = even)
  turnsAtStage: number;      // how long at current stage
}

// ── Career stage (where they are in their career arc) ────────────────────────
export type CareerStage =
  | "unknown"      // nobody knows them yet
  | "emerging"     // starting to get noticed
  | "buzzing"      // real momentum, people are watching
  | "breakout"     // first major success period
  | "established"  // proven, consistent presence
  | "peak"         // at the top of their game
  | "declining"    // losing steam
  | "washed"       // fallen off hard
  | "legacy";      // elder statesman, past prime but respected

// ── Artist archetype (what kind of artist they are — can change over time) ───
export type ArtistArchetype =
  | "raw_young_prospect"       // 16-21, undeveloped but could be anything
  | "buzzing_underground"      // 18-26, building a real following
  | "viral_wildcard"           // 18-28, volatile — could blow up or crash
  | "polished_midtier"         // 24-32, solid but probably not a star
  | "aging_veteran"            // 30-40, experienced, stable, limited upside
  | "stalled_washed"           // 24-36, career has stalled or gone backwards
  | "generational_prospect";   // 16-23, rare elite talent

// Keep for backwards compat in save data — maps to archetype behavior internally
export type CareerPhase = CareerStage;
export type DurabilityType = "flash" | "solid" | "durable";

export interface GameEvent {
  id: string;
  turn: number;
  type: EventType;
  title: string;
  description: string;
  artistId?: string;
  moneyDelta: number;
  reputationDelta: number;
  fanbaseDelta: number;
  popularityDelta?: number;
  resolved: boolean;
  // ── Extended event data ─────────────────────────────────────────
  buzzDelta?: number;          // direct buzz change (applied to artist)
  momentumDelta?: number;      // direct momentum change (applied to artist)
  isRivalEvent?: boolean;      // true if this event affects a rival label/artist
  rivalLabelId?: string;       // which rival label is affected
}

// ── Active beef record (ecosystem-level tracking) ─────────────────────────

export interface ActiveBeefRecord {
  id: string;
  artist1Name: string;
  artist1Id?: string;          // real id if in game
  artist1LabelName: string;
  artist2Name: string;
  artist2Id?: string;
  artist2LabelName: string;
  stage: BeefStage;
  turnStarted: number;
  dissTrackCount: number;
  turnsAtStage: number;
}

export interface ChartEntry {
  position: number;
  songId: string;       // "" for industry songs
  title: string;
  artistName: string;
  labelName: string;    // player's label name or rival label name
  weeksOnChart: number;
  streams: number;
  isPlayerSong: boolean;
  genre: Genre;
  featuredArtistName?: string;  // display "ft. X" on charts
}

// ── Rival Labels / Industry Competition ───────────────────────────────────────

export interface IndustrySong {
  id: string;
  title: string;
  artistName: string;
  labelId: string;
  labelName: string;
  genre: Genre;
  quality: number;
  viralPotential: number;
  turnReleased: number;
  weeksOnChart: number;
  streamsTotal: number;
  // Simulated artist stats for chart scoring
  artistPopularity: number;
  artistMomentum: number;
  artistBuzz: number;
  artistFanbase: number;
  // Feature info
  featuredArtistName?: string;
}

export type RivalReleaseStrategy = "aggressive" | "balanced" | "selective";

export interface RivalLabel {
  id: string;
  name: string;
  primaryGenre: Genre;
  prestige: number;       // 0–100: affects producer access, signing power, exposure
  activityLevel: number;  // 0–100: affects release frequency
  releaseStrategy: RivalReleaseStrategy; // release behavior profile
  activeSongs: IndustrySong[];
  // ── Roster & stats ──────────────────────────────────────────────────
  rosterArtists: Artist[];       // artists currently signed to this label
  totalSongsReleased: number;
  totalStreams: number;
  chartHits: number;             // songs that reached top 10
  awardWins: number;
  founded: number;               // turn the label was "founded" (for display)
  // ── PR & events ─────────────────────────────────────────────────────
  prLevel: number;               // 0–10: derived from prestige, affects event mitigation
}

// ── Grammy-Style Awards ───────────────────────────────────────────────────────

export type AwardCategory =
  | "song_of_year"
  | "album_of_year"
  | "artist_of_year"
  | "best_new_artist"
  | "label_of_year";

export interface AwardNominee {
  category: AwardCategory;
  name: string;            // song/album/artist/label name
  artistName?: string;     // used for song/album categories
  isPlayer: boolean;       // true if this is the player's entry
  score: number;           // computed eligibility score
}

export interface AwardCeremony {
  id: string;
  year: number;
  turn: number;
  nominees: AwardNominee[];
  winners: AwardNominee[];
  playerWins: AwardCategory[];
  moneyReward: number;
  reputationReward: number;
}

// ── Label Milestones ──────────────────────────────────────────────────────────

export type MilestoneType =
  | "chart_number_one"
  | "award_win"
  | "fanbase_milestone"
  | "first_album"
  | "revenue_milestone"
  | "rivalry_beat";

export interface LabelMilestone {
  id: string;
  turn: number;
  type: MilestoneType;
  title: string;
  description: string;
}

export type TourSize = "club_tour" | "regional_tour" | "national_tour" | "major_tour" | "world_tour";

// ── Mall ─────────────────────────────────────────────────────────────────────

export type MallCategory = "jewelry" | "cars" | "homes" | "clothes" | "shoes" | "accessories" | "exotic_pets";

export interface MallItem {
  id: string;
  name: string;
  category: MallCategory;
  price: number;
  icon: string;        // emoji placeholder; real sprites supplied later
  description: string;
}

export interface VaultItem {
  uid: string;         // unique purchase id (multiple buys create multiple entries)
  itemId: string;      // references MallItem.id
  name: string;
  category: MallCategory;
  icon: string;
  price: number;
  purchasedTurn: number;
}

// ── Achievement System ────────────────────────────────────────────────────────

export type AchievementCategory =
  | "streaming"
  | "merch"
  | "touring"
  | "cash"
  | "charts"
  | "albums"
  | "awards"
  | "collaborations"
  | "dynasty"
  | "hall_of_fame"
  | "narrative";

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  tier: number;                  // I=1, II=2, III=3, etc.
  threshold: number;             // numeric target (e.g. 10_000_000 for 10M streams)
}

export interface AchievementProgress {
  achievementId: string;
  unlocked: boolean;
  unlockedTurn?: number;
}

// ── Hall of Fame ─────────────────────────────────────────────────────────────

export type HoFTier = "eligible" | "strong_candidate" | "first_ballot";

export interface HallOfFameEntry {
  artistId: string;
  artistName: string;
  inductionTurn: number;
  inductionYear: number;
  tier: HoFTier;
  score: number;
  labelName?: string;
  genre?: Genre;
  spriteIndex?: number;
  stats: {
    awards: number;
    numberOneSongs: number;
    platinumAlbums: number;
    totalStreams: number;
    careerYears: number;
    overallRating: number;
  };
}

// ── Transaction Log ──────────────────────────────────────────────────────────

export type TransactionType =
  | "signing"
  | "release"
  | "recording"
  | "single_release"
  | "album_release"
  | "feature_deal"
  | "tour_booking"
  | "upgrade"
  | "mall_purchase"
  | "revenue"
  | "renegotiation"
  | "contract_risk"
  | "scout_refresh"
  | "artist_dropped"
  | "overhead";

export interface Transaction {
  id: string;
  turn: number;
  type: TransactionType;
  description: string;
  amount: number;           // positive = income, negative = expense
  category: "income" | "expense" | "action";
  artistName?: string;
  details?: string;
}

export interface GameState {
  labelName: string;
  money: number;
  reputation: number;
  fanbase: number;
  turn: number;
  startDate: string;         // ISO date string; weekly turns drive calendar progression
  artists: Artist[];
  producers: Producer[];
  songs: Song[];
  albums: Album[];
  upgrades: Upgrade[];
  chart: ChartEntry[];
  recentEvents: GameEvent[];
  gameStarted: boolean;
  gameOver: boolean;
  lastRefreshTurn: number;
  studioLevel: number;       // 0–10 ladder stage
  scoutingLevel: number;     // 0–10 ladder stage
  artistDevLevel: number;    // 0–10 ladder stage
  touringLevel: number;      // 0–10 ladder stage
  marketingLevel: number;    // 0–10 ladder stage
  prLevel: number;           // 0–10 ladder stage
  merchLevel: number;        // 0–10 ladder stage
  recordingTokens: number;   // weekly pool; spent for bonus sessions beyond artist limit
  vault: VaultItem[];        // items purchased from the mall
  // ── Industry & Competition ────────────────────────────────────────────────
  rivalLabels: RivalLabel[];
  industrySongs: IndustrySong[];   // all active industry songs across all rivals
  freeAgentPool: Artist[];         // persistent large pool; scouting level controls visibility
  // ── Awards ────────────────────────────────────────────────────────────────
  awardHistory: AwardCeremony[];
  pendingAwardCeremony: AwardCeremony | null; // shown as modal, then cleared
  // ── Hip-hop event system ────────────────────────────────────────────────
  activeBeefs: ActiveBeefRecord[];  // all active beefs in the ecosystem
  // ── Feature / collaboration system ────────────────────────────────────────
  artistRelationships: ArtistRelationship[];    // pairwise relationship scores
  pendingFeatureRequests: FeatureRequest[];     // incoming requests from other labels
  // ── Achievement system ──────────────────────────────────────────────────
  achievements: AchievementProgress[];
  // ── Hall of Fame ────────────────────────────────────────────────────────
  hallOfFame: HallOfFameEntry[];
  globalHallOfFame: HallOfFameEntry[];  // rival label retirees
  // ── Transaction log ────────────────────────────────────────────────────
  transactions: Transaction[];
  // ── Dynasty tracking ────────────────────────────────────────────────────
  dynastyYears: number;                         // consecutive years as #1 label
  // ── History ───────────────────────────────────────────────────────────────
  labelMilestones: LabelMilestone[];
  // ── Revenue tracking ────────────────────────────────────────────────────
  revenueHistory: RevenueHistory;
}

export interface RevenueHistory {
  streaming: number;     // all-time cumulative
  touring: number;
  merch: number;
  brandDeals: number;
  awards: number;
  // Weekly snapshot (most recent turn)
  weeklyStreaming: number;
  weeklyTouring: number;
  weeklyMerch: number;
  weeklyBrandDeals: number;
  weeklyOverhead: number;
}
