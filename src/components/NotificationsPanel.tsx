"use client";
import { useState, useMemo } from "react";
import { useGameStore } from "@/store/gameStore";
import { GameEvent } from "@/lib/types";

type EventType = GameEvent["type"];

/* ── colour dot per event type (matches ReputationBell) ── */
function eventDot(type: EventType): string {
  switch (type) {
    case "scandal":
    case "major_controversy":
      return "bg-red-500";
    case "beef":
    case "beef_tension":
    case "beef_open":
    case "beef_diss_track":
      return "bg-red-400";
    case "minor_controversy":
    case "legal_incident":
    case "charges_filed":
    case "court_case":
    case "jail_sentence":
      return "bg-red-300";
    case "release_from_jail":
      return "bg-orange-300";
    case "burnout":
      return "bg-orange-400";
    case "viral_moment":
      return "bg-green-500";
    case "chart_surge":
      return "bg-green-400";
    case "award_nomination":
      return "bg-yellow-500";
    case "radio_play":
      return "bg-blue-400";
    case "label_deal":
      return "bg-blue-500";
    case "revenue":
      return "bg-gray-400";
    case "milestone":
      return "bg-blue-600";
    case "album_release":
      return "bg-purple-400";
    case "retirement":
      return "bg-gray-500";
    case "feature_collab":
      return "bg-pink-400";
    case "beef_resolution":
      return "bg-green-300";
    default:
      return "bg-gray-300";
  }
}

