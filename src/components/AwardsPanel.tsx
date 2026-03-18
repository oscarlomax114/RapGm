"use client";
import { useGameStore } from "@/store/gameStore";
import { AwardCategory, AwardCeremony } from "@/lib/types";

const CATEGORY_LABELS: Record<AwardCategory, string> = {
  song_of_year:   "Song of the Year",
  album_of_year:  "Album of the Year",
  artist_of_year: "Artist of the Year",
  best_new_artist:"Best New Artist",
  label_of_year:  "Label of the Year",
};

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function AwardsPanel() {
  const { awardHistory, pendingAwardCeremony, dismissAwardCeremony, turn, labelName } = useGameStore();

  const nextCeremonyTurn = (() => {
    if (turn < 48) return 48;
    const cyclesSince = Math.floor((turn - 48) / 52);
    return 48 + (cyclesSince + 1) * 52;
  })();
  const weeksUntil = nextCeremonyTurn - turn;

  return (
    <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-md p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-gray-900 font-semibold text-sm">Annual Awards</h2>
            <p className="text-gray-400 text-xs mt-1">
              {weeksUntil > 0
                ? `Next ceremony in ${weeksUntil} week${weeksUntil !== 1 ? "s" : ""} (Week ${nextCeremonyTurn})`
                : "Ceremony happening now!"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-gray-400 text-xs">Total Wins</div>
            <div className="text-blue-600 font-semibold text-2xl">
              {awardHistory.reduce((sum, c) => sum + c.playerWins.length, 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Award history */}
      {awardHistory.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
          <p className="text-gray-500 text-sm">No ceremonies yet. First ceremony at Week 48.</p>
          <p className="text-gray-400 text-xs mt-1">Eligible songs are those released in the past 52 weeks.</p>
        </div>
      ) : (
        awardHistory.map((ceremony) => (
          <CeremonyCard key={ceremony.id} ceremony={ceremony} labelName={labelName} />
        ))
      )}
    </div>
  );
}

function CeremonyCard({ ceremony, labelName }: { ceremony: AwardCeremony; labelName: string }) {
  const categories: AwardCategory[] = ["song_of_year", "album_of_year", "artist_of_year", "best_new_artist", "label_of_year"];
  return (
    <div className="bg-white border border-gray-200 rounded-md p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-gray-900 font-semibold text-sm">Year {ceremony.year} Ceremony</h3>
          <span className="text-gray-400 text-xs">Week {ceremony.turn}</span>
        </div>
        {ceremony.playerWins.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-blue-600 font-semibold text-lg">{ceremony.playerWins.length}</span>
            <span className="text-gray-500 text-xs">win{ceremony.playerWins.length !== 1 ? "s" : ""}</span>
            {ceremony.moneyReward > 0 && <span className="text-green-700 text-xs">+{fmt(ceremony.moneyReward)}</span>}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">No wins</span>
        )}
      </div>
      <div className="space-y-1.5">
        {categories.map((cat) => {
          const winner = ceremony.winners.find((w) => w.category === cat);
          if (!winner) return null;
          const isPlayerWin = winner.isPlayer;
          return (
            <div
              key={cat}
              className={`flex items-center justify-between px-3 py-2 rounded ${
                isPlayerWin ? "bg-blue-50 border border-blue-200" : "bg-gray-50"
              }`}
            >
              <div>
                <div className="text-gray-500 text-xs">{CATEGORY_LABELS[cat]}</div>
                <div className={`text-sm font-medium ${isPlayerWin ? "text-blue-700" : "text-gray-900"}`}>
                  {winner.name}
                  {winner.artistName && <span className="text-gray-500 font-normal"> — {winner.artistName}</span>}
                </div>
              </div>
              {isPlayerWin && (
                <span className="text-blue-600 text-xs font-semibold shrink-0 ml-2">Winner</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CeremonyModal({ ceremony, labelName, onClose }: { ceremony: AwardCeremony; labelName: string; onClose: () => void }) {
  const categories: AwardCategory[] = ["song_of_year", "album_of_year", "artist_of_year", "best_new_artist", "label_of_year"];
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white border border-gray-200 sm:rounded-md rounded-t-xl shadow-lg w-full sm:max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-gray-900 font-semibold text-lg">Year {ceremony.year} Awards</h2>
              <p className="text-gray-500 text-sm mt-0.5">
                {ceremony.playerWins.length > 0
                  ? `${labelName} won ${ceremony.playerWins.length} award${ceremony.playerWins.length !== 1 ? "s" : ""}!`
                  : `${labelName} was shut out this year.`}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl px-2">&#x2715;</button>
          </div>
          {ceremony.playerWins.length > 0 && (
            <div className="flex gap-3 mt-3">
              {ceremony.moneyReward > 0 && (
                <span className="text-xs bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded font-medium">
                  +{fmt(ceremony.moneyReward)} reward
                </span>
              )}
              {ceremony.reputationReward > 0 && (
                <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded font-medium">
                  +{ceremony.reputationReward} reputation
                </span>
              )}
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {categories.map((cat) => {
            const winner = ceremony.winners.find((w) => w.category === cat);
            const catNominees = ceremony.nominees.filter((n) => n.category === cat)
              .sort((a, b) => b.score - a.score)
              .slice(0, 5);
            if (!winner) return null;
            const isPlayerWin = winner.isPlayer;
            return (
              <div key={cat} className={`rounded-md p-4 ${isPlayerWin ? "bg-blue-50 border border-blue-200" : "bg-gray-50 border border-gray-200"}`}>
                <div className="text-gray-500 text-xs font-medium mb-2">{CATEGORY_LABELS[cat]}</div>
                <div className={`font-semibold text-sm mb-3 ${isPlayerWin ? "text-blue-700" : "text-gray-900"}`}>
                  {isPlayerWin ? "Winner: " : ""}{winner.name}
                  {winner.artistName && <span className="text-gray-500 font-normal text-sm"> — {winner.artistName}</span>}
                </div>
                <div className="space-y-1">
                  {catNominees.map((n, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className={n.isPlayer ? "text-blue-700" : "text-gray-500"}>
                        {n.isPlayer ? "* " : ""}{n.name}{n.artistName ? ` — ${n.artistName}` : ""}
                      </span>
                      <div className="w-24 bg-gray-200 rounded-full h-1.5 ml-3">
                        <div
                          className={`h-1.5 rounded-full ${n.isPlayer ? "bg-blue-600" : "bg-gray-400"}`}
                          style={{ width: `${Math.min(100, (n.score / 120) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded transition"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
