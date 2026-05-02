"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import Image from "next/image";

export default function StartScreen() {
  const [name, setName] = useState("");
  const startGame = useGameStore((s) => s.startGame);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-md p-6 sm:p-10 w-full max-w-md shadow-sm">
        <div className="flex justify-center mb-6">
          <Image src="/RL_FULL_LOGO.png" alt="RapLabel GM" width={220} height={160} priority />
        </div>
        <p className="text-neutral-400 mb-8 text-sm text-center">
          Build a rap empire. Sign artists, record heat, top the charts.
        </p>

        <label className="block text-gray-100 text-sm font-semibold mb-2">Label Name</label>
        <input
          className="w-full bg-neutral-900 border border-neutral-700 rounded-md px-4 py-2.5 text-gray-100 placeholder-neutral-500 focus:outline-none focus:border-purple-500 transition mb-6 text-sm"
          placeholder="e.g. Apex Records"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && startGame(name.trim())}
        />

        <button
          onClick={() => name.trim() && startGame(name.trim())}
          disabled={!name.trim()}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-1.5 rounded text-sm transition"
        >
          Start Your Label
        </button>

        <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-neutral-400">
          <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3">
            Sign Artists
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3">
            Record Songs
          </div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3">
            Top Charts
          </div>
        </div>
      </div>
    </div>
  );
}
