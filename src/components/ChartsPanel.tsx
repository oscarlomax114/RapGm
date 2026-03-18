"use client";
import { useGameStore } from "@/store/gameStore";

const GENRE_COLORS: Record<string, string> = {
  trap: "bg-orange-50 text-orange-700",
  "boom-bap": "bg-yellow-50 text-yellow-700",
  drill: "bg-red-50 text-red-700",
  "r-and-b": "bg-pink-50 text-pink-700",
  "pop-rap": "bg-purple-50 text-purple-700",
  experimental: "bg-cyan-50 text-cyan-700",
};

export default function ChartsPanel() {
  const { chart, songs, artists, labelName } = useGameStore();

  const allReleased = songs
    .filter((s) => s.released)
    .sort((a, b) => b.streamsTotal - a.streamsTotal);

  const playerOnChart = chart.filter((e) => e.isPlayerSong).length;

  return (
    <div className="p-4 space-y-6">

      {/* Live Chart */}
      <section className="bg-white border border-gray-200 rounded-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-900 font-semibold text-sm">Industry Chart — Top 20</h2>
          {chart.length > 0 && (
            <span className="text-xs text-gray-400">
              {playerOnChart > 0
                ? <span className="text-blue-600 font-semibold">{playerOnChart} your song{playerOnChart !== 1 ? "s" : ""}</span>
                : <span className="text-gray-400">0 your songs</span>}
              {" "}&middot; {chart.length - playerOnChart} rival
            </span>
          )}
        </div>
        {chart.length === 0 ? (
          <p className="text-gray-400 text-sm">No songs on the chart yet. Release tracks to get started.</p>
        ) : (
          <div className="space-y-0">
            {chart.map((entry, idx) => (
              <div
                key={entry.isPlayerSong ? entry.songId : `${entry.title}-${entry.artistName}`}
                className={`flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0 ${
                  entry.isPlayerSong && entry.position === 1
                    ? "bg-amber-50"
                    : entry.isPlayerSong && entry.position <= 3
                    ? "bg-blue-50"
                    : entry.isPlayerSong
                    ? "bg-blue-50/50"
                    : idx % 2 === 0
                    ? "bg-white"
                    : "bg-gray-50"
                }`}
              >
                <span
                  className={`text-sm font-semibold w-7 text-center shrink-0 ${
                    entry.isPlayerSong && entry.position === 1
                      ? "text-amber-600"
                      : entry.isPlayerSong && entry.position <= 3
                      ? "text-blue-600"
                      : entry.isPlayerSong
                      ? "text-blue-600"
                      : "text-gray-400"
                  }`}
                >
                  {entry.position}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 text-sm font-medium truncate">{entry.title}</span>
                    {entry.isPlayerSong && (
                      <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-semibold shrink-0">YOUR</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{entry.artistName}</span>
                    <span className="text-gray-300">&middot;</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${GENRE_COLORS[entry.genre] ?? "bg-gray-100 text-gray-600"}`}>
                      {entry.genre}
                    </span>
                    <span className="text-gray-300">&middot;</span>
                    <span className={entry.isPlayerSong ? "text-blue-600" : "text-gray-400"}>
                      {entry.isPlayerSong ? labelName : entry.labelName}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-gray-700 text-xs font-medium">
                    {entry.streams >= 1_000_000
                      ? `${(entry.streams / 1_000_000).toFixed(1)}M`
                      : `${(entry.streams / 1000).toFixed(0)}K`}
                  </div>
                  <div className="text-gray-400 text-[10px]">{entry.weeksOnChart}w</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Player Catalog */}
      <section className="bg-white border border-gray-200 rounded-md p-5">
        <h2 className="text-gray-900 font-semibold text-sm mb-4">Your Catalog</h2>
        {allReleased.length === 0 ? (
          <p className="text-gray-400 text-sm">No released songs yet.</p>
        ) : (
          <div className="space-y-0">
            {allReleased.map((s, idx) => {
              const artist = artists.find((a) => a.id === s.artistId);
              return (
                <div key={s.id} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-b-0 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                  <div className="min-w-0">
                    <span className="text-gray-900 text-sm font-medium truncate block">{s.title}</span>
                    <span className="text-gray-500 text-xs">{artist?.name} &middot; {s.genre}</span>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <div className="text-gray-600 text-xs">
                      {s.streamsTotal >= 1_000_000
                        ? `${(s.streamsTotal / 1_000_000).toFixed(1)}M`
                        : `${(s.streamsTotal / 1000).toFixed(0)}K`}{" "}
                      streams
                    </div>
                    <div className="text-green-700 text-xs">
                      ${s.revenue >= 1000 ? `${(s.revenue / 1000).toFixed(1)}K` : s.revenue} earned
                    </div>
                    {s.chartPosition ? (
                      <div className="text-amber-600 text-xs">#{s.chartPosition} this week</div>
                    ) : (
                      <div className="text-gray-400 text-xs">Off chart</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
