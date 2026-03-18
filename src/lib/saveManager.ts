import { GameState } from "./types";
import { createClient } from "./supabase/client";

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

// ── Account (Supabase API) ────────────────────────────────────────────────────

interface SaveRow {
  slot_number: number;
  label_name: string;
  turn: number;
  updated_at: string;
  game_state?: GameState;
}

export async function accountListSlots(): Promise<SaveSlotMeta[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("save_slots")
    .select("slot_number, label_name, turn, updated_at")
    .order("slot_number");

  if (error) {
    console.error("Failed to list saves:", error);
    return Array.from({ length: MAX_SLOTS }, (_, i) => ({
      slotNumber: i + 1, labelName: "", turn: 0, updatedAt: "", isEmpty: true,
    }));
  }

  const rows = (data || []) as SaveRow[];
  const existing = new Map(rows.map((r) => [r.slot_number, r]));
  const slots: SaveSlotMeta[] = [];
  for (let i = 1; i <= MAX_SLOTS; i++) {
    const row = existing.get(i);
    if (row) {
      slots.push({
        slotNumber: i,
        labelName: row.label_name,
        turn: row.turn,
        updatedAt: row.updated_at,
        isEmpty: false,
      });
    } else {
      slots.push({ slotNumber: i, labelName: "", turn: 0, updatedAt: "", isEmpty: true });
    }
  }
  return slots;
}

export async function accountLoad(slot: number): Promise<GameState | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("save_slots")
    .select("game_state")
    .eq("slot_number", slot)
    .single();

  if (error || !data) return null;
  return data.game_state as GameState;
}

export async function accountSave(slot: number, state: GameState): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("save_slots")
    .upsert({
      user_id: user.id,
      slot_number: slot,
      label_name: state.labelName,
      turn: state.turn,
      game_state: state,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,slot_number" });

  if (error) console.error("Account save failed:", error);
}

export async function accountDelete(slot: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("save_slots")
    .delete()
    .eq("slot_number", slot);

  if (error) console.error("Account delete failed:", error);
}

export async function migrateGuestSaves(): Promise<number> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Get existing account slots
  const { data: existing } = await supabase
    .from("save_slots")
    .select("slot_number");

  const usedSlots = new Set(((existing || []) as { slot_number: number }[]).map((r) => r.slot_number));

  let migrated = 0;
  for (let i = 1; i <= MAX_SLOTS; i++) {
    if (usedSlots.has(i)) continue;
    const state = guestLoad(i);
    if (!state) continue;

    const { error } = await supabase
      .from("save_slots")
      .insert({
        user_id: user.id,
        slot_number: i,
        label_name: state.labelName,
        turn: state.turn,
        game_state: state,
      });

    if (!error) {
      guestDelete(i);
      migrated++;
    }
  }
  return migrated;
}
