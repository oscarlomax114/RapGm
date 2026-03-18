"use client";
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

export default function UpgradesPanel() {
  const {
    money, studioLevel, scoutingLevel, artistDevLevel, touringLevel,
    marketingLevel, prLevel, merchLevel, recordingTokens,
    upgradeStudio, upgradeScouting, upgradeArtistDev, upgradeTouringDept,
    upgradeMarketing, upgradePR, upgradeMerch,
  } = useGameStore();

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

  function handleStudio() {
    const err = upgradeStudio();
    if (err) alert(err);
  }
  function handleScouting() {
    const err = upgradeScouting();
    if (err) alert(err);
  }
  function handleArtistDev() {
    const err = upgradeArtistDev();
    if (err) alert(err);
  }
  function handleTouring() {
    const err = upgradeTouringDept();
    if (err) alert(err);
  }
  function handleMarketing() {
    const err = upgradeMarketing();
    if (err) alert(err);
  }
  function handlePR() {
    const err = upgradePR();
    if (err) alert(err);
  }
  function handleMerch() {
    const err = upgradeMerch();
    if (err) alert(err);
  }

  return (
    <div className="p-4 space-y-8">

      {/* ── Studio Ladder ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-900 font-semibold text-sm">Studio</h2>
          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
            Level {studioLevel} / 10
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 rounded mb-4">
          <div
            className="h-2 bg-blue-600 rounded transition-all"
            style={{ width: `${studioLevel * 10}%` }}
          />
        </div>

        {/* Current stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {[
            ["Quality Bonus", `+${studio.qualityBonusFlat}`],
            ["Roster Cap", `${studio.rosterCap} artists`],
            ["Tokens/Week", studio.tokensPerWeek],
            ["Token Pool", recordingTokens],
            ["Weekly Cost", fmt(studio.weeklyOperatingCost)],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
              <div className="text-gray-400 text-[10px] uppercase tracking-wider">{label}</div>
              <div className="text-gray-900 font-semibold text-sm mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        {/* Producer access */}
        <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-4 text-xs text-gray-600">
          Producer access: <span className="text-gray-900 font-semibold">{STUDIO_TIER_LABEL[studio.producerTierUnlocked]} and below</span>
          {studioLevel < 10 && nextStudio && (
            <> &nbsp;→&nbsp; next unlock: <span className="text-blue-600 font-semibold">{STUDIO_TIER_LABEL[nextStudio.producerTierUnlocked]}</span></>
          )}
        </div>

        {/* Upgrade button */}
        {nextStudio ? (
          <div className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-gray-900 font-semibold text-sm">Upgrade to Level {studioLevel + 1}</div>
              <div className="text-gray-600 text-xs mt-1 space-y-0.5">
                <div>+{nextStudio.qualityBonusFlat} quality · {nextStudio.tokensPerWeek} tokens/week · {nextStudio.rosterCap} roster cap</div>
                <div>Weekly cost: {fmt(nextStudio.weeklyOperatingCost)}/wk</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-semibold text-sm mb-1 ${money >= nextStudio.unlockCost ? "text-green-700" : "text-red-600"}`}>
                {fmt(nextStudio.unlockCost)}
              </div>
              <button
                onClick={handleStudio}
                disabled={money < nextStudio.unlockCost}
                className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-1.5 rounded transition"
              >
                Upgrade
              </button>
            </div>
          </div>
        ) : (
          <div className="text-green-700 text-sm font-semibold text-center py-3">Studio at max level</div>
        )}
      </section>

      {/* ── Scouting Ladder ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-900 font-semibold text-sm">Scouting Department</h2>
          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
            Level {scoutingLevel} / 10
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-gray-200 rounded mb-4">
          <div
            className="h-2 bg-blue-600 rounded transition-all"
            style={{ width: `${scoutingLevel * 10}%` }}
          />
        </div>

        {/* Current stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            ["Visibility", `${scouting.visibilityPct}%`],
            ["Scouted", `${scouting.scoutedPct}%`],
            ["Agents Shown", `${Math.round(4 + (scouting.visibilityPct / 100) * 4)}`],
            ["Weekly Cost", fmt(scouting.weeklyOperatingCost)],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
              <div className="text-gray-400 text-[10px] uppercase tracking-wider">{label}</div>
              <div className="text-gray-900 font-semibold text-sm mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        {/* Revealed traits */}
        {scouting.revealedTraits.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-4 text-xs text-gray-600">
            Revealed traits: <span className="text-gray-900 font-semibold">{scouting.revealedTraits.join(", ")}</span>
          </div>
        )}
        {nextScouting && nextScouting.revealedTraits.length > scouting.revealedTraits.length && (
          <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-4 text-xs text-gray-600">
            Next unlock reveals: <span className="text-blue-600 font-semibold">
              {nextScouting.revealedTraits.filter((t) => !scouting.revealedTraits.includes(t)).join(", ")}
            </span>
          </div>
        )}

        {/* Upgrade button */}
        {nextScouting ? (
          <div className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-gray-900 font-semibold text-sm">Upgrade to Level {scoutingLevel + 1}</div>
              <div className="text-gray-600 text-xs mt-1 space-y-0.5">
                <div>{nextScouting.visibilityPct}% visibility · {nextScouting.scoutedPct}% scouted</div>
                <div>Weekly cost: {fmt(nextScouting.weeklyOperatingCost)}/wk</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-semibold text-sm mb-1 ${money >= nextScouting.unlockCost ? "text-green-700" : "text-red-600"}`}>
                {fmt(nextScouting.unlockCost)}
              </div>
              <button
                onClick={handleScouting}
                disabled={money < nextScouting.unlockCost}
                className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-1.5 rounded transition"
              >
                Upgrade
              </button>
            </div>
          </div>
        ) : (
          <div className="text-green-700 text-sm font-semibold text-center py-3">Scouting at max level</div>
        )}
      </section>

      {/* ── Artist Development ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-900 font-semibold text-sm">Artist Development</h2>
          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
            Level {artistDevLevel} / 10
          </span>
        </div>

        <div className="w-full h-2 bg-gray-200 rounded mb-4">
          <div
            className="h-2 bg-blue-600 rounded transition-all"
            style={{ width: `${artistDevLevel * 10}%` }}
          />
        </div>

        {artistDevLevel > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-4 text-xs text-gray-400 italic">
            {artistDev.name}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            ["Improve Prob", artistDevLevel > 0 ? `+${Math.round(artistDev.improveProbBonus * 100)}%` : "—"],
            ["Regress Risk", artistDevLevel > 0 ? `-${Math.round(artistDev.regressReduction * 100)}%` : "—"],
            ["Age Decline", artistDevLevel > 0 ? `-${Math.round(artistDev.ageDeclineReduction * 100)}%` : "—"],
            ["Weekly Cost", fmt(artistDev.weeklyOperatingCost)],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
              <div className="text-gray-400 text-[10px] uppercase tracking-wider">{label}</div>
              <div className="text-gray-900 font-semibold text-sm mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        {nextArtistDev ? (
          <div className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-gray-900 font-semibold text-sm">{nextArtistDev.name}</div>
              <div className="text-gray-600 text-xs mt-1 space-y-0.5">
                <div>+{Math.round(nextArtistDev.improveProbBonus * 100)}% improve · -{Math.round(nextArtistDev.regressReduction * 100)}% regress · -{Math.round(nextArtistDev.ageDeclineReduction * 100)}% age decline</div>
                <div>Weekly cost: {fmt(nextArtistDev.weeklyOperatingCost)}/wk</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-semibold text-sm mb-1 ${money >= nextArtistDev.unlockCost ? "text-green-700" : "text-red-600"}`}>
                {fmt(nextArtistDev.unlockCost)}
              </div>
              <button
                onClick={handleArtistDev}
                disabled={money < nextArtistDev.unlockCost}
                className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-1.5 rounded transition"
              >
                Upgrade
              </button>
            </div>
          </div>
        ) : (
          <div className="text-green-700 text-sm font-semibold text-center py-3">Artist Development at max level</div>
        )}
      </section>

      {/* ── Touring Department ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-900 font-semibold text-sm">Touring Department</h2>
          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
            Level {touringLevel} / 10
          </span>
        </div>

        <div className="w-full h-2 bg-gray-200 rounded mb-4">
          <div
            className="h-2 bg-blue-600 rounded transition-all"
            style={{ width: `${touringLevel * 10}%` }}
          />
        </div>

        {touringLevel > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-4 text-xs text-gray-400 italic">
            {touring.name}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            ["Revenue Boost", touringLevel > 0 ? `+${touring.revenueBonusPct}%` : "—"],
            ["Fan Growth", touringLevel > 0 ? `+${touring.fanBonusPct}%` : "—"],
            ["Fatigue Reduction", touringLevel > 0 ? `-${Math.round(touring.fatigueMitigation * 100)}%` : "—"],
            ["Weekly Cost", fmt(touring.weeklyOperatingCost)],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
              <div className="text-gray-400 text-[10px] uppercase tracking-wider">{label}</div>
              <div className="text-gray-900 font-semibold text-sm mt-0.5">{value}</div>
            </div>
          ))}
        </div>

        {nextTouring ? (
          <div className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-gray-900 font-semibold text-sm">{nextTouring.name}</div>
              <div className="text-gray-600 text-xs mt-1 space-y-0.5">
                <div>+{nextTouring.revenueBonusPct}% revenue · +{nextTouring.fanBonusPct}% fans · -{Math.round(nextTouring.fatigueMitigation * 100)}% fatigue</div>
                <div>Weekly cost: {fmt(nextTouring.weeklyOperatingCost)}/wk</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-semibold text-sm mb-1 ${money >= nextTouring.unlockCost ? "text-green-700" : "text-red-600"}`}>
                {fmt(nextTouring.unlockCost)}
              </div>
              <button
                onClick={handleTouring}
                disabled={money < nextTouring.unlockCost}
                className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-1.5 rounded transition"
              >
                Upgrade
              </button>
            </div>
          </div>
        ) : (
          <div className="text-green-700 text-sm font-semibold text-center py-3">Touring Department at max level</div>
        )}
      </section>

      {/* ── Marketing Department ── */}
      {([
        { label: "Marketing Department", level: marketingLevel, data: MARKETING_DATA, next: nextMarketing, color: "sky", handle: handleMarketing,
          stats: (d: typeof marketing) => [
            ["Stream Revenue", marketingLevel > 0 ? `+${d.revenuePct}%` : "—"],
            ["Fan Growth", marketingLevel > 0 ? `+${d.fanGrowthPct}%` : "—"],
            ["Weekly Cost", fmt(d.weeklyOperatingCost)],
          ],
          nextDesc: (n: typeof nextMarketing) => n ? `+${n!.revenuePct}% revenue · +${n!.fanGrowthPct}% fan growth` : "",
        },
      ] as const).map(() => (
        <section key="marketing">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-gray-900 font-semibold text-sm">Marketing Department</h2>
            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">Level {marketingLevel} / 10</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded mb-4">
            <div className="h-2 bg-blue-600 rounded transition-all" style={{ width: `${marketingLevel * 10}%` }} />
          </div>
          {marketingLevel > 0 && <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-4 text-xs text-gray-400 italic">{marketing.name}</div>}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[["Stream Revenue", marketingLevel > 0 ? `+${marketing.revenuePct}%` : "—"],["Fan Growth", marketingLevel > 0 ? `+${marketing.fanGrowthPct}%` : "—"],["Weekly Cost", fmt(marketing.weeklyOperatingCost)]].map(([l,v]) => (
              <div key={l as string} className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
                <div className="text-gray-400 text-[10px] uppercase tracking-wider">{l}</div>
                <div className="text-gray-900 font-semibold text-sm mt-0.5">{v}</div>
              </div>
            ))}
          </div>
          {nextMarketing ? (
            <div className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-gray-900 font-semibold text-sm">{nextMarketing.name}</div>
                <div className="text-gray-600 text-xs mt-1">+{nextMarketing.revenuePct}% revenue · +{nextMarketing.fanGrowthPct}% fan growth · {fmt(nextMarketing.weeklyOperatingCost)}/wk</div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-semibold text-sm mb-1 ${money >= nextMarketing.unlockCost ? "text-green-700" : "text-red-600"}`}>{fmt(nextMarketing.unlockCost)}</div>
                <button onClick={handleMarketing} disabled={money < nextMarketing.unlockCost} className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-1.5 rounded transition">Upgrade</button>
              </div>
            </div>
          ) : <div className="text-green-700 text-sm font-semibold text-center py-3">Marketing at max level</div>}
        </section>
      ))}

      {/* ── PR Department ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-900 font-semibold text-sm">PR Department</h2>
          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">Level {prLevel} / 10</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded mb-4">
          <div className="h-2 bg-blue-600 rounded transition-all" style={{ width: `${prLevel * 10}%` }} />
        </div>
        {prLevel > 0 && <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-4 text-xs text-gray-400 italic">{pr.name}</div>}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            ["Scandal Freq", prLevel > 0 ? `-${Math.round(pr.scandalFreqReduction * 100)}%` : "—"],
            ["Scandal Damage", prLevel > 0 ? `-${Math.round(pr.scandalDamageReduction * 100)}%` : "—"],
            ["Weekly Cost", fmt(pr.weeklyOperatingCost)],
          ].map(([l,v]) => (
            <div key={l as string} className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
              <div className="text-gray-400 text-[10px] uppercase tracking-wider">{l}</div>
              <div className="text-gray-900 font-semibold text-sm mt-0.5">{v}</div>
            </div>
          ))}
        </div>
        {nextPR ? (
          <div className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-gray-900 font-semibold text-sm">{nextPR.name}</div>
              <div className="text-gray-600 text-xs mt-1">-{Math.round(nextPR.scandalFreqReduction * 100)}% frequency · -{Math.round(nextPR.scandalDamageReduction * 100)}% damage · {fmt(nextPR.weeklyOperatingCost)}/wk</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-semibold text-sm mb-1 ${money >= nextPR.unlockCost ? "text-green-700" : "text-red-600"}`}>{fmt(nextPR.unlockCost)}</div>
              <button onClick={handlePR} disabled={money < nextPR.unlockCost} className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-1.5 rounded transition">Upgrade</button>
            </div>
          </div>
        ) : <div className="text-green-700 text-sm font-semibold text-center py-3">PR Department at max level</div>}
      </section>

      {/* ── Merchandising Department ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-900 font-semibold text-sm">Merchandising</h2>
          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">Level {merchLevel} / 10</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded mb-4">
          <div className="h-2 bg-blue-600 rounded transition-all" style={{ width: `${merchLevel * 10}%` }} />
        </div>
        {merchLevel > 0 && <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 mb-4 text-xs text-gray-400 italic">{merch.name}</div>}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            ["$/Fan/Week", merchLevel > 0 ? `$${merch.revenuePerFan.toFixed(3)}` : "—"],
            ["Est. Revenue", merchLevel > 0 ? "Scales with fans" : "—"],
            ["Weekly Cost", fmt(merch.weeklyOperatingCost)],
          ].map(([l,v]) => (
            <div key={l as string} className="bg-gray-50 border border-gray-200 rounded p-2 text-center">
              <div className="text-gray-400 text-[10px] uppercase tracking-wider">{l}</div>
              <div className="text-gray-900 font-semibold text-sm mt-0.5">{v}</div>
            </div>
          ))}
        </div>
        {nextMerch ? (
          <div className="bg-white border border-gray-200 rounded-md p-4 flex items-center justify-between gap-4">
            <div>
              <div className="text-gray-900 font-semibold text-sm">{nextMerch.name}</div>
              <div className="text-gray-600 text-xs mt-1">${nextMerch.revenuePerFan.toFixed(3)}/fan · {fmt(nextMerch.weeklyOperatingCost)}/wk</div>
            </div>
            <div className="text-right shrink-0">
              <div className={`font-semibold text-sm mb-1 ${money >= nextMerch.unlockCost ? "text-green-700" : "text-red-600"}`}>{fmt(nextMerch.unlockCost)}</div>
              <button onClick={handleMerch} disabled={money < nextMerch.unlockCost} className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-1.5 rounded transition">Upgrade</button>
            </div>
          </div>
        ) : <div className="text-green-700 text-sm font-semibold text-center py-3">Merchandising at max level</div>}
      </section>

    </div>
  );
}
