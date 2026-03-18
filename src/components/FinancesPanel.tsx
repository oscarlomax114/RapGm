"use client";
import { useGameStore } from "@/store/gameStore";
import { RevenueHistory, Transaction } from "@/lib/types";
import {
  STUDIO_DATA,
  SCOUTING_DATA,
  ARTIST_DEV_DATA,
  TOURING_DEPT_DATA,
  MARKETING_DATA,
  PR_DATA,
  MERCH_DATA,
} from "@/lib/data";

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.floor(n)}`;
}

function amtColor(n: number): string {
  if (n > 0) return "text-green-600";
  if (n < 0) return "text-red-600";
  return "text-gray-500";
}

export default function FinancesPanel() {
  const money = useGameStore((s) => s.money);
  const revenueHistory = useGameStore((s) => s.revenueHistory);
  const songs = useGameStore((s) => s.songs);
  const albums = useGameStore((s) => s.albums);
  const artists = useGameStore((s) => s.artists);
  const transactions = useGameStore((s) => s.transactions);
  const turn = useGameStore((s) => s.turn);
  const vault = useGameStore((s) => s.vault);
  const studioLevel = useGameStore((s) => s.studioLevel);
  const scoutingLevel = useGameStore((s) => s.scoutingLevel);
  const artistDevLevel = useGameStore((s) => s.artistDevLevel);
  const touringLevel = useGameStore((s) => s.touringLevel);
  const marketingLevel = useGameStore((s) => s.marketingLevel);
  const prLevel = useGameStore((s) => s.prLevel);
  const merchLevel = useGameStore((s) => s.merchLevel);

  // --- Compute weekly overhead from upgrade data ---
  const studioCost = STUDIO_DATA[studioLevel]?.weeklyOperatingCost ?? 0;
  const scoutingCost = SCOUTING_DATA[scoutingLevel]?.weeklyOperatingCost ?? 0;
  const artistDevCost = ARTIST_DEV_DATA[artistDevLevel]?.weeklyOperatingCost ?? 0;
  const touringCost = TOURING_DEPT_DATA[touringLevel]?.weeklyOperatingCost ?? 0;
  const marketingCost = MARKETING_DATA[marketingLevel]?.weeklyOperatingCost ?? 0;
  const prCost = PR_DATA[prLevel]?.weeklyOperatingCost ?? 0;
  const merchCost = MERCH_DATA[merchLevel]?.weeklyOperatingCost ?? 0;
  const totalWeeklyOverhead = studioCost + scoutingCost + artistDevCost + touringCost + marketingCost + prCost + merchCost;

  // --- Weekly income ---
  const weeklyIncome =
    revenueHistory.weeklyStreaming +
    revenueHistory.weeklyTouring +
    revenueHistory.weeklyMerch +
    revenueHistory.weeklyBrandDeals;
  const weeklyNet = weeklyIncome - revenueHistory.weeklyOverhead;

  // --- Revenue sources ---
  const allTimeTotal =
    revenueHistory.streaming +
    revenueHistory.touring +
    revenueHistory.merch +
    revenueHistory.brandDeals +
    revenueHistory.awards;

  const revenueSources = [
    { label: "Streaming", weekly: revenueHistory.weeklyStreaming, allTime: revenueHistory.streaming },
    { label: "Touring", weekly: revenueHistory.weeklyTouring, allTime: revenueHistory.touring },
    { label: "Merch", weekly: revenueHistory.weeklyMerch, allTime: revenueHistory.merch },
    { label: "Brand Deals", weekly: revenueHistory.weeklyBrandDeals, allTime: revenueHistory.brandDeals },
    { label: "Awards", weekly: 0, allTime: revenueHistory.awards },
  ];

  // --- One-time expenses from transactions ---
  const expenseByType = {
    signings: 0,
    recordings: 0,
    features: 0,
    marketing: 0,
    mall: 0,
    upgrades: 0,
  };
  for (const tx of transactions) {
    if (tx.amount >= 0) continue;
    const cost = Math.abs(tx.amount);
    switch (tx.type) {
      case "signing":
      case "renegotiation":
        expenseByType.signings += cost;
        break;
      case "recording":
        expenseByType.recordings += cost;
        break;
      case "feature_deal":
        expenseByType.features += cost;
        break;
      case "album_release":
        expenseByType.marketing += cost;
        break;
      case "mall_purchase":
        expenseByType.mall += cost;
        break;
      case "upgrade":
        expenseByType.upgrades += cost;
        break;
    }
  }

  // --- P&L ---
  const totalRevenue = allTimeTotal;
  const totalOneTimeExpenses = Object.values(expenseByType).reduce((a, b) => a + b, 0);
  const estimatedOverheadAllTime = totalWeeklyOverhead * turn;
  const totalExpenses = totalOneTimeExpenses + estimatedOverheadAllTime;
  const netPL = totalRevenue - totalExpenses;

  // --- Recent transactions (last 20 non-zero) ---
  const recentTx = transactions
    .filter((tx) => tx.amount !== 0)
    .slice(-20)
    .reverse();

  // --- Recurring expense rows ---
  const recurringRows = [
    { label: "Studio", level: studioLevel, cost: studioCost },
    { label: "Scouting", level: scoutingLevel, cost: scoutingCost },
    { label: "Artist Dev", level: artistDevLevel, cost: artistDevCost },
    { label: "Touring Dept", level: touringLevel, cost: touringCost },
    { label: "Marketing", level: marketingLevel, cost: marketingCost },
    { label: "PR", level: prLevel, cost: prCost },
    { label: "Merch", level: merchLevel, cost: merchCost },
  ];

  return (
    <div className="p-2 sm:p-0 space-y-3">
      {/* ── Financial Summary Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white border border-gray-200 rounded-md p-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Cash</div>
          <div className={`text-sm font-bold ${money >= 0 ? "text-green-600" : "text-red-600"}`}>
            {fmt(money)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Weekly Net</div>
          <div className={`text-sm font-bold ${amtColor(weeklyNet)}`}>
            {weeklyNet >= 0 ? "+" : ""}{fmt(weeklyNet)}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Weekly Income</div>
          <div className="text-sm font-bold text-green-600">{fmt(weeklyIncome)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-md p-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">Weekly Overhead</div>
          <div className="text-sm font-bold text-red-600">-{fmt(revenueHistory.weeklyOverhead)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* ── Revenue Sources ───────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-md">
          <div className="px-2 py-1 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-700">Revenue Sources</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-gray-400 uppercase">
                <th className="text-left px-2 py-0.5 font-medium">Source</th>
                <th className="text-right px-2 py-0.5 font-medium">This Week</th>
                <th className="text-right px-2 py-0.5 font-medium">All-Time</th>
                <th className="text-right px-2 py-0.5 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {revenueSources.map((src) => {
                const pct = allTimeTotal > 0 ? ((src.allTime / allTimeTotal) * 100) : 0;
                return (
                  <tr key={src.label} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-2 py-0.5 text-gray-700">{src.label}</td>
                    <td className="px-2 py-0.5 text-right text-green-600">{fmt(src.weekly)}</td>
                    <td className="px-2 py-0.5 text-right text-gray-700">{fmt(src.allTime)}</td>
                    <td className="px-2 py-0.5 text-right text-gray-500">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
              <tr className="border-t border-gray-200 font-semibold">
                <td className="px-2 py-0.5 text-gray-800">Total</td>
                <td className="px-2 py-0.5 text-right text-green-600">{fmt(weeklyIncome)}</td>
                <td className="px-2 py-0.5 text-right text-gray-800">{fmt(allTimeTotal)}</td>
                <td className="px-2 py-0.5 text-right text-gray-500">100%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Expenses Breakdown ────────────────────────────────── */}
        <div className="bg-white border border-gray-200 rounded-md">
          <div className="px-2 py-1 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-700">Expenses Breakdown</span>
          </div>

          {/* Recurring */}
          <div className="px-2 pt-1">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Recurring (weekly)</div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-gray-400 uppercase">
                <th className="text-left px-2 py-0.5 font-medium">Dept</th>
                <th className="text-right px-2 py-0.5 font-medium">Lvl</th>
                <th className="text-right px-2 py-0.5 font-medium">Weekly</th>
              </tr>
            </thead>
            <tbody>
              {recurringRows.map((row) => (
                <tr key={row.label} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-2 py-0.5 text-gray-700">{row.label}</td>
                  <td className="px-2 py-0.5 text-right text-gray-500">{row.level}</td>
                  <td className="px-2 py-0.5 text-right text-red-600">
                    {row.cost > 0 ? `-${fmt(row.cost)}` : "$0"}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 font-semibold">
                <td className="px-2 py-0.5 text-gray-800" colSpan={2}>Total Overhead</td>
                <td className="px-2 py-0.5 text-right text-red-600">-{fmt(totalWeeklyOverhead)}</td>
              </tr>
            </tbody>
          </table>

          {/* One-time */}
          <div className="px-2 pt-2">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">One-Time Spending (all-time)</div>
          </div>
          <table className="w-full text-xs mb-1">
            <tbody>
              {[
                { label: "Signings & Contracts", val: expenseByType.signings },
                { label: "Recordings", val: expenseByType.recordings },
                { label: "Features", val: expenseByType.features },
                { label: "Album Marketing", val: expenseByType.marketing },
                { label: "Mall Purchases", val: expenseByType.mall },
                { label: "Upgrades", val: expenseByType.upgrades },
              ].map((row) => (
                <tr key={row.label} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-2 py-0.5 text-gray-700">{row.label}</td>
                  <td className="px-2 py-0.5 text-right text-red-600">
                    {row.val > 0 ? `-${fmt(row.val)}` : "$0"}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-gray-200 font-semibold">
                <td className="px-2 py-0.5 text-gray-800">Total One-Time</td>
                <td className="px-2 py-0.5 text-right text-red-600">-{fmt(totalOneTimeExpenses)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Profit & Loss Statement ─────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-md">
        <div className="px-2 py-1 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-700">Profit & Loss (All-Time)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-2 py-1.5">
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Total Revenue</div>
            <div className="text-sm font-bold text-green-600">{fmt(totalRevenue)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Total Expenses</div>
            <div className="text-sm font-bold text-red-600">-{fmt(totalExpenses)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase">Net P&L</div>
            <div className={`text-sm font-bold ${amtColor(netPL)}`}>
              {netPL >= 0 ? "+" : ""}{fmt(netPL)}
            </div>
          </div>
        </div>
        <div className="px-2 pb-1">
          <div className="text-[10px] text-gray-400">
            Roster: {artists.filter((a) => a.signed).length} artists | Released songs: {songs.filter((s) => s.released).length} | Albums: {albums.filter((a) => a.status === "released").length} | Mall items: {vault.length} (spent {fmt(vault.reduce((s, v) => s + v.price, 0))})
          </div>
        </div>
      </div>

      {/* ── Recent Financial Transactions ───────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-md overflow-x-auto">
        <div className="px-2 py-1 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-700">Recent Transactions</span>
          <span className="text-[10px] text-gray-400 ml-1">({recentTx.length})</span>
        </div>
        {recentTx.length === 0 ? (
          <div className="px-2 py-2 text-xs text-gray-400">No financial transactions yet.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-gray-400 uppercase">
                <th className="text-left px-2 py-0.5 font-medium w-10">Wk</th>
                <th className="text-left px-2 py-0.5 font-medium w-20">Type</th>
                <th className="text-left px-2 py-0.5 font-medium">Description</th>
                <th className="text-right px-2 py-0.5 font-medium w-20">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.map((tx) => (
                <tr key={tx.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-2 py-0.5 text-gray-500">{tx.turn}</td>
                  <td className="px-2 py-0.5 text-gray-600">{tx.type.replace(/_/g, " ")}</td>
                  <td className="px-2 py-0.5 text-gray-700 truncate max-w-[200px]">{tx.description}</td>
                  <td className={`px-2 py-0.5 text-right font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {tx.amount >= 0 ? "+" : ""}{fmt(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
