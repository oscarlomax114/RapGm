"use client";
import { useGameStore } from "@/store/gameStore";
import StartScreen from "@/components/StartScreen";
import GameLayout from "@/components/GameLayout";

export default function Home() {
  const gameStarted = useGameStore((s) => s.gameStarted);
  return gameStarted ? <GameLayout /> : <StartScreen />;
}
