import { create } from "zustand";
import { GameState, Artist, TourSize, ArtistAppearance, VaultItem, Transaction } from "@/lib/types";
import { INITIAL_UPGRADES, generateArtist, PRODUCER_ROSTER, SCOUTING_DATA, MALL_CATALOG, createRivalLabels } from "@/lib/data";
import { getVisibleFreeAgents, generateIndustryHistory } from "@/lib/engine";
import {
  advanceTurn,
  recordSong,
  releaseSong,
  signArtist,
  releaseArtist,
  buyUpgrade,
  upgradeStudio,
  upgradeScouting,
  upgradeArtistDev,
  upgradeTouringDept,
  upgradeMarketing,
  upgradePR,
  upgradeMerch,
  sendOnTour,
  renegotiateContract,
  riskRetaining,
  computeSigningFee,
  computeRenegotiationFee,
  startAlbum,
  releaseAlbum,
  restArtist,
  promoWeek,
  addSongToAlbum,
  removeSongFromAlbum,
  deleteSong,
  setSongAlbumStatus,
  preReleaseSingleCheck,
  addDeluxeTrack,
} from "@/lib/engine";
import {
  recordFeatureSong,
  evaluateFeatureAcceptance,
  computeFeatureFee,
  getAvailableFeatureArtists,
  acceptFeatureRequest,
  declineFeatureRequest,
  getMarketTier,
} from "@/lib/features";

export { computeSigningFee, computeRenegotiationFee, computeFeatureFee, evaluateFeatureAcceptance, getMarketTier, getAvailableFeatureArtists };

function txId() { return Math.random().toString(36).slice(2, 10); }

function addTx(state: GameState, tx: Omit<Transaction, "id">): GameState {
  return { ...state, transactions: [...state.transactions, { ...tx, id: txId() }] };
}

function generateGlobalHoF(rivalLabels: GameState["rivalLabels"]): GameState["globalHallOfFame"] {
  // Generate legendary historical artists for the global HoF
  const legends = [
    { name: "King Midas", label: "Def Dynasty", genre: "boom-bap" as const, ovr: 95, awards: 12, ones: 8, albums: 6, streams: 2_500_000_000, years: 18 },
    { name: "Phantom 6ix", label: "Phantom Ent.", genre: "trap" as const, ovr: 92, awards: 9, ones: 12, albums: 5, streams: 3_800_000_000, years: 14 },
    { name: "Lyric Prophet", label: "Conscious Rec.", genre: "boom-bap" as const, ovr: 97, awards: 15, ones: 5, albums: 8, streams: 1_200_000_000, years: 22 },
    { name: "Blaze Auto", label: "Street Kings", genre: "drill" as const, ovr: 88, awards: 6, ones: 9, albums: 4, streams: 2_100_000_000, years: 11 },
    { name: "Velvet Rose", label: "Silk Sound", genre: "r-and-b" as const, ovr: 91, awards: 10, ones: 7, albums: 7, streams: 2_900_000_000, years: 16 },
    { name: "MC Titan", label: "Empire Records", genre: "pop-rap" as const, ovr: 93, awards: 11, ones: 15, albums: 9, streams: 5_000_000_000, years: 20 },
    { name: "3rd Eye", label: "Conscious Rec.", genre: "experimental" as const, ovr: 96, awards: 8, ones: 3, albums: 10, streams: 800_000_000, years: 24 },
    { name: "Young Sov", label: "Drip Nation", genre: "trap" as const, ovr: 85, awards: 4, ones: 6, albums: 3, streams: 1_800_000_000, years: 9 },
  ];

  // Also add top rival roster artists as recent inductees
  const rivalEntries = rivalLabels.flatMap((rl) =>
    rl.rosterArtists
      .filter((a) => a.overallRating >= 75 && a.age >= 33)
      .slice(0, 2)
      .map((a) => ({
        name: a.name,
        label: rl.name,
        genre: a.genre,
        ovr: a.overallRating,
        awards: Math.floor(a.popularity / 15),
        ones: Math.floor(a.popularity / 20),
        albums: Math.floor((a.age - 20) / 3),
        streams: a.fanbase * 50_000,
        years: a.age - 18,
        spriteIndex: a.spriteIndex,
      }))
  );

  const all = [...legends, ...rivalEntries];

  return all.map((l, i) => {
    const score = l.awards * 5 + l.ones * 10 + l.albums * 15 + Math.floor(l.streams / 100_000_000) + l.years * 2;
    return {
      artistId: `hof_${i}`,
      artistName: l.name,
      inductionTurn: 0,
      inductionYear: 2025 - Math.floor(Math.random() * 15),
      tier: (score >= 200 ? "first_ballot" : score >= 150 ? "strong_candidate" : "eligible") as GameState["globalHallOfFame"][0]["tier"],
      score,
      labelName: l.label,
      genre: l.genre,
      spriteIndex: "spriteIndex" in l ? l.spriteIndex : Math.floor(Math.random() * 440),
      stats: {
        awards: l.awards,
        numberOneSongs: l.ones,
        platinumAlbums: l.albums,
        totalStreams: l.streams,
        careerYears: l.years,
        overallRating: l.ovr,
      },
    };
  });
}

