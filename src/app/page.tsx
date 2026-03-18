"use client";
import { useGameStore } from "@/store/gameStore";
import SaveSlotScreen from "@/components/SaveSlotScreen";
import StartScreen from "@/components/StartScreen";
import GameLayout from "@/components/GameLayout";

export default function Home() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  const activeSlot = useGameStore((s) => s.activeSlot);
  const setActiveSlot = useGameStore((s) => s.setActiveSlot);

  // Game is running — show the game
  if (gameStarted) return <GameLayout />;

  // No slot selected — show save slot picker
  if (!activeSlot) {
    return (
      <SaveSlotScreen
        onStartNew={(slot) => setActiveSlot(slot)}
      />
    );
  }

  // Slot selected but game not started — show label name input
  return <StartScreen />;
}
