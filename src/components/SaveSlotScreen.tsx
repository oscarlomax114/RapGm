"use client";
import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { guestListSlots, guestLoad, guestDelete, accountListSlots, accountLoad, accountDelete, type SaveSlotMeta } from "@/lib/saveManager";
import { useGameStore } from "@/store/gameStore";
import AuthModal from "./AuthModal";
import Image from "next/image";

export default function SaveSlotScreen({ onStartNew }: { onStartNew: (slot: number) => void }) {
  const { user, isGuest, loading: authLoading } = useAuth();
  const [slots, setSlots] = useState<SaveSlotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const loadSaveState = useGameStore((s) => s.loadSaveState);

  useEffect(() => {
    if (authLoading) return;
    loadSlots();
  }, [authLoading, isGuest]);

  async function loadSlots() {
    setLoading(true);
    const data = isGuest ? guestListSlots() : await accountListSlots();
    setSlots(data);
    setLoading(false);
  }

  async function handleLoad(slot: number) {
    const state = isGuest ? guestLoad(slot) : await accountLoad(slot);
    if (state) {
      loadSaveState(state, slot);
    }
  }

  async function handleDelete(slot: number) {
    setDeleting(slot);
    if (isGuest) {
      guestDelete(slot);
    } else {
      await accountDelete(slot);
    }
    await loadSlots();
    setDeleting(null);
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-neutral-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      {showAuth && <AuthModal onClose={() => { setShowAuth(false); loadSlots(); }} />}

      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Image src="/RL_TEXT_LOGO.png" alt="RapLabel GM" width={200} height={40} priority />
            <p className="text-neutral-500 text-xs mt-1.5">
              {isGuest ? "Playing as Guest" : user?.email}
            </p>
          </div>
          <div>
            {isGuest ? (
              <button
                onClick={() => setShowAuth(true)}
                className="text-sm text-purple-400 hover:text-purple-300 font-medium"
              >
                Sign In
              </button>
            ) : (
              <SignOutButton />
            )}
          </div>
        </div>

        {/* Guest warning */}
        {isGuest && (
          <div className="bg-amber-950/40 border border-amber-800 rounded px-3 py-2 mb-4">
            <p className="text-amber-400 text-xs">
              Guest saves are stored in your browser only. Create an account to save across devices.
            </p>
          </div>
        )}

        {/* Save slots */}
        <div className="grid grid-cols-2 gap-3">
          {slots.map((slot) => (
            <div
              key={slot.slotNumber}
              className={`bg-neutral-950 border rounded-lg p-4 ${
                slot.isEmpty ? "border-dashed border-neutral-700" : "border-neutral-800"
              }`}
            >
              <div className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider mb-2">
                Slot {slot.slotNumber}
              </div>

              {slot.isEmpty ? (
                <div className="space-y-3">
                  <p className="text-neutral-600 text-sm">Empty</p>
                  <button
                    onClick={() => onStartNew(slot.slotNumber)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-1.5 rounded text-xs transition"
                  >
                    New Game
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <div className="text-gray-100 font-semibold text-sm truncate">{slot.labelName}</div>
                    <div className="text-neutral-400 text-xs">Week {slot.turn}</div>
                    {slot.updatedAt && (
                      <div className="text-neutral-600 text-[10px]">
                        {new Date(slot.updatedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleLoad(slot.slotNumber)}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-1.5 rounded text-xs transition"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(slot.slotNumber)}
                      disabled={deleting === slot.slotNumber}
                      className="bg-red-950/50 hover:bg-red-900/50 text-red-400 font-medium py-1.5 px-2.5 rounded text-xs transition"
                    >
                      {deleting === slot.slotNumber ? "..." : "Del"}
                    </button>
                  </div>
                  <button
                    onClick={() => onStartNew(slot.slotNumber)}
                    className="w-full text-neutral-500 hover:text-neutral-300 text-[11px] font-medium"
                  >
                    Overwrite with New Game
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button
      onClick={async () => { await signOut(); window.location.reload(); }}
      className="text-sm text-neutral-500 hover:text-neutral-300 font-medium"
    >
      Sign Out
    </button>
  );
}