function createInitialState(labelName: string): GameState {
  // Start with zero signed artists — player builds from scratch via scouting
  const rosterArtists: Artist[] = [];
  // Large persistent free agent pool (400 agents — the full game world)
  // Player sees a filtered/scouted subset; rival labels can sign from the pool too
  const freeAgentPool: Artist[] = Array.from({ length: 400 }, (_, i) =>
    generateArtist(`pool_${i}`)
  );
  const producers = PRODUCER_ROSTER;

  // Start date: first Monday of 2025
  const startDate = "2025-01-06";

  const rivalLabels = createRivalLabels();

  // Generate historical global HoF entries from rival labels
  const globalHoF = generateGlobalHoF(rivalLabels);

  // Pre-populate 6-12 months of industry history so charts aren't empty at game start
  const baseState: GameState = {
    labelName,
    money: 100000,
    reputation: 20,
    fanbase: 5000,
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
    globalHallOfFame: globalHoF,
    transactions: [],
    dynastyYears: 0,
    labelMilestones: [],
    revenueHistory: {
      streaming: 0, touring: 0, merch: 0, brandDeals: 0, awards: 0,
      weeklyStreaming: 0, weeklyTouring: 0, weeklyMerch: 0, weeklyBrandDeals: 0, weeklyOverhead: 0,
    },
  };

  // Generate pre-game industry songs so the chart is populated from turn 1
  const history = generateIndustryHistory(baseState);

  return {
    ...baseState,
    industrySongs: history.industrySongs,
    rivalLabels: history.rivalLabels,
    chart: history.chart,
  };
}

