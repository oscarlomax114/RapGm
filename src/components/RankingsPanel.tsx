"use client";

import { useState, useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import ArtistSprite from "./ArtistSprite";
import type { Artist, Genre } from "@/lib/types";
import { getVisibleFreeAgents } from "@/lib/engine";
import type { GameState } from "@/lib/types";

const GENRE_COLORS: Record<string, string> = {
  trap: "bg-orange-50 text-orange-700",
  "boom-bap": "bg-yellow-50 text-yellow-700",
  drill: "bg-red-50 text-red-700",
  "r-and-b": "bg-pink-50 text-pink-700",
  "pop-rap": "bg-purple-50 text-purple-700",
  experimental: "bg-cyan-50 text-cyan-700",
};

const ALL_GENRES: Genre[] = ["trap", "boom-bap", "drill", "r-and-b", "pop-rap", "experimental"];

type SortKey = "overallRating" | "age" | "potential" | "popularity" | "fanbase" | "momentum" | "genre";
type SortDir = "asc" | "desc";
type SubTab = "all" | "compare";
type PoolFilter = "all" | "signed" | "freeAgent";

interface RankedArtist extends Artist {
  label: string;
}

const PER_PAGE = 50;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function phaseLabel(phase: string): string {
  return phase
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Stat comparison bar ──────────────────────────────────────────────────────
function ComparisonBar({ label, a, b, max }: { label: string; a: number; b: number; max: number }) {
  const pctA = max > 0 ? (a / max) * 100 : 0;
  const pctB = max > 0 ? (b / max) * 100 : 0;
  const aWins = a > b;
  const bWins = b > a;
  return (
    <div className="grid grid-cols-[1fr_80px_1fr] items-center gap-2 text-xs py-1">
      {/* left value */}
      <div className="flex items-center justify-end gap-2">
        <span className={`font-semibold tabular-nums ${aWins ? "text-green-600" : bWins ? "text-red-500" : "text-gray-600"}`}>
          {typeof a === "number" ? a.toLocaleString() : a}
        </span>
        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${aWins ? "bg-green-400" : bWins ? "bg-red-300" : "bg-gray-300"}`}
            style={{ width: `${Math.min(pctA, 100)}%`, marginLeft: "auto" }}
          />
        </div>
      </div>
      {/* label */}
      <span className="text-center text-gray-500 font-medium">{label}</span>
      {/* right value */}
      <div className="flex items-center gap-2">
        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${bWins ? "bg-green-400" : aWins ? "bg-red-300" : "bg-gray-300"}`}
            style={{ width: `${Math.min(pctB, 100)}%` }}
          />
        </div>
        <span className={`font-semibold tabular-nums ${bWins ? "text-green-600" : aWins ? "text-red-500" : "text-gray-600"}`}>
          {typeof b === "number" ? b.toLocaleString() : b}
        </span>
      </div>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────
export default function RankingsPanel() {
  const store = useGameStore();
  const { artists, rivalLabels, labelName, songs } = store;

  // Sub-tab
  const [subTab, setSubTab] = useState<SubTab>("all");

  // Filters
  const [poolFilter, setPoolFilter] = useState<PoolFilter>("all");
  const [genreFilter, setGenreFilter] = useState<string>("All");
  const [minOvr, setMinOvr] = useState(0);
  const [maxAge, setMaxAge] = useState(99);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("overallRating");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(0);

  // Compare
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");

  // ── Build merged artist list (respects scouting fog-of-war) ──────────────
  const signed = artists.filter((a) => a.signed);
  const visibleFreeAgents = useMemo(() => getVisibleFreeAgents(store as unknown as GameState), [store]);

  const allArtists: RankedArtist[] = useMemo(() => {
    return [
      ...signed.map((a) => ({ ...a, label: labelName })),
      ...rivalLabels.flatMap((rl) => rl.rosterArtists.map((a) => ({ ...a, label: rl.name }))),
      ...visibleFreeAgents.map((a) => ({ ...a, label: "Free Agent" })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artists, rivalLabels, visibleFreeAgents, labelName]);

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allArtists;

    // Pool filter
    if (poolFilter === "signed") {
      list = list.filter((a) => a.label !== "Free Agent");
    } else if (poolFilter === "freeAgent") {
      list = list.filter((a) => a.label === "Free Agent");
    }

    // Genre
    if (genreFilter !== "All") {
      list = list.filter((a) => a.genre === genreFilter);
    }

    // Min OVR
    if (minOvr > 0) {
      list = list.filter((a) => a.overallRating >= minOvr);
    }

    // Max age
    if (maxAge < 99) {
      list = list.filter((a) => a.age <= maxAge);
    }

    // Sort
    const dir = sortDir === "desc" ? -1 : 1;
    list = [...list].sort((a, b) => {
      if (sortKey === "genre") {
        return dir * a.genre.localeCompare(b.genre);
      }
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return dir * (av - bv);
    });

    return list;
  }, [allArtists, poolFilter, genreFilter, minOvr, maxAge, sortKey, sortDir]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pageSlice = filtered.slice(safePage * PER_PAGE, (safePage + 1) * PER_PAGE);

  // ── Sort handler ──────────────────────────────────────────────────────────
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return null;
    return <span className="ml-0.5 text-blue-500">{sortDir === "desc" ? "\u25BC" : "\u25B2"}</span>;
  }

  // ── Compare helpers ───────────────────────────────────────────────────────
  const artistA = allArtists.find((a) => a.id === compareA);
  const artistB = allArtists.find((a) => a.id === compareB);

  const playerArtistIds = new Set(signed.map((a) => a.id));

  // ── Column header button ──────────────────────────────────────────────────
  const ColHeader = ({ label, sortKeyName, className }: { label: string; sortKeyName: SortKey; className?: string }) => (
    <th
      className={`px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 select-none whitespace-nowrap ${className ?? ""}`}
      onClick={() => toggleSort(sortKeyName)}
    >
      {label}
      {sortIndicator(sortKeyName)}
    </th>
  );

  return (
    <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
      {/* Sub-tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-md p-1 w-fit">
        {(["all", "compare"] as SubTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-1.5 text-xs font-medium rounded transition-colors ${
              subTab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "all" ? "All Artists" : "Compare"}
          </button>
        ))}
      </div>

      {/* ── ALL ARTISTS TAB ──────────────────────────────────────────────────── */}
      {subTab === "all" && (
        <section className="bg-white border border-gray-200 rounded-md">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            {/* Pool filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-gray-500 font-medium">Pool:</span>
              {(["all", "signed", "freeAgent"] as PoolFilter[]).map((p) => (
                <button
                  key={p}
                  onClick={() => { setPoolFilter(p); setPage(0); }}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    poolFilter === p
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {p === "all" ? "All" : p === "signed" ? "Signed Only" : "Free Agents"}
                </button>
              ))}
            </div>

            {/* Genre */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-gray-500 font-medium">Genre:</span>
              <select
                value={genreFilter}
                onChange={(e) => { setGenreFilter(e.target.value); setPage(0); }}
                className="border border-gray-200 rounded px-2 py-1 text-xs bg-white text-gray-700"
              >
                <option value="All">All</option>
                {ALL_GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Min OVR */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-gray-500 font-medium">Min OVR:</span>
              <input
                type="range"
                min={0}
                max={99}
                value={minOvr}
                onChange={(e) => { setMinOvr(Number(e.target.value)); setPage(0); }}
                className="w-20 h-1 accent-blue-500"
              />
              <input
                type="number"
                min={0}
                max={99}
                value={minOvr}
                onChange={(e) => { setMinOvr(Math.max(0, Math.min(99, Number(e.target.value)))); setPage(0); }}
                className="w-10 border border-gray-200 rounded px-1 py-0.5 text-xs text-center bg-white text-gray-700"
              />
            </div>

            {/* Max Age */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-gray-500 font-medium">Max Age:</span>
              <input
                type="number"
                min={14}
                max={99}
                value={maxAge}
                onChange={(e) => { setMaxAge(Math.max(14, Math.min(99, Number(e.target.value)))); setPage(0); }}
                className="w-12 border border-gray-200 rounded px-1 py-0.5 text-xs text-center bg-white text-gray-700"
              />
            </div>

            {/* Count */}
            <span className="text-[10px] text-gray-400 ml-auto">{filtered.length} artists</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide w-8">#</th>
                  <th className="px-1 py-2 w-8"></th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Label</th>
                  <ColHeader label="Genre" sortKeyName="genre" />
                  <ColHeader label="Age" sortKeyName="age" />
                  <ColHeader label="OVR" sortKeyName="overallRating" />
                  <ColHeader label="POT" sortKeyName="potential" />
                  <ColHeader label="POP" sortKeyName="popularity" />
                  <ColHeader label="Fans" sortKeyName="fanbase" />
                  <ColHeader label="MOM" sortKeyName="momentum" />
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Phase</th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Hits</th>
                </tr>
              </thead>
              <tbody>
                {pageSlice.length === 0 && (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-gray-400">No artists match the current filters.</td>
                  </tr>
                )}
                {pageSlice.map((a, idx) => {
                  const rank = safePage * PER_PAGE + idx + 1;
                  const isPlayer = playerArtistIds.has(a.id);
                  return (
                    <tr
                      key={`${a.id}-${a.label}`}
                      className={`border-b border-gray-50 ${
                        isPlayer
                          ? "bg-blue-50/60"
                          : idx % 2 === 0
                          ? "bg-white"
                          : "bg-gray-50/40"
                      }`}
                    >
                      <td className="px-2 py-1.5 text-gray-400 font-medium tabular-nums">{rank}</td>
                      <td className="px-1 py-1">
                        <ArtistSprite spriteIndex={a.spriteIndex} size={24} />
                      </td>
                      <td className="px-2 py-1.5 text-gray-900 font-medium truncate max-w-[140px]">{a.name}</td>
                      <td className={`px-2 py-1.5 truncate max-w-[120px] ${
                        isPlayer ? "text-blue-600 font-medium" : a.label === "Free Agent" ? "text-gray-400 italic" : "text-gray-600"
                      }`}>
                        {a.label}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${GENRE_COLORS[a.genre] ?? "bg-gray-100 text-gray-600"}`}>
                          {a.genre}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 tabular-nums">{a.age}</td>
                      <td className={`px-2 py-1.5 font-semibold tabular-nums ${
                        a.overallRating >= 80 ? "text-green-600" : a.overallRating >= 60 ? "text-gray-800" : "text-gray-500"
                      }`}>
                        {Math.round(a.overallRating)}
                      </td>
                      <td className={`px-2 py-1.5 tabular-nums ${
                        a.potential >= 85 ? "text-purple-600 font-semibold" : a.potential >= 70 ? "text-gray-700" : "text-gray-500"
                      }`}>
                        {a.potential}
                      </td>
                      <td className="px-2 py-1.5 text-gray-600 tabular-nums">{a.popularity}</td>
                      <td className="px-2 py-1.5 text-gray-600 tabular-nums">{formatNumber(a.fanbase)}</td>
                      <td className={`px-2 py-1.5 tabular-nums ${
                        a.momentum >= 70 ? "text-amber-600 font-semibold" : a.momentum >= 40 ? "text-gray-700" : "text-gray-500"
                      }`}>
                        {a.momentum}
                      </td>
                      <td className="px-2 py-1.5 text-gray-500 truncate max-w-[90px]">{phaseLabel(a.careerPhase)}</td>
                      <td className="px-2 py-1.5 text-gray-600 tabular-nums">{a.chartHits}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="px-3 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="text-[10px] text-gray-500">
                Page {safePage + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="px-3 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </section>
      )}

      {/* ── COMPARE TAB ──────────────────────────────────────────────────────── */}
      {subTab === "compare" && (
        <section className="bg-white border border-gray-200 rounded-md p-5 space-y-5">
          {/* Artist pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* Artist A */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Artist A</label>
              <select
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white text-gray-700"
              >
                <option value="">Select artist...</option>
                {allArtists
                  .sort((a, b) => b.overallRating - a.overallRating)
                  .map((a) => (
                    <option key={`a-${a.id}-${a.label}`} value={a.id}>
                      {a.name} ({Math.round(a.overallRating)} OVR) — {a.label}
                    </option>
                  ))}
              </select>
            </div>
            {/* Artist B */}
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Artist B</label>
              <select
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white text-gray-700"
              >
                <option value="">Select artist...</option>
                {allArtists
                  .sort((a, b) => b.overallRating - a.overallRating)
                  .map((a) => (
                    <option key={`b-${a.id}-${a.label}`} value={a.id}>
                      {a.name} ({Math.round(a.overallRating)} OVR) — {a.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Comparison display */}
          {artistA && artistB ? (
            <div className="space-y-4">
              {/* Header cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {[artistA, artistB].map((artist) => (
                  <div key={`card-${artist.id}-${artist.label}`} className={`flex items-center gap-3 p-3 rounded-md border ${
                    playerArtistIds.has(artist.id) ? "border-blue-200 bg-blue-50/40" : "border-gray-200 bg-gray-50/40"
                  }`}>
                    <ArtistSprite spriteIndex={artist.spriteIndex} size={64} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{artist.name}</div>
                      <div className={`text-xs ${
                        playerArtistIds.has(artist.id) ? "text-blue-600" : artist.label === "Free Agent" ? "text-gray-400 italic" : "text-gray-500"
                      }`}>
                        {artist.label}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${GENRE_COLORS[artist.genre] ?? "bg-gray-100 text-gray-600"}`}>
                          {artist.genre}
                        </span>
                        <span className="text-[10px] text-gray-500">Age {artist.age}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Core stats comparison */}
              <div className="border border-gray-200 rounded-md p-4">
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Core Stats</h3>
                <ComparisonBar label="OVR" a={Math.round(artistA.overallRating)} b={Math.round(artistB.overallRating)} max={100} />
                <ComparisonBar label="POT" a={artistA.potential} b={artistB.potential} max={100} />
                <ComparisonBar label="POP" a={artistA.popularity} b={artistB.popularity} max={100} />
                <ComparisonBar label="Fans" a={artistA.fanbase} b={artistB.fanbase} max={Math.max(artistA.fanbase, artistB.fanbase, 1)} />
                <ComparisonBar label="MOM" a={artistA.momentum} b={artistB.momentum} max={100} />
                <ComparisonBar label="Buzz" a={artistA.buzz} b={artistB.buzz} max={100} />
                <ComparisonBar label="Morale" a={artistA.morale} b={artistB.morale} max={100} />
                <ComparisonBar label="Fatigue" a={artistA.fatigue} b={artistB.fatigue} max={100} />
              </div>

              {/* Career comparison */}
              <div className="border border-gray-200 rounded-md p-4">
                <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Career</h3>
                <div className="grid grid-cols-[1fr_80px_1fr] text-xs gap-y-2">
                  {/* Phase */}
                  <div className="text-right text-gray-700">{phaseLabel(artistA.careerPhase)}</div>
                  <div className="text-center text-gray-500 font-medium">Phase</div>
                  <div className="text-left text-gray-700">{phaseLabel(artistB.careerPhase)}</div>
                  {/* Chart Hits */}
                  <div className={`text-right font-semibold tabular-nums ${artistA.chartHits > artistB.chartHits ? "text-green-600" : artistA.chartHits < artistB.chartHits ? "text-red-500" : "text-gray-600"}`}>
                    {artistA.chartHits}
                  </div>
                  <div className="text-center text-gray-500 font-medium">Chart Hits</div>
                  <div className={`text-left font-semibold tabular-nums ${artistB.chartHits > artistA.chartHits ? "text-green-600" : artistB.chartHits < artistA.chartHits ? "text-red-500" : "text-gray-600"}`}>
                    {artistB.chartHits}
                  </div>
                  {/* Singles */}
                  <div className={`text-right font-semibold tabular-nums ${artistA.totalSinglesReleased > artistB.totalSinglesReleased ? "text-green-600" : artistA.totalSinglesReleased < artistB.totalSinglesReleased ? "text-red-500" : "text-gray-600"}`}>
                    {artistA.totalSinglesReleased}
                  </div>
                  <div className="text-center text-gray-500 font-medium">Singles</div>
                  <div className={`text-left font-semibold tabular-nums ${artistB.totalSinglesReleased > artistA.totalSinglesReleased ? "text-green-600" : artistB.totalSinglesReleased < artistA.totalSinglesReleased ? "text-red-500" : "text-gray-600"}`}>
                    {artistB.totalSinglesReleased}
                  </div>
                  {/* Albums */}
                  <div className={`text-right font-semibold tabular-nums ${artistA.totalAlbumsReleased > artistB.totalAlbumsReleased ? "text-green-600" : artistA.totalAlbumsReleased < artistB.totalAlbumsReleased ? "text-red-500" : "text-gray-600"}`}>
                    {artistA.totalAlbumsReleased}
                  </div>
                  <div className="text-center text-gray-500 font-medium">Albums</div>
                  <div className={`text-left font-semibold tabular-nums ${artistB.totalAlbumsReleased > artistA.totalAlbumsReleased ? "text-green-600" : artistB.totalAlbumsReleased < artistA.totalAlbumsReleased ? "text-red-500" : "text-gray-600"}`}>
                    {artistB.totalAlbumsReleased}
                  </div>
                  {/* Durability */}
                  <div className="text-right text-gray-700 capitalize">{artistA.durability}</div>
                  <div className="text-center text-gray-500 font-medium">Durability</div>
                  <div className="text-left text-gray-700 capitalize">{artistB.durability}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 text-sm">
              Select two artists above to compare them side by side.
            </div>
          )}
        </section>
      )}
    </div>
  );
}
