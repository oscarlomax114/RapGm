"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";

export default function StartScreen() {
  const [name, setName] = useState("");
  const startGame = useGameStore((s) => s.startGame);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-md p-10 w-full max-w-md shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2 tracking-tight">Wrap Label GM</h1>
        <p className="text-gray-500 mb-8 text-sm">
          Build a rap empire. Sign artists, record heat, top the charts.
        </p>

        <label className="block text-gray-900 text-sm font-semibold mb-2">Label Name</label>
        <input
          className="w-full bg-white border border-gray-200 rounded-md px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-600 transition mb-6 text-sm"
          placeholder="e.g. Apex Records"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && startGame(name.trim())}
        />

        <button
          onClick={() => name.trim() && startGame(name.trim())}
          disabled={!name.trim()}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-1.5 rounded text-sm transition"
        >
          Start Your Label
        </button>

        <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-gray-500">
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            Sign Artists
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            Record Songs
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            Top Charts
          </div>
        </div>
      </div>
    </div>
  );
}