interface GameStore extends GameState {
  activeSlot: number | null;
  setActiveSlot: (slot: number | null) => void;
  loadSaveState: (state: GameState, slot: number) => void;
  startGame: (labelName: string) => void;
  nextTurn: () => void;
  recordNewSong: (artistId: string, producerId: string, standalone?: boolean) => string | null;
  recordFeatureSong: (artistId: string, producerId: string, featuredArtistId: string, fee: number, standalone?: boolean) => string | null;
  releaseTrack: (songId: string) => string | null;
  signNewArtist: (artistId: string, fee: number, albumCount: 1 | 2 | 3) => string | null;
  dropArtist: (artistId: string) => void;
  purchaseUpgrade: (upgradeId: string) => void;
  upgradeStudio: () => string | null;
  upgradeScouting: () => string | null;
  upgradeArtistDev: () => string | null;
  upgradeTouringDept: () => string | null;
  upgradeMarketing: () => string | null;
  upgradePR: () => string | null;
  upgradeMerch: () => string | null;
  bookTour: (artistId: string, tourType: TourSize) => string | null;
  refreshFreeAgents: () => string;
  renegotiateArtistContract: (artistId: string, albumCount: 1 | 2 | 3) => string | null;
  riskRetainingArtist: (artistId: string) => boolean;
  startNewAlbum: (artistId: string) => string | null;
  releaseAlbumProject: (albumId: string, marketingBudget: number) => string | null;
  addSongToAlbum: (albumId: string, songId: string) => string | null;
  removeSongFromAlbum: (albumId: string, songId: string) => string | null;
  setSongAlbumStatus: (songId: string, status: "confirmed" | "maybe" | "scrap") => void;
  scrapSong: (songId: string) => string | null;
  restArtistWeek: (artistId: string) => string | null;
  promoArtistWeek: (artistId: string) => string | null;
  renameArtist: (artistId: string, newName: string) => void;
  setArtistAppearance: (artistId: string, patch: Partial<ArtistAppearance>) => void;
  purchaseMallItem: (itemId: string) => string | null;
  dismissAwardCeremony: () => void;
  getVisibleFreeAgents: () => Artist[];
  acceptIncomingFeature: (requestId: string) => string | null;
  declineIncomingFeature: (requestId: string) => void;
  addDeluxeTrack: (albumId: string, songId: string) => string | null;
  switchLabel: (rivalLabelId: string) => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  labelName: "",
  money: 0,
  reputation: 0,
  fanbase: 0,
  turn: 0,
  startDate: "2025-01-06",
  artists: [],
  producers: [],
  songs: [],
  albums: [],
  upgrades: INITIAL_UPGRADES,
  chart: [],
  recentEvents: [],
  gameStarted: false,
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
  rivalLabels: [],
  industrySongs: [],
  freeAgentPool: [],
  awardHistory: [],
  pendingAwardCeremony: null,
  activeBeefs: [],
  artistRelationships: [],
  pendingFeatureRequests: [],
  achievements: [],
  hallOfFame: [],
  globalHallOfFame: [],
  transactions: [],
  dynastyYears: 0,
  labelMilestones: [],
  revenueHistory: {
    streaming: 0, touring: 0, merch: 0, brandDeals: 0, awards: 0,
    weeklyStreaming: 0, weeklyTouring: 0, weeklyMerch: 0, weeklyBrandDeals: 0, weeklyOverhead: 0,
  },
  activeSlot: null,

  setActiveSlot: (slot) => {
    set({ activeSlot: slot });
  },

  loadSaveState: (state, slot) => {
    set({ ...state, activeSlot: slot });
  },

  startGame: (labelName) => {
    const slot = get().activeSlot;
    set({ ...createInitialState(labelName), activeSlot: slot });
  },

  nextTurn: () => {
    set((state) => advanceTurn(state as GameState));
  },

  recordNewSong: (artistId, producerId, standalone) => {
    const state = get() as GameState;
    const { newState, error } = recordSong(state, artistId, producerId, standalone);
    if (error) return error;
    const artist = state.artists.find((a) => a.id === artistId);
    const producer = state.producers.find((p) => p.id === producerId);
    const cost = producer ? producer.costPerSong : 0;
    set(addTx(newState, { turn: state.turn, type: "recording", description: `Recorded song with ${artist?.name ?? "?"} (prod. ${producer?.name ?? "?"})`, amount: -cost, category: "expense", artistName: artist?.name }));
    return null;
  },

  recordFeatureSong: (artistId, producerId, featuredArtistId, fee, standalone) => {
    const state = get() as GameState;
    const artist = state.artists.find((a) => a.id === artistId);
    const { newState, error } = recordFeatureSong(state, artistId, producerId, featuredArtistId, fee, standalone ?? false);
    if (error) return error;
    set(addTx(newState, { turn: state.turn, type: "feature_deal", description: `Feature recording with ${artist?.name ?? "?"}`, amount: -fee, category: "expense", artistName: artist?.name, details: `Feature fee: $${fee.toLocaleString()}` }));
    return null;
  },

