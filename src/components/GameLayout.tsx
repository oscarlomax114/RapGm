"use client";
import { useState, useEffect, useCallback } from "react";
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

const VALID_TABS = new Set<string>([
  "dashboard", "artists", "studio", "scouting", "charts",
  "labels", "finances", "transactions", "rankings", "halloffame",
  "upgrades", "mall", "awards", "achievements", "notifications", "help",
]);

function getTabFromHash(): Tab {
  if (typeof window === "undefined") return "dashboard";
  const hash = window.location.hash.replace("#", "");
  return VALID_TABS.has(hash) ? (hash as Tab) : "dashboard";
}

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
  const [tab, setTabState] = useState<Tab>(getTabFromHash);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const { nextTurn, gameOver, money, reputation, labelName, pendingAwardCeremony, dismissAwardCeremony, activeSlot, setActiveSlot } = useGameStore();
  const { isGuest } = useAuth();
  const isMobile = useIsMobile();
  useAutosave(activeSlot, isGuest);

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sync tab state with browser hash for back/forward/refresh support
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    if (typeof window !== "undefined") {
      const currentHash = window.location.hash.replace("#", "");
      if (currentHash !== t) {
        window.history.pushState({ tab: t }, "", `#${t}`);
      }
    }
  }, []);

  // Set initial hash on mount if none exists
  useEffect(() => {
    if (typeof window === "undefined") return;
    const initialTab = getTabFromHash();
    if (!window.location.hash || window.location.hash === "#") {
      window.history.replaceState({ tab: initialTab }, "", `#${initialTab}`);
    }
  }, []);

  // Listen for browser back/forward navigation
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handlePopState() {
      const t = getTabFromHash();
      setTabState(t);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function switchTab(t: Tab) {
    setTab(t);
    setMobileMoreOpen(false);
    setDrawerOpen(false);
  }

  if (gameOver) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-neutral-950 border border-neutral-800 rounded-md p-8 sm:p-10 w-full max-w-md text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-100 mb-2">Label Closed</h1>
          <p className="text-neutral-400 text-sm mb-6">
            {money < -50000
              ? `${labelName} went bankrupt due to unsustainable debt.`
              : `${labelName} lost all industry reputation and could not recover.`}
          </p>
          <div className="grid grid-cols-2 gap-3 mb-8 text-sm">
            <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3">
              <div className="text-neutral-500 text-xs">Final Cash</div>
              <div className={`font-semibold ${money < 0 ? "text-red-400" : "text-green-400"}`}>
                ${money.toLocaleString()}
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-md p-3">
              <div className="text-neutral-500 text-xs">Reputation</div>
              <div className="font-semibold text-gray-100">{reputation}/100</div>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 rounded text-sm transition"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {pendingAwardCeremony && (
        <CeremonyModal
          ceremony={pendingAwardCeremony}
          labelName={labelName}
          onClose={dismissAwardCeremony}
        />
      )}

      {/* Main Menu Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShowSwitchModal(false)}>
          <div className="bg-neutral-950 border border-neutral-800 sm:rounded-lg rounded-t-xl shadow-lg w-full sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <div>
                <h3 className="text-gray-100 font-bold text-sm">Main Menu</h3>
                <p className="text-neutral-500 text-[11px]">Return to save slot selection</p>
              </div>
              <button onClick={() => setShowSwitchModal(false)} className="text-neutral-500 hover:text-gray-100 text-sm p-1">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-neutral-400 text-xs">Your progress is saved automatically. You can switch to a different save slot or start a new label.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSwitchModal(false)}
                  className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium py-2 rounded text-xs transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setActiveSlot(null); }}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 rounded text-xs transition"
                >
                  Go to Main Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile side drawer */}
      {isMobile && drawerOpen && (
        <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setDrawerOpen(false)}>
          <div
            className="absolute top-0 left-0 bottom-0 w-64 bg-neutral-950 shadow-lg flex flex-col border-r border-neutral-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <span className="text-gray-100 font-bold text-sm">{labelName}</span>
              <button onClick={() => setDrawerOpen(false)} className="text-neutral-500 hover:text-gray-100 p-1">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 py-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => switchTab(t.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-medium transition flex items-center gap-2.5 ${
                    tab === t.id
                      ? "bg-purple-950/50 text-purple-400 border-l-2 border-purple-500"
                      : "text-neutral-300 hover:bg-neutral-900 active:bg-neutral-800 border-l-2 border-transparent"
                  }`}
                >
                  <span className="text-base leading-none w-5 text-center">{t.icon}</span>
                  {t.label}
                </button>
              ))}
              <div className="border-t border-neutral-800 mt-1 pt-1">
                <button
                  onClick={() => { setDrawerOpen(false); setShowSwitchModal(true); }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-neutral-500 hover:bg-neutral-900 active:bg-neutral-800 transition flex items-center gap-2.5"
                >
                  <span className="text-base leading-none w-5 text-center">🔄</span>
                  Main Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <TopBar onNextTurn={nextTurn} onSeeAllNotifications={() => switchTab("notifications")} onMenuOpen={isMobile ? () => setDrawerOpen(true) : undefined} />

      {/* Desktop Tab Nav — hidden on mobile */}
      <div className="hidden sm:flex bg-neutral-950 border-b border-neutral-800 px-2 gap-0.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition border-b-2 ${
              tab === t.id
                ? "border-purple-500 text-gray-100"
                : "border-transparent text-neutral-500 hover:text-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowSwitchModal(true)}
          className="px-3 py-2 text-xs font-medium whitespace-nowrap text-neutral-500 hover:text-gray-100 transition"
        >
          Main Menu
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
