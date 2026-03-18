"use client";
import { useEffect, useRef, useCallback } from "react";
import { useGameStore } from "@/store/gameStore";
import { GameState } from "./types";
import { guestSave, accountSave } from "./saveManager";

// Extract only GameState keys from the store (exclude functions)
function extractGameState(store: Record<string, unknown>): GameState {
  const state: Record<string, unknown> = {};
  const skip = new Set(["startGame", "nextTurn", "recordNewSong", "recordFeatureSong",
    "releaseTrack", "signNewArtist", "dropArtist", "purchaseUpgrade", "upgradeStudio",
    "upgradeScouting", "upgradeArtistDev", "upgradeTouringDept", "upgradeMarketing",
    "upgradePR", "upgradeMerch", "bookTour", "refreshFreeAgents", "renegotiateArtistContract",
    "riskRetainingArtist", "startNewAlbum", "releaseAlbumProject", "addSongToAlbum",
    "removeSongFromAlbum", "setSongAlbumStatus", "scrapSong", "restArtistWeek",
    "promoArtistWeek", "renameArtist", "setArtistAppearance", "purchaseMallItem",
    "dismissAwardCeremony", "getVisibleFreeAgents", "acceptIncomingFeature",
    "declineIncomingFeature", "addDeluxeTrack", "setActiveSlot", "loadSaveState"]);

  for (const [key, value] of Object.entries(store)) {
    if (typeof value !== "function" && !skip.has(key) && key !== "activeSlot") {
      state[key] = value;
    }
  }
  return state as unknown as GameState;
}

export function useAutosave(slotNumber: number | null, isGuest: boolean) {
  const pendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    if (!slotNumber) return;
    if (pendingRef.current) return;

    const store = useGameStore.getState() as unknown as Record<string, unknown>;
    const gameStarted = store.gameStarted as boolean;
    const gameOver = store.gameOver as boolean;
    if (!gameStarted || gameOver) return;

    const state = extractGameState(store);
    pendingRef.current = true;

    try {
      if (isGuest) {
        guestSave(slotNumber, state);
      } else {
        await accountSave(slotNumber, state);
      }
    } catch (e) {
      console.error("Autosave failed:", e);
    } finally {
      pendingRef.current = false;
    }
  }, [slotNumber, isGuest]);

  useEffect(() => {
    if (!slotNumber) return;

    const unsub = useGameStore.subscribe(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(save, 1500);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [slotNumber, save]);
}