  releaseTrack: (songId) => {
    const state = get() as GameState;
    const capErr = preReleaseSingleCheck(state, songId);
    if (capErr) return capErr;
    const song = state.songs.find((s) => s.id === songId);
    const artist = state.artists.find((a) => a.id === song?.artistId);
    set((s) => {
      const ns = releaseSong(s as GameState, songId);
      return addTx(ns as GameState, { turn: state.turn, type: "single_release", description: `Released single "${song?.title ?? "?"}" by ${artist?.name ?? "?"}`, amount: 0, category: "action", artistName: artist?.name });
    });
    return null;
  },

  signNewArtist: (artistId, fee, albumCount) => {
    const state = get() as GameState;
    const artist = [...state.artists, ...state.freeAgentPool].find((a) => a.id === artistId);
    const { newState, error } = signArtist(state, artistId, fee, albumCount);
    if (error) return error;
    set(addTx(newState, { turn: state.turn, type: "signing", description: `Signed ${artist?.name ?? "?"} to ${albumCount}-album deal`, amount: -fee, category: "expense", artistName: artist?.name, details: `${albumCount}-album contract` }));
    return null;
  },

  dropArtist: (artistId) => {
    const artist = get().artists.find((a) => a.id === artistId);
    set((state) => {
      const ns = releaseArtist(state as GameState, artistId);
      return addTx(ns as GameState, { turn: state.turn, type: "artist_dropped", description: `Released ${artist?.name ?? "?"} from roster`, amount: 0, category: "action", artistName: artist?.name });
    });
  },

  purchaseUpgrade: (upgradeId) => {
    set((state) => buyUpgrade(state as GameState, upgradeId));
  },

  upgradeStudio: () => {
    const state = get() as GameState;
    const cost = state.money;
    const { newState, error } = upgradeStudio(state);
    if (error) return error;
    const spent = cost - newState.money;
    set(addTx(newState, { turn: state.turn, type: "upgrade", description: `Upgraded Studio to Level ${newState.studioLevel}`, amount: -spent, category: "expense" }));
    return null;
  },

  upgradeScouting: () => {
    const state = get() as GameState;
    const { newState, error } = upgradeScouting(state);
    if (error) return error;
    set(newState);
    return null;
  },

  upgradeArtistDev: () => {
    const state = get() as GameState;
    const { newState, error } = upgradeArtistDev(state);
    if (error) return error;
    set(newState);
    return null;
  },

  upgradeTouringDept: () => {
    const state = get() as GameState;
    const { newState, error } = upgradeTouringDept(state);
    if (error) return error;
    set(newState);
    return null;
  },

  upgradeMarketing: () => {
    const state = get() as GameState;
    const { newState, error } = upgradeMarketing(state);
    if (error) return error;
    set(newState);
    return null;
  },

  upgradePR: () => {
    const state = get() as GameState;
    const { newState, error } = upgradePR(state);
    if (error) return error;
    set(newState);
    return null;
  },

  upgradeMerch: () => {
    const state = get() as GameState;
    const { newState, error } = upgradeMerch(state);
    if (error) return error;
    set(newState);
    return null;
  },

  bookTour: (artistId, tourType) => {
    const state = get() as GameState;
    const artist = state.artists.find((a) => a.id === artistId);
    const cost = state.money;
    const { newState, error } = sendOnTour(state, artistId, tourType);
    if (error) return error;
    const spent = cost - newState.money;
    set(addTx(newState, { turn: state.turn, type: "tour_booking", description: `Booked ${tourType.replace(/_/g, " ")} for ${artist?.name ?? "?"}`, amount: spent >= 0 ? -spent : 0, category: "expense", artistName: artist?.name }));
    return null;
  },

