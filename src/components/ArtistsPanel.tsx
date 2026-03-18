"use client";
import { useState, useRef, useEffect } from "react";
import { useGameStore, computeSigningFee, computeRenegotiationFee } from "@/store/gameStore";
import { Artist, Song, Producer, Album, GameState, ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS } from "@/lib/types";
import { ALBUM_CYCLE_TURNS, computeWillingness, getProspectTier, MIN_SIGNING_WILLINGNESS } from "@/lib/engine";
import { STUDIO_DATA } from "@/lib/data";
import ArtistSprite from "./ArtistSprite";

export default function ArtistsPanel() {
  const store = useGameStore();
  const { artists, money, songs, albums, producers, turn, reputation, fanbase,
          signNewArtist, dropArtist, renegotiateArtistContract, riskRetainingArtist,
          renameArtist, getVisibleFreeAgents, scoutingLevel, studioLevel } = store;
  const gameState = store as unknown as GameState;

  const signed = artists.filter((a) => a.signed);
  const freeAgents = getVisibleFreeAgents();
  const expiredContracts = signed.filter(
    (a) => a.contractAlbumsLeft === 0 &&
      (a.lastAlbumReleaseTurn === 0 || turn - a.lastAlbumReleaseTurn >= ALBUM_CYCLE_TURNS)
  );
  const cycleLockedContracts = signed.filter(
    (a) => a.contractAlbumsLeft === 0 &&
      a.lastAlbumReleaseTurn > 0 && turn - a.lastAlbumReleaseTurn < ALBUM_CYCLE_TURNS
  );

  const [profileArtistId, setProfileArtistId] = useState<string | null>(null);
  const profileArtist = profileArtistId ? artists.find((a) => a.id === profileArtistId) ?? null : null;
  const [signingArtist, setSigningArtist] = useState<Artist | null>(null);
  const [renegArtist, setRenegArtist] = useState<Artist | null>(null);
  const [riskResult, setRiskResult] = useState<{ name: string; stayed: boolean } | null>(null);
  const [signingError, setSigningError] = useState<string | null>(null);

  // Free agent filters + pagination
  const [faGenreFilter, setFaGenreFilter] = useState<string>("all");
  const [faMinOvr, setFaMinOvr] = useState<number>(0);
  const [faMaxAge, setFaMaxAge] = useState<number>(99);
  const [faSortBy, setFaSortBy] = useState<"ovr" | "age" | "potential" | "popularity">("ovr");
  const [faPage, setFaPage] = useState(0);
  const FA_PER_PAGE = 40;

  const filteredFreeAgents = (() => {
    const scouted = freeAgents.filter((a) => a.scouted);
    const unscouted = freeAgents.filter((a) => !a.scouted);

    const filteredScouted = scouted
      .filter((a) => faGenreFilter === "all" || a.genre === faGenreFilter)
      .filter((a) => a.overallRating >= faMinOvr)
      .filter((a) => a.age <= faMaxAge)
      .sort((a, b) => {
        if (faSortBy === "ovr") return b.overallRating - a.overallRating;
        if (faSortBy === "age") return a.age - b.age;
        if (faSortBy === "potential") return b.potential - a.potential;
        return b.popularity - a.popularity;
      });

    const filteredUnscouted = unscouted
      .filter((a) => faGenreFilter === "all" || a.genre === faGenreFilter)
      .filter((a) => a.age <= faMaxAge);

    return [...filteredScouted, ...filteredUnscouted];
  })();

  const totalFaPages = Math.max(1, Math.ceil(filteredFreeAgents.length / FA_PER_PAGE));
  const clampedPage = Math.min(faPage, totalFaPages - 1);
  const pagedFreeAgents = filteredFreeAgents.slice(clampedPage * FA_PER_PAGE, (clampedPage + 1) * FA_PER_PAGE);

  useEffect(() => { setFaPage(0); }, [faGenreFilter, faMinOvr, faMaxAge, faSortBy]);

  function handleRisk(artist: Artist) {
    const stayed = riskRetainingArtist(artist.id);
    setRiskResult({ name: artist.name, stayed });
  }

  function getStatusLabel(a: Artist): { text: string; color: string } {
    if (a.onTour) return { text: "Touring", color: "text-yellow-600" };
    if (a.contractAlbumsLeft === 0) return { text: "Expired", color: "text-red-500" };
    if (a.fatigue > 70) return { text: "Fatigued", color: "text-orange-500" };
    return { text: "Active", color: "text-green-600" };
  }

  return (
    <div className="p-2 space-y-3">
      {/* Modals */}
      {profileArtist && (
        <ArtistProfileModal
          artist={profileArtist}
          songs={songs}
          albums={albums}
          producers={producers}
          onClose={() => setProfileArtistId(null)}
        />
      )}

      {signingArtist && (
        <SigningModal
          artist={signingArtist}
          money={money}
          onSign={(albumCount, fee) => {
            const err = signNewArtist(signingArtist.id, fee, albumCount);
            if (err) {
              setSigningError(err);
              setSigningArtist(null);
            } else {
              setSigningArtist(null);
            }
          }}
          onClose={() => setSigningArtist(null)}
        />
      )}

      {signingError && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-sm w-full text-center shadow-lg">
            <h3 className="text-gray-900 font-bold text-sm mb-1">Signing Failed</h3>
            <p className="text-gray-500 text-xs mb-4">{signingError}</p>
            <button
              onClick={() => setSigningError(null)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-1.5 rounded transition"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {renegArtist && (
        <RenegotiationModal
          artist={renegArtist}
          gameState={gameState}
          onRenegotiate={(albumCount) => {
            renegotiateArtistContract(renegArtist.id, albumCount);
            setRenegArtist(null);
          }}
          onClose={() => setRenegArtist(null)}
        />
      )}

      {riskResult && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-sm w-full text-center shadow-lg">
            <h3 className="text-gray-900 font-bold text-sm mb-1">
              {riskResult.stayed ? `${riskResult.name} Stays!` : `${riskResult.name} Walked`}
            </h3>
            <p className="text-gray-500 text-xs mb-4">
              {riskResult.stayed
                ? "Their loyalty kept them around. Contract extended by 1 album."
                : "They felt undervalued and left the label."}
            </p>
            <button
              onClick={() => setRiskResult(null)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-1.5 rounded transition"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Cycle-locked contracts — compact alert bar */}
      {cycleLockedContracts.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1.5 flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-gray-500">Album Cycle In Progress:</span>
          {cycleLockedContracts.map((a) => {
            const weeksLeft = ALBUM_CYCLE_TURNS - (turn - a.lastAlbumReleaseTurn);
            return (
              <span key={a.id} className="text-gray-600">
                <span className="font-medium text-gray-900">{a.name}</span> — eval in {weeksLeft}wk{weeksLeft !== 1 ? "s" : ""}
              </span>
            );
          })}
        </div>
      )}

      {/* Expired Contracts — compact alert bar */}
      {expiredContracts.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded px-2 py-1.5 space-y-1">
          <div className="text-xs font-semibold text-amber-800">Contract Expirations — Action Required</div>
          {expiredContracts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{a.name}</span>
                <span className="text-amber-700">Fulfilled {a.contractAlbumsTotal}-album deal</span>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setRenegArtist(a)}
                  className="text-[11px] bg-green-600 hover:bg-green-500 text-white px-2 py-0.5 rounded transition"
                >
                  Renegotiate
                </button>
                <button
                  onClick={() => handleRisk(a)}
                  className="text-[11px] bg-amber-500 hover:bg-amber-400 text-white px-2 py-0.5 rounded transition"
                >
                  Risk ({a.traits.loyalty}%)
                </button>
                <button
                  onClick={() => dropArtist(a.id)}
                  className="text-[11px] bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded transition"
                >
                  Release
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signed Roster — compact table */}
      <section>
        <h2 className="text-gray-900 font-bold text-sm mb-1">Signed Roster ({signed.length}/{STUDIO_DATA[studioLevel].rosterCap})</h2>
        {signed.length === 0 && <p className="text-gray-400 text-xs">No signed artists yet.</p>}
        {signed.length > 0 && (
          <div className="border border-gray-200 rounded overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-500 border-b border-gray-200">
                  <th className="text-left py-1 px-2 font-semibold">Name</th>
                  <th className="text-center py-1 px-1 font-semibold">Age</th>
                  <th className="text-left py-1 px-1 font-semibold">Genre</th>
                  <th className="text-center py-1 px-1 font-semibold">OVR</th>
                  <th className="text-center py-1 px-1 font-semibold">POT</th>
                  <th className="text-center py-1 px-1 font-semibold">Contract</th>
                  <th className="text-center py-1 px-1 font-semibold">Status</th>
                  <th className="text-center py-1 px-1 font-semibold">MOM</th>
                  <th className="text-center py-1 px-1 font-semibold">MRL</th>
                  <th className="text-center py-1 px-1 font-semibold">FTG</th>
                  <th className="text-right py-1 px-1 font-semibold">Fans</th>
                  <th className="text-right py-1 px-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {signed.map((a, i) => {
                  const status = getStatusLabel(a);
                  const ps = a.careerPhase ? phaseStyle(a.careerPhase) : null;
                  return (
                    <RosterRow
                      key={a.id}
                      artist={a}
                      index={i}
                      status={status}
                      phase={ps}
                      onViewProfile={() => setProfileArtistId(a.id)}
                      onRename={(newName) => renameArtist(a.id, newName)}
                      onDrop={() => dropArtist(a.id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Free Agents — compact table */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-gray-900 font-bold text-sm">Free Agents ({filteredFreeAgents.length})</h2>
            <p className="text-gray-400 text-[11px]">
              Scouting Lv.{scoutingLevel} · {freeAgents.filter(a => a.scouted).length}/{freeAgents.length} scouted
            </p>
          </div>
        </div>

        {/* Filters — inline single row */}
        <div className="flex items-center gap-1 mb-1.5 flex-wrap">
          <select
            value={faGenreFilter}
            onChange={(e) => setFaGenreFilter(e.target.value)}
            className="bg-white border border-gray-200 text-gray-700 text-[11px] rounded px-1.5 py-1 outline-none"
          >
            <option value="all">All Genres</option>
            <option value="trap">Trap</option>
            <option value="boom-bap">Boom Bap</option>
            <option value="drill">Drill</option>
            <option value="r-and-b">R&B</option>
            <option value="pop-rap">Pop Rap</option>
            <option value="experimental">Experimental</option>
          </select>
          <select
            value={faMinOvr}
            onChange={(e) => setFaMinOvr(Number(e.target.value))}
            className="bg-white border border-gray-200 text-gray-700 text-[11px] rounded px-1.5 py-1 outline-none"
          >
            <option value={0}>OVR: Any</option>
            <option value={30}>OVR: 30+</option>
            <option value={40}>OVR: 40+</option>
            <option value={50}>OVR: 50+</option>
            <option value={60}>OVR: 60+</option>
            <option value={70}>OVR: 70+</option>
            <option value={80}>OVR: 80+</option>
          </select>
          <select
            value={faMaxAge}
            onChange={(e) => setFaMaxAge(Number(e.target.value))}
            className="bg-white border border-gray-200 text-gray-700 text-[11px] rounded px-1.5 py-1 outline-none"
          >
            <option value={99}>Age: Any</option>
            <option value={21}>Age: &le;21</option>
            <option value={25}>Age: &le;25</option>
            <option value={28}>Age: &le;28</option>
            <option value={30}>Age: &le;30</option>
            <option value={35}>Age: &le;35</option>
          </select>
          <select
            value={faSortBy}
            onChange={(e) => setFaSortBy(e.target.value as typeof faSortBy)}
            className="bg-white border border-gray-200 text-gray-700 text-[11px] rounded px-1.5 py-1 outline-none"
          >
            <option value="ovr">Sort: OVR</option>
            <option value="potential">Sort: POT</option>
            <option value="age">Sort: Youngest</option>
            <option value="popularity">Sort: Pop</option>
          </select>
        </div>

        {filteredFreeAgents.length === 0 && <p className="text-gray-400 text-xs">No free agents match your filters.</p>}

        {pagedFreeAgents.length > 0 && (
          <div className="border border-gray-200 rounded overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100 text-gray-500 border-b border-gray-200">
                  <th className="text-left py-1 px-2 font-semibold">Name</th>
                  <th className="text-center py-1 px-1 font-semibold">Age</th>
                  <th className="text-left py-1 px-1 font-semibold">Genre</th>
                  <th className="text-center py-1 px-1 font-semibold">OVR</th>
                  <th className="text-center py-1 px-1 font-semibold">POT</th>
                  <th className="text-center py-1 px-1 font-semibold">Phase</th>
                  <th className="text-right py-1 px-1 font-semibold">Ask Fee</th>
                  <th className="text-center py-1 px-1 font-semibold">Willing</th>
                  <th className="text-right py-1 px-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {pagedFreeAgents.map((a, i) => {
                  if (!a.scouted) {
                    const prospect = getProspectTier(a);
                    const ps = a.careerPhase ? phaseStyle(a.careerPhase) : null;
                    return (
                      <tr key={a.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="py-1 px-2">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-[10px] font-bold shrink-0">?</div>
                            <span className="text-gray-400 font-medium">Unscouted</span>
                          </div>
                        </td>
                        <td className="text-center py-1 px-1 text-gray-500">{a.age}</td>
                        <td className="py-1 px-1 text-gray-500">{a.genre}</td>
                        <td className="text-center py-1 px-1 text-gray-300">--</td>
                        <td className="text-center py-1 px-1 text-gray-300">--</td>
                        <td className="text-center py-1 px-1">
                          {ps && <span className={`${phaseStyleLight(a.careerPhase)} text-[10px] font-semibold`}>{ps.label}</span>}
                        </td>
                        <td className="text-right py-1 px-1 text-gray-300">--</td>
                        <td className="text-center py-1 px-1">
                          <span className={`text-[10px] font-semibold ${prospect.color}`}>{prospect.label}</span>
                        </td>
                        <td className="text-right py-1 px-2"></td>
                      </tr>
                    );
                  }
                  const willingness = computeWillingness(a, reputation);
                  const tooUnwilling = willingness < MIN_SIGNING_WILLINGNESS;
                  const willingnessColor = tooUnwilling ? "text-gray-300" : willingness >= 70 ? "text-green-600" : willingness >= 45 ? "text-yellow-600" : "text-red-500";
                  const fee1 = computeSigningFee(a, 1);
                  const ps = a.careerPhase ? phaseStyle(a.careerPhase) : null;
                  return (
                    <tr
                      key={a.id}
                      className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${tooUnwilling ? "opacity-50" : "hover:bg-blue-50"}`}
                    >
                      <td className="py-1 px-2">
                        <div className="flex items-center gap-1.5">
                          <div className="shrink-0"><ArtistSprite spriteIndex={a.spriteIndex} size={20} /></div>
                          <button
                            onClick={tooUnwilling ? undefined : () => setProfileArtistId(a.id)}
                            className={`font-medium text-gray-900 truncate max-w-[120px] ${!tooUnwilling ? "hover:text-indigo-600 cursor-pointer" : ""}`}
                          >
                            {a.name}
                          </button>
                        </div>
                      </td>
                      <td className="text-center py-1 px-1 text-gray-600">{a.age}</td>
                      <td className="py-1 px-1 text-gray-600">{a.genre}</td>
                      <td className="text-center py-1 px-1 font-semibold text-gray-900">{a.overallRating}</td>
                      <td className="text-center py-1 px-1 text-gray-600">{a.potential}</td>
                      <td className="text-center py-1 px-1">
                        {ps && <span className={`${phaseStyleLight(a.careerPhase)} text-[10px] font-semibold`}>{ps.label}</span>}
                      </td>
                      <td className="text-right py-1 px-1 text-gray-600">${(fee1 / 1000).toFixed(0)}K</td>
                      <td className="text-center py-1 px-1">
                        <span className={`text-[10px] font-semibold ${willingnessColor}`}>
                          {tooUnwilling ? "No" : `${willingness}%`}
                        </span>
                      </td>
                      <td className="text-right py-1 px-2">
                        {!tooUnwilling && (
                          <button
                            onClick={() => setSigningArtist(a)}
                            className="text-[11px] text-green-600 hover:text-green-500 font-semibold"
                          >
                            Sign
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalFaPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-1.5">
            <button
              onClick={() => setFaPage(Math.max(0, clampedPage - 1))}
              disabled={clampedPage === 0}
              className="text-[11px] text-gray-500 hover:text-gray-900 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-0.5 rounded transition"
            >
              Prev
            </button>
            <span className="text-gray-400 text-[11px]">
              {clampedPage + 1} / {totalFaPages}
            </span>
            <button
              onClick={() => setFaPage(Math.min(totalFaPages - 1, clampedPage + 1))}
              disabled={clampedPage >= totalFaPages - 1}
              className="text-[11px] text-gray-500 hover:text-gray-900 border border-gray-200 disabled:opacity-30 disabled:cursor-not-allowed px-2 py-0.5 rounded transition"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// ── Roster Table Row (with inline rename) ────────────────────────────────────

function RosterRow({
  artist: a,
  index,
  status,
  phase,
  onViewProfile,
  onRename,
  onDrop,
}: {
  artist: Artist;
  index: number;
  status: { text: string; color: string };
  phase: { label: string; color: string } | null;
  onViewProfile: () => void;
  onRename: (newName: string) => void;
  onDrop: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(a.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (renaming) inputRef.current?.focus(); }, [renaming]);

  function commitRename() {
    if (nameInput.trim() && nameInput.trim() !== a.name) onRename(nameInput.trim());
    setRenaming(false);
  }

  return (
    <tr className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-blue-50 border-b border-gray-100`}>
      <td className="py-1 px-2">
        <div className="flex items-center gap-1.5">
          <div className="shrink-0"><ArtistSprite spriteIndex={a.spriteIndex} size={20} /></div>
          {renaming ? (
            <input
              ref={inputRef}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
              onBlur={commitRename}
              className="bg-white border border-indigo-400 rounded px-1 py-0 text-gray-900 text-xs font-medium w-24 focus:outline-none"
              maxLength={32}
            />
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={onViewProfile}
                className="font-medium text-gray-900 hover:text-indigo-600 cursor-pointer truncate max-w-[120px]"
              >
                {a.name}
              </button>
              <button
                onClick={() => { setNameInput(a.name); setRenaming(true); }}
                className="text-gray-300 hover:text-gray-500 transition shrink-0 text-[10px] leading-none"
                title="Rename"
              >
                ✎
              </button>
            </div>
          )}
        </div>
      </td>
      <td className="text-center py-1 px-1 text-gray-600">{a.age}</td>
      <td className="py-1 px-1 text-gray-600">{a.genre}</td>
      <td className="text-center py-1 px-1 font-semibold text-gray-900">{a.overallRating}</td>
      <td className="text-center py-1 px-1 text-gray-600">{a.potential}</td>
      <td className="text-center py-1 px-1">
        {a.contractAlbumsLeft === 0
          ? <span className="text-red-500 font-semibold">Expired</span>
          : <span className="text-gray-600">{a.contractAlbumsLeft}/{a.contractAlbumsTotal}</span>}
      </td>
      <td className="text-center py-1 px-1">
        <span className={`text-[10px] font-semibold ${status.color}`}>{status.text}</span>
      </td>
      <td className="text-center py-1 px-1">
        <span className={`font-semibold ${momentumBar(a.momentum ?? 0)}`}>{a.momentum ?? 0}</span>
      </td>
      <td className="text-center py-1 px-1 text-gray-600">{a.morale}</td>
      <td className={`text-center py-1 px-1 ${a.fatigue > 70 ? "text-red-500 font-semibold" : "text-gray-600"}`}>{a.fatigue}</td>
      <td className="text-right py-1 px-1 text-gray-600">
        {a.fanbase >= 1000 ? `${(a.fanbase / 1000).toFixed(0)}K` : a.fanbase}
      </td>
      <td className="text-right py-1 px-2">
        <button
          onClick={onDrop}
          className="text-[11px] text-red-400 hover:text-red-600 font-medium"
        >
          Drop
        </button>
      </td>
    </tr>
  );
}

// ── Signing Modal ─────────────────────────────────────────────────────────────

function SigningModal({
  artist,
  money,
  onSign,
  onClose,
}: {
  artist: Artist;
  money: number;
  onSign: (albumCount: 1 | 2 | 3, fee: number) => void;
  onClose: () => void;
}) {
  const [albumCount, setAlbumCount] = useState<1 | 2 | 3>(1);
  const fee = computeSigningFee(artist, albumCount);
  const canAfford = money >= fee;

  const ALBUM_LABELS: Record<number, string> = {
    1: "1-Album — Short-term",
    2: "2-Album — Balanced",
    3: "3-Album — Long-term",
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-lg w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <div>
            <h3 className="text-gray-900 font-bold text-sm">Sign {artist.name}</h3>
            <div className="text-gray-400 text-[11px]">{artist.genre} · Pop {artist.popularity} · {(artist.fanbase / 1000).toFixed(0)}K fans</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition text-sm">✕</button>
        </div>

        <div className="px-3 py-2 space-y-2">
          <div className="space-y-1">
            {([1, 2, 3] as const).map((n) => {
              const f = computeSigningFee(artist, n);
              return (
                <button
                  key={n}
                  onClick={() => setAlbumCount(n)}
                  className={`w-full text-left px-2 py-1.5 rounded border transition text-xs ${albumCount === n ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 font-medium">{ALBUM_LABELS[n]}</span>
                    <span className={`font-bold ${money >= f ? "text-green-600" : "text-red-500"}`}>
                      ${(f / 1000).toFixed(0)}K
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-[11px] text-gray-500 space-y-0.5">
            <div className="flex justify-between"><span>Signing Fee</span><span className="text-gray-900">${fee.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Albums</span><span className="text-gray-900">{albumCount}</span></div>
            <div className="flex justify-between"><span>Your Cash</span><span className={canAfford ? "text-green-600" : "text-red-500"}>${money.toLocaleString()}</span></div>
          </div>

          {!canAfford && <p className="text-red-500 text-[11px]">Not enough money for this deal.</p>}

          <button
            onClick={() => onSign(albumCount, fee)}
            disabled={!canAfford}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs py-1.5 rounded transition"
          >
            Sign {albumCount}-Album Deal — ${(fee / 1000).toFixed(0)}K
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Renegotiation Modal ───────────────────────────────────────────────────────

function RenegotiationModal({
  artist,
  gameState,
  onRenegotiate,
  onClose,
}: {
  artist: Artist;
  gameState: GameState;
  onRenegotiate: (albumCount: 1 | 2 | 3) => void;
  onClose: () => void;
}) {
  const [albumCount, setAlbumCount] = useState<1 | 2 | 3>(1);
  const fee = computeRenegotiationFee(artist, gameState, albumCount);
  const canAfford = gameState.money >= fee;

  const ALBUM_LABELS: Record<number, string> = {
    1: "1-Album Extension",
    2: "2-Album Extension",
    3: "3-Album Extension",
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-lg w-full max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
          <div>
            <h3 className="text-gray-900 font-bold text-sm">Renegotiate — {artist.name}</h3>
            <div className="text-gray-400 text-[11px]">Contract fulfilled. Extend the deal.</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition text-sm">✕</button>
        </div>

        <div className="px-3 py-2 space-y-2">
          <div className="space-y-1">
            {([1, 2, 3] as const).map((n) => {
              const f = computeRenegotiationFee(artist, gameState, n);
              return (
                <button
                  key={n}
                  onClick={() => setAlbumCount(n)}
                  className={`w-full text-left px-2 py-1.5 rounded border transition text-xs ${albumCount === n ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 font-medium">{ALBUM_LABELS[n]}</span>
                    <span className={`font-bold ${gameState.money >= f ? "text-green-600" : "text-red-500"}`}>
                      ${(f / 1000).toFixed(0)}K
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-[11px] text-gray-500 space-y-0.5">
            <div className="flex justify-between"><span>Renegotiation Fee</span><span className="text-gray-900">${fee.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>New Albums</span><span className="text-gray-900">{albumCount}</span></div>
            <div className="flex justify-between"><span>Loyalty</span><span className="text-gray-900">{artist.traits.loyalty}</span></div>
          </div>

          <p className="text-gray-400 text-[10px]">Fee reflects popularity, fan base, label reputation, and release quality.</p>

          {!canAfford && <p className="text-red-500 text-[11px]">Not enough money.</p>}

          <button
            onClick={() => onRenegotiate(albumCount)}
            disabled={!canAfford}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs py-1.5 rounded transition"
          >
            Extend Contract — ${(fee / 1000).toFixed(0)}K
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Artist Profile Modal (dense layout) ──────────────────────────────────────

function ArtistProfileModal({
  artist,
  songs,
  albums,
  producers,
  onClose,
}: {
  artist: Artist;
  songs: Song[];
  albums: Album[];
  producers: Producer[];
  onClose: () => void;
}) {
  const artistSongs = songs
    .filter((s) => s.artistId === artist.id && s.released)
    .sort((a, b) => a.turnReleased - b.turnReleased);
  const artistAlbums = albums
    .filter((al) => al.artistId === artist.id && al.status === "released")
    .sort((a, b) => a.turnReleased - b.turnReleased);

  const totalStreams = artistSongs.reduce((sum, s) => sum + s.streamsTotal, 0);
  const totalRevenue = artistSongs.reduce((sum, s) => sum + s.revenue, 0);
  const artistEarnings = Math.floor(totalRevenue * 0.3);
  const labelRevenue = Math.floor(totalRevenue * 0.7);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-2"
      onClick={onClose}
    >
      <div
        className="bg-white border border-gray-200 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-3 py-2 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-gray-900 font-bold text-sm">{artist.name}</h2>
              {artist.careerPhase && (() => { const ps = phaseStyle(artist.careerPhase); return (
                <span className={`${phaseStyleLight(artist.careerPhase)} border px-1.5 py-0 rounded text-[10px] font-semibold`}>{ps.label}</span>
              ); })()}
            </div>
            <div className="text-gray-400 text-[11px]">{artist.persona} · {artist.genre}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 text-sm transition">✕</button>
        </div>

        <div className="px-3 py-2 space-y-3">
          {/* Character sprite */}
          <div className="flex gap-3 items-start">
            <div className="shrink-0 bg-gray-50 rounded border border-gray-200 p-2">
              <ArtistSprite spriteIndex={artist.spriteIndex} size={60} />
            </div>
          </div>

          {/* Core stats — compact grid */}
          <div className="grid grid-cols-4 gap-1">
            <MiniStat label="Pop" value={`${artist.popularity}`} sub={popularityLabel(artist.popularity)} />
            <MiniStat label="Fans" value={artist.fanbase >= 1000000 ? `${(artist.fanbase / 1000000).toFixed(1)}M` : artist.fanbase >= 1000 ? `${(artist.fanbase / 1000).toFixed(1)}K` : String(artist.fanbase)} />
            <MiniStat label="Morale" value={String(artist.morale)} />
            <MiniStat label="Age" value={String(artist.age)} />
          </div>

          {/* Career ecosystem */}
          {artist.careerPhase && (
            <div>
              <h3 className="text-gray-500 font-semibold text-[11px] uppercase tracking-wider mb-1">Career</h3>
              <div className="grid grid-cols-4 gap-1">
                <MiniStat label="Phase" value={phaseStyle(artist.careerPhase).label} />
                <MiniStat label="Momentum" value={String(artist.momentum ?? 0)} />
                <MiniStat label="Buzz" value={String(artist.buzz ?? 0)} />
                <MiniStat label="Peak Mom" value={String(artist.peakMomentum ?? 0)} />
              </div>
              <div className="grid grid-cols-3 gap-1 mt-1">
                <MiniStat label="Chart Hits" value={String(artist.chartHits ?? 0)} />
                <MiniStat label="Flops" value={String(artist.flops ?? 0)} />
                <MiniStat label="Durability" value={artist.durability === "flash" ? "Flash" : artist.durability === "durable" ? "Durable" : "Solid"} />
              </div>
            </div>
          )}

          {/* Attributes */}
          <div>
            <h3 className="text-gray-500 font-semibold text-[11px] uppercase tracking-wider mb-1">
              Attributes <span className="text-gray-300 font-normal normal-case">OVR {artist.overallRating}</span>
            </h3>
            <div className="space-y-1.5">
              {Object.entries(ATTRIBUTE_GROUPS).map(([group, keys]) => (
                <div key={group}>
                  <div className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5">{group}</div>
                  <div className="grid grid-cols-5 gap-1">
                    {keys.map((k) => {
                      const val = artist.attributes[k];
                      const color = val >= 70 ? "text-green-600" : val >= 50 ? "text-gray-900" : val >= 30 ? "text-gray-400" : "text-red-500";
                      return (
                        <div key={k} className="bg-gray-50 border border-gray-100 rounded px-1 py-0.5 text-center">
                          <div className={`text-xs font-bold ${color}`}>{val}</div>
                          <div className="text-gray-400 text-[9px] leading-tight">{ATTRIBUTE_LABELS[k]}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Personality */}
          <div>
            <h3 className="text-gray-500 font-semibold text-[11px] uppercase tracking-wider mb-1">Personality</h3>
            <div className="grid grid-cols-3 gap-1">
              <MiniStat label="Loyalty" value={String(artist.traits.loyalty)} />
              <MiniStat label="Work Ethic" value={String(artist.traits.workEthic)} />
              <MiniStat label="Money Motiv." value={String(artist.traits.moneyMotivation)} />
              <MiniStat label="Competitive" value={String(artist.traits.competitiveness)} />
              <MiniStat label="Fame Motiv." value={String(artist.traits.fameMotivation)} />
              <MiniStat label="Controversy" value={String(artist.traits.controversyRisk)} />
            </div>
          </div>

          {/* Career stats */}
          <div>
            <h3 className="text-gray-500 font-semibold text-[11px] uppercase tracking-wider mb-1">Career Stats</h3>
            <div className="grid grid-cols-4 gap-1">
              <MiniStat label="Songs" value={String(artistSongs.length)} />
              <MiniStat label="Albums" value={String(artistAlbums.length)} />
              <MiniStat label="Streams" value={totalStreams >= 1000000 ? `${(totalStreams / 1000000).toFixed(1)}M` : totalStreams >= 1000 ? `${(totalStreams / 1000).toFixed(0)}K` : String(totalStreams)} />
              <MiniStat label="Revenue" value={`$${(totalRevenue / 1000).toFixed(1)}K`} />
            </div>
          </div>

          {/* Financial breakdown */}
          <div className="grid grid-cols-2 gap-1">
            <MiniStat label="Artist (30%)" value={`$${(artistEarnings / 1000).toFixed(1)}K`} highlight="green" />
            <MiniStat label="Label (70%)" value={`$${(labelRevenue / 1000).toFixed(1)}K`} highlight="indigo" />
          </div>

          {/* Albums */}
          {artistAlbums.length > 0 && (
            <div>
              <h3 className="text-gray-500 font-semibold text-[11px] uppercase tracking-wider mb-1">Albums ({artistAlbums.length})</h3>
              <div className="border border-gray-200 rounded overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 border-b border-gray-200">
                      <th className="text-left py-1 px-2 font-semibold">Title</th>
                      <th className="text-center py-1 px-1 font-semibold">Week</th>
                      <th className="text-center py-1 px-1 font-semibold">Tracks</th>
                      <th className="text-center py-1 px-1 font-semibold">Score</th>
                      <th className="text-right py-1 px-2 font-semibold">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artistAlbums.map((al, i) => (
                      <tr key={al.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="py-1 px-2 font-medium text-gray-900">&ldquo;{al.title}&rdquo;</td>
                        <td className="text-center py-1 px-1 text-gray-500">Wk {al.turnReleased}</td>
                        <td className="text-center py-1 px-1 text-gray-500">{al.songIds.length}</td>
                        <td className="text-center py-1 px-1 text-indigo-600 font-semibold">{al.qualityScore}</td>
                        <td className="text-right py-1 px-2 text-green-600">${(al.totalRevenue / 1000).toFixed(1)}K</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Release history */}
          <div>
            <h3 className="text-gray-500 font-semibold text-[11px] uppercase tracking-wider mb-1">Releases</h3>
            {artistSongs.length === 0 ? (
              <p className="text-gray-400 text-xs">No releases yet.</p>
            ) : (
              <div className="border border-gray-200 rounded overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 border-b border-gray-200">
                      <th className="text-left py-1 px-2 font-semibold">Song</th>
                      <th className="text-left py-1 px-1 font-semibold">Producer</th>
                      <th className="text-right py-1 px-1 font-semibold">Wk</th>
                      <th className="text-right py-1 px-1 font-semibold">Streams</th>
                      <th className="text-right py-1 px-1 font-semibold">Peak</th>
                      <th className="text-right py-1 px-2 font-semibold">Rev</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artistSongs.map((s, i) => {
                      const producer = producers.find((p) => p.id === s.producerId);
                      return (
                        <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="py-1 px-2 font-medium text-gray-900">{s.title}</td>
                          <td className="py-1 px-1 text-gray-500">{producer?.name ?? "Unknown"}</td>
                          <td className="py-1 px-1 text-right text-gray-500">{s.turnReleased}</td>
                          <td className="py-1 px-1 text-right text-gray-700">
                            {s.streamsTotal >= 1000000
                              ? `${(s.streamsTotal / 1000000).toFixed(1)}M`
                              : s.streamsTotal >= 1000
                              ? `${(s.streamsTotal / 1000).toFixed(0)}K`
                              : s.streamsTotal}
                          </td>
                          <td className="py-1 px-1 text-right text-gray-500">
                            {s.chartPosition ? `#${s.chartPosition}` : s.weeksOnChart > 0 ? "—" : "—"}
                          </td>
                          <td className="py-1 px-2 text-right text-green-600">${(s.revenue / 1000).toFixed(1)}K</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper: compact stat cell ─────────────────────────────────────────────────

function MiniStat({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: "green" | "indigo" }) {
  const valueColor =
    highlight === "green" ? "text-green-600"
    : highlight === "indigo" ? "text-indigo-600"
    : "text-gray-900";
  return (
    <div className="bg-gray-50 border border-gray-100 rounded px-1.5 py-1">
      <div className="text-gray-400 text-[10px] leading-tight">{label}</div>
      <div className={`font-bold text-xs ${valueColor}`}>{value}</div>
      {sub && <div className="text-gray-400 text-[9px]">{sub}</div>}
    </div>
  );
}

function popularityLabel(pop: number) {
  if (pop >= 80) return "Superstar";
  if (pop >= 60) return "Established";
  if (pop >= 40) return "Rising";
  if (pop >= 20) return "Underground";
  return "Unknown";
}

function phaseStyle(phase: string): { label: string; color: string } {
  switch (phase) {
    case "peak": return { label: "Peak", color: "text-yellow-400 border-yellow-700" };
    case "established": return { label: "Established", color: "text-green-400 border-green-700" };
    case "breakout": return { label: "Breakout", color: "text-emerald-400 border-emerald-700" };
    case "buzzing": return { label: "Buzzing", color: "text-blue-400 border-blue-700" };
    case "emerging": return { label: "Emerging", color: "text-cyan-400 border-cyan-700" };
    case "legacy": return { label: "Legacy", color: "text-amber-400 border-amber-700" };
    case "declining": return { label: "Declining", color: "text-red-400 border-red-700" };
    case "washed": return { label: "Washed", color: "text-red-600 border-red-800" };
    case "unknown": return { label: "Unknown", color: "text-zinc-400 border-zinc-600" };
    default: return { label: phase, color: "text-zinc-500 border-zinc-700" };
  }
}

function phaseStyleLight(phase: string): string {
  switch (phase) {
    case "peak": return "text-yellow-600 border-yellow-300";
    case "established": return "text-green-600 border-green-300";
    case "breakout": return "text-emerald-600 border-emerald-300";
    case "buzzing": return "text-blue-600 border-blue-300";
    case "emerging": return "text-cyan-600 border-cyan-300";
    case "legacy": return "text-amber-600 border-amber-300";
    case "declining": return "text-red-500 border-red-300";
    case "washed": return "text-red-600 border-red-400";
    case "unknown": return "text-gray-400 border-gray-300";
    default: return "text-gray-500 border-gray-300";
  }
}

function momentumBar(mom: number): string {
  if (mom >= 80) return "text-green-600";
  if (mom >= 60) return "text-emerald-600";
  if (mom >= 40) return "text-yellow-600";
  if (mom >= 25) return "text-orange-500";
  return "text-red-500";
}

function Stat({ label, value }: { label: string; value: number; max?: number; color?: string }) {
  return (
    <div className="flex justify-between text-gray-500 text-xs">
      <span>{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}
