"use client";
import { useGameStore } from "@/store/gameStore";
import SaveSlotScreen from "@/components/SaveSlotScreen";
import StartScreen from "@/components/StartScreen";
import GameLayout from "@/components/GameLayout";

export default function Home() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  const activeSlot = useGameStore((s) => s.activeSlot);
  const setActiveSlot = useGameStore((s) => s.setActiveSlot);

  // No slot selected — show save slot picker (takes priority over gameStarted
  // so that returning to main menu via setActiveSlot(null) always works)
  if (!activeSlot) {
    return (
      <SaveSlotScreen
        onStartNew={(slot) => setActiveSlot(slot)}
      />
    );
  }

  // Game is running — show the game
  if (gameStarted) return <GameLayout />;

  // Slot selected but game not started — show label name input
  return <StartScreen />;
}