  renegotiateArtistContract: (artistId, albumCount) => {
    const state = get() as GameState;
    const artist = state.artists.find((a) => a.id === artistId);
    if (!artist) return "Artist not found.";
    const fee = computeRenegotiationFee(artist, state, albumCount);
    const { newState, error } = renegotiateContract(state, artistId, albumCount, fee);
    if (error) return error;
    set(addTx(newState, { turn: state.turn, type: "renegotiation", description: `Renegotiated ${artist.name}'s contract (${albumCount}-album extension)`, amount: -fee, category: "expense", artistName: artist.name }));
    return null;
  },

  riskRetainingArtist: (artistId) => {
    const state = get() as GameState;
    const { newState, stayed } = riskRetaining(state, artistId);
    set(newState);
    return stayed;
  },

  startNewAlbum: (artistId) => {
    const state = get() as GameState;
    const { newState, error } = startAlbum(state, artistId);
    if (error) return error;
    set(newState);
    return null;
  },

  releaseAlbumProject: (albumId, marketingBudget) => {
    const state = get() as GameState;
    const album = state.albums.find((a) => a.id === albumId);
    const artist = state.artists.find((a) => a.id === album?.artistId);
    const { newState, error } = releaseAlbum(state, albumId, marketingBudget);
    if (error) return error;
    set(addTx(newState, { turn: state.turn, type: "album_release", description: `Released album "${album?.title ?? "?"}" by ${artist?.name ?? "?"}`, amount: -marketingBudget, category: marketingBudget > 0 ? "expense" : "action", artistName: artist?.name, details: marketingBudget > 0 ? `Marketing: $${marketingBudget.toLocaleString()}` : undefined }));
    return null;
  },

  addSongToAlbum: (albumId, songId) => {
    const state = get() as GameState;
    const { newState, error } = addSongToAlbum(state, albumId, songId);
    if (error) return error;
    set(newState);
    return null;
  },

  removeSongFromAlbum: (albumId, songId) => {
    const state = get() as GameState;
    const { newState, error } = removeSongFromAlbum(state, albumId, songId);
    if (error) return error;
    set(newState);
    return null;
  },

  setSongAlbumStatus: (songId, status) => {
    set((state) => setSongAlbumStatus(state as GameState, songId, status));
  },

  scrapSong: (songId) => {
    const state = get() as GameState;
    const { newState, error } = deleteSong(state, songId);
    if (error) return error;
    set(newState);
    return null;
  },

  restArtistWeek: (artistId) => {
    const state = get() as GameState;
    const { newState, error } = restArtist(state, artistId);
    if (error) return error;
    set(newState);
    return null;
  },

  promoArtistWeek: (artistId) => {
    const state = get() as GameState;
    const { newState, error } = promoWeek(state, artistId);
    if (error) return error;
    set(newState);
    return null;
  },

  renameArtist: (artistId, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    set((state) => ({
      ...state,
      artists: state.artists.map((a) => a.id === artistId ? { ...a, name: trimmed } : a),
    }));
  },

  setArtistAppearance: (artistId, patch) => {
    set((state) => ({
      ...state,
      artists: state.artists.map((a) =>
        a.id === artistId ? { ...a, appearance: { ...a.appearance, ...patch } } : a
      ),
    }));
  },

  purchaseMallItem: (itemId) => {
    const state = get();
    const item = MALL_CATALOG.find((i) => i.id === itemId);
    if (!item) return "Item not found.";
    if (state.money < item.price) return "Not enough cash.";
    const vaultItem: VaultItem = {
      uid: Math.random().toString(36).slice(2, 9),
      itemId: item.id,
      name: item.name,
      category: item.category,
      icon: item.icon,
      price: item.price,
      purchasedTurn: state.turn,
    };
    set((s) => {
      const ns = { ...s, money: s.money - item.price, vault: [...s.vault, vaultItem] };
      return addTx(ns as GameState, { turn: state.turn, type: "mall_purchase", description: `Purchased ${item.name}`, amount: -item.price, category: "expense" });
    });
    return null;
  },

