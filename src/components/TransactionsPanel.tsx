"use client";
import { useState, useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { Transaction, TransactionType } from "@/lib/types";

function fmt(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`;
  return `$${abs}`;
}

function fmtSigned(n: number) {
  if (n > 0) return `+${fmt(n)}`;
  if (n < 0) return `-${fmt(n)}`;
  return "$0";
}

const TYPE_BADGE_COLORS: Record<TransactionType, string> = {
  signing: "bg-blue-100 text-blue-700",
  release: "bg-gray-100 text-gray-600",
  recording: "bg-purple-100 text-purple-700",
  single_release: "bg-green-100 text-green-700",
  album_release: "bg-green-100 text-green-700",
  feature_deal: "bg-pink-100 text-pink-700",
  tour_booking: "bg-yellow-100 text-yellow-800",
  upgrade: "bg-indigo-100 text-indigo-700",
  mall_purchase: "bg-amber-100 text-amber-800",
  revenue: "bg-emerald-100 text-emerald-700",
  renegotiation: "bg-gray-100 text-gray-600",
  contract_risk: "bg-gray-100 text-gray-600",
  scout_refresh: "bg-gray-100 text-gray-600",
  artist_dropped: "bg-gray-100 text-gray-600",
  overhead: "bg-gray-100 text-gray-600",
};

const TYPE_LABELS: Record<TransactionType, string> = {
  signing: "Signing",
  release: "Release",
  recording: "Recording",
  single_release: "Single",
  album_release: "Album",
  feature_deal: "Feature",
  tour_booking: "Tour",
  upgrade: "Upgrade",
  mall_purchase: "Mall",
  revenue: "Revenue",
  renegotiation: "Renegotiation",
  contract_risk: "Contract Risk",
  scout_refresh: "Scout",
  artist_dropped: "Dropped",
  overhead: "Overhead",
};

type CategoryFilter = "all" | "income" | "expense" | "action";
type TypeFilter =
  | "all"
  | "signings"
  | "recordings"
  | "releases"
  | "features"
  | "tours"
  | "upgrades"
  | "mall"
  | "other";

const TYPE_FILTER_MAP: Record<TypeFilter, TransactionType[]> = {
  all: [],
  signings: ["signing"],
  recordings: ["recording"],
  releases: ["single_release", "album_release", "release"],
  features: ["feature_deal"],
  tours: ["tour_booking"],
  upgrades: ["upgrade"],
  mall: ["mall_purchase"],
  other: [
    "revenue",
    "renegotiation",
    "contract_risk",
    "scout_refresh",
    "artist_dropped",
    "overhead",
  ],
};

const PAGE_SIZE = 30;

export default function TransactionsPanel() {
  const { transactions, turn } = useGameStore();

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [weekMin, setWeekMin] = useState("");
  const [weekMax, setWeekMax] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = [...transactions];

    if (categoryFilter !== "all") {
      result = result.filter((t) => t.category === categoryFilter);
    }

    if (typeFilter !== "all") {
      const allowedTypes = TYPE_FILTER_MAP[typeFilter];
      result = result.filter((t) => allowedTypes.includes(t.type));
    }

    const minW = weekMin ? parseInt(weekMin, 10) : NaN;
    const maxW = weekMax ? parseInt(weekMax, 10) : NaN;
    if (!isNaN(minW)) {
      result = result.filter((t) => t.turn >= minW);
    }
    if (!isNaN(maxW)) {
      result = result.filter((t) => t.turn <= maxW);
    }

    result.sort((a, b) => b.turn - a.turn || b.id.localeCompare(a.id));
    return result;
  }, [transactions, categoryFilter, typeFilter, weekMin, weekMax]);

  const totalIncome = useMemo(
    () => transactions.reduce((s, t) => (t.amount > 0 ? s + t.amount : s), 0),
    [transactions]
  );
  const totalExpenses = useMemo(
    () => transactions.reduce((s, t) => (t.amount < 0 ? s + t.amount : s), 0),
    [transactions]
  );
  const net = totalIncome + totalExpenses;

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageSlice = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  function handleCategoryChange(val: string) {
    setCategoryFilter(val as CategoryFilter);
    setPage(0);
  }
  function handleTypeChange(val: string) {
    setTypeFilter(val as TypeFilter);
    setPage(0);
  }
  function handleWeekMinChange(val: string) {
    setWeekMin(val);
    setPage(0);
  }
  function handleWeekMaxChange(val: string) {
    setWeekMax(val);
    setPage(0);
  }

  return (
    <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
      {/* Summary bar */}
      <div className="bg-white border border-gray-200 rounded-md p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          <div>
            <div className="text-gray-400 text-xs">Transactions</div>
            <div className="text-gray-900 font-semibold text-lg">
              {transactions.length}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Total Income</div>
            <div className="text-green-700 font-semibold text-lg">
              +{fmt(totalIncome)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Total Expenses</div>
            <div className="text-red-600 font-semibold text-lg">
              -{fmt(Math.abs(totalExpenses))}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Net</div>
            <div
              className={`font-semibold text-lg ${
                net > 0 ? "text-green-700" : net < 0 ? "text-red-600" : "text-gray-500"
              }`}
            >
              {fmtSigned(net)}
            </div>
          </div>
        </div>
      </div>

      {/* Filter controls */}
      <div className="bg-white border border-gray-200 rounded-md p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-gray-500 text-xs">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
              <option value="action">Actions</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-gray-500 text-xs">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All</option>
              <option value="signings">Signings</option>
              <option value="recordings">Recordings</option>
              <option value="releases">Releases</option>
              <option value="features">Features</option>
              <option value="tours">Tours</option>
              <option value="upgrades">Upgrades</option>
              <option value="mall">Mall</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-gray-500 text-xs">Weeks</label>
            <input
              type="text"
              value={weekMin}
              onChange={(e) => handleWeekMinChange(e.target.value)}
              placeholder="Min"
              className="text-xs border border-gray-200 rounded px-2 py-1 w-14 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-gray-400 text-xs">–</span>
            <input
              type="text"
              value={weekMax}
              onChange={(e) => handleWeekMaxChange(e.target.value)}
              placeholder="Max"
              className="text-xs border border-gray-200 rounded px-2 py-1 w-14 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="ml-auto text-gray-400 text-xs">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            {filtered.length !== transactions.length && ` of ${transactions.length}`}
          </div>
        </div>
      </div>

      {/* Transaction table */}
      {transactions.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
          <p className="text-gray-500 text-sm">
            No transactions yet. Start playing to see your history here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
          <p className="text-gray-500 text-sm">
            No transactions match your filters.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden overflow-x-auto">
          <table className="w-full text-xs min-w-[600px] sm:min-w-0">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left text-gray-500 font-medium px-3 py-2 w-14">
                  Week
                </th>
                <th className="text-left text-gray-500 font-medium px-3 py-2 w-24">
                  Type
                </th>
                <th className="text-left text-gray-500 font-medium px-3 py-2">
                  Description
                </th>
                <th className="text-left text-gray-500 font-medium px-3 py-2 w-28">
                  Artist
                </th>
                <th className="text-right text-gray-500 font-medium px-3 py-2 w-20">
                  Amount
                </th>
                <th className="text-left text-gray-500 font-medium px-3 py-2 w-36">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {pageSlice.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-3 py-1.5 text-gray-600 tabular-nums">
                    {tx.turn}
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight ${
                        TYPE_BADGE_COLORS[tx.type] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {TYPE_LABELS[tx.type] ?? tx.type}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-gray-800 truncate max-w-[260px]">
                    {tx.description}
                  </td>
                  <td className="px-3 py-1.5 text-gray-600 truncate">
                    {tx.artistName ?? "—"}
                  </td>
                  <td
                    className={`px-3 py-1.5 text-right tabular-nums font-medium ${
                      tx.amount > 0
                        ? "text-green-700"
                        : tx.amount < 0
                        ? "text-red-600"
                        : "text-gray-400"
                    }`}
                  >
                    {tx.amount > 0
                      ? `+${fmt(tx.amount)}`
                      : tx.amount < 0
                      ? `-${fmt(tx.amount)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-gray-500 truncate max-w-[160px]">
                    {tx.details ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
              <div className="text-gray-400 text-xs">
                Showing {safePage * PAGE_SIZE + 1}–
                {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(0)}
                  disabled={safePage === 0}
                  className="px-2 py-0.5 text-xs rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  First
                </button>
                <button
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 0}
                  className="px-2 py-0.5 text-xs rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="text-gray-500 text-xs px-2">
                  {safePage + 1} / {pageCount}
                </span>
                <button
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount - 1}
                  className="px-2 py-0.5 text-xs rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                <button
                  onClick={() => setPage(pageCount - 1)}
                  disabled={safePage >= pageCount - 1}
                  className="px-2 py-0.5 text-xs rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
