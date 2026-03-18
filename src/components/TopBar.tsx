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

export default function TopBar({ onNextTurn, onSeeAllNotifications }: { onNextTurn: () => void; onSeeAllNotifications?: () => void }) {
  const { labelName, money, reputation, fanbase, turn, startDate, gameOver } = useGameStore();
  const gameDate = formatGameDate(getGameDate(startDate || "2025-01-06", turn));

  return (
    <div className="bg-white border-b border-gray-200 px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
      {/* Left: Label name + date */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        <span className="text-gray-900 font-semibold text-xs sm:text-sm tracking-tight truncate">{labelName}</span>
        <div className="flex flex-col shrink-0">
          <span className="text-gray-500 text-[10px] sm:text-xs font-medium">{gameDate}</span>
          <span className="text-gray-400 text-[9px] sm:text-[10px]">Week {turn}</span>
        </div>
      </div>

      {/* Center: Stats — compact on mobile, full on desktop */}
      <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
        <StatCompact label="Cash" value={fmt(money)} color={money < 0 ? "text-red-600" : "text-green-600"} />
        <StatCompact label="Rep" value={`${reputation}`} color="text-gray-900" />
        <StatCompact label="Fans" value={fmtFans(fanbase)} color="text-gray-900" hideLabelMobile />
      </div>

      {/* Right: Bell + Next Week */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <ReputationBell onSeeAll={onSeeAllNotifications} />
        <button
          onClick={onNextTurn}
          disabled={gameOver}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-2.5 sm:px-4 py-1.5 rounded text-xs sm:text-sm transition whitespace-nowrap"
        >
          <span className="hidden sm:inline">Next Week</span>
          <span className="sm:hidden">Next</span>
        </button>
      </div>
    </div>
  );
}

function StatCompact({ label, value, color, hideLabelMobile }: { label: string; value: string; color: string; hideLabelMobile?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-gray-400 text-[9px] sm:text-xs ${hideLabelMobile ? "hidden sm:block" : ""}`}>{label}</span>
      <span className={`font-semibold text-xs sm:text-sm ${color}`}>{value}</span>
    </div>
  );
}