  refreshFreeAgents: () => {
    const COOLDOWN = 8;
    const state = get();
    if (state.turn - state.lastRefreshTurn < COOLDOWN && state.lastRefreshTurn !== 0) {
      return "cooldown";
    }
    const scoutCost = 5000 + state.scoutingLevel * 2000;
    if (state.money < scoutCost) {
      return "no_money";
    }
    const freshPool = Array.from({ length: 400 }, (_, i) =>
      generateArtist(`pool_${Date.now()}_${i}`)
    );
    set({
      ...state,
      money: state.money - scoutCost,
      freeAgentPool: freshPool,
      artists: state.artists.filter((a) => a.signed),
      lastRefreshTurn: state.turn,
    });
    return "ok";
  },

  dismissAwardCeremony: () => {
    set((state) => ({ ...state, pendingAwardCeremony: null }));
  },

  getVisibleFreeAgents: () => {
    return getVisibleFreeAgents(get() as GameState);
  },

  acceptIncomingFeature: (requestId) => {
    const state = get() as GameState;
    const { newState, error } = acceptFeatureRequest(state, requestId);
    if (error) return error;
    set(newState);
    return null;
  },

  declineIncomingFeature: (requestId) => {
    set((state) => declineFeatureRequest(state as GameState, requestId));
  },

  addDeluxeTrack: (albumId, songId) => {
    const state = get() as GameState;
    const { newState, error } = addDeluxeTrack(state, albumId, songId);
    if (error) return error;
    set(newState);
    return null;
  },

  switchLabel: (rivalLabelId) => {
    const state = get() as GameState;
    const rival = state.rivalLabels.find((r) => r.id === rivalLabelId);
    if (!rival) return;

    // Convert current player → rival label
    const playerAsRival = {
      id: `player_${Date.now()}`,
      name: state.labelName,
      primaryGenre: (state.artists.find((a) => a.signed)?.genre ?? "trap") as GameState["rivalLabels"][0]["primaryGenre"],
      prestige: state.reputation,
      activityLevel: Math.min(100, 40 + state.songs.filter((s) => s.released).length),
      releaseStrategy: "balanced" as const,
      activeSongs: state.industrySongs.filter((s) => s.labelName === state.labelName),
      rosterArtists: state.artists.filter((a) => a.signed).map((a) => ({ ...a, signed: true })),
      totalSongsReleased: state.songs.filter((s) => s.released).length,
      totalStreams: state.songs.reduce((sum, s) => sum + s.streamsTotal, 0),
      chartHits: state.songs.filter((s) => s.chartPosition !== null && s.chartPosition <= 10).length,
      awardWins: state.awardHistory.reduce((sum, c) => sum + c.playerWins.length, 0),
      founded: 1,
      prLevel: state.prLevel,
    };

    // Convert rival → player state
    const newRivals = state.rivalLabels
      .filter((r) => r.id !== rivalLabelId)
      .concat(playerAsRival);

    // Rival artists become player's signed roster
    const newArtists = rival.rosterArtists.map((a) => ({ ...a, signed: true }));

    set({
      ...state,
      labelName: rival.name,
      money: Math.floor(rival.prestige * 1000 + 25000),
      reputation: rival.prestige,
      artists: newArtists,
      rivalLabels: newRivals,
      // Reset player-specific progress
      songs: [],
      albums: [],
      vault: [],
      transactions: [{ id: txId(), turn: state.turn, type: "action" as Transaction["type"], description: `Switched management to ${rival.name}`, amount: 0, category: "action" }],
      studioLevel: Math.min(10, Math.floor(rival.prestige / 12)),
      scoutingLevel: Math.min(10, Math.floor(rival.prestige / 15)),
      artistDevLevel: Math.min(10, Math.floor(rival.prestige / 15)),
      touringLevel: Math.min(10, Math.floor(rival.prestige / 15)),
      marketingLevel: Math.min(10, Math.floor(rival.prestige / 15)),
      prLevel: rival.prLevel,
      merchLevel: Math.min(10, Math.floor(rival.prestige / 15)),
    });
  },
}));
