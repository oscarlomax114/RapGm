"use client";
import { useMemo, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { HallOfFameEntry, HoFTier, Genre } from "@/lib/types";
import ArtistSprite from "./ArtistSprite";

type SortKey = "score" | "inductionYear" | "awards" | "numberOneSongs" | "totalStreams" | "overallRating" | "careerYears";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "inductionYear", label: "Year" },
  { key: "awards", label: "Awards" },
  { key: "numberOneSongs", label: "#1 Songs" },
  { key: "totalStreams", label: "Streams" },
  { key: "overallRating", label: "OVR" },
  { key: "careerYears", label: "Career Years" },
];

const TIER_LABELS: Record<HoFTier, string> = {
  first_ballot: "First Ballot",
  strong_candidate: "Strong Candidate",
  eligible: "Eligible",
};

const TIER_COLORS: Record<HoFTier, string> = {
  first_ballot: "bg-yellow-100 text-yellow-800 border-yellow-300",
  strong_candidate: "bg-blue-100 text-blue-800 border-blue-300",
  eligible: "bg-gray-100 text-gray-600 border-gray-300",
};

const GENRE_LABELS: Record<Genre, string> = {
  trap: "Trap",
  "boom-bap": "Boom Bap",
  drill: "Drill",
  "r-and-b": "R&B",
  "pop-rap": "Pop Rap",
  experimental: "Experimental",
};

function fmtStreams(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return String(n);
}

function getSortValue(entry: HallOfFameEntry, key: SortKey): number {
  switch (key) {
    case "score": return entry.score;
    case "inductionYear": return entry.inductionYear;
    case "awards": return entry.stats.awards;
    case "numberOneSongs": return entry.stats.numberOneSongs;
    case "totalStreams": return entry.stats.totalStreams;
    case "overallRating": return entry.stats.overallRating;
    case "careerYears": return entry.stats.careerYears;
  }
}

