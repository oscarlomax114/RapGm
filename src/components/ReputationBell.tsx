"use client";
import { useState, useRef, useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { GameEvent } from "@/lib/types";

function BellIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M5.85 3.5a.75.75 0 0 0-1.117-1 9.719 9.719 0 0 0-2.348 4.876.75.75 0 0 0 1.479.248A8.219 8.219 0 0 1 5.85 3.5ZM19.267 2.5a.75.75 0 1 0-1.118 1 8.22 8.22 0 0 1 1.987 4.124.75.75 0 0 0 1.48-.248A9.72 9.72 0 0 0 19.266 2.5Z" />
      <path
        fillRule="evenodd"
        d="M12 2.25A6.75 6.75 0 0 0 5.25 9v.75a8.217 8.217 0 0 1-2.119 5.52.75.75 0 0 0 .298 1.206c1.544.57 3.16.99 4.831 1.243a3.75 3.75 0 1 0 7.48 0 24.583 24.583 0 0 0 4.83-1.244.75.75 0 0 0 .298-1.205 8.217 8.217 0 0 1-2.118-5.52V9A6.75 6.75 0 0 0 12 2.25ZM9.75 18c0-.034 0-.067.002-.1a25.05 25.05 0 0 0 4.496 0l.002.1a2.25 2.25 0 1 1-4.5 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function eventDot(type: GameEvent["type"]) {
  switch (type) {
    case "scandal":          return "bg-red-500";
    case "beef":             return "bg-red-400";
    case "burnout":          return "bg-orange-400";
    case "viral_moment":     return "bg-green-500";
    case "award_nomination": return "bg-yellow-500";
    case "chart_surge":      return "bg-green-400";
    case "radio_play":       return "bg-blue-400";
    case "label_deal":       return "bg-blue-500";
    case "revenue":          return "bg-gray-400";
    case "milestone":        return "bg-blue-600";
    case "album_release":    return "bg-purple-400";
    default:                 return "bg-gray-300";
  }
}

function deltaTag(value: number, prefix: string, suffix: string) {
  if (value === 0) return null;
  const positive = value > 0;
  const color = positive ? "text-green-600" : "text-red-600";
  const sign = positive ? "+" : "";
  return <span className={`text-[10px] font-semibold ${color}`}>{sign}{prefix}{value.toLocaleString()}{suffix}</span>;
}

export default function ReputationBell() {
  const recentEvents = useGameStore((s) => s.recentEvents);
  const [open, setOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const unread = Math.max(0, recentEvents.length - seenCount);

  function handleOpen() {
    if (!open) setSeenCount(recentEvents.length);
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative text-gray-400 hover:text-gray-900 transition p-1 rounded-md hover:bg-gray-100"
        aria-label="Notification log"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-semibold leading-none rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-md shadow-md z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-gray-900 font-semibold text-sm">Notifications</span>
            <span className="text-gray-400 text-xs">{recentEvents.length} events</span>
          </div>

          {recentEvents.length === 0 ? (
            <div className="px-4 py-6 text-gray-400 text-sm text-center">
              No events yet -- advance a week to see activity.
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {recentEvents.map((event) => (
                <li key={event.id} className="px-4 py-3 flex gap-3 items-start hover:bg-gray-50 transition">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${eventDot(event.type)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-gray-900 text-xs font-semibold truncate">{event.title}</span>
                      <span className="text-gray-400 text-[10px] shrink-0">Wk {event.turn}</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{event.description}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {deltaTag(event.moneyDelta, "$", "")}
                      {deltaTag(event.reputationDelta, "", " rep")}
                      {deltaTag(event.fanbaseDelta, "", " fans")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
