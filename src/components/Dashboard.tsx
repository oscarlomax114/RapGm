"use client";
import { useGameStore } from "@/store/gameStore";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements";
import { MallCategory, RevenueHistory, AchievementCategory, HoFTier, Artist } from "@/lib/types";
import { STUDIO_DATA } from "@/lib/data";
import ArtistSprite from "./ArtistSprite";

const CATEGORY_LABELS: Record<MallCategory, string> = {
  jewelry:     "Jewelry",
  cars:        "Cars",
  homes:       "Homes",
  clothes:     "Clothes",
  shoes:       "Shoes",
  accessories: "Accessories",
  exotic_pets: "Exotic Pets",
};

const MILESTONE_COLORS: Record<string, string> = {
  chart_number_one: "bg-yellow-500",
  award_win: "bg-amber-500",
  fanbase_milestone: "bg-blue-500",
  first_album: "bg-purple-500",
  revenue_milestone: "bg-green-500",
  rivalry_beat: "bg-red-500",
};

const ACH_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  streaming: "Streaming",
  merch: "Merch",
  touring: "Touring",
  cash: "Cash",
  charts: "Charts",
  albums: "Albums",
  awards: "Awards",
  collaborations: "Collabs",
  dynasty: "Dynasty",
  hall_of_fame: "Hall of Fame",
  narrative: "Narrative",
};

const ACH_CATEGORY_COLORS: Record<AchievementCategory, string> = {
  streaming: "bg-blue-500",
  merch: "bg-yellow-500",
  touring: "bg-green-500",
  cash: "bg-emerald-500",
  charts: "bg-purple-500",
  albums: "bg-indigo-500",
  awards: "bg-amber-500",
  collaborations: "bg-pink-500",
  dynasty: "bg-red-500",
  hall_of_fame: "bg-orange-500",
  narrative: "bg-cyan-500",
};

const HOF_TIER_LABELS: Record<HoFTier, string> = {
  first_ballot: "1st Ballot",
  strong_candidate: "Strong",
  eligible: "Eligible",
};

const HOF_TIER_COLORS: Record<HoFTier, string> = {
  first_ballot: "bg-yellow-100 text-yellow-800 border-yellow-300",
  strong_candidate: "bg-blue-100 text-blue-800 border-blue-300",
  eligible: "bg-gray-100 text-gray-700 border-gray-300",
};

const TIER_SYMBOLS = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

