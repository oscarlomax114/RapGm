"use client";
import { useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useAuth } from "./AuthProvider";
import { useAutosave } from "@/lib/useAutosave";
import { useIsMobile } from "@/lib/useMediaQuery";
import TopBar from "./TopBar";
import Dashboard from "./Dashboard";
import ArtistsPanel from "./ArtistsPanel";
import StudioPanel from "./StudioPanel";
import ScoutingPanel from "./ScoutingPanel";
import ChartsPanel from "./ChartsPanel";
import UpgradesPanel from "./UpgradesPanel";
import MallPanel from "./MallPanel";
import AwardsPanel, { CeremonyModal } from "./AwardsPanel";
import LabelsPanel from "./LabelsPanel";
import FinancesPanel from "./FinancesPanel";
import TransactionsPanel from "./TransactionsPanel";
import HallOfFamePanel from "./HallOfFamePanel";
import RankingsPanel from "./RankingsPanel";
import AchievementsPanel from "./AchievementsPanel";
import NotificationsPanel from "./NotificationsPanel";
import HelpPanel from "./HelpPanel";

type Tab =
  | "dashboard" | "artists" | "studio" | "scouting" | "charts"
  | "labels" | "finances" | "transactions" | "rankings" | "halloffame"
  | "upgrades" | "mall" | "awards" | "achievements" | "notifications" | "help";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "dashboard",    label: "Dashboard",     icon: "📊" },
  { id: "artists",      label: "Artists",       icon: "🎤" },
  { id: "studio",       label: "Studio",        icon: "🎵" },
  { id: "scouting",     label: "Scouting",      icon: "🔍" },
  { id: "charts",       label: "Charts",        icon: "📈" },
  { id: "labels",       label: "Labels",        icon: "🏷️" },
  { id: "rankings",     label: "Rankings",      icon: "🏆" },
  { id: "finances",     label: "Finances",      icon: "💰" },
  { id: "transactions", label: "Transactions",  icon: "📒" },
  { id: "halloffame",   label: "Hall of Fame",  icon: "⭐" },
  { id: "upgrades",     label: "Upgrades",      icon: "⬆️" },
  { id: "mall",         label: "Mall",          icon: "🛍️" },
  { id: "awards",       label: "Awards",        icon: "🏅" },
  { id: "achievements", label: "Achievements",  icon: "🎯" },
  { id: "notifications",label: "Notifications", icon: "🔔" },
  { id: "help",         label: "How to Play",   icon: "❓" },
];


export default function GameLayout() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const { nextTurn, gameOver, money, reputation, labelName, pendingAwardCeremony, dismissAwardCeremony, activeSlot, rivalLabels, switchLabel } = useGameStore();
  const { isGuest } = useAuth();
  const isMobile = useIsMobile();
  useAutosave(activeSlot, isGuest);

  const [drawerOpen, setDrawerOpen] = useState(false);

  function switchTab(t: Tab) {
    setTab(t);
    setMobileMoreOpen(false);
    setDrawerOpen(false);
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-md p-8 sm:p-10 w-full max-w-md text-center shadow-sm">
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded text-sm transition"
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

      {/* Switch Label Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShowSwitchModal(false)}>
          <div className="bg-white border border-gray-200 sm:rounded-lg rounded-t-xl shadow-lg w-full sm:max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <h3 className="text-gray-900 font-bold text-sm">Switch Label</h3>
                <p className="text-gray-400 text-[11px]">Take over management of another label</p>
              </div>
              <button onClick={() => setShowSwitchModal(false)} className="text-gray-400 hover:text-gray-900 text-sm p-1">✕</button>
            </div>
            <div className="p-3 space-y-1 overflow-y-auto flex-1">
              {rivalLabels.map((rl) => (
                <button
                  key={rl.id}
                  onClick={() => {
                    if (confirm(`Switch to ${rl.name}? Your current progress as ${labelName} will be preserved as a rival label.`)) {
                      switchLabel(rl.id);
                      setShowSwitchModal(false);
                      setTab("dashboard");
                    }
                  }}
                  className="w-full text-left px-3 py-2.5 rounded border border-gray-200 hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100 transition flex items-center justify-between"
                >
                  <div>
                    <div className="text-gray-900 font-medium text-sm">{rl.name}</div>
                    <div className="text-gray-400 text-[11px]">{rl.primaryGenre} · {rl.rosterArtists.length} artists</div>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-900 font-semibold text-xs">{rl.prestige}</div>
                    <div className="text-gray-400 text-[10px]">prestige</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile side drawer */}
      {isMobile && drawerOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setDrawerOpen(false)}>
          <div
            className="absolute top-0 left-0 bottom-0 w-64 bg-white shadow-lg flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-gray-900 font-bold text-sm">{labelName}</span>
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-gray-900 p-1">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 py-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition flex items-center gap-2.5 ${
                    tab === t.id
                      ? "bg-blue-50 text-blue-600 border-l-2 border-blue-600"
                      : "text-gray-700 hover:bg-gray-50 active:bg-gray-100 border-l-2 border-transparent"
                  }`}
                >
                  <span className="text-base leading-none w-5 text-center">{t.icon}</span>
                  {t.label}
                </button>
              ))}
              <div className="border-t border-gray-200 mt-1 pt-1">
                <button
                  onClick={() => { setDrawerOpen(false); setShowSwitchModal(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 active:bg-gray-100 transition flex items-center gap-2.5"
                >
                  <span className="text-base leading-none w-5 text-center">🔄</span>
                  Switch Label
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TopBar onNextTurn={nextTurn} onSeeAllNotifications={() => switchTab("notifications")} onMenuOpen={isMobile ? () => setDrawerOpen(true) : undefined} />

      {/* Desktop Tab Nav — hidden on mobile */}
      <div className="hidden sm:flex bg-white border-b border-gray-200 px-2 gap-0.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition border-b-2 ${
              tab === t.id
                ? "border-blue-600 text-gray-900"
                : "border-transparent text-gray-400 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowSwitchModal(true)}
          className="px-3 py-2 text-xs font-medium whitespace-nowrap text-gray-400 hover:text-gray-900 transition"
        >
          Switch Label
        </button>
      </div>

      {/* Panel */}
      <div className="flex-1 overflow-y-auto">
        {tab === "dashboard"    && <Dashboard />}
        {tab === "artists"      && <ArtistsPanel />}
        {tab === "studio"       && <StudioPanel />}
        {tab === "scouting"     && <ScoutingPanel />}
        {tab === "charts"       && <ChartsPanel />}
        {tab === "labels"       && <LabelsPanel />}
        {tab === "rankings"     && <RankingsPanel />}
        {tab === "finances"     && <FinancesPanel />}
        {tab === "transactions" && <TransactionsPanel />}
        {tab === "halloffame"   && <HallOfFamePanel />}
        {tab === "upgrades"     && <UpgradesPanel />}
        {tab === "mall"         && <MallPanel />}
        {tab === "awards"       && <AwardsPanel />}
        {tab === "achievements" && <AchievementsPanel />}
        {tab === "notifications"&& <NotificationsPanel />}
        {tab === "help"          && <HelpPanel />}
      </div>
    </div>
  );
}
