"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import TopBar from "./TopBar";
import Dashboard from "./Dashboard";
import ArtistsPanel from "./ArtistsPanel";
import StudioPanel from "./StudioPanel";
import ChartsPanel from "./ChartsPanel";
import UpgradesPanel from "./UpgradesPanel";
import MallPanel from "./MallPanel";
import AwardsPanel, { CeremonyModal } from "./AwardsPanel";
import LabelsPanel from "./LabelsPanel";

type Tab = "dashboard" | "artists" | "studio" | "charts" | "labels" | "upgrades" | "mall" | "awards";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "artists",   label: "Artists" },
  { id: "studio",    label: "Studio" },
  { id: "charts",    label: "Charts" },
  { id: "labels",    label: "Labels" },
  { id: "upgrades",  label: "Upgrades" },
  { id: "mall",      label: "Mall" },
  { id: "awards",    label: "Awards" },
];

export default function GameLayout() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const { nextTurn, gameOver, money, reputation, labelName, pendingAwardCeremony, dismissAwardCeremony } = useGameStore();

  if (gameOver) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-md p-10 w-full max-w-md text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Label Closed</h1>
          <p className="text-gray-500 text-sm mb-6">
            {money < -50000
              ? `${labelName} went bankrupt due to unsustainable debt.`
              : `${labelName} lost all industry reputation and could not recover.`}
          </p>
          <div className="grid grid-cols-2 gap-3 mb-8 text-sm">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              <div className="text-gray-500 text-xs">Final Cash</div>
              <div className={`font-semibold ${money < 0 ? "text-red-600" : "text-green-600"}`}>
                ${money.toLocaleString()}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              <div className="text-gray-500 text-xs">Reputation</div>
              <div className="font-semibold text-gray-900">{reputation}/100</div>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 rounded text-sm transition"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {pendingAwardCeremony && (
        <CeremonyModal
          ceremony={pendingAwardCeremony}
          labelName={labelName}
          onClose={dismissAwardCeremony}
        />
      )}
      <TopBar onNextTurn={nextTurn} />

      {/* Tab Nav */}
      <div className="bg-white border-b border-gray-200 px-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 ${
              tab === t.id
                ? "border-blue-600 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="flex-1 overflow-y-auto">
        {tab === "dashboard" && <Dashboard />}
        {tab === "artists"   && <ArtistsPanel />}
        {tab === "studio"    && <StudioPanel />}
        {tab === "charts"    && <ChartsPanel />}
        {tab === "labels"    && <LabelsPanel />}
        {tab === "upgrades"  && <UpgradesPanel />}
        {tab === "mall"      && <MallPanel />}
        {tab === "awards"    && <AwardsPanel />}
      </div>
    </div>
  );
}