export default function Dashboard() {
  const {
    money, reputation, fanbase, turn, artists, songs, recentEvents,
    vault, labelMilestones, awardHistory, revenueHistory,
    achievements, hallOfFame, dynastyYears, studioLevel,
  } = useGameStore();

  const signedArtists = artists.filter((a) => a.signed);
  const releasedSongs = songs.filter((s) => s.released);
  const charting = songs.filter((s) => s.chartPosition !== null);
  const totalStreams = songs.reduce((acc, s) => acc + s.streamsTotal, 0);

  // Group vault items by category
  const vaultByCategory = vault.reduce<Record<string, typeof vault>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  void money; void reputation; void fanbase; void turn;
  const totalAwardWins = awardHistory.reduce((sum, c) => sum + c.playerWins.length, 0);

  // Achievement stats by category
  const unlockedSet = new Set(
    (achievements ?? []).filter((p) => p.unlocked).map((p) => p.achievementId)
  );
  const achByCategory = ACHIEVEMENT_DEFS.reduce<
    Record<AchievementCategory, { total: number; unlocked: number; defs: typeof ACHIEVEMENT_DEFS }>
  >((acc, def) => {
    if (!acc[def.category]) acc[def.category] = { total: 0, unlocked: 0, defs: [] };
    acc[def.category].total++;
    acc[def.category].defs.push(def);
    if (unlockedSet.has(def.id)) acc[def.category].unlocked++;
    return acc;
  }, {} as Record<AchievementCategory, { total: number; unlocked: number; defs: typeof ACHIEVEMENT_DEFS }>);

  const totalAch = ACHIEVEMENT_DEFS.length;
  const totalUnlocked = unlockedSet.size;

  return (
    <div className="p-2 sm:p-3 space-y-2 sm:space-y-3">
      {/* Stat cards — tighter padding */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card label="Signed Artists" value={signedArtists.length} sub={`of ${STUDIO_DATA[studioLevel].rosterCap} slots`} />
        <Card label="Songs Released" value={releasedSongs.length} sub={`${charting.length} charting`} />
        <Card
          label="Total Streams"
          value={totalStreams >= 1_000_000 ? `${(totalStreams / 1_000_000).toFixed(1)}M` : `${(totalStreams / 1000).toFixed(0)}K`}
          sub="all time"
        />
        <Card label="Award Wins" value={totalAwardWins} sub={`${awardHistory.length} ceremonies`} />
      </div>

      {/* Signed Artists */}
      {signedArtists.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
          <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Signed Artists ({signedArtists.length})</h3>
          <div className="border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-500 border-b border-gray-200">
                  <th className="text-left py-1 px-2 font-semibold">Name</th>
                  <th className="text-center py-1 px-1 font-semibold">Age</th>
                  <th className="text-left py-1 px-1 font-semibold">Genre</th>
                  <th className="text-center py-1 px-1 font-semibold">OVR</th>
                  <th className="text-center py-1 px-1 font-semibold">POP</th>
                  <th className="text-center py-1 px-1 font-semibold">MOM</th>
                  <th className="text-center py-1 px-1 font-semibold">MRL</th>
                  <th className="text-center py-1 px-1 font-semibold">FTG</th>
                  <th className="text-right py-1 px-2 font-semibold">Fans</th>
                  <th className="text-center py-1 px-1 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {signedArtists.map((a: Artist, i: number) => {
                  const status = a.jailed
                    ? { text: `Jailed (${a.jailTurnsLeft ?? "?"}wk)`, color: "text-red-700" }
                    : a.legalState && a.legalState.stage !== "resolved"
                    ? { text: "Legal Issue", color: "text-red-500" }
                    : a.onTour
                    ? { text: `Tour (${a.tourTurnsLeft}wk)`, color: "text-yellow-600" }
                    : a.contractAlbumsLeft === 0
                    ? { text: "Expired", color: "text-red-500" }
                    : a.fatigue > 70
                    ? { text: "Fatigued", color: "text-orange-500" }
                    : { text: "Active", color: "text-green-600" };
                  return (
                    <tr key={a.id} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} border-b border-gray-100`}>
                      <td className="py-1 px-2">
                        <div className="flex items-center gap-1.5">
                          <ArtistSprite spriteIndex={a.spriteIndex} size={18} />
                          <span className="font-medium text-gray-900 truncate max-w-[120px]">{a.name}</span>
                        </div>
                      </td>
                      <td className="text-center py-1 px-1 text-gray-600">{a.age}</td>
                      <td className="py-1 px-1 text-gray-600">{a.genre}</td>
                      <td className="text-center py-1 px-1 font-semibold text-gray-900">{a.overallRating}</td>
                      <td className="text-center py-1 px-1 text-gray-600">{a.popularity}</td>
                      <td className="text-center py-1 px-1">
                        <span className={`font-semibold ${(a.momentum ?? 0) >= 60 ? "text-green-600" : (a.momentum ?? 0) >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                          {a.momentum ?? 0}
                        </span>
                      </td>
                      <td className="text-center py-1 px-1 text-gray-600">{a.morale}</td>
                      <td className={`text-center py-1 px-1 ${a.fatigue > 70 ? "text-red-500 font-semibold" : "text-gray-600"}`}>{a.fatigue}</td>
                      <td className="text-right py-1 px-2 text-gray-600">
                        {a.fanbase >= 1000 ? `${(a.fanbase / 1000).toFixed(0)}K` : a.fanbase}
                      </td>
                      <td className="text-center py-1 px-1">
                        <span className={`text-[10px] font-semibold ${status.color}`}>{status.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dynasty Tracker */}
      {(dynastyYears ?? 0) > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-md px-3 py-2 flex items-center gap-2">
          <span className="text-amber-600 text-xs font-bold">👑</span>
          <span className="text-xs font-semibold text-amber-800">
            Dynasty: {dynastyYears} yr{dynastyYears !== 1 ? "s" : ""} as #1 label
          </span>
          {dynastyYears >= 5 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-semibold ml-auto">Era Defining</span>}
          {dynastyYears >= 3 && dynastyYears < 5 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold ml-auto">Builder</span>}
        </div>
      )}

      {/* Revenue Breakdown */}
      {turn > 1 && <RevenueBreakdown rev={revenueHistory} money={money} />}

      {/* Achievements Section */}
      {totalAch > 0 && (
        <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Achievements</h3>
            <span className="text-xs text-gray-400">{totalUnlocked}/{totalAch}</span>
          </div>

          {/* Overall progress bar */}
          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2.5">
            <div
              className="h-1.5 rounded-full bg-indigo-500 transition-all"
              style={{ width: `${totalAch > 0 ? (totalUnlocked / totalAch) * 100 : 0}%` }}
            />
          </div>

          {/* Per-category compact rows */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1.5">
            {(Object.keys(achByCategory) as AchievementCategory[]).map((cat) => {
              const { total, unlocked } = achByCategory[cat];
              const pct = total > 0 ? (unlocked / total) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${ACH_CATEGORY_COLORS[cat]}`} />
                  <span className="text-[10px] text-gray-500 w-16 truncate">{ACH_CATEGORY_LABELS[cat]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1">
                    <div
                      className={`h-1 rounded-full ${ACH_CATEGORY_COLORS[cat]} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 w-7 text-right">{unlocked}/{total}</span>
                </div>
              );
            })}
          </div>

          {/* Recently unlocked achievements — compact badges */}
          {totalUnlocked > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex flex-wrap gap-1">
                {ACHIEVEMENT_DEFS
                  .filter((d) => unlockedSet.has(d.id))
                  .sort((a, b) => {
                    const aP = (achievements ?? []).find((p) => p.achievementId === a.id);
                    const bP = (achievements ?? []).find((p) => p.achievementId === b.id);
                    return (bP?.unlockedTurn ?? 0) - (aP?.unlockedTurn ?? 0);
                  })
                  .slice(0, 12)
                  .map((def) => (
                    <span
                      key={def.id}
                      className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-gray-700"
                      title={def.description}
                    >
                      <span className="text-gray-400 font-mono">{TIER_SYMBOLS[def.tier] ?? def.tier}</span>
                      <span className="font-medium">{def.name}</span>
                    </span>
                  ))}
                {totalUnlocked > 12 && (
                  <span className="text-[10px] text-gray-400 px-1 py-0.5">+{totalUnlocked - 12} more</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hall of Fame Section */}
      {(hallOfFame ?? []).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Hall of Fame</h3>
            <span className="text-xs text-gray-400">{hallOfFame.length} inductee{hallOfFame.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {hallOfFame
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((entry) => (
                <div key={entry.artistId} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1 py-0.5 rounded border font-semibold ${HOF_TIER_COLORS[entry.tier]}`}>
                      {HOF_TIER_LABELS[entry.tier]}
                    </span>
                    <span className="text-gray-900 font-medium">{entry.artistName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span>{entry.stats.numberOneSongs} #1s</span>
                    <span>{entry.stats.awards} awards</span>
                    <span className="font-semibold text-gray-500">{entry.score}pts</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Recent Events — denser */}
      {recentEvents.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
          <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">Recent Events</h3>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {recentEvents.slice(0, 10).map((ev) => (
              <div key={ev.id} className="flex items-start gap-1.5 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${eventDotColor(ev.type)}`} />
                <div className="min-w-0">
                  <span className="text-gray-900 font-medium">{ev.title}</span>
                  <span className="text-gray-400 ml-1.5">{ev.description}</span>
                  <span className="text-gray-300 ml-1.5 text-[10px]">W{ev.turn}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Label History — denser */}
      {labelMilestones.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
          <h3 className="text-gray-900 font-semibold text-xs mb-2">Label History</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {labelMilestones.slice(0, 20).map((m) => (
              <div key={m.id} className="flex items-start gap-1.5 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${MILESTONE_COLORS[m.type] ?? "bg-gray-300"}`} />
                <div className="min-w-0">
                  <span className="text-gray-900 font-medium">{m.title}</span>
                  <span className="text-gray-400 text-[10px] ml-1.5">{m.description}</span>
                  <span className="text-gray-300 text-[10px] ml-1.5">W{m.turn}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vault — denser */}
      {vault.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-gray-900 font-semibold text-xs">Vault</h3>
            <span className="text-gray-400 text-[10px]">{vault.length} item{vault.length !== 1 ? "s" : ""} -- ${vault.reduce((s, i) => s + i.price, 0).toLocaleString()} total</span>
          </div>
          <div className="space-y-2.5">
            {(Object.keys(vaultByCategory) as MallCategory[]).map((cat) => (
              <div key={cat}>
                <div className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1">{CATEGORY_LABELS[cat]}</div>
                <div className="border border-gray-200 rounded-md divide-y divide-gray-100">
                  {vaultByCategory[cat].map((item) => (
                    <div key={item.uid} className="px-2 py-1.5 flex items-center justify-between">
                      <div>
                        <span className="text-gray-900 text-[10px] font-semibold">{item.name}</span>
                        <span className="text-gray-400 text-[10px] ml-1.5">W{item.purchasedTurn}</span>
                      </div>
                      <span className="text-gray-500 text-[10px]">${item.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
      <div className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xl font-semibold text-gray-900">{value}</div>
      <div className="text-gray-400 text-[10px] mt-0.5">{sub}</div>
    </div>
  );
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.floor(n)}`;
}

function RevenueBreakdown({ rev, money }: { rev: RevenueHistory; money: number }) {
  const totalAllTime = rev.streaming + rev.touring + rev.merch + rev.brandDeals + rev.awards;
  const weeklyIncome = rev.weeklyStreaming + rev.weeklyTouring + rev.weeklyMerch + rev.weeklyBrandDeals;
  const weeklyNet = weeklyIncome - rev.weeklyOverhead;

  const sources = [
    { label: "Streaming",   weekly: rev.weeklyStreaming,   total: rev.streaming,   color: "bg-blue-500",   textColor: "text-blue-600" },
    { label: "Touring",     weekly: rev.weeklyTouring,     total: rev.touring,     color: "bg-green-500",  textColor: "text-green-600" },
    { label: "Merch",       weekly: rev.weeklyMerch,       total: rev.merch,       color: "bg-yellow-500", textColor: "text-yellow-600" },
    { label: "Brand Deals", weekly: rev.weeklyBrandDeals,  total: rev.brandDeals,  color: "bg-purple-500", textColor: "text-purple-600" },
    { label: "Awards",      weekly: 0,                     total: rev.awards,      color: "bg-amber-500",  textColor: "text-amber-600" },
  ];

  const milestones = [
    { label: "Millionaire",       target: 1_000_000 },
    { label: "Multi-Millionaire", target: 10_000_000 },
    { label: "Mogul",             target: 100_000_000 },
    { label: "Billionaire",       target: 1_000_000_000 },
  ];
  const currentMilestone = milestones.filter(m => money >= m.target).pop();
  const nextMilestone = milestones.find(m => money < m.target);

  if (totalAllTime === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Revenue Breakdown</h3>
        {currentMilestone && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-900 font-semibold">
            {currentMilestone.label}
          </span>
        )}
      </div>

      {/* Weekly summary */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <div className="text-gray-400 text-[10px]">Weekly Income</div>
          <div className="text-green-600 font-semibold text-xs">{fmt(weeklyIncome)}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-[10px]">Weekly Overhead</div>
          <div className="text-red-600 font-semibold text-xs">-{fmt(rev.weeklyOverhead)}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-400 text-[10px]">Net / Week</div>
          <div className={`font-semibold text-xs ${weeklyNet >= 0 ? "text-green-600" : "text-red-600"}`}>
            {weeklyNet >= 0 ? "+" : ""}{fmt(weeklyNet)}
          </div>
        </div>
      </div>

      {/* Revenue bar */}
      {weeklyIncome > 0 && (
        <div className="w-full h-1.5 rounded-full overflow-hidden flex mb-2 bg-gray-100">
          {sources.filter(s => s.weekly > 0).map((s) => (
            <div
              key={s.label}
              className={`h-full ${s.color}`}
              style={{ width: `${(s.weekly / weeklyIncome) * 100}%` }}
            />
          ))}
        </div>
      )}

      {/* Source breakdown */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {sources.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
              <span className="text-gray-500">{s.label}</span>
            </div>
            <div className="text-right">
              {s.weekly > 0 && <span className={`${s.textColor} font-semibold`}>{fmt(s.weekly)}/w</span>}
              {s.weekly === 0 && s.total > 0 && <span className="text-gray-400">{fmt(s.total)} total</span>}
              {s.weekly === 0 && s.total === 0 && <span className="text-gray-300">--</span>}
            </div>
          </div>
        ))}
      </div>

      {/* All-time total */}
      <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between">
        <span className="text-gray-500 text-[10px]">All-Time Revenue</span>
        <span className="text-gray-900 font-semibold text-xs">{fmt(totalAllTime)}</span>
      </div>

      {/* Next milestone progress */}
      {nextMilestone && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-0.5">
            <span>Next: {nextMilestone.label}</span>
            <span>{fmt(money)} / {fmt(nextMilestone.target)}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1">
            <div
              className="h-1 rounded-full bg-blue-600 transition-all"
              style={{ width: `${Math.min(100, (money / nextMilestone.target) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function eventDotColor(type: string) {
  const colors: Record<string, string> = {
    scandal: "bg-red-500",
    viral_moment: "bg-green-500",
    award_nomination: "bg-yellow-500",
    burnout: "bg-orange-400",
    beef: "bg-red-400",
    label_deal: "bg-blue-500",
    chart_surge: "bg-green-400",
    radio_play: "bg-blue-400",
    revenue: "bg-gray-400",
    milestone: "bg-blue-600",
    album_release: "bg-purple-400",
  };
  return colors[type] ?? "bg-gray-300";
}
