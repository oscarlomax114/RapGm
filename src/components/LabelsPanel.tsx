"use client";
import { useState, useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { RivalLabel, Genre, Artist, ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS } from "@/lib/types";
import ArtistSprite from "./ArtistSprite";

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

type SortKey = "rank" | "name" | "genre" | "prestige" | "artists" | "releases" | "streams" | "chartSongs" | "awardWins";
type SortDir = "asc" | "desc";

interface LeaderboardRow {
  id: string;
  name: string;
  genre: string;
  prestige: number;
  artists: number;
  releases: number;
  streams: number;
  chartSongs: number;
  awardWins: number;
  isPlayer: boolean;
  rivalRef: RivalLabel | null;
}

export default function LabelsPanel() {
  const { rivalLabels, labelName, reputation, fanbase, awardHistory, chart, artists, freeAgentPool } = useGameStore();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("prestige");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const playerChartSongs = chart.filter((e) => e.isPlayerSong).length;
  const playerAwardWins = awardHistory.reduce((sum, c) => sum + c.playerWins.length, 0);
  const signedArtists = artists.filter((a) => a.signed);
  const playerStreams = signedArtists.reduce((sum, a) => a.fanbase + sum, 0); // proxy

  // Build unified leaderboard rows
  const rows: LeaderboardRow[] = useMemo(() => {
    const playerRow: LeaderboardRow = {
      id: "__player__",
      name: labelName,
      genre: "Multi",
      prestige: reputation,
      artists: signedArtists.length,
      releases: 0, // player releases tracked differently
      streams: playerStreams,
      chartSongs: playerChartSongs,
      awardWins: playerAwardWins,
      isPlayer: true,
      rivalRef: null,
    };

    const rivalRows: LeaderboardRow[] = rivalLabels.map((l) => ({
      id: l.id,
      name: l.name,
      genre: GENRE_LABELS[l.primaryGenre],
      prestige: l.prestige,
      artists: l.rosterArtists.length,
      releases: l.totalSongsReleased,
      streams: l.totalStreams,
      chartSongs: chart.filter((e) => !e.isPlayerSong && e.labelName === l.name).length,
      awardWins: l.awardWins,
      isPlayer: false,
      rivalRef: l,
    }));

    return [playerRow, ...rivalRows];
  }, [rivalLabels, labelName, reputation, signedArtists.length, playerStreams, playerChartSongs, playerAwardWins, chart]);

  // Sort rows
  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      let aVal: string | number = a[sortKey as keyof LeaderboardRow] as string | number;
      let bVal: string | number = b[sortKey as keyof LeaderboardRow] as string | number;
      if (sortKey === "rank") {
        aVal = a.prestige;
        bVal = b.prestige;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return sorted;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const selected = selectedLabel ? rivalLabels.find((l) => l.id === selectedLabel) : null;

  const SortHeader = ({ label, col, className }: { label: string; col: SortKey; className?: string }) => (
    <th
      className={`px-2 py-1.5 text-left text-sm font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 whitespace-nowrap ${className ?? ""}`}
      onClick={() => handleSort(col)}
    >
      {label}
      {sortKey === col && (
        <span className="ml-0.5 text-gray-400">{sortDir === "desc" ? " \u25BC" : " \u25B2"}</span>
      )}
    </th>
  );

  return (
    <div className="p-2 sm:p-3 space-y-3">
      {/* Your label summary — compact inline stat row */}
      <div className="bg-white border border-gray-200 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2 sm:gap-0">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-900 font-semibold text-sm">{labelName}</span>
          <span className="text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-medium">YOU</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-gray-500 flex-wrap">
          <span>Rep <span className="text-gray-900 font-medium">{reputation}</span></span>
          <span>Fanbase <span className="text-gray-900 font-medium">{fmt(fanbase)}</span></span>
          <span>Chart Songs <span className="text-gray-900 font-medium">{playerChartSongs}</span></span>
          <span>Awards <span className="text-gray-900 font-medium">{playerAwardWins}</span></span>
          <span>Artists <span className="text-gray-900 font-medium">{signedArtists.length}</span></span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-400">{rivalLabels.length} rivals &middot; {freeAgentPool.length} free agents</span>
        </div>
      </div>

      {/* Industry leaderboard table */}
      <div className="bg-white border border-gray-200 overflow-x-auto">
        <table className="w-full text-xs min-w-[600px]">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <SortHeader label="#" col="rank" className="w-8 text-center" />
              <SortHeader label="Label" col="name" />
              <SortHeader label="Genre" col="genre" />
              <SortHeader label="Prestige" col="prestige" />
              <SortHeader label="Artists" col="artists" />
              <SortHeader label="Releases" col="releases" />
              <SortHeader label="Streams" col="streams" />
              <SortHeader label="Chart" col="chartSongs" />
              <SortHeader label="Wins" col="awardWins" />
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => {
              const rank = i + 1;
              return (
                <tr
                  key={row.id}
                  onClick={() => {
                    if (!row.isPlayer && row.rivalRef) setSelectedLabel(row.id);
                  }}
                  className={`
                    ${row.isPlayer ? "bg-blue-50 border-l-2 border-l-blue-500" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}
                    ${!row.isPlayer ? "cursor-pointer hover:bg-gray-100" : ""}
                    border-b border-gray-100 last:border-b-0
                  `}
                >
                  <td className="px-2 py-1.5 text-center text-gray-400 font-mono">{rank}</td>
                  <td className="px-2 py-1.5">
                    <span className={`font-medium ${row.isPlayer ? "text-blue-700" : "text-gray-900"}`}>
                      {row.name}
                    </span>
                    {row.isPlayer && <span className="ml-1 text-[9px] text-blue-500 font-medium">YOU</span>}
                  </td>
                  <td className="px-2 py-1.5 text-gray-500">{row.genre}</td>
                  <td className="px-2 py-1.5 text-gray-900 font-medium">{row.prestige}</td>
                  <td className="px-2 py-1.5 text-gray-700">{row.artists}</td>
                  <td className="px-2 py-1.5 text-gray-700">{row.releases}</td>
                  <td className="px-2 py-1.5 text-gray-700">{fmt(row.streams)}</td>
                  <td className="px-2 py-1.5 text-gray-700">{row.chartSongs}</td>
                  <td className="px-2 py-1.5 text-gray-700">{row.awardWins > 0 ? row.awardWins : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Label detail modal */}
      {selected && (
        <LabelDetailModal label={selected} chart={chart} onClose={() => setSelectedLabel(null)} />
      )}
    </div>
  );
}

function LabelDetailModal({ label, chart, onClose }: {
  label: RivalLabel;
  chart: { position: number; title: string; artistName: string; labelName: string; isPlayerSong: boolean; streams: number }[];
  onClose: () => void;
}) {
  const [profileArtist, setProfileArtist] = useState<Artist | null>(null);
  const chartSongs = chart.filter((e) => !e.isPlayerSong && e.labelName === label.name);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      {profileArtist && (
        <RivalArtistProfileModal artist={profileArtist} labelName={label.name} onClose={() => setProfileArtist(null)} />
      )}
      <div
        className="bg-white border border-gray-200 shadow-lg w-full max-w-2xl h-[90vh] sm:h-auto sm:max-h-[85vh] overflow-y-auto rounded-t-xl sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-gray-900 font-semibold text-sm">{label.name}</h2>
            <span className="text-xs text-gray-500">{GENRE_LABELS[label.primaryGenre]}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-sm px-1">&#x2715;</button>
        </div>

        <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
          {/* Stats summary row */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs text-gray-500 border-b border-gray-100 pb-3 flex-wrap">
            <span>Prestige <span className="text-gray-900 font-medium">{label.prestige}</span></span>
            <span>Activity <span className="text-gray-900 font-medium">{label.activityLevel}</span></span>
            <span>Releases <span className="text-gray-900 font-medium">{label.totalSongsReleased}</span></span>
            <span>Streams <span className="text-gray-900 font-medium">{fmt(label.totalStreams)}</span></span>
            <span>Chart Hits <span className="text-gray-900 font-medium">{label.chartHits}</span></span>
            <span>Awards <span className="text-gray-900 font-medium">{label.awardWins}</span></span>
          </div>

          {/* Roster table */}
          <div>
            <h3 className="text-gray-600 text-sm font-medium mb-1.5">Roster ({label.rosterArtists.length})</h3>
            <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-2 py-1 text-left text-gray-500 font-medium">Name</th>
                  <th className="px-2 py-1 text-left text-gray-500 font-medium">OVR</th>
                  <th className="px-2 py-1 text-left text-gray-500 font-medium">Age</th>
                  <th className="px-2 py-1 text-left text-gray-500 font-medium">Genre</th>
                  <th className="px-2 py-1 text-left text-gray-500 font-medium">Phase</th>
                  <th className="px-2 py-1 text-left text-gray-500 font-medium">Pop</th>
                  <th className="px-2 py-1 text-left text-gray-500 font-medium">Pot</th>
                  <th className="px-2 py-1 text-left text-gray-500 font-medium">Mom</th>
                </tr>
              </thead>
              <tbody>
                {label.rosterArtists.map((artist: Artist, i: number) => (
                  <tr
                    key={artist.id || i}
                    onClick={() => setProfileArtist(artist)}
                    className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                  >
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <ArtistSprite spriteIndex={artist.spriteIndex} size={18} />
                        <span className="text-gray-900 font-medium hover:text-blue-600">{artist.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <span className={
                        artist.overallRating >= 85 ? "text-amber-700 font-semibold" :
                        artist.overallRating >= 70 ? "text-green-700 font-medium" :
                        artist.overallRating >= 50 ? "text-blue-700" :
                        "text-gray-500"
                      }>
                        {artist.overallRating}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-gray-600">{artist.age}</td>
                    <td className="px-2 py-1 text-gray-600">{GENRE_LABELS[artist.genre]}</td>
                    <td className="px-2 py-1 text-gray-600 capitalize">{artist.careerPhase ?? "-"}</td>
                    <td className="px-2 py-1 text-gray-600">{artist.popularity}</td>
                    <td className="px-2 py-1 text-gray-600">{artist.potential}</td>
                    <td className="px-2 py-1 text-gray-600">{artist.momentum ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* Chart songs table */}
          {chartSongs.length > 0 && (
            <div>
              <h3 className="text-gray-600 text-sm font-medium mb-1.5">Currently Charting ({chartSongs.length})</h3>
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left text-gray-500 font-medium w-10">#</th>
                    <th className="px-2 py-1 text-left text-gray-500 font-medium">Title</th>
                    <th className="px-2 py-1 text-left text-gray-500 font-medium">Artist</th>
                    <th className="px-2 py-1 text-right text-gray-500 font-medium">Streams</th>
                  </tr>
                </thead>
                <tbody>
                  {chartSongs.map((entry, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="px-2 py-1 text-gray-400 font-mono">{entry.position}</td>
                      <td className="px-2 py-1 text-gray-900">{entry.title}</td>
                      <td className="px-2 py-1 text-gray-600">{entry.artistName}</td>
                      <td className="px-2 py-1 text-gray-600 text-right">{fmt(entry.streams)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}

          {/* Recent releases table */}
          {label.activeSongs.length > 0 && (
            <div>
              <h3 className="text-gray-600 text-sm font-medium mb-1.5">Recent Releases</h3>
              <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left text-gray-500 font-medium">Title</th>
                    <th className="px-2 py-1 text-left text-gray-500 font-medium">Artist</th>
                    <th className="px-2 py-1 text-left text-gray-500 font-medium">Quality</th>
                    <th className="px-2 py-1 text-right text-gray-500 font-medium">Streams</th>
                  </tr>
                </thead>
                <tbody>
                  {label.activeSongs.slice(0, 10).map((song, i) => (
                    <tr key={song.id} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="px-2 py-1 text-gray-900">{song.title}</td>
                      <td className="px-2 py-1 text-gray-600">{song.artistName}</td>
                      <td className="px-2 py-1 text-gray-600">{song.quality}</td>
                      <td className="px-2 py-1 text-gray-600 text-right">{fmt(song.streamsTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>

        {/* Close */}
        <div className="px-4 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rival Artist Profile Modal ───────────────────────────────────────────────

function RivalArtistProfileModal({ artist, labelName, onClose }: {
  artist: Artist;
  labelName: string;
  onClose: () => void;
}) {
  const phaseLabel = (phase: string) => {
    const map: Record<string, string> = {
      peak: "Peak", established: "Established", breakout: "Breakout",
      buzzing: "Buzzing", emerging: "Emerging", legacy: "Legacy",
      declining: "Declining", washed: "Washed", unknown: "Unknown",
    };
    return map[phase] ?? phase;
  };

  const phaseColor = (phase: string) => {
    const map: Record<string, string> = {
      peak: "text-yellow-600 bg-yellow-50 border-yellow-200",
      established: "text-green-600 bg-green-50 border-green-200",
      breakout: "text-emerald-600 bg-emerald-50 border-emerald-200",
      buzzing: "text-blue-600 bg-blue-50 border-blue-200",
      emerging: "text-cyan-600 bg-cyan-50 border-cyan-200",
      legacy: "text-amber-600 bg-amber-50 border-amber-200",
      declining: "text-red-500 bg-red-50 border-red-200",
      washed: "text-red-600 bg-red-50 border-red-300",
    };
    return map[phase] ?? "text-gray-500 bg-gray-50 border-gray-200";
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center sm:p-2" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-t-xl sm:rounded-lg w-full max-w-xl h-[90vh] sm:h-auto sm:max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between px-3 py-2 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-gray-900 font-bold text-sm">{artist.name}</h2>
              {artist.careerPhase && (
                <span className={`${phaseColor(artist.careerPhase)} border px-1.5 py-0 rounded text-[10px] font-semibold`}>
                  {phaseLabel(artist.careerPhase)}
                </span>
              )}
            </div>
            <div className="text-gray-400 text-[11px]">{artist.persona} · {artist.genre} · {labelName}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-sm transition">✕</button>
        </div>

        <div className="px-3 py-2 space-y-3">
          {/* Sprite + core stats */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-start">
            <div className="shrink-0 bg-gray-50 rounded border border-gray-200 p-2 self-center sm:self-start">
              <ArtistSprite spriteIndex={artist.spriteIndex} size={144} />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-1">
              <MiniStat label="OVR" value={String(artist.overallRating)} />
              <MiniStat label="Potential" value={String(artist.potential)} />
              <MiniStat label="Popularity" value={String(artist.popularity)} />
              <MiniStat label="Fans" value={artist.fanbase >= 1000000 ? `${(artist.fanbase / 1000000).toFixed(1)}M` : artist.fanbase >= 1000 ? `${(artist.fanbase / 1000).toFixed(1)}K` : String(artist.fanbase)} />
              <MiniStat label="Age" value={String(artist.age)} />
              <MiniStat label="Momentum" value={String(artist.momentum ?? 0)} />
              <MiniStat label="Buzz" value={String(artist.buzz ?? 0)} />
              <MiniStat label="Morale" value={String(artist.morale)} />
            </div>
          </div>

          {/* Attributes */}
          <div>
            <h3 className="text-gray-500 font-semibold text-[11px] uppercase tracking-wider mb-1">
              Attributes <span className="text-gray-300 font-normal normal-case">OVR {artist.overallRating}</span>
            </h3>
            <div className="space-y-1.5">
              {Object.entries(ATTRIBUTE_GROUPS).map(([group, keys]) => (
                <div key={group}>
                  <div className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5">{group}</div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                    {keys.map((k) => {
                      const val = artist.attributes[k];
                      const color = val >= 70 ? "text-green-600" : val >= 50 ? "text-gray-900" : val >= 30 ? "text-gray-400" : "text-red-500";
                      return (
                        <div key={k} className="bg-gray-50 border border-gray-100 rounded px-1 py-0.5 text-center">
                          <div className={`text-xs font-bold ${color}`}>{val}</div>
                          <div className="text-gray-400 text-[9px] leading-tight">{ATTRIBUTE_LABELS[k]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Personality */}
          <div>
            <h3 className="text-gray-500 font-semibold text-[11px] uppercase tracking-wider mb-1">Personality</h3>
            <div className="grid grid-cols-3 gap-1">
              <MiniStat label="Loyalty" value={String(artist.traits.loyalty)} />
              <MiniStat label="Work Ethic" value={String(artist.traits.workEthic)} />
              <MiniStat label="Money Motiv." value={String(artist.traits.moneyMotivation)} />
              <MiniStat label="Competitive" value={String(artist.traits.competitiveness)} />
              <MiniStat label="Fame Motiv." value={String(artist.traits.fameMotivation)} />
              <MiniStat label="Controversy" value={String(artist.traits.controversyRisk)} />
            </div>
          </div>

          {/* Career info */}
          <div>
            <h3 className="text-gray-500 font-semibold text-[11px] uppercase tracking-wider mb-1">Career</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              <MiniStat label="Phase" value={phaseLabel(artist.careerPhase)} />
              <MiniStat label="Chart Hits" value={String(artist.chartHits ?? 0)} />
              <MiniStat label="Singles" value={String(artist.totalSinglesReleased ?? 0)} />
              <MiniStat label="Albums" value={String(artist.totalAlbumsReleased ?? 0)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded px-1.5 py-1">
      <div className="text-gray-400 text-[10px] leading-tight">{label}</div>
      <div className="font-bold text-xs text-gray-900">{value}</div>
    </div>
  );
}
