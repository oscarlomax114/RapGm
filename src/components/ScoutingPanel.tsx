"use client";
import { useState, useEffect } from "react";
import { useGameStore, computeSigningFee } from "@/store/gameStore";
import { Artist, Song, Producer, Album, GameState, ATTRIBUTE_GROUPS, ATTRIBUTE_LABELS } from "@/lib/types";
import { computeWillingness, getProspectTier, MIN_SIGNING_WILLINGNESS } from "@/lib/engine";
import { isProducerUnlocked, PRODUCER_TIER_MIN_STUDIO } from "@/lib/data";
import ArtistSprite from "./ArtistSprite";

type FaSortCol = "ovr" | "age" | "potential" | "popularity" | "genre" | "fee" | "willingness";
type SubTab = "freeAgents" | "producers";

const TIER_BADGE: Record<string, string> = {
  underground: "bg-gray-200 text-gray-600",
  "mid-tier":  "bg-blue-100 text-blue-700",
  elite:       "bg-yellow-100 text-yellow-700",
};

export default function ScoutingPanel() {
  const store = useGameStore();
  const { artists, money, songs, albums, producers, turn, reputation, fanbase,
          signNewArtist, getVisibleFreeAgents, scoutingLevel, studioLevel, freeAgentPool } = store;
  const gameState = store as unknown as GameState;

  const freeAgents = getVisibleFreeAgents();

  const [subTab, setSubTab] = useState<SubTab>("freeAgents");

  // Profile modal
  const [profileArtistId, setProfileArtistId] = useState<string | null>(null);
  const profileArtist = profileArtistId ? artists.find((a) => a.id === profileArtistId) ?? null : null;

  // Signing modal
  const [signingArtist, setSigningArtist] = useState<Artist | null>(null);
  const [signingError, setSigningError] = useState<string | null>(null);

  // Free agent filters + pagination
  const [faGenreFilter, setFaGenreFilter] = useState<string>("all");
  const [faMinOvr, setFaMinOvr] = useState<number>(0);
  const [faMaxAge, setFaMaxAge] = useState<number>(99);
  const [faSortBy, setFaSortBy] = useState<FaSortCol>("ovr");
  const [faSortDesc, setFaSortDesc] = useState(true);
  const [faHideUnwilling, setFaHideUnwilling] = useState(false);
  const [faPage, setFaPage] = useState(0);
  const FA_PER_PAGE = 40;

  function toggleFaSort(col: FaSortCol) {
    if (faSortBy === col) {
      setFaSortDesc((d) => !d);
    } else {
      setFaSortBy(col);
      setFaSortDesc(col !== "age" && col !== "genre");
    }
  }

  const filteredFreeAgents = (() => {
    const scouted = freeAgents.filter((a) => a.scouted);
    const unscouted = freeAgents.filter((a) => !a.scouted);

    const dir = faSortDesc ? -1 : 1;
    const filteredScouted = scouted
      .filter((a) => faGenreFilter === "all" || a.genre === faGenreFilter)
      .filter((a) => a.overallRating >= faMinOvr)
      .filter((a) => a.age <= faMaxAge)
      .filter((a) => !faHideUnwilling || computeWillingness(a, reputation) >= MIN_SIGNING_WILLINGNESS)
      .sort((a, b) => {
        if (faSortBy === "ovr") return (a.overallRating - b.overallRating) * dir;
        if (faSortBy === "age") return (a.age - b.age) * dir;
        if (faSortBy === "potential") return (a.potential - b.potential) * dir;
        if (faSortBy === "genre") return a.genre.localeCompare(b.genre) * dir;
        if (faSortBy === "fee") return (computeSigningFee(a, 1) - computeSigningFee(b, 1)) * dir;
        if (faSortBy === "willingness") return (computeWillingness(a, reputation) - computeWillingness(b, reputation)) * dir;
        return (a.popularity - b.popularity) * dir;
      });

    const filteredUnscouted = faHideUnwilling ? [] : unscouted
      .filter((a) => faGenreFilter === "all" || a.genre === faGenreFilter)
      .filter((a) => a.age <= faMaxAge);

    return [...filteredScouted, ...filteredUnscouted];
  })();

  const totalFaPages = Math.max(1, Math.ceil(filteredFreeAgents.length / FA_PER_PAGE));
  const clampedPage = Math.min(faPage, totalFaPages - 1);
  const pagedFreeAgents = filteredFreeAgents.slice(clampedPage * FA_PER_PAGE, (clampedPage + 1) * FA_PER_PAGE);

  useEffect(() => { setFaPage(0); }, [faGenreFilter, faMinOvr, faMaxAge, faSortBy, faSortDesc, faHideUnwilling]);

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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white border border-gray-200 sm:rounded-lg rounded-t-xl p-5 sm:max-w-sm w-full text-center shadow-lg">
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

      {/* Sub-tab toggle */}
      <div className="flex gap-0 border-b border-gray-200">
        {([
          { key: "freeAgents" as SubTab, label: "Free Agents" },
          { key: "producers" as SubTab, label: "Producers" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition ${
              subTab === tab.key
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Free Agents Sub-tab ── */}
      {subTab === "freeAgents" && (
        <section>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-gray-900 font-bold text-sm">Free Agents ({filteredFreeAgents.length})</h2>
              <p className="text-gray-400 text-[11px]">
                Scouting Lv.{scoutingLevel} · {freeAgents.filter(a => a.scouted).length}/{freeAgents.length} visible · {freeAgentPool.length} total in market
              </p>
            </div>
          </div>

          {/* Filters — inline single row */}
          <div className="flex items-center gap-1.5 sm:gap-1 mb-1.5 flex-wrap">
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
            <label className="flex items-center gap-1 cursor-pointer select-none ml-1">
              <input
                type="checkbox"
                checked={faHideUnwilling}
                onChange={(e) => setFaHideUnwilling(e.target.checked)}
                className="accent-blue-500"
              />
              <span className="text-[11px] text-gray-500">Hide unwilling</span>
            </label>
          </div>

          {filteredFreeAgents.length === 0 && <p className="text-gray-400 text-xs">No free agents match your filters.</p>}

          {pagedFreeAgents.length > 0 && (
            <div className="border border-gray-200 rounded overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-100 text-gray-500 border-b border-gray-200">
                    <th className="text-left py-1 px-2 font-semibold">Name</th>
                    <SortTh col="age" label="Age" align="center" current={faSortBy} desc={faSortDesc} onToggle={toggleFaSort} />
                    <SortTh col="genre" label="Genre" align="left" current={faSortBy} desc={faSortDesc} onToggle={toggleFaSort} />
                    <SortTh col="ovr" label="OVR" align="center" current={faSortBy} desc={faSortDesc} onToggle={toggleFaSort} />
                    <SortTh col="potential" label="POT" align="center" current={faSortBy} desc={faSortDesc} onToggle={toggleFaSort} />
                    <th className="text-center py-1 px-1 font-semibold">Phase</th>
                    <SortTh col="fee" label="Ask Fee" align="right" current={faSortBy} desc={faSortDesc} onToggle={toggleFaSort} />
                    <SortTh col="willingness" label="Willing" align="center" current={faSortBy} desc={faSortDesc} onToggle={toggleFaSort} />
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
                    // Signing cooldown check
                    const SIGNING_COOLDOWN = 8;
                    const REP_CHANGE_OVERRIDE = 10;
                    const onCooldown = a.lastOfferOutcome === "declined" && a.lastOfferTurn
                      && (turn - a.lastOfferTurn) < SIGNING_COOLDOWN
                      && (reputation - (a.lastOfferReputation ?? 0)) < REP_CHANGE_OVERRIDE;
                    const cooldownWeeks = onCooldown && a.lastOfferTurn ? SIGNING_COOLDOWN - (turn - a.lastOfferTurn) : 0;
                    return (
                      <tr
                        key={a.id}
                        className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} ${tooUnwilling || onCooldown ? "opacity-50" : "hover:bg-blue-50"}`}
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
                          {onCooldown ? (
                            <span className="text-[10px] text-amber-500 font-medium">{cooldownWeeks}wk</span>
                          ) : !tooUnwilling ? (
                            <button
                              onClick={() => setSigningArtist(a)}
                              className="text-[11px] text-green-600 hover:text-green-500 font-semibold"
                            >
                              Sign
                            </button>
                          ) : null}
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
      )}

      {/* ── Producers Sub-tab ── */}
      {subTab === "producers" && (
        <section>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-gray-900 font-bold text-sm">Producer Roster ({producers.length})</h2>
              <p className="text-gray-400 text-[11px]">
                Studio Lv.{studioLevel} · {producers.filter(p => isProducerUnlocked(p, { studioLevel })).length}/{producers.length} unlocked
              </p>
            </div>
          </div>

          <div className="border border-gray-200 rounded overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100 text-gray-500 border-b border-gray-200">
                  <th className="text-left py-1 px-2 font-semibold">Name</th>
                  <th className="text-left py-1 px-1 font-semibold">Tier</th>
                  <th className="text-left py-1 px-1 font-semibold">Specialty</th>
                  <th className="text-center py-1 px-1 font-semibold">Quality</th>
                  <th className="text-right py-1 px-1 font-semibold">Cost/Song</th>
                  <th className="text-center py-1 px-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {producers.map((p, idx) => {
                  const unlocked = isProducerUnlocked(p, { studioLevel });
                  const reqLevel = PRODUCER_TIER_MIN_STUDIO[p.studioTierRequired];
                  return (
                    <tr key={p.id} className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${!unlocked ? "opacity-50" : "hover:bg-blue-50"}`}>
                      <td className="py-1 px-2 text-gray-900 font-medium">{p.name}</td>
                      <td className="py-1 px-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${TIER_BADGE[p.tier]}`}>{p.tier}</span>
                      </td>
                      <td className="py-1 px-1 text-gray-600">{p.specialty}</td>
                      <td className="text-center py-1 px-1 font-semibold text-gray-900">{p.quality}</td>
                      <td className="text-right py-1 px-1 text-gray-600">${(p.costPerSong / 1000).toFixed(0)}K</td>
                      <td className="text-center py-1 px-2">
                        {unlocked ? (
                          <span className="text-green-600 text-[10px] font-semibold">Unlocked</span>
                        ) : (
                          <span className="text-gray-400 text-[10px] font-semibold">Studio Lv.{reqLevel}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
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
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200 sm:rounded-lg rounded-t-xl w-full sm:max-w-sm shadow-lg" onClick={(e) => e.stopPropagation()}>
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

// ── Artist Profile Modal (view-only for scouting) ─────────────────────────────

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

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center sm:p-2"
      onClick={onClose}
    >
      <div
        className="bg-white border border-gray-200 sm:rounded-lg rounded-t-xl w-full sm:max-w-2xl h-[90vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto shadow-lg"
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
          {/* Character sprite + core stats side by side */}
          <div className="flex gap-3 items-start">
            <div className="shrink-0 bg-gray-50 rounded border border-gray-200 p-2">
              <ArtistSprite spriteIndex={artist.spriteIndex} size={96} />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-1">
              <MiniStat label="Pop" value={`${artist.popularity}`} sub={popularityLabel(artist.popularity)} />
              <MiniStat label="Fans" value={artist.fanbase >= 1000000 ? `${(artist.fanbase / 1000000).toFixed(1)}M` : artist.fanbase >= 1000 ? `${(artist.fanbase / 1000).toFixed(1)}K` : String(artist.fanbase)} />
              <MiniStat label="Morale" value={String(artist.morale)} />
              <MiniStat label="Age" value={String(artist.age)} />
            </div>
          </div>

          {/* Career ecosystem */}
          {artist.careerPhase && (
            <div>
              <h3 className="text-gray-500 font-semibold text-[11px] uppercase tracking-wider mb-1">Career</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
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
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
              <MiniStat label="Songs" value={String(artistSongs.length)} />
              <MiniStat label="Albums" value={String(artistAlbums.length)} />
              <MiniStat label="Streams" value={totalStreams >= 1000000 ? `${(totalStreams / 1000000).toFixed(1)}M` : totalStreams >= 1000 ? `${(totalStreams / 1000).toFixed(0)}K` : String(totalStreams)} />
              <MiniStat label="Revenue" value={`$${(totalRevenue / 1000).toFixed(1)}K`} />
            </div>
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

// ── Sortable table header ──────────────────────────────────────────────────────

function SortTh({
  col, label, align, current, desc, onToggle,
}: {
  col: FaSortCol;
  label: string;
  align: "left" | "center" | "right";
  current: FaSortCol;
  desc: boolean;
  onToggle: (col: FaSortCol) => void;
}) {
  const active = current === col;
  const arrow = active ? (desc ? " ▼" : " ▲") : "";
  return (
    <th
      className={`py-1 px-1 font-semibold cursor-pointer select-none hover:text-gray-900 transition text-${align} ${active ? "text-gray-900" : "text-gray-500"}`}
      onClick={() => onToggle(col)}
    >
      {label}{arrow}
    </th>
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
