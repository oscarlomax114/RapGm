"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { STUDIO_DATA, SCOUTING_DATA, ARTIST_DEV_DATA, TOURING_DEPT_DATA, MARKETING_DATA, PR_DATA, MERCH_DATA } from "@/lib/data";

const STUDIO_TIER_LABEL: Record<number, string> = {
  0: "Underground",
  1: "Mid-Tier",
  2: "High-Tier",
  3: "Elite",
};

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;
}

function LevelBar({ level, max = 10, affordable }: { level: number; max?: number; affordable: boolean | null }) {
  const pct = (level / max) * 100;
  const barColor = level >= max
    ? "bg-emerald-500"
    : affordable
      ? "bg-emerald-500"
      : "bg-red-400";
  return (
    <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function UpgradesPanel() {
  const {
    money, studioLevel, scoutingLevel, artistDevLevel, touringLevel,
    marketingLevel, prLevel, merchLevel, recordingTokens,
    upgradeStudio, upgradeScouting, upgradeArtistDev, upgradeTouringDept,
    upgradeMarketing, upgradePR, upgradeMerch,
  } = useGameStore();

  const [expanded, setExpanded] = useState<string | null>(null);

  const studio = STUDIO_DATA[studioLevel];
  const nextStudio = studioLevel < 10 ? STUDIO_DATA[studioLevel + 1] : null;
  const scouting = SCOUTING_DATA[scoutingLevel];
  const nextScouting = scoutingLevel < 10 ? SCOUTING_DATA[scoutingLevel + 1] : null;
  const artistDev = ARTIST_DEV_DATA[artistDevLevel];
  const nextArtistDev = artistDevLevel < 10 ? ARTIST_DEV_DATA[artistDevLevel + 1] : null;
  const touring = TOURING_DEPT_DATA[touringLevel];
  const nextTouring = touringLevel < 10 ? TOURING_DEPT_DATA[touringLevel + 1] : null;
  const marketing = MARKETING_DATA[marketingLevel];
  const nextMarketing = marketingLevel < 10 ? MARKETING_DATA[marketingLevel + 1] : null;
  const pr = PR_DATA[prLevel];
  const nextPR = prLevel < 10 ? PR_DATA[prLevel + 1] : null;
  const merch = MERCH_DATA[merchLevel];
  const nextMerch = merchLevel < 10 ? MERCH_DATA[merchLevel + 1] : null;

  function handle(fn: () => string | null | undefined) {
    const err = fn();
    if (err) alert(err);
  }

  const departments = [
    {
      id: "studio",
      name: "Studio",
      level: studioLevel,
      keyStat: `+${studio.qualityBonusFlat} quality`,
      weeklyCost: studio.weeklyOperatingCost,
      nextCost: nextStudio?.unlockCost ?? null,
      affordable: nextStudio ? money >= nextStudio.unlockCost : null,
      onUpgrade: () => handle(upgradeStudio),
      detail: {
        current: [
          ["Quality Bonus", `+${studio.qualityBonusFlat}`],
          ["Roster Cap", `${studio.rosterCap}`],
          ["Tokens/Wk", `${studio.tokensPerWeek}`],
          ["Token Pool", `${recordingTokens}`],
          ["Producer", STUDIO_TIER_LABEL[studio.producerTierUnlocked]],
        ],
        next: nextStudio ? [
          ["Quality", `+${nextStudio.qualityBonusFlat}`],
          ["Roster", `${nextStudio.rosterCap}`],
          ["Tokens/Wk", `${nextStudio.tokensPerWeek}`],
          ["Producer", STUDIO_TIER_LABEL[nextStudio.producerTierUnlocked]],
          ["Op Cost", `${fmt(nextStudio.weeklyOperatingCost)}/wk`],
        ] : null,
      },
    },
    {
      id: "scouting",
      name: "Scouting",
      level: scoutingLevel,
      keyStat: `${scouting.visibilityPct}% vis`,
      weeklyCost: scouting.weeklyOperatingCost,
      nextCost: nextScouting?.unlockCost ?? null,
      affordable: nextScouting ? money >= nextScouting.unlockCost : null,
      onUpgrade: () => handle(upgradeScouting),
      detail: {
        current: [
          ["Visibility", `${scouting.visibilityPct}%`],
          ["Scouted", `${scouting.scoutedPct}%`],
          ["Agents Shown", `${Math.round(4 + (scouting.visibilityPct / 100) * 4)}`],
          ["Traits", scouting.revealedTraits.length > 0 ? scouting.revealedTraits.join(", ") : "none"],
        ],
        next: nextScouting ? [
          ["Visibility", `${nextScouting.visibilityPct}%`],
          ["Scouted", `${nextScouting.scoutedPct}%`],
          ...(nextScouting.revealedTraits.length > scouting.revealedTraits.length
            ? [["New Traits", nextScouting.revealedTraits.filter(t => !scouting.revealedTraits.includes(t)).join(", ")]]
            : []),
          ["Op Cost", `${fmt(nextScouting.weeklyOperatingCost)}/wk`],
        ] : null,
      },
    },
    {
      id: "artistdev",
      name: "Artist Dev",
      level: artistDevLevel,
      keyStat: artistDevLevel > 0 ? `+${Math.round(artistDev.improveProbBonus * 100)}% imp` : "--",
      weeklyCost: artistDev.weeklyOperatingCost,
      nextCost: nextArtistDev?.unlockCost ?? null,
      affordable: nextArtistDev ? money >= nextArtistDev.unlockCost : null,
      onUpgrade: () => handle(upgradeArtistDev),
      detail: {
        current: [
          ["Program", artistDevLevel > 0 ? artistDev.name : "None"],
          ["Improve Prob", artistDevLevel > 0 ? `+${Math.round(artistDev.improveProbBonus * 100)}%` : "--"],
          ["Regress Risk", artistDevLevel > 0 ? `-${Math.round(artistDev.regressReduction * 100)}%` : "--"],
          ["Age Decline", artistDevLevel > 0 ? `-${Math.round(artistDev.ageDeclineReduction * 100)}%` : "--"],
        ],
        next: nextArtistDev ? [
          ["Program", nextArtistDev.name],
          ["Improve", `+${Math.round(nextArtistDev.improveProbBonus * 100)}%`],
          ["Regress", `-${Math.round(nextArtistDev.regressReduction * 100)}%`],
          ["Age Decline", `-${Math.round(nextArtistDev.ageDeclineReduction * 100)}%`],
          ["Op Cost", `${fmt(nextArtistDev.weeklyOperatingCost)}/wk`],
        ] : null,
      },
    },
    {
      id: "touring",
      name: "Touring",
      level: touringLevel,
      keyStat: touringLevel > 0 ? `+${touring.revenueBonusPct}% rev` : "--",
      weeklyCost: touring.weeklyOperatingCost,
      nextCost: nextTouring?.unlockCost ?? null,
      affordable: nextTouring ? money >= nextTouring.unlockCost : null,
      onUpgrade: () => handle(upgradeTouringDept),
      detail: {
        current: [
          ["Program", touringLevel > 0 ? touring.name : "None"],
          ["Revenue", touringLevel > 0 ? `+${touring.revenueBonusPct}%` : "--"],
          ["Fan Growth", touringLevel > 0 ? `+${touring.fanBonusPct}%` : "--"],
          ["Fatigue Red.", touringLevel > 0 ? `-${Math.round(touring.fatigueMitigation * 100)}%` : "--"],
        ],
        next: nextTouring ? [
          ["Program", nextTouring.name],
          ["Revenue", `+${nextTouring.revenueBonusPct}%`],
          ["Fans", `+${nextTouring.fanBonusPct}%`],
          ["Fatigue", `-${Math.round(nextTouring.fatigueMitigation * 100)}%`],
          ["Op Cost", `${fmt(nextTouring.weeklyOperatingCost)}/wk`],
        ] : null,
      },
    },
    {
      id: "marketing",
      name: "Marketing",
      level: marketingLevel,
      keyStat: marketingLevel > 0 ? `+${marketing.revenuePct}% rev` : "--",
      weeklyCost: marketing.weeklyOperatingCost,
      nextCost: nextMarketing?.unlockCost ?? null,
      affordable: nextMarketing ? money >= nextMarketing.unlockCost : null,
      onUpgrade: () => handle(upgradeMarketing),
      detail: {
        current: [
          ["Program", marketingLevel > 0 ? marketing.name : "None"],
          ["Stream Revenue", marketingLevel > 0 ? `+${marketing.revenuePct}%` : "--"],
          ["Fan Growth", marketingLevel > 0 ? `+${marketing.fanGrowthPct}%` : "--"],
        ],
        next: nextMarketing ? [
          ["Program", nextMarketing.name],
          ["Revenue", `+${nextMarketing.revenuePct}%`],
          ["Fan Growth", `+${nextMarketing.fanGrowthPct}%`],
          ["Op Cost", `${fmt(nextMarketing.weeklyOperatingCost)}/wk`],
        ] : null,
      },
    },
    {
      id: "pr",
      name: "PR",
      level: prLevel,
      keyStat: prLevel > 0 ? `-${Math.round(pr.scandalDamageReduction * 100)}% dmg` : "--",
      weeklyCost: pr.weeklyOperatingCost,
      nextCost: nextPR?.unlockCost ?? null,
      affordable: nextPR ? money >= nextPR.unlockCost : null,
      onUpgrade: () => handle(upgradePR),
      detail: {
        current: [
          ["Program", prLevel > 0 ? pr.name : "None"],
          ["Scandal Freq", prLevel > 0 ? `-${Math.round(pr.scandalFreqReduction * 100)}%` : "--"],
          ["Scandal Dmg", prLevel > 0 ? `-${Math.round(pr.scandalDamageReduction * 100)}%` : "--"],
        ],
        next: nextPR ? [
          ["Program", nextPR.name],
          ["Frequency", `-${Math.round(nextPR.scandalFreqReduction * 100)}%`],
          ["Damage", `-${Math.round(nextPR.scandalDamageReduction * 100)}%`],
          ["Op Cost", `${fmt(nextPR.weeklyOperatingCost)}/wk`],
        ] : null,
      },
    },
    {
      id: "merch",
      name: "Merch",
      level: merchLevel,
      keyStat: merchLevel > 0 ? `$${merch.revenuePerFan.toFixed(3)}/fan` : "--",
      weeklyCost: merch.weeklyOperatingCost,
      nextCost: nextMerch?.unlockCost ?? null,
      affordable: nextMerch ? money >= nextMerch.unlockCost : null,
      onUpgrade: () => handle(upgradeMerch),
      detail: {
        current: [
          ["Program", merchLevel > 0 ? merch.name : "None"],
          ["$/Fan/Wk", merchLevel > 0 ? `$${merch.revenuePerFan.toFixed(3)}` : "--"],
        ],
        next: nextMerch ? [
          ["Program", nextMerch.name],
          ["$/Fan/Wk", `$${nextMerch.revenuePerFan.toFixed(3)}`],
          ["Op Cost", `${fmt(nextMerch.weeklyOperatingCost)}/wk`],
        ] : null,
      },
    },
  ];

  const totalWeeklyCost = departments.reduce((sum, d) => sum + d.weeklyCost, 0);

  return (
    <div className="p-2 sm:p-3">
      {/* Total overhead banner */}
      <div className="flex items-center justify-between mb-3 px-2">
        <h2 className="text-sm font-semibold text-gray-800">Department Upgrades</h2>
        <div className="text-xs text-gray-500">
          Weekly overhead: <span className="font-semibold text-gray-900">{fmt(totalWeeklyCost)}</span>/wk
        </div>
      </div>

      {/* Department table */}
      <div className="border border-gray-200 rounded-md overflow-hidden overflow-x-auto bg-white">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_80px_90px_70px_70px_72px] gap-0 px-3 py-1.5 bg-gray-100 border-b border-gray-200">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Department</div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-center">Level</div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right">Key Stat</div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right">Cost/Wk</div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-right">Next</div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-center"></div>
        </div>

        {departments.map((dept, idx) => {
          const isExpanded = expanded === dept.id;
          const isMaxed = dept.level >= 10;
          const rowBg = idx % 2 === 0 ? "bg-white" : "bg-gray-50/60";

          return (
            <div key={dept.id} className={`border-b border-gray-100 last:border-b-0 ${rowBg}`}>
              {/* Main row */}
              <div
                className="grid grid-cols-[1fr_80px_90px_70px_70px_72px] gap-0 px-3 py-2 items-center cursor-pointer hover:bg-blue-50/40 transition-colors"
                onClick={() => setExpanded(isExpanded ? null : dept.id)}
              >
                {/* Department name + expand indicator */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 select-none">{isExpanded ? "\u25BC" : "\u25B6"}</span>
                  <span className="text-xs font-medium text-gray-800">{dept.name}</span>
                </div>

                {/* Level bar + label */}
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-gray-600 tabular-nums">{dept.level}/10</span>
                  <LevelBar level={dept.level} affordable={dept.affordable} />
                </div>

                {/* Key stat */}
                <div className="text-xs text-gray-700 text-right tabular-nums">{dept.keyStat}</div>

                {/* Weekly cost */}
                <div className="text-xs text-gray-600 text-right tabular-nums">{fmt(dept.weeklyCost)}</div>

                {/* Next upgrade cost */}
                <div className={`text-xs text-right tabular-nums font-medium ${
                  isMaxed ? "text-gray-300" : dept.affordable ? "text-emerald-600" : "text-red-500"
                }`}>
                  {isMaxed ? "--" : fmt(dept.nextCost!)}
                </div>

                {/* Upgrade button */}
                <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                  {isMaxed ? (
                    <span className="text-[10px] text-emerald-600 font-medium">MAX</span>
                  ) : (
                    <button
                      onClick={dept.onUpgrade}
                      disabled={!dept.affordable}
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded transition
                        ${dept.affordable
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                    >
                      Upgrade
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded detail row */}
              {isExpanded && (
                <div className="px-4 pb-2.5 pt-0.5">
                  <div className="bg-gray-50 border border-gray-200 rounded p-2.5 grid grid-cols-2 gap-x-6 gap-y-0.5">
                    {/* Current stats column */}
                    <div>
                      <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Current (Lv {dept.level})</div>
                      {dept.detail.current.map(([label, value]) => (
                        <div key={label} className="flex justify-between text-xs py-0.5">
                          <span className="text-gray-500">{label}</span>
                          <span className="text-gray-800 font-medium tabular-nums">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Next level column */}
                    <div>
                      {dept.detail.next ? (
                        <>
                          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            Next (Lv {dept.level + 1})
                            <span className={`ml-1.5 ${dept.affordable ? "text-emerald-600" : "text-red-500"}`}>
                              {fmt(dept.nextCost!)}
                            </span>
                          </div>
                          {dept.detail.next.map(([label, value]) => (
                            <div key={label} className="flex justify-between text-xs py-0.5">
                              <span className="text-gray-500">{label}</span>
                              <span className="text-blue-700 font-medium tabular-nums">{value}</span>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider mt-0.5">
                          Department at max level
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
