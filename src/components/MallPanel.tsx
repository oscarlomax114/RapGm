"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { MALL_CATALOG } from "@/lib/data";
import { MallCategory } from "@/lib/types";

const CATEGORIES: { id: MallCategory; label: string; icon: string }[] = [
  { id: "jewelry",     label: "Jewelry",      icon: "💎" },
  { id: "cars",        label: "Cars",         icon: "🚗" },
  { id: "homes",       label: "Homes",        icon: "🏠" },
  { id: "clothes",     label: "Clothes",      icon: "👕" },
  { id: "shoes",       label: "Shoes",        icon: "👟" },
  { id: "accessories", label: "Accessories",  icon: "🕶️" },
  { id: "exotic_pets", label: "Exotic Pets",  icon: "🐯" },
];

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function MallPanel() {
  const { money, vault, purchaseMallItem } = useGameStore();
  const [activeCategory, setActiveCategory] = useState<MallCategory>("jewelry");
  const [buyError, setBuyError] = useState<string | null>(null);
  const [lastBought, setLastBought] = useState<string | null>(null);

  const items = MALL_CATALOG.filter((i) => i.category === activeCategory);

  function handleBuy(itemId: string) {
    const err = purchaseMallItem(itemId);
    if (err) {
      setBuyError(err);
      setLastBought(null);
    } else {
      setBuyError(null);
      setLastBought(itemId);
      setTimeout(() => setLastBought(null), 2000);
    }
  }

  // Count how many of each item are in the vault
  const ownedCounts = vault.reduce<Record<string, number>>((acc, v) => {
    acc[v.itemId] = (acc[v.itemId] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-2 sm:p-4 space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-gray-900 font-semibold text-sm">The Mall</h2>
          <p className="text-gray-400 text-xs mt-0.5">Spend your earnings. Items appear in the Vault on your dashboard.</p>
        </div>
        <div className="text-right">
          <div className="text-gray-400 text-xs">Available</div>
          <div className={`font-semibold text-lg ${money < 0 ? "text-red-600" : "text-green-700"}`}>{fmt(money)}</div>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setActiveCategory(cat.id); setBuyError(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs font-medium whitespace-nowrap transition ${
              activeCategory === cat.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:text-gray-900 hover:bg-gray-200"
            }`}
          >
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {buyError && (
        <div className="bg-red-50 border border-red-200 rounded px-4 py-2 text-red-600 text-sm">{buyError}</div>
      )}

      {/* Item grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => {
          const owned = ownedCounts[item.id] ?? 0;
          const canAfford = money >= item.price;
          const justBought = lastBought === item.id;

          return (
            <div
              key={item.id}
              className={`bg-white border rounded-md p-4 flex flex-col gap-3 transition ${
                justBought ? "border-green-400 bg-green-50" : "border-gray-200"
              }`}
            >
              {/* Icon + owned badge */}
              <div className="flex items-start justify-between gap-3">
                <div className="text-lg select-none leading-none">{item.icon}</div>
                {owned > 0 && (
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium shrink-0">
                    Owned x{owned}
                  </span>
                )}
              </div>

              <div className="flex-1">
                <div className="text-gray-900 font-medium text-sm">{item.name}</div>
                <div className="text-gray-500 text-xs mt-1 leading-relaxed">{item.description}</div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className={`font-semibold text-sm ${canAfford ? "text-green-700" : "text-red-600"}`}>
                  {fmt(item.price)}
                </span>
                <button
                  onClick={() => handleBuy(item.id)}
                  disabled={!canAfford}
                  className={`text-xs font-medium px-4 py-1.5 rounded transition disabled:opacity-40 disabled:cursor-not-allowed ${
                    justBought
                      ? "bg-green-600 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {justBought ? "Bought!" : "Buy"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
