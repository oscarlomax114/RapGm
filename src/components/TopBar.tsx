"use client";
import { useGameStore } from "@/store/gameStore";
import ReputationBell from "@/components/ReputationBell";
import { getGameDate, formatGameDate } from "@/lib/engine";
import Image from "next/image";

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

export default function TopBar({ onNextTurn, onSeeAllNotifications, onMenuOpen }: { onNextTurn: () => void; onSeeAllNotifications?: () => void; onMenuOpen?: () => void }) {
  const { labelName, money, reputation, fanbase, turn, startDate, gameOver } = useGameStore();
  const gameDate = formatGameDate(getGameDate(startDate || "2025-01-06", turn));

  return (
    <div className="bg-neutral-950 border-b border-neutral-800 px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
      {/* Left: Hamburger (mobile) + Logo + date */}
      <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
        {onMenuOpen && (
          <button
            onClick={onMenuOpen}
            className="sm:hidden text-neutral-400 hover:text-gray-100 p-1 -ml-1 shrink-0"
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <Image src="/RL_TEXT_LOGO.png" alt="RapLabel GM" width={100} height={20} className="hidden sm:block shrink-0" />
        <span className="text-gray-100 font-semibold text-xs sm:text-sm tracking-tight truncate">{labelName}</span>
        <div className="flex flex-col shrink-0">
          <span className="text-neutral-400 text-[10px] sm:text-xs font-medium">{gameDate}</span>
          <span className="text-neutral-600 text-[9px] sm:text-[10px]">Week {turn}</span>
        </div>
      </div>

      {/* Center: Stats */}
      <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
        <StatCompact label="Cash" value={fmt(money)} color={money < 0 ? "text-red-400" : "text-green-400"} />
        <StatCompact label="Rep" value={`${reputation}`} color="text-gray-100" />
        <StatCompact label="Fans" value={fmtFans(fanbase)} color="text-gray-100" hideLabelMobile />
      </div>

      {/* Right: Bell + Next Week */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <ReputationBell onSeeAll={onSeeAllNotifications} />
        <button
          onClick={onNextTurn}
          disabled={gameOver}
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white font-medium px-2.5 sm:px-4 py-1.5 rounded text-xs sm:text-sm transition whitespace-nowrap"
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
      <span className={`text-neutral-500 text-[9px] sm:text-xs ${hideLabelMobile ? "hidden sm:block" : ""}`}>{label}</span>
      <span className={`font-semibold text-xs sm:text-sm ${color}`}>{value}</span>
    </div>
  );
}
