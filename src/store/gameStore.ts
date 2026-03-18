import { create } from "zustand";
import { GameState, Artist, TourSize, ArtistAppearance, VaultItem } from "@/lib/types";
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

function createInitialState(labelName: string): GameState {
  // 2 signed starter artists
  const rosterArtists: Artist[] = Array.from({ length: 2 }, (_, i) =>
    generateArtist(`a${i}`, true)
  );
  // Large persistent free agent pool (400 agents — the full game world)
  // Player sees a filtered/scouted subset; rival labels can sign from the pool too
  const freeAgentPool: Artist[] = Array.from({ length: 400 }, (_, i) =>
    generateArtist(`pool_${i}`)
  );
  const producers = PRODUCER_ROSTER;

  // Start date: first Monday of 2025
  const startDate = "2025-01-06";

  const rivalLabels = createRivalLabels();

  // Pre-populate 6-12 months of industry history so charts aren't empty at game start
  const baseState: GameState = {
    labelName,
    money: 75000,
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
  dynastyYears: 0,
  labelMilestones: [],
  revenueHistory: {
    streaming: 0, touring: 0, merch: 0, brandDeals: 0, awards: 0,
    weeklyStreaming: 0, weeklyTouring: 0, weeklyMerch: 0, weeklyBrandDeals: 0, weeklyOverhead: 0,
  },

  startGame: (labelName) => {
    set(createInitialState(labelName));
  },

  nextTurn: () => {
    set((state) => advanceTurn(state as GameState));
  },

  recordNewSong: (artistId, producerId, standalone) => {
    const state = get() as GameState;
    const { newState, error } = recordSong(state, artistId, producerId, standalone);
    if (error) return error;
    set(newState);
    return null;
  },

  recordFeatureSong: (artistId, producerId, featuredArtistId, fee, standalone) => {
    const state = get() as GameState;
    const { newState, error } = recordFeatureSong(state, artistId, producerId, featuredArtistId, fee, standalone ?? false);
    if (error) return error;
    set(newState);
    return null;
  },

  releaseTrack: (songId) => {
    const state = get() as GameState;
    const capErr = preReleaseSingleCheck(state, songId);
    if (capErr) return capErr;
    set((s) => releaseSong(s as GameState, songId));
    return null;
  },

  signNewArtist: (artistId, fee, albumCount) => {
    const state = get() as GameState;
    const { newState, error } = signArtist(state, artistId, fee, albumCount);
    if (error) return error;
    set(newState);
    return null;
  },

  dropArtist: (artistId) => {
    set((state) => releaseArtist(state as GameState, artistId));
  },

  purchaseUpgrade: (upgradeId) => {
    set((state) => buyUpgrade(state as GameState, upgradeId));
  },

  upgradeStudio: () => {
    const state = get() as GameState;
    const { newState, error } = upgradeStudio(state);
    if (error) return error;
    set(newState);
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
    const { newState, error } = sendOnTour(state, artistId, tourType);
    if (error) return error;
    set(newState);
    return null;
  },

  renegotiateArtistContract: (artistId, albumCount) => {
    const state = get() as GameState;
    const artist = state.artists.find((a) => a.id === artistId);
    if (!artist) return "Artist not found.";
    const fee = computeRenegotiationFee(artist, state, albumCount);
    const { newState, error } = renegotiateContract(state, artistId, albumCount, fee);
    if (error) return error;
    set(newState);
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
    const { newState, error } = releaseAlbum(state, albumId, marketingBudget);
    if (error) return error;
    set(newState);
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
    set((s) => ({ ...s, money: s.money - item.price, vault: [...s.vault, vaultItem] }));
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
}));