/* ── delta tag helper ── */
function deltaTag(value: number | undefined, prefix: string, suffix: string) {
  if (value === undefined || value === 0) return null;
  const positive = value > 0;
  const color = positive ? "text-green-600" : "text-red-600";
  const sign = positive ? "+" : "";
  return (
    <span className={`text-[10px] font-semibold ${color}`}>
      {sign}
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ── Filter types ── */
type TypeCategory =
  | "all"
  | "career"
  | "financial"
  | "scandal_legal"
  | "beef"
  | "awards"
  | "other";

type ImpactFilter = "all" | "positive" | "negative" | "neutral";

const TYPE_CATEGORY_MAP: Record<TypeCategory, EventType[]> = {
  all: [],
  career: [
    "viral_moment",
    "chart_surge",
    "radio_play",
    "milestone",
    "album_release",
  ],
  financial: ["revenue", "label_deal"],
  scandal_legal: [
    "scandal",
    "minor_controversy",
    "major_controversy",
    "legal_incident",
    "charges_filed",
    "court_case",
    "jail_sentence",
    "release_from_jail",
  ],
  beef: [
    "beef",
    "beef_tension",
    "beef_open",
    "beef_diss_track",
    "beef_resolution",
  ],
  awards: ["award_nomination"],
  other: ["burnout", "retirement", "feature_collab"],
};

const TYPE_CATEGORY_LABELS: Record<TypeCategory, string> = {
  all: "All Types",
  career: "Career",
  financial: "Financial",
  scandal_legal: "Scandal / Legal",
  beef: "Beef",
  awards: "Awards",
  other: "Other",
};

const PAGE_SIZE = 40;

export default function NotificationsPanel() {
  const recentEvents = useGameStore((s) => s.recentEvents);
  const turn = useGameStore((s) => s.turn);

  const [typeCategory, setTypeCategory] = useState<TypeCategory>("all");
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [weekMin, setWeekMin] = useState("");
  const [weekMax, setWeekMax] = useState("");
  const [page, setPage] = useState(0);

  /* ── Summary stats ── */
  const summary = useMemo(() => {
    const total = recentEvents.length;
    const thisWeek = recentEvents.filter((e) => e.turn === turn).length;
    const positive = recentEvents.filter((e) => e.moneyDelta > 0).length;
    const negative = recentEvents.filter((e) => e.moneyDelta < 0).length;
    return { total, thisWeek, positive, negative };
  }, [recentEvents, turn]);

  /* ── Filtered + sorted events ── */
  const filtered = useMemo(() => {
    let result = [...recentEvents];

    if (typeCategory !== "all") {
      const allowed = TYPE_CATEGORY_MAP[typeCategory];
      result = result.filter((e) => allowed.includes(e.type));
    }

    if (impactFilter === "positive") {
      result = result.filter((e) => e.moneyDelta > 0);
    } else if (impactFilter === "negative") {
      result = result.filter((e) => e.moneyDelta < 0);
    } else if (impactFilter === "neutral") {
      result = result.filter((e) => e.moneyDelta === 0);
    }

    const minW = weekMin ? parseInt(weekMin, 10) : NaN;
    const maxW = weekMax ? parseInt(weekMax, 10) : NaN;
    if (!isNaN(minW)) {
      result = result.filter((e) => e.turn >= minW);
    }
    if (!isNaN(maxW)) {
      result = result.filter((e) => e.turn <= maxW);
    }

    result.sort((a, b) => b.turn - a.turn || b.id.localeCompare(a.id));
    return result;
  }, [recentEvents, typeCategory, impactFilter, weekMin, weekMax]);

  /* ── Pagination ── */
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageSlice = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  /* ── Filter change handlers (reset page) ── */
  function handleTypeCategoryChange(val: string) {
    setTypeCategory(val as TypeCategory);
    setPage(0);
  }
  function handleImpactChange(val: string) {
    setImpactFilter(val as ImpactFilter);
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
            <div className="text-gray-400 text-xs">Total Events</div>
            <div className="text-gray-900 font-semibold text-lg">
              {summary.total}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">This Week</div>
            <div className="text-gray-900 font-semibold text-lg">
              {summary.thisWeek}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Positive Money</div>
            <div className="text-green-700 font-semibold text-lg">
              {summary.positive}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs">Negative Money</div>
            <div className="text-red-600 font-semibold text-lg">
              {summary.negative}
            </div>
          </div>
        </div>
      </div>

      {/* Filter controls */}
      <div className="bg-white border border-gray-200 rounded-md p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-gray-500 text-xs">Type</label>
            <select
              value={typeCategory}
              onChange={(e) => handleTypeCategoryChange(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              {(Object.keys(TYPE_CATEGORY_LABELS) as TypeCategory[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {TYPE_CATEGORY_LABELS[key]}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <label className="text-gray-500 text-xs">Impact</label>
            <select
              value={impactFilter}
              onChange={(e) => handleImpactChange(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="all">All</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
              <option value="neutral">Neutral</option>
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
            <span className="text-gray-400 text-xs">&ndash;</span>
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
            {filtered.length !== recentEvents.length &&
              ` of ${recentEvents.length}`}
          </div>
        </div>
      </div>

      {/* Events list */}
      {recentEvents.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
          <p className="text-gray-500 text-sm">
            No events yet. Advance a week to see activity.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-8 text-center">
          <p className="text-gray-500 text-sm">
            No events match your filters.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {pageSlice.map((event) => (
              <li
                key={event.id}
                className="px-4 py-3 flex gap-3 items-start hover:bg-gray-50 transition-colors"
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${eventDot(event.type)}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-gray-900 text-xs font-semibold truncate">
                      {event.title}
                    </span>
                    <span className="text-gray-400 text-[10px] shrink-0">
                      Wk {event.turn}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {event.description}
                  </p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {deltaTag(event.moneyDelta, "$", "")}
                    {deltaTag(event.reputationDelta, "", " rep")}
                    {deltaTag(event.fanbaseDelta, "", " fans")}
                    {deltaTag(event.buzzDelta, "", " buzz")}
                    {deltaTag(event.momentumDelta, "", " momentum")}
                    {deltaTag(event.popularityDelta, "", " pop")}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
              <div className="text-gray-400 text-xs">
                Showing {safePage * PAGE_SIZE + 1}&ndash;
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
