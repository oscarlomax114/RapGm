import { GameState } from "./types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SaveSlotMeta {
  slotNumber: number;
  labelName: string;
  turn: number;
  updatedAt: string;
  isEmpty: boolean;
}

const STORAGE_PREFIX = "wlgm_save_";
const MAX_SLOTS = 4;

// ── Guest (localStorage) ──────────────────────────────────────────────────────

export function guestSave(slot: number, state: GameState): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${slot}`, JSON.stringify(state));
  } catch (e) {
    console.warn("Guest save failed (storage full?):", e);
  }
}

export function guestLoad(slot: number): GameState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${slot}`);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function guestDelete(slot: number): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${slot}`);
}

export function guestListSlots(): SaveSlotMeta[] {
  const slots: SaveSlotMeta[] = [];
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${i}`);
    if (raw) {
      try {
        const state = JSON.parse(raw) as GameState;
        slots.push({
          slotNumber: i,
          labelName: state.labelName,
          turn: state.turn,
          updatedAt: new Date().toISOString(),
          isEmpty: false,
        });
      } catch {
        slots.push({ slotNumber: i, labelName: "", turn: 0, updatedAt: "", isEmpty: true });
      }
    } else {
      slots.push({ slotNumber: i, labelName: "", turn: 0, updatedAt: "", isEmpty: true });
    }
  }
  return slots;
}

export function guestHasAnySave(): boolean {
  if (typeof window === "undefined") return false;
  for (let i = 1; i <= MAX_SLOTS; i++) {
    if (localStorage.getItem(`${STORAGE_PREFIX}${i}`)) return true;
  }
  return false;
}

export function guestClearAll(): void {
  for (let i = 1; i <= MAX_SLOTS; i++) {
    localStorage.removeItem(`${STORAGE_PREFIX}${i}`);
  }
}

// ── Account (API) ─────────────────────────────────────────────────────────────

export async function accountListSlots(): Promise<SaveSlotMeta[]> {
  try {
    const res = await fetch("/api/saves");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("Failed to list saves:", e);
    return Array.from({ length: MAX_SLOTS }, (_, i) => ({
      slotNumber: i + 1, labelName: "", turn: 0, updatedAt: "", isEmpty: true,
    }));
  }
}

export async function accountLoad(slot: number): Promise<GameState | null> {
  try {
    const res = await fetch(`/api/saves/${slot}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.game_state ?? null;
  } catch {
    return null;
  }
}

export async function accountSave(slot: number, state: GameState): Promise<void> {
  try {
    const res = await fetch(`/api/saves/${slot}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_state: state,
        label_name: state.labelName,
        turn: state.turn,
      }),
    });
    if (!res.ok) console.error("Account save failed:", res.status);
  } catch (e) {
    console.error("Account save failed:", e);
  }
}

export async function accountDelete(slot: number): Promise<void> {
  try {
    await fetch(`/api/saves/${slot}`, { method: "DELETE" });
  } catch (e) {
    console.error("Account delete failed:", e);
  }
}

export async function migrateGuestSaves(): Promise<number> {
  const saves: { slot_number: number; label_name: string; turn: number; game_state: GameState }[] = [];

  for (let i = 1; i <= MAX_SLOTS; i++) {
    const state = guestLoad(i);
    if (state) {
      saves.push({ slot_number: i, label_name: state.labelName, turn: state.turn, game_state: state });
    }
  }

  if (saves.length === 0) return 0;

  try {
    const res = await fetch("/api/saves/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saves }),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    // Clear migrated guest saves
    if (data.migrated > 0) {
      for (const save of saves) {
        guestDelete(save.slot_number);
      }
    }
    return data.migrated;
  } catch (e) {
    console.error("Migration failed:", e);
    return 0;
  }
}
