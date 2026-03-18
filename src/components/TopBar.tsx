"use client";
import { useGameStore } from "@/store/gameStore";
import ReputationBell from "@/components/ReputationBell";
import { getGameDate, formatGameDate } from "@/lib/engine";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtFans(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export default function TopBar({ onNextTurn }: { onNextTurn: () => void }) {
  const { labelName, money, reputation, fanbase, turn, startDate, gameOver } = useGameStore();
  const gameDate = formatGameDate(getGameDate(startDate || "2025-01-06", turn));

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <span className="text-gray-900 font-semibold text-sm tracking-tight">{labelName}</span>
        <div className="flex flex-col">
          <span className="text-gray-500 text-xs font-medium">{gameDate}</span>
          <span className="text-gray-400 text-[10px]">Week {turn}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <Stat label="Cash" value={fmt(money)} color={money < 0 ? "text-red-600" : "text-green-600"} />
        <Stat label="Rep" value={`${reputation}/100`} color="text-gray-900" />
        <Stat label="Fans" value={fmtFans(fanbase)} color="text-gray-900" />
      </div>

      <div className="flex items-center gap-2">
        <ReputationBell />
        <button
          onClick={onNextTurn}
          disabled={gameOver}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-4 py-1.5 rounded text-sm transition"
        >
          Next Week
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}
