"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { RivalLabel, Genre, Artist } from "@/lib/types";

const GENRE_COLORS: Record<Genre, string> = {
  trap: "bg-red-50 text-red-700",
  "boom-bap": "bg-amber-50 text-amber-700",
  drill: "bg-gray-100 text-gray-700",
  "r-and-b": "bg-purple-50 text-purple-700",
  "pop-rap": "bg-pink-50 text-pink-700",
  experimental: "bg-cyan-50 text-cyan-700",
};

const GENRE_LABELS: Record<Genre, string> = {
  trap: "Trap",
  "boom-bap": "Boom Bap",
  drill: "Drill",
  "r-and-b": "R&B",
  "pop-rap": "Pop Rap",
  experimental: "Experimental",
};

function fmt(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

function PrestigeBar({ value }: { value: number }) {
  const color =
    value >= 75 ? "bg-amber-500" :
    value >= 55 ? "bg-blue-500" :
    value >= 35 ? "bg-gray-400" :
    "bg-gray-300";
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

function OvrBadge({ ovr }: { ovr: number }) {
  const color =
    ovr >= 85 ? "text-amber-700 border-amber-300" :
    ovr >= 70 ? "text-green-700 border-green-300" :
    ovr >= 50 ? "text-blue-700 border-blue-300" :
    "text-gray-500 border-gray-300";
  return (
    <span className={`text-xs font-semibold border rounded px-1.5 py-0.5 ${color}`}>
      {ovr} OVR
    </span>
  );
}

export default function LabelsPanel() {
  const { rivalLabels, labelName, reputation, fanbase, awardHistory, chart, industrySongs, artists, freeAgentPool } = useGameStore();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const playerChartSongs = chart.filter((e) => e.isPlayerSong).length;
  const playerTotalStreams = industrySongs.reduce((sum, s) => sum + s.streamsTotal, 0); // rival total for comparison
  const playerAwardWins = awardHistory.reduce((sum, c) => sum + c.playerWins.length, 0);
  const signedCount = artists.filter((a) => a.signed).length;

  // Sort labels by prestige
  const sortedLabels = [...rivalLabels].sort((a, b) => b.prestige - a.prestige);
  const selected = selectedLabel ? rivalLabels.find((l) => l.id === selectedLabel) : null;

  // suppress unused var warning
  void playerTotalStreams;

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-md p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-gray-900 font-semibold text-sm">Industry Overview</h2>
            <p className="text-gray-400 text-xs mt-1">
              {rivalLabels.length} competing labels &middot; {freeAgentPool.length} free agents in the market
            </p>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-xs">Your Label</div>
            <div className="text-blue-600 font-semibold text-sm">{labelName}</div>
            <div className="text-gray-400 text-xs mt-1">Rep {reputation} &middot; {signedCount} artists</div>
          </div>
        </div>
      </div>

      {/* Your label card (mini) */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-900 font-semibold text-sm">{labelName}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">You</span>
          </div>
          <div className="text-xs text-gray-500">{playerAwardWins} award win{playerAwardWins !== 1 ? "s" : ""}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div>
            <div className="text-gray-500">Reputation</div>
            <div className="text-blue-600 font-semibold text-sm">{reputation}</div>
          </div>
          <div>
            <div className="text-gray-500">Fanbase</div>
            <div className="text-gray-900 font-semibold text-sm">{fmt(fanbase)}</div>
          </div>
          <div>
            <div className="text-gray-500">Chart Songs</div>
            <div className="text-gray-900 font-semibold text-sm">{playerChartSongs}</div>
          </div>
        </div>
      </div>

      {/* Label detail modal */}
      {selected && (
        <LabelDetailModal label={selected} chart={chart} onClose={() => setSelectedLabel(null)} />
      )}

      {/* Rival labels grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sortedLabels.map((label) => {
          const chartSongs = chart.filter((e) => !e.isPlayerSong && e.labelName === label.name);
          return (
            <button
              key={label.id}
              onClick={() => setSelectedLabel(label.id)}
              className="bg-white border border-gray-200 rounded-md p-4 text-left hover:border-gray-300 hover:shadow-sm transition w-full"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 font-semibold text-sm">{label.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${GENRE_COLORS[label.primaryGenre]}`}>
                    {GENRE_LABELS[label.primaryGenre]}
                  </span>
                </div>
                {label.awardWins > 0 && (
                  <span className="text-amber-600 text-xs font-medium">{label.awardWins} wins</span>
                )}
              </div>

              {/* Prestige bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                  <span>Prestige</span>
                  <span>{label.prestige}/100</span>
                </div>
                <PrestigeBar value={label.prestige} />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div>
                  <div className="text-gray-400">Artists</div>
                  <div className="text-gray-900 font-medium">{label.rosterArtists.length}</div>
                </div>
                <div>
                  <div className="text-gray-400">Releases</div>
                  <div className="text-gray-900 font-medium">{label.totalSongsReleased}</div>
                </div>
                <div>
                  <div className="text-gray-400">On Chart</div>
                  <div className="text-gray-900 font-medium">{chartSongs.length}</div>
                </div>
              </div>

              {/* Artist names preview */}
              <div className="mt-2 text-[10px] text-gray-400 truncate">
                {label.rosterArtists.slice(0, 4).map(a => a.name).join(", ")}
                {label.rosterArtists.length > 4 && ` +${label.rosterArtists.length - 4}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RivalArtistCard({ artist }: { artist: Artist }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-gray-900 text-sm font-medium">{artist.name}</span>
        <OvrBadge ovr={artist.overallRating} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${GENRE_COLORS[artist.genre]}`}>
          {GENRE_LABELS[artist.genre]}
        </span>
        {artist.careerPhase && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
            artist.careerPhase === "peak" ? "text-amber-700 border-amber-300 bg-amber-50"
            : artist.careerPhase === "established" ? "text-green-700 border-green-300 bg-green-50"
            : artist.careerPhase === "breakout" ? "text-emerald-700 border-emerald-300 bg-emerald-50"
            : artist.careerPhase === "buzzing" ? "text-blue-700 border-blue-300 bg-blue-50"
            : artist.careerPhase === "emerging" ? "text-cyan-700 border-cyan-300 bg-cyan-50"
            : artist.careerPhase === "legacy" ? "text-amber-700 border-amber-300 bg-amber-50"
            : artist.careerPhase === "declining" ? "text-red-600 border-red-300 bg-red-50"
            : artist.careerPhase === "washed" ? "text-red-700 border-red-300 bg-red-50"
            : "text-gray-500 border-gray-300 bg-gray-50"
          }`}>
            {artist.careerPhase.charAt(0).toUpperCase() + artist.careerPhase.slice(1)}
          </span>
        )}
        <span className="text-gray-400 text-[10px]">Age {artist.age}</span>
        <span className="text-gray-400 text-[10px]">Pop {artist.popularity}</span>
        <span className="text-gray-400 text-[10px]">Pot {artist.potential}</span>
        {artist.momentum !== undefined && <span className="text-gray-400 text-[10px]">Mom {artist.momentum}</span>}
      </div>
    </div>
  );
}

function LabelDetailModal({ label, chart, onClose }: {
  label: RivalLabel;
  chart: { position: number; title: string; artistName: string; labelName: string; isPlayerSong: boolean; streams: number }[];
  onClose: () => void;
}) {
  const chartSongs = chart.filter((e) => !e.isPlayerSong && e.labelName === label.name);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border border-gray-200 rounded-md shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-gray-900 font-semibold text-lg">{label.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded ${GENRE_COLORS[label.primaryGenre]}`}>
                  {GENRE_LABELS[label.primaryGenre]}
                </span>
                {label.awardWins > 0 && (
                  <span className="text-amber-600 text-xs font-medium">{label.awardWins} Award Win{label.awardWins !== 1 ? "s" : ""}</span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl px-2">&#x2715;</button>
          </div>
        </div>

        {/* Stats */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Prestige" value={`${label.prestige}/100`} color="text-blue-600" />
            <StatCard label="Activity" value={`${label.activityLevel}/100`} color="text-green-700" />
            <StatCard label="Total Releases" value={`${label.totalSongsReleased}`} color="text-gray-900" />
            <StatCard label="Total Streams" value={fmt(label.totalStreams)} color="text-gray-900" />
            <StatCard label="Chart Hits (Top 10)" value={`${label.chartHits}`} color="text-amber-600" />
            <StatCard label="Roster Size" value={`${label.rosterArtists.length}`} color="text-gray-900" />
          </div>

          {/* Prestige bar */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Prestige Level</span>
              <span>{label.prestige >= 75 ? "Elite" : label.prestige >= 55 ? "Major" : label.prestige >= 35 ? "Mid-Tier" : "Underground"}</span>
            </div>
            <PrestigeBar value={label.prestige} />
          </div>

          {/* Roster */}
          <div>
            <h3 className="text-gray-900 font-semibold text-sm mb-2">Signed Artists</h3>
            <div className="space-y-1.5">
              {label.rosterArtists.map((artist, i) => (
                <RivalArtistCard key={artist.id || i} artist={artist} />
              ))}
            </div>
          </div>

          {/* Current chart songs */}
          {chartSongs.length > 0 && (
            <div>
              <h3 className="text-gray-900 font-semibold text-sm mb-2">Currently Charting</h3>
              <div className="space-y-1">
                {chartSongs.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs font-mono w-5">#{entry.position}</span>
                      <div>
                        <div className="text-gray-900 text-sm">{entry.title}</div>
                        <div className="text-gray-400 text-xs">{entry.artistName}</div>
                      </div>
                    </div>
                    <span className="text-gray-500 text-xs">{fmt(entry.streams)} streams</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent releases (from active songs) */}
          {label.activeSongs.length > 0 && (
            <div>
              <h3 className="text-gray-900 font-semibold text-sm mb-2">Recent Releases</h3>
              <div className="space-y-1">
                {label.activeSongs.slice(0, 8).map((song) => (
                  <div key={song.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2">
                    <div>
                      <div className="text-gray-900 text-sm">{song.title}</div>
                      <div className="text-gray-400 text-xs">{song.artistName} &middot; Q{song.quality}</div>
                    </div>
                    <span className="text-gray-500 text-xs">{fmt(song.streamsTotal)} streams</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Close */}
        <div className="p-5 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-3 text-center">
      <div className="text-gray-400 text-[10px]">{label}</div>
      <div className={`font-semibold text-sm ${color}`}>{value}</div>
    </div>
  );
}