export default function HallOfFamePanel() {
  const hallOfFame = useGameStore((s) => s.hallOfFame);
  const globalHallOfFame = useGameStore((s) => s.globalHallOfFame);
  const labelName = useGameStore((s) => s.labelName);

  const [tierFilter, setTierFilter] = useState<HoFTier | "all">("all");
  const [labelFilter, setLabelFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);

  // Merge player HoF (injecting labelName) with global HoF
  const merged = useMemo(() => {
    const playerEntries: HallOfFameEntry[] = hallOfFame.map((e) => ({
      ...e,
      labelName: labelName,
    }));
    return [...playerEntries, ...globalHallOfFame];
  }, [hallOfFame, globalHallOfFame, labelName]);

  // Unique label names for filter dropdown
  const uniqueLabels = useMemo(() => {
    const set = new Set<string>();
    for (const e of merged) {
      if (e.labelName) set.add(e.labelName);
    }
    return Array.from(set).sort();
  }, [merged]);

  // Filtered + sorted list
  const displayed = useMemo(() => {
    let list = [...merged];

    if (tierFilter !== "all") {
      list = list.filter((e) => e.tier === tierFilter);
    }
    if (labelFilter !== "all") {
      if (labelFilter === "__player__") {
        list = list.filter((e) => e.labelName === labelName);
      } else {
        list = list.filter((e) => e.labelName === labelFilter);
      }
    }

    list.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      return sortAsc ? va - vb : vb - va;
    });

    return list;
  }, [merged, tierFilter, labelFilter, sortKey, sortAsc, labelName]);

  // Summary stats
  const totalInductees = merged.length;
  const firstBallotCount = merged.filter((e) => e.tier === "first_ballot").length;
  const playerCount = merged.filter((e) => e.labelName === labelName).length;

  if (totalInductees === 0) {
    return (
      <div className="p-4">
        <div className="bg-white border border-gray-200 rounded-md p-5 mb-4">
          <h2 className="text-gray-900 font-semibold text-sm">Hall of Fame</h2>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
          <p className="text-gray-500 text-sm">The Hall of Fame is empty. Retire legendary artists to see them inducted here.</p>
        </div>
      </div>
    );
  }

  function handleSortClick(key: SortKey) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  return (
    <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-md p-3 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-gray-900 font-semibold text-sm">Hall of Fame</h2>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-gray-400 text-xs">Total</div>
              <div className="text-gray-900 font-semibold text-lg">{totalInductees}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xs">First Ballot</div>
              <div className="text-yellow-600 font-semibold text-lg">{firstBallotCount}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-400 text-xs">Your Label</div>
              <div className="text-blue-600 font-semibold text-lg">{playerCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Tier filter */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs font-medium">Tier:</span>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as HoFTier | "all")}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All</option>
              <option value="first_ballot">First Ballot</option>
              <option value="strong_candidate">Strong Candidate</option>
              <option value="eligible">Eligible</option>
            </select>
          </div>

          {/* Label filter */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs font-medium">Label:</span>
            <select
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All</option>
              <option value="__player__">Your Label</option>
              {uniqueLabels
                .filter((l) => l !== labelName)
                .map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-xs font-medium">Sort:</span>
            <select
              value={sortKey}
              onChange={(e) => { setSortKey(e.target.value as SortKey); setSortAsc(false); }}
              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={() => setSortAsc((prev) => !prev)}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded px-2 py-1"
              title={sortAsc ? "Ascending" : "Descending"}
            >
              {sortAsc ? "↑" : "↓"}
            </button>
          </div>

          {/* Result count */}
          <span className="text-gray-400 text-xs ml-auto">
            {displayed.length} inductee{displayed.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-md overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-left">
              <th className="px-3 py-2 font-medium w-10">#</th>
              <th className="px-1 py-2 font-medium w-8"></th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Genre</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium cursor-pointer select-none" onClick={() => handleSortClick("inductionYear")}>
                Year{sortKey === "inductionYear" ? (sortAsc ? " ↑" : " ↓") : ""}
              </th>
              <th className="px-3 py-2 font-medium cursor-pointer select-none text-right" onClick={() => handleSortClick("overallRating")}>
                OVR{sortKey === "overallRating" ? (sortAsc ? " ↑" : " ↓") : ""}
              </th>
              <th className="px-3 py-2 font-medium cursor-pointer select-none text-right" onClick={() => handleSortClick("awards")}>
                Awards{sortKey === "awards" ? (sortAsc ? " ↑" : " ↓") : ""}
              </th>
              <th className="px-3 py-2 font-medium cursor-pointer select-none text-right" onClick={() => handleSortClick("numberOneSongs")}>
                #1s{sortKey === "numberOneSongs" ? (sortAsc ? " ↑" : " ↓") : ""}
              </th>
              <th className="px-3 py-2 font-medium text-right">Albums</th>
              <th className="px-3 py-2 font-medium cursor-pointer select-none text-right" onClick={() => handleSortClick("totalStreams")}>
                Streams{sortKey === "totalStreams" ? (sortAsc ? " ↑" : " ↓") : ""}
              </th>
              <th className="px-3 py-2 font-medium cursor-pointer select-none text-right" onClick={() => handleSortClick("careerYears")}>
                Yrs{sortKey === "careerYears" ? (sortAsc ? " ↑" : " ↓") : ""}
              </th>
              <th className="px-3 py-2 font-medium cursor-pointer select-none text-right" onClick={() => handleSortClick("score")}>
                Score{sortKey === "score" ? (sortAsc ? " ↑" : " ↓") : ""}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-3 py-8 text-center text-gray-400">
                  No inductees match these filters.
                </td>
              </tr>
            ) : (
              displayed.map((entry, idx) => {
                const isPlayer = entry.labelName === labelName;
                return (
                  <tr
                    key={`${entry.artistId}-${entry.inductionTurn}`}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${isPlayer ? "bg-blue-50" : ""}`}
                  >
                    <td className="px-3 py-2 text-gray-400 font-medium">{idx + 1}</td>
                    <td className="px-1 py-2">
                      {entry.spriteIndex != null ? (
                        <ArtistSprite spriteIndex={entry.spriteIndex} size={24} />
                      ) : (
                        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-[10px] font-bold">
                          {entry.artistName.charAt(0)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{entry.artistName}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${isPlayer ? "text-blue-600 font-medium" : "text-gray-600"}`}>
                      {entry.labelName || "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                      {entry.genre ? GENRE_LABELS[entry.genre] : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${TIER_COLORS[entry.tier]}`}>
                        {TIER_LABELS[entry.tier]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{entry.inductionYear}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-medium">{entry.stats.overallRating}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{entry.stats.awards}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{entry.stats.numberOneSongs}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{entry.stats.platinumAlbums}</td>
                    <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">{fmtStreams(entry.stats.totalStreams)}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{entry.stats.careerYears}</td>
                    <td className="px-3 py-2 text-right text-gray-900 font-semibold">{entry.score}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
