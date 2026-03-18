"use client";

import { useState, useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements";
import { AchievementCategory, AchievementDef, GameState } from "@/lib/types";

// ── Formatting helpers ───────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toFixed(0);
}

function fmtMoney(n: number): string {
  return `$${fmtNum(n)}`;
}

// ── Category metadata ────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  AchievementCategory,
  { label: string; color: string; dot: string; bg: string; border: string; barBg: string; barFill: string }
> = {
  streaming:      { label: "Streaming",      color: "text-blue-400",    dot: "bg-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    barBg: "bg-blue-950",    barFill: "bg-blue-500" },
  merch:          { label: "Merch",          color: "text-yellow-400",  dot: "bg-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30",  barBg: "bg-yellow-950",  barFill: "bg-yellow-500" },
  touring:        { label: "Touring",        color: "text-green-400",   dot: "bg-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30",   barBg: "bg-green-950",   barFill: "bg-green-500" },
  cash:           { label: "Cash",           color: "text-emerald-400", dot: "bg-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", barBg: "bg-emerald-950", barFill: "bg-emerald-500" },
  charts:         { label: "Charts",         color: "text-purple-400",  dot: "bg-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30",  barBg: "bg-purple-950",  barFill: "bg-purple-500" },
  albums:         { label: "Albums",         color: "text-indigo-400",  dot: "bg-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/30",  barBg: "bg-indigo-950",  barFill: "bg-indigo-500" },
  awards:         { label: "Awards",         color: "text-amber-400",   dot: "bg-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   barBg: "bg-amber-950",   barFill: "bg-amber-500" },
  collaborations: { label: "Collaborations", color: "text-pink-400",    dot: "bg-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/30",    barBg: "bg-pink-950",    barFill: "bg-pink-500" },
  dynasty:        { label: "Dynasty",        color: "text-red-400",     dot: "bg-red-400",     bg: "bg-red-500/10",     border: "border-red-500/30",     barBg: "bg-red-950",     barFill: "bg-red-500" },
  hall_of_fame:   { label: "Hall of Fame",   color: "text-orange-400",  dot: "bg-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30",  barBg: "bg-orange-950",  barFill: "bg-orange-500" },
  narrative:      { label: "Narrative",      color: "text-cyan-400",    dot: "bg-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    barBg: "bg-cyan-950",    barFill: "bg-cyan-500" },
};

const ALL_CATEGORIES: AchievementCategory[] = [
  "streaming", "merch", "touring", "cash", "charts", "albums",
  "awards", "collaborations", "dynasty", "hall_of_fame", "narrative",
];

// ── Tier display ─────────────────────────────────────────────────────────────

const TIER_LABELS = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

function tierColor(tier: number): string {
  if (tier === 1) return "bg-stone-600 text-stone-200";
  if (tier === 2) return "bg-blue-700 text-blue-100";
  if (tier === 3) return "bg-yellow-600 text-yellow-100";
  if (tier === 4) return "bg-purple-700 text-purple-100";
  return "bg-amber-500 text-amber-950"; // 5+
}

// ── Current value computation ────────────────────────────────────────────────

function getCurrentValue(def: AchievementDef, state: GameState): number {
  // Streaming: total catalog streams
  if (def.id.startsWith("stream_")) {
    return state.songs.reduce((s, x) => s + x.streamsTotal, 0);
  }

  // Merch
  if (def.id.startsWith("merch_")) {
    return state.revenueHistory?.merch ?? 0;
  }

  // Touring
  if (def.id.startsWith("tour_")) {
    return state.revenueHistory?.touring ?? 0;
  }

  // Cash balance
  if (def.id.startsWith("cash_")) {
    return state.money;
  }

  // Charts - depends on specific achievement
  if (def.id.startsWith("chart_")) {
    const playerChartSongs = state.chart.filter((c) => c.isPlayerSong);
    switch (def.id) {
      case "chart_1": // Top 10 debut: count in top 10
        return playerChartSongs.filter((c) => c.position <= 10).length;
      case "chart_2": // Number one: has a #1
        return playerChartSongs.some((c) => c.position === 1) ? 1 : 0;
      case "chart_3": // 5 cumulative #1 songs
      case "chart_4": // 20 cumulative #1 songs
      case "chart_5": // 50 cumulative #1 songs
        return state.songs.filter((s) => s.released && s.chartPosition === 1).length;
      case "chart_6": // 3 songs in top 10 simultaneously
        return playerChartSongs.filter((c) => c.position <= 10).length;
      case "chart_7": // 10 songs in top 20 simultaneously
        return playerChartSongs.filter((c) => c.position <= 20).length;
      default:
        return 0;
    }
  }

  // Albums - depends on specific achievement
  if (def.id.startsWith("album_")) {
    const releasedAlbums = state.albums.filter((al) => al.status === "released");
    switch (def.id) {
      case "album_1": // Release first album
        return releasedAlbums.length;
      case "album_2": // Album reaches 500K streams
        return Math.max(0, ...releasedAlbums.map((al) => al.totalStreams), 0);
      case "album_3": // Album reaches 1M streams
        return Math.max(0, ...releasedAlbums.map((al) => al.totalStreams), 0);
      case "album_4": // Album reaches 5M streams
        return Math.max(0, ...releasedAlbums.map((al) => al.totalStreams), 0);
      case "album_5": // Album reaches 10M streams
        return Math.max(0, ...releasedAlbums.map((al) => al.totalStreams), 0);
      case "album_6": // Album with quality > 90
        return Math.max(0, ...releasedAlbums.map((al) => al.qualityScore), 0);
      default:
        return 0;
    }
  }

  // Awards
  if (def.id.startsWith("award_")) {
    if (def.id === "award_5") {
      // Clean sweep: max player wins in a single ceremony
      return state.awardHistory.length > 0
        ? Math.max(...state.awardHistory.map((c) => c.playerWins.length))
        : 0;
    }
    return state.awardHistory.reduce((sum, c) => sum + c.playerWins.length, 0);
  }

  // Collaborations
  if (def.id.startsWith("collab_")) {
    const collabSongs = state.songs.filter((s) => s.released && s.featuredArtistId);
    switch (def.id) {
      case "collab_1":
        return collabSongs.length;
      case "collab_2": {
        // Superstar summit: binary check
        const hasSuperstarCollab = collabSongs.some((s) => {
          const artist = state.artists.find((a) => a.id === s.artistId);
          const feat = state.artists.find((a) => a.id === s.featuredArtistId)
            ?? state.rivalLabels.flatMap((l) => l.rosterArtists).find((a) => a.id === s.featuredArtistId);
          if (!artist || !feat) return false;
          const artistScore = artist.popularity * 0.35 + artist.fanbase / 20000 * 0.25 + (artist.momentum ?? 30) * 0.20;
          const featScore = feat.popularity * 0.35 + feat.fanbase / 20000 * 0.25 + (feat.momentum ?? 30) * 0.20;
          return artistScore >= 55 && featScore >= 55;
        });
        return hasSuperstarCollab ? 1 : 0;
      }
      case "collab_3":
        return collabSongs.some((s) => s.chartPosition === 1) ? 1 : 0;
      default:
        return 0;
    }
  }

  // Dynasty
  if (def.id.startsWith("dynasty_")) {
    return state.dynastyYears ?? 0;
  }

  // Hall of Fame
  if (def.id.startsWith("hof_")) {
    return (state.hallOfFame ?? []).length;
  }

  // Narrative (binary)
  if (def.id.startsWith("narrative_")) {
    const firstDayOutHit = state.songs.some((s) => {
      if (!s.released || s.chartPosition === null || s.chartPosition > 10) return false;
      const artist = state.artists.find((a) => a.id === s.artistId);
      return artist && artist.releaseFromJailTurn && artist.releaseFromJailTurn > 0;
    });
    return firstDayOutHit ? 1 : 0;
  }

  return 0;
}

// ── Progress bar component ───────────────────────────────────────────────────

function ProgressBar({
  value,
  max,
  barBg,
  barFill,
  height = "h-1.5",
}: {
  value: number;
  max: number;
  barBg: string;
  barFill: string;
  height?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`w-full ${barBg} rounded-full ${height} overflow-hidden`}>
      <div
        className={`${barFill} ${height} rounded-full transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AchievementsPanel() {
  const state = useGameStore() as unknown as GameState;
  const achievements = useGameStore((s) => s.achievements);
  const [activeFilter, setActiveFilter] = useState<"all" | AchievementCategory>("all");

  const unlockedSet = useMemo(() => {
    const map = new Map<string, number | undefined>();
    for (const ap of achievements) {
      if (ap.unlocked) map.set(ap.achievementId, ap.unlockedTurn);
    }
    return map;
  }, [achievements]);

  const totalUnlocked = unlockedSet.size;
  const totalAchievements = ACHIEVEMENT_DEFS.length;
  const pctComplete = totalAchievements > 0 ? Math.round((totalUnlocked / totalAchievements) * 100) : 0;

  // Group defs by category
  const byCategory = useMemo(() => {
    const map = new Map<AchievementCategory, AchievementDef[]>();
    for (const cat of ALL_CATEGORIES) map.set(cat, []);
    for (const def of ACHIEVEMENT_DEFS) {
      map.get(def.category)?.push(def);
    }
    return map;
  }, []);

  // Recently unlocked (last 5 by turn)
  const recentlyUnlocked = useMemo(() => {
    return achievements
      .filter((ap) => ap.unlocked && ap.unlockedTurn != null)
      .sort((a, b) => (b.unlockedTurn ?? 0) - (a.unlockedTurn ?? 0))
      .slice(0, 5)
      .map((ap) => {
        const def = ACHIEVEMENT_DEFS.find((d) => d.id === ap.achievementId);
        return def ? { ...def, unlockedTurn: ap.unlockedTurn! } : null;
      })
      .filter(Boolean) as (AchievementDef & { unlockedTurn: number })[];
  }, [achievements]);

  // Filtered categories to display
  const visibleCategories = activeFilter === "all"
    ? ALL_CATEGORIES
    : [activeFilter];

  return (
    <div className="p-2 sm:p-0 space-y-3 sm:space-y-4">
      {/* ── Summary header ─────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">Achievements</h2>
          <div className="text-sm text-gray-400">
            <span className="text-white font-semibold">{totalUnlocked}</span>
            <span className="mx-1">/</span>
            <span>{totalAchievements}</span>
            <span className="ml-2 text-green-400 font-semibold">{pctComplete}%</span>
          </div>
        </div>
        <ProgressBar
          value={totalUnlocked}
          max={totalAchievements}
          barBg="bg-gray-800"
          barFill="bg-green-500"
          height="h-2"
        />
      </div>

      {/* ── Recently unlocked ──────────────────────────────────────── */}
      {recentlyUnlocked.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Recently Unlocked
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentlyUnlocked.map((def) => {
              const meta = CATEGORY_META[def.category];
              return (
                <div
                  key={def.id}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border ${meta.border} ${meta.bg}`}
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} />
                  <span className={`text-xs font-semibold ${tierColor(def.tier)} px-1.5 py-0.5 rounded text-[10px]`}>
                    {TIER_LABELS[def.tier] ?? def.tier}
                  </span>
                  <span className="text-xs font-medium text-white whitespace-nowrap">
                    {def.name}
                  </span>
                  <span className="text-[10px] text-green-400 whitespace-nowrap">
                    Wk {def.unlockedTurn}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Category filter tabs ───────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveFilter("all")}
          className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            activeFilter === "all"
              ? "bg-white text-gray-900"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
          }`}
        >
          All
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const meta = CATEGORY_META[cat];
          const catDefs = byCategory.get(cat) ?? [];
          const catUnlocked = catDefs.filter((d) => unlockedSet.has(d.id)).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeFilter === cat
                  ? `${meta.bg} ${meta.color} border ${meta.border}`
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
              <span className="text-[10px] opacity-70">
                {catUnlocked}/{catDefs.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Category sections ──────────────────────────────────────── */}
      {visibleCategories.map((cat) => {
        const meta = CATEGORY_META[cat];
        const defs = byCategory.get(cat) ?? [];
        if (defs.length === 0) return null;
        const catUnlocked = defs.filter((d) => unlockedSet.has(d.id)).length;

        return (
          <div key={cat} className="space-y-2">
            {/* Category header */}
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dot}`} />
              <h3 className={`text-sm font-bold ${meta.color}`}>{meta.label}</h3>
              <span className="text-xs text-gray-500">
                {catUnlocked}/{defs.length}
              </span>
              <div className="flex-1 max-w-[120px]">
                <ProgressBar
                  value={catUnlocked}
                  max={defs.length}
                  barBg={meta.barBg}
                  barFill={meta.barFill}
                />
              </div>
            </div>

            {/* Achievement cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {defs.map((def) => {
                const isUnlocked = unlockedSet.has(def.id);
                const unlockedTurn = unlockedSet.get(def.id);
                const currentVal = getCurrentValue(def, state);
                const pct = def.threshold > 0 ? Math.min(100, (currentVal / def.threshold) * 100) : 0;
                const isMoney = def.id.startsWith("merch_") || def.id.startsWith("tour_") || def.id.startsWith("cash_");

                return (
                  <div
                    key={def.id}
                    className={`rounded-lg border p-2.5 transition-colors ${
                      isUnlocked
                        ? "bg-gray-900 border-l-2 border-l-green-500 border-t-gray-700 border-r-gray-700 border-b-gray-700"
                        : "bg-gray-900/60 border-gray-800 opacity-75"
                    }`}
                  >
                    {/* Top row: icon + tier + name */}
                    <div className="flex items-center gap-1.5 mb-1">
                      {/* Lock/unlock icon */}
                      <span className={`text-sm ${isUnlocked ? "text-green-400" : "text-gray-600"}`}>
                        {isUnlocked ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        )}
                      </span>
                      {/* Tier badge */}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tierColor(def.tier)}`}>
                        {TIER_LABELS[def.tier] ?? def.tier}
                      </span>
                      {/* Name */}
                      <span className={`text-xs truncate ${isUnlocked ? "font-bold text-white" : "text-gray-500"}`}>
                        {def.name}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-gray-500 mb-1.5 leading-tight">
                      {def.description}
                    </p>

                    {/* Progress bar */}
                    <ProgressBar
                      value={currentVal}
                      max={def.threshold}
                      barBg={meta.barBg}
                      barFill={isUnlocked ? "bg-green-500" : meta.barFill}
                    />

                    {/* Progress text + unlock info */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-500">
                        {isMoney ? fmtMoney(currentVal) : fmtNum(currentVal)}
                        {" / "}
                        {isMoney ? fmtMoney(def.threshold) : fmtNum(def.threshold)}
                      </span>
                      {isUnlocked && unlockedTurn != null && (
                        <span className="text-[10px] text-green-400 font-medium">
                          Unlocked Week {unlockedTurn}
                        </span>
                      )}
                      {!isUnlocked && (
                        <span className="text-[10px] text-gray-600">
                          {pct.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ── Empty state ────────────────────────────────────────────── */}
      {totalAchievements === 0 && (
        <div className="text-center text-gray-500 py-8 text-sm">
          No achievements defined.
        </div>
      )}
    </div>
  );
}
