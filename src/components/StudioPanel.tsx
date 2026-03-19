"use client";
import { useState } from "react";
import { useGameStore, computeFeatureFee, evaluateFeatureAcceptance, getAvailableFeatureArtists } from "@/store/gameStore";
import { GameState } from "@/lib/types";
import { isProducerUnlocked, PRODUCER_TIER_MIN_STUDIO } from "@/lib/data";
import { Producer, Album, TourSize, Song, Artist } from "@/lib/types";
import { TOUR_DATA, getTourEstimates, ALBUM_MIN_TRACKS, ALBUM_SHORT_MAX, ALBUM_LONG_MIN, ALBUM_CYCLE_TURNS, ALBUM_YEAR_TURNS, HIGH_WORK_ETHIC_THRESHOLD, computeAlbumStrategy, evaluateAlbumApproval } from "@/lib/engine";

const TIER_BADGE: Record<string, string> = {
  underground: "bg-gray-200 text-gray-600",
  "mid-tier":  "bg-blue-100 text-blue-700",
  elite:       "bg-yellow-100 text-yellow-700",
};

export default function StudioPanel() {
  const store = useGameStore();
  const { artists, producers, songs, albums, money, reputation, fanbase, turn, studioLevel,
          recordNewSong, releaseTrack, bookTour, startNewAlbum, releaseAlbumProject,
          addSongToAlbum, removeSongFromAlbum, setSongAlbumStatus, scrapSong } = store;
  const gameState = store as unknown as GameState;
  const [selectedArtist, setSelectedArtist] = useState("");
  const [selectedProducer, setSelectedProducer] = useState("");
  const [standaloneMode, setStandaloneMode] = useState(false);
  const [tourArtist, setTourArtist] = useState("");
  const [tourSize, setTourSize] = useState<TourSize>("club_tour");
  const [error, setError] = useState("");
  const [tourError, setTourError] = useState("");
  // Feature collab state (merged into recording)
  const [addFeature, setAddFeature] = useState(false);
  const [featTarget, setFeatTarget] = useState("");
  const [featSearch, setFeatSearch] = useState("");
  const [featSort, setFeatSort] = useState<"ovr" | "price" | "pop" | "name">("ovr");
  const [featGenreFilter, setFeatGenreFilter] = useState<string>("all");
  const [albumDashboard, setAlbumDashboard] = useState<Album | null>(null);
  const [releaseModal, setReleaseModal] = useState<Album | null>(null);
  const [producerGenreFilter, setProducerGenreFilter] = useState<string>("auto");
  const [producerSort, setProducerSort] = useState<"fit" | "quality" | "cost">("fit");

  const signedArtists = artists.filter((a) => a.signed && !a.onTour);
  const unreleased = songs.filter((s) => !s.released && !s.albumId);
  const inProgressAlbums = albums.filter((al) => al.status === "recording");

  // Feature artist data (depends on selectedArtist)
  const selectedArtistObj = artists.find((a) => a.id === selectedArtist);

  // Producer genre filtering & sorting
  const artistGenre = selectedArtistObj?.genre;
  const effectiveGenreFilter = producerGenreFilter === "auto" ? (artistGenre ?? "all") : producerGenreFilter;
  const GENRE_FIT: Record<string, Record<string, "strong" | "good" | "neutral" | "poor">> = {
    trap:         { trap: "strong", drill: "good", "pop-rap": "good", "boom-bap": "neutral", "r-and-b": "neutral", experimental: "poor" },
    "boom-bap":   { "boom-bap": "strong", experimental: "good", "pop-rap": "neutral", trap: "neutral", drill: "neutral", "r-and-b": "neutral" },
    drill:        { drill: "strong", trap: "good", "boom-bap": "neutral", "pop-rap": "neutral", "r-and-b": "poor", experimental: "neutral" },
    "r-and-b":    { "r-and-b": "strong", "pop-rap": "good", "boom-bap": "neutral", trap: "neutral", experimental: "neutral", drill: "poor" },
    "pop-rap":    { "pop-rap": "strong", "r-and-b": "good", trap: "good", "boom-bap": "neutral", drill: "neutral", experimental: "neutral" },
    experimental: { experimental: "strong", "boom-bap": "good", trap: "neutral", "pop-rap": "neutral", drill: "neutral", "r-and-b": "neutral" },
  };
  function getProducerFit(p: Producer): "strong" | "good" | "neutral" | "poor" {
    if (!artistGenre) return "neutral";
    return GENRE_FIT[artistGenre]?.[p.specialty] ?? "neutral";
  }
  const FIT_SCORE: Record<string, number> = { strong: 3, good: 2, neutral: 1, poor: 0 };
  const FIT_LABEL: Record<string, { text: string; cls: string }> = {
    strong: { text: "Strong Fit", cls: "text-green-600" },
    good:   { text: "Good Fit",   cls: "text-blue-600" },
    neutral:{ text: "Neutral",    cls: "text-gray-400" },
    poor:   { text: "Poor Fit",   cls: "text-red-500" },
  };
  const filteredProducers = producers
    .filter((p) => {
      if (effectiveGenreFilter === "all") return true;
      return p.specialty === effectiveGenreFilter;
    })
    .sort((a, b) => {
      switch (producerSort) {
        case "fit": {
          const diff = FIT_SCORE[getProducerFit(b)] - FIT_SCORE[getProducerFit(a)];
          return diff !== 0 ? diff : b.quality - a.quality;
        }
        case "quality": return b.quality - a.quality;
        case "cost": return a.costPerSong - b.costPerSong;
        default: return 0;
      }
    });

  const availableFeatsRaw = selectedArtist ? getAvailableFeatureArtists(gameState, selectedArtist) : null;
  const availableFeats = availableFeatsRaw
    ? [
        ...availableFeatsRaw.sameLabel.map((a) => ({ artist: a, label: "Your Label" })),
        ...availableFeatsRaw.rivalArtists.map((r) => ({ artist: r.artist, label: r.labelName })),
      ]
    : [];
  const featTargetObj = featTarget ? [...artists, ...(gameState.freeAgentPool || []), ...gameState.rivalLabels.flatMap((l) => l.rosterArtists)].find((a) => a.id === featTarget) : null;
  const featFee = selectedArtistObj && featTargetObj ? computeFeatureFee(featTargetObj, selectedArtistObj, gameState) : 0;
  const featAcceptance = selectedArtistObj && featTargetObj ? evaluateFeatureAcceptance(gameState, selectedArtistObj, featTargetObj, featFee) : null;

  // Feature genre list for filter
  const featGenres = [...new Set(availableFeats.map((f) => f.artist.genre))].sort();

  // Filtered + sorted feature artists
  const filteredFeats = availableFeats
    .filter((f) => {
      if (featGenreFilter !== "all" && f.artist.genre !== featGenreFilter) return false;
      if (featSearch && !f.artist.name.toLowerCase().includes(featSearch.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      switch (featSort) {
        case "ovr": return b.artist.overallRating - a.artist.overallRating;
        case "price": {
          const feeA = selectedArtistObj ? computeFeatureFee(a.artist, selectedArtistObj, gameState) : 0;
          const feeB = selectedArtistObj ? computeFeatureFee(b.artist, selectedArtistObj, gameState) : 0;
          return feeA - feeB;
        }
        case "pop": return b.artist.popularity - a.artist.popularity;
        case "name": return a.artist.name.localeCompare(b.artist.name);
        default: return 0;
      }
    });

  function handleRecord() {
    if (!selectedArtist || !selectedProducer) return;
    const hasActiveAlbum = albums.some((al) => al.artistId === selectedArtist && al.status === "recording");
    const isStandalone = standaloneMode || !hasActiveAlbum;
    if (addFeature && featTarget) {
      const err = store.recordFeatureSong(selectedArtist, selectedProducer, featTarget, featFee, isStandalone);
      if (err) setError(err);
      else { setError(""); setFeatTarget(""); setAddFeature(false); }
    } else {
      const err = recordNewSong(selectedArtist, selectedProducer, isStandalone);
      if (err) setError(err);
      else setError("");
    }
  }

  function handleTour() {
    if (!tourArtist) return;
    const err = bookTour(tourArtist, tourSize);
    if (err) setTourError(err);
    else { setTourError(""); setTourArtist(""); }
  }

  function handleAlbumRelease(albumId: string, marketingBudget: number) {
    const err = releaseAlbumProject(albumId, marketingBudget);
    if (err) setError(err);
    else setReleaseModal(null);
  }

  // Selected artist album status info
  const activeAlbumForSelected = selectedArtist ? albums.find((al) => al.artistId === selectedArtist && al.status === "recording") : null;

  return (
    <div className="p-2 space-y-3">

      {/* Album Dashboard Modal */}
      {albumDashboard && (
        <AlbumDashboardModal
          album={albumDashboard}
          songs={songs}
          artists={artists}
          turn={turn}
          onAdd={(songId) => addSongToAlbum(albumDashboard.id, songId)}
          onRemove={(songId) => removeSongFromAlbum(albumDashboard.id, songId)}
          onSetStatus={(songId, status) => setSongAlbumStatus(songId, status)}
          onScrap={(songId) => scrapSong(songId)}
          onDropAlbum={() => { setReleaseModal(albumDashboard); setAlbumDashboard(null); }}
          onClose={() => setAlbumDashboard(null)}
        />
      )}

      {/* Album Release Modal */}
      {releaseModal && (
        <AlbumReleaseModal
          album={releaseModal}
          songs={songs}
          artists={artists}
          money={money}
          reputation={reputation}
          onRelease={(budget) => handleAlbumRelease(releaseModal.id, budget)}
          onClose={() => setReleaseModal(null)}
        />
      )}

      {/* ── Recording Session ── */}
      <section>
        <h2 className="text-gray-900 font-bold text-sm mb-1">Recording Session</h2>
        <div className="flex items-end gap-2 flex-wrap">
          <select
            value={selectedArtist}
            onChange={(e) => setSelectedArtist(e.target.value)}
            className="bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-xs focus:outline-none focus:border-blue-400 min-w-0 w-full sm:w-auto sm:min-w-[140px]"
          >
            <option value="">Artist...</option>
            {signedArtists.map((a) => {
              const weekLimit = a.traits.workEthic >= 75 ? 3 : a.traits.workEthic >= 50 ? 2 : 1;
              const recordedThisTurn = songs.filter((s) => s.artistId === a.id && s.turnRecorded === turn).length;
              return (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.genre}, fat {a.fatigue}, {recordedThisTurn}/{weekLimit})
                </option>
              );
            })}
          </select>
          <select
            value={selectedProducer}
            onChange={(e) => setSelectedProducer(e.target.value)}
            className="bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-xs focus:outline-none focus:border-blue-400 min-w-0 w-full sm:w-auto sm:min-w-[160px]"
          >
            <option value="">Producer...</option>
            {filteredProducers.map((p) => {
              const unlocked = isProducerUnlocked(p, { studioLevel });
              const fit = getProducerFit(p);
              const fitTag = fit === "strong" ? " ★" : fit === "good" ? " ●" : fit === "poor" ? " ✗" : "";
              return (
                <option key={p.id} value={p.id} disabled={!unlocked}>
                  {unlocked ? "" : "[LOCKED] "}{p.name} — {p.specialty} · ${(p.costPerSong / 1000).toFixed(0)}K · Q{p.quality}{fitTag}
                </option>
              );
            })}
          </select>
          <button
            onClick={handleRecord}
            disabled={!selectedArtist || !selectedProducer || (addFeature && !featTarget)}
            className={`${addFeature ? "bg-purple-600 hover:bg-purple-500" : "bg-blue-600 hover:bg-blue-500"} disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-3 py-1 rounded text-xs transition`}
          >
            {addFeature ? "Record (feat.)" : "Record"}
          </button>
        </div>

        {/* Producer genre filter & sort */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs">
          <span className="text-gray-400">Filter:</span>
          <select
            value={producerGenreFilter}
            onChange={(e) => { setProducerGenreFilter(e.target.value); setSelectedProducer(""); }}
            className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 text-xs focus:outline-none focus:border-blue-400"
          >
            <option value="auto">Auto ({artistGenre ?? "all"})</option>
            <option value="all">All Genres</option>
            <option value="trap">Trap</option>
            <option value="boom-bap">Boom-Bap</option>
            <option value="drill">Drill</option>
            <option value="r-and-b">R&B</option>
            <option value="pop-rap">Pop-Rap</option>
            <option value="experimental">Experimental</option>
          </select>
          <span className="text-gray-400 ml-1">Sort:</span>
          <select
            value={producerSort}
            onChange={(e) => setProducerSort(e.target.value as "fit" | "quality" | "cost")}
            className="bg-white border border-gray-200 rounded px-1.5 py-0.5 text-gray-700 text-xs focus:outline-none focus:border-blue-400"
          >
            <option value="fit">Best Fit</option>
            <option value="quality">Quality</option>
            <option value="cost">Cheapest</option>
          </select>
          <span className="text-gray-300 ml-1">({filteredProducers.length} producers)</span>
        </div>

        {/* Album status for selected artist — compact inline */}
        {selectedArtist && (
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            {activeAlbumForSelected ? (
              <>
                <span>Album: <span className="text-gray-900 font-medium">&quot;{activeAlbumForSelected.title}&quot;</span> ({activeAlbumForSelected.songIds.length}/{ALBUM_MIN_TRACKS} tracks)</span>
                <label className="flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={standaloneMode}
                    onChange={(e) => setStandaloneMode(e.target.checked)}
                    className="accent-blue-500"
                  />
                  <span className="text-xs text-gray-400">Standalone single</span>
                </label>
              </>
            ) : (
              <>
                <span>No album — recording standalone.</span>
                <button
                  onClick={() => { const err = startNewAlbum(selectedArtist); if (err) setError(err); }}
                  className="text-xs text-blue-600 hover:text-blue-500 underline"
                >
                  Start Album
                </button>
              </>
            )}
          </div>
        )}

        {/* Album cooldown display for selected artist */}
        {selectedArtist && !activeAlbumForSelected && (() => {
          const a = signedArtists.find((x) => x.id === selectedArtist);
          if (!a || !a.lastAlbumReleaseTurn || a.lastAlbumReleaseTurn === 0) return null;
          const turnsSince = turn - a.lastAlbumReleaseTurn;
          const canDoSecond = a.traits.workEthic >= HIGH_WORK_ETHIC_THRESHOLD;
          const yearCooldown = canDoSecond ? Math.floor(ALBUM_YEAR_TURNS / 2) : ALBUM_YEAR_TURNS;
          const cycleCooldown = ALBUM_CYCLE_TURNS;
          const weeksUntilCycle = Math.max(0, cycleCooldown - turnsSince);
          const weeksUntilYear = Math.max(0, yearCooldown - turnsSince);
          const weeksLeft = Math.max(weeksUntilCycle, weeksUntilYear);
          if (weeksLeft <= 0) return null;
          return (
            <div className="mt-1 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-xs text-amber-700">
              Album cooldown: <span className="font-semibold">{weeksLeft} weeks</span> until {a.name} can start a new album
              {weeksUntilCycle > 0 && weeksUntilYear > weeksUntilCycle && (
                <span className="text-amber-500 ml-1">(cycle: {weeksUntilCycle}wk, yearly: {weeksUntilYear}wk)</span>
              )}
            </div>
          );
        })()}

        {/* Selected producer detail — compact inline */}
        {selectedProducer && (() => {
          const p = producers.find((x) => x.id === selectedProducer);
          const artist = signedArtists.find((a) => a.id === selectedArtist);
          if (!p) return null;
          const unlocked = isProducerUnlocked(p, { studioLevel });
          const fit = getProducerFit(p);
          const fitInfo = FIT_LABEL[fit];
          return (
            <div className="mt-1 text-xs text-gray-500">
              {p.name}: <span className="font-medium text-gray-700">{p.specialty}</span>, Q{p.quality}, ${(p.costPerSong / 1000).toFixed(0)}K/song
              {artist && <span className={`font-bold ml-1 ${fitInfo.cls}`}>{fitInfo.text}</span>}
              {!unlocked && <span className="text-red-500 ml-1">LOCKED (Studio Lv{PRODUCER_TIER_MIN_STUDIO[p.studioTierRequired]}+)</span>}
            </div>
          );
        })()}

        {/* Add Feature toggle */}
        {selectedArtist && selectedProducer && (
          <div className="mt-1.5">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addFeature}
                onChange={(e) => { setAddFeature(e.target.checked); if (!e.target.checked) setFeatTarget(""); }}
                className="accent-purple-500"
              />
              <span className="text-xs text-purple-600 font-medium">Add Feature Artist</span>
            </label>
          </div>
        )}

        {/* Feature cost preview */}
        {addFeature && featTarget && featTargetObj && featAcceptance && (
          <div className="mt-1 text-xs text-gray-500 flex items-center gap-3 flex-wrap bg-purple-50 border border-purple-200 rounded px-2 py-1">
            <span>Fee: <span className="text-gray-900 font-semibold">${featFee.toLocaleString()}</span></span>
            <span>Acceptance: <span className={`font-semibold ${featAcceptance.accepted ? "text-green-600" : "text-red-500"}`}>
              {featAcceptance.accepted ? "Likely" : "Unlikely"} ({Math.round(featAcceptance.chance)}%)
            </span></span>
            <span>Genre: <span className="text-gray-700">{featTargetObj.genre}</span></span>
            <span>OVR: <span className="text-gray-700">{featTargetObj.overallRating}</span></span>
          </div>
        )}

        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </section>

      {/* ── Feature Artist Browser (shown when Add Feature is on) ── */}
      {addFeature && selectedArtist && (
        <section>
          <h2 className="text-gray-900 font-bold text-sm mb-1">Select Feature Artist</h2>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1.5">
            <input
              type="text"
              value={featSearch}
              onChange={(e) => setFeatSearch(e.target.value)}
              placeholder="Search name..."
              className="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-purple-400 w-36"
            />
            <select
              value={featGenreFilter}
              onChange={(e) => setFeatGenreFilter(e.target.value)}
              className="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-purple-400"
            >
              <option value="all">All Genres</option>
              {featGenres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <select
              value={featSort}
              onChange={(e) => setFeatSort(e.target.value as typeof featSort)}
              className="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900 focus:outline-none focus:border-purple-400"
            >
              <option value="ovr">Sort: OVR</option>
              <option value="price">Sort: Price</option>
              <option value="pop">Sort: Popularity</option>
              <option value="name">Sort: Name</option>
            </select>
            <span className="text-gray-400 text-xs ml-auto">{filteredFeats.length} available</span>
          </div>
          <div className="max-h-48 overflow-y-auto overflow-x-auto border border-gray-200 rounded bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-200 sticky top-0 bg-white">
                  <th className="py-1 px-2 font-medium">Name</th>
                  <th className="py-1 px-2 font-medium">Genre</th>
                  <th className="py-1 px-2 font-medium">OVR</th>
                  <th className="py-1 px-2 font-medium">Pop</th>
                  <th className="py-1 px-2 font-medium">Price</th>
                  <th className="py-1 px-2 font-medium">Label</th>
                  <th className="py-1 px-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredFeats.length === 0 ? (
                  <tr><td colSpan={7} className="py-4 text-center text-gray-400">No feature artists available.</td></tr>
                ) : filteredFeats.map(({ artist: a, label }, idx) => {
                  const fee = selectedArtistObj ? computeFeatureFee(a, selectedArtistObj, gameState) : 0;
                  const acceptance = selectedArtistObj ? evaluateFeatureAcceptance(gameState, selectedArtistObj, a, fee) : null;
                  const isSelected = featTarget === a.id;
                  return (
                    <tr
                      key={a.id}
                      className={`${isSelected ? "bg-purple-50" : idx % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-purple-50 cursor-pointer transition`}
                      onClick={() => setFeatTarget(isSelected ? "" : a.id)}
                    >
                      <td className="py-1 px-2 text-gray-900 font-medium">{a.name}</td>
                      <td className="py-1 px-2 text-gray-600">{a.genre}</td>
                      <td className="py-1 px-2 text-gray-700 font-semibold">{a.overallRating}</td>
                      <td className="py-1 px-2 text-gray-600">{a.popularity}</td>
                      <td className="py-1 px-2 text-gray-700 font-medium">${(fee / 1000).toFixed(0)}K</td>
                      <td className="py-1 px-2 text-gray-500">{label}</td>
                      <td className="py-1 px-2 text-right">
                        {acceptance && (
                          <span className={`text-[10px] font-semibold ${acceptance.accepted ? "text-green-600" : "text-red-500"}`}>
                            {Math.round(acceptance.chance)}%
                          </span>
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

      {/* ── Albums in Progress ── */}
      {inProgressAlbums.length > 0 && (
        <section>
          <h2 className="text-gray-900 font-bold text-sm mb-1">Albums in Progress</h2>
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200">
                <th className="py-1 pr-2 font-medium">Title</th>
                <th className="py-1 pr-2 font-medium">Artist</th>
                <th className="py-1 pr-2 font-medium">Tracks</th>
                <th className="py-1 pr-2 font-medium">Avg Q</th>
                <th className="py-1 pr-2 font-medium">Started</th>
                <th className="py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {inProgressAlbums.map((al, idx) => {
                const artist = artists.find((a) => a.id === al.artistId);
                const albumSongs = songs.filter((s) => al.songIds.includes(s.id));
                const trackCount = albumSongs.length;
                const avgQuality = trackCount > 0
                  ? Math.floor(albumSongs.reduce((sum, s) => sum + s.quality, 0) / trackCount)
                  : 0;
                const ready = trackCount >= ALBUM_MIN_TRACKS;
                return (
                  <tr key={al.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="py-1 pr-2">
                      <button onClick={() => setAlbumDashboard(al)} className="text-blue-600 hover:text-blue-500 font-medium underline">
                        &quot;{al.title}&quot;
                      </button>
                    </td>
                    <td className="py-1 pr-2 text-gray-600">{artist?.name}</td>
                    <td className="py-1 pr-2">
                      <span className={ready ? "text-green-600 font-bold" : "text-gray-900"}>{trackCount}/{ALBUM_MIN_TRACKS}</span>
                    </td>
                    <td className="py-1 pr-2 text-gray-600">{avgQuality || "—"}</td>
                    <td className="py-1 pr-2 text-gray-400">Wk {al.turnStarted}</td>
                    <td className="py-1 text-right">
                      <button
                        onClick={() => setReleaseModal(al)}
                        disabled={!ready}
                        title={ready ? undefined : `Need ${ALBUM_MIN_TRACKS - trackCount} more track(s)`}
                        className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2 py-0.5 rounded transition font-medium"
                      >
                        Drop
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {/* Track listings per album — simple numbered lists */}
          {inProgressAlbums.map((al) => {
            const albumSongs = songs.filter((s) => al.songIds.includes(s.id));
            if (albumSongs.length === 0) return null;
            return (
              <div key={al.id} className="mt-1 ml-2 mb-2">
                <span className="text-[10px] text-gray-400 font-medium">&quot;{al.title}&quot; tracklist:</span>
                <ol className="list-decimal list-inside text-[10px] text-gray-500 ml-1">
                  {albumSongs.map((s) => (
                    <li key={s.id}>{s.title} <span className="text-gray-400">Q{s.quality} VP{s.viralPotential}</span></li>
                  ))}
                </ol>
              </div>
            );
          })}
        </section>
      )}

      {/* ── Unreleased Tracks ── */}
      {unreleased.length > 0 && (
        <section>
          <h2 className="text-gray-900 font-bold text-sm mb-1">Unreleased Tracks</h2>
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-200">
                <th className="py-1 pr-2 font-medium">Title</th>
                <th className="py-1 pr-2 font-medium">Artist</th>
                <th className="py-1 pr-2 font-medium">Quality</th>
                <th className="py-1 pr-2 font-medium">Viral</th>
                <th className="py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {unreleased.map((s, idx) => {
                const artist = artists.find((a) => a.id === s.artistId);
                return (
                  <tr key={s.id} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="py-1 pr-2 text-gray-900 font-medium">{s.title}</td>
                    <td className="py-1 pr-2 text-gray-500">{artist?.name}</td>
                    <td className="py-1 pr-2 text-gray-600">{s.quality}</td>
                    <td className="py-1 pr-2 text-gray-600">{s.viralPotential}</td>
                    <td className="py-1 text-right space-x-1">
                      <button
                        onClick={() => { const err = releaseTrack(s.id); if (err) setError(err); }}
                        className="text-xs text-green-600 hover:text-green-500 px-1.5 py-0.5 rounded border border-green-200 hover:border-green-400 transition"
                      >
                        Release
                      </button>
                      <button
                        onClick={() => { const err = scrapSong(s.id); if (err) setError(err); }}
                        className="text-xs text-red-500 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-200 hover:border-red-400 transition"
                      >
                        Scrap
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </section>
      )}

      {/* ── Producer Roster ── */}
      <section>
        <h2 className="text-gray-900 font-bold text-sm mb-1">Producer Roster</h2>
        <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-200">
              <th className="py-1 pr-2 font-medium">Name</th>
              <th className="py-1 pr-2 font-medium">Tier</th>
              <th className="py-1 pr-2 font-medium">Specialty</th>
              <th className="py-1 pr-2 font-medium">Quality</th>
              <th className="py-1 pr-2 font-medium">Cost</th>
              <th className="py-1 font-medium">Genre Match</th>
            </tr>
          </thead>
          <tbody>
            {producers.map((p, idx) => {
              const unlocked = isProducerUnlocked(p, { studioLevel });
              const selArtist = signedArtists.find((a) => a.id === selectedArtist);
              const genreMatch = selArtist && selArtist.genre === p.specialty;
              return (
                <tr key={p.id} className={`${idx % 2 === 0 ? "bg-gray-50" : "bg-white"} ${!unlocked ? "opacity-50" : ""}`}>
                  <td className="py-1 pr-2 text-gray-900 font-medium">{p.name}</td>
                  <td className="py-1 pr-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${TIER_BADGE[p.tier]}`}>{p.tier}</span>
                  </td>
                  <td className="py-1 pr-2 text-gray-600">{p.specialty}</td>
                  <td className="py-1 pr-2 text-gray-600">{p.quality}</td>
                  <td className="py-1 pr-2 text-gray-600">${(p.costPerSong / 1000).toFixed(0)}K</td>
                  <td className="py-1">
                    {genreMatch && unlocked ? <span className="text-green-600 font-bold">Yes</span> : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </section>

      {/* ── Tour Booking ── */}
      <section>
        <h2 className="text-gray-900 font-bold text-sm mb-1">Tour Booking</h2>
        <div className="flex items-end gap-2 flex-wrap">
          <select
            value={tourArtist}
            onChange={(e) => setTourArtist(e.target.value)}
            className="bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-xs focus:outline-none focus:border-blue-400 min-w-0 w-full sm:w-auto sm:min-w-[140px]"
          >
            <option value="">Artist...</option>
            {signedArtists.filter((a) => !a.onTour).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — Pop {a.popularity} · Fat {a.fatigue}
              </option>
            ))}
          </select>
          <select
            value={tourSize}
            onChange={(e) => setTourSize(e.target.value as TourSize)}
            className="bg-white border border-gray-200 rounded px-2 py-1 text-gray-900 text-xs focus:outline-none focus:border-blue-400 min-w-0 w-full sm:w-auto sm:min-w-[140px]"
          >
            {(["club_tour", "regional_tour", "national_tour", "major_tour", "world_tour"] as TourSize[]).map((t) => (
              <option key={t} value={t}>
                {TOUR_DATA[t].label} — {TOUR_DATA[t].weeks}wk
              </option>
            ))}
          </select>

          {/* Inline estimated revenue */}
          {tourArtist && (() => {
            const artist = signedArtists.find((a) => a.id === tourArtist);
            if (!artist) return null;
            const est = getTourEstimates(artist, tourSize);
            return (
              <span className="text-xs text-gray-500">
                Net <span className={est.netRevenue >= 0 ? "text-green-600 font-bold" : "text-red-500 font-bold"}>{est.netRevenue >= 0 ? "+" : ""}${(est.netRevenue / 1000).toFixed(0)}K</span>
                {" · "}+{(est.totalFanGain / 1000).toFixed(1)}K fans
                {" · "}+{est.totalFatigue} fat
              </span>
            );
          })()}

          <button
            onClick={handleTour}
            disabled={!tourArtist}
            className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-3 py-1 rounded text-xs transition"
          >
            Book
          </button>
        </div>

        {/* Expanded tour estimates when artist selected */}
        {tourArtist && (() => {
          const artist = signedArtists.find((a) => a.id === tourArtist);
          if (!artist) return null;
          const est = getTourEstimates(artist, tourSize);
          return (
            <div className="mt-1 flex gap-4 text-[10px] text-gray-400 flex-wrap">
              <span>Booking: {est.bookingCost > 0 ? `-$${(est.bookingCost / 1000).toFixed(0)}K` : "Free"}</span>
              <span>Gross: ${(est.totalRevenue / 1000).toFixed(0)}K</span>
              <span>Rep: +{est.reputationGain}</span>
            </div>
          );
        })()}

        {tourError && <p className="text-red-500 text-xs mt-1">{tourError}</p>}
      </section>
    </div>
  );
}

// ── Album Release Modal ───────────────────────────────────────────────────────

function AlbumReleaseModal({
  album,
  songs,
  artists,
  money,
  reputation,
  onRelease,
  onClose,
}: {
  album: Album;
  songs: Song[];
  artists: Artist[];
  money: number;
  reputation: number;
  onRelease: (marketingBudget: number) => void;
  onClose: () => void;
}) {
  const [marketingBudget, setMarketingBudget] = useState(0);
  const albumSongs = songs.filter(
    (s) => album.songIds.includes(s.id) && (s.albumStatus === "confirmed" || !s.albumStatus)
  );
  const artist = artists.find((a) => a.id === album.artistId);
  const avgQuality = albumSongs.length > 0
    ? Math.floor(albumSongs.reduce((sum, s) => sum + s.quality, 0) / albumSongs.length)
    : 0;

  const BUDGETS = [0, 10000, 25000, 50000, 100000];

  const strategy = artist
    ? computeAlbumStrategy(albumSongs.length, artist.traits)
    : null;

  const approval = artist && strategy
    ? evaluateAlbumApproval(artist, albumSongs, strategy)
    : null;

  const baseEstQuality = Math.min(
    100,
    Math.floor(
      avgQuality * 0.5 +
        (artist?.popularity ?? 0) * 0.25 +
        reputation * 0.15 +
        Math.min(20, Math.floor(marketingBudget / 10000))
    )
  );
  const estQuality = Math.min(100, baseEstQuality + (strategy?.qualityBonus ?? 0));
  const estFanGain = Math.floor(estQuality * 200);
  const baseRepGain = estQuality >= 70 ? "3–8" : estQuality >= 50 ? "1–4" : "0";
  const estRepBonus = strategy?.repBonus ?? 0;
  const estViralMult = strategy?.viralMult ?? 1.0;
  const canAfford = money >= marketingBudget;

  const CATEGORY_COLORS: Record<string, string> = {
    Short:  "text-blue-700 bg-blue-50 border-blue-200",
    Medium: "text-gray-700 bg-gray-50 border-gray-200",
    Long:   "text-orange-700 bg-orange-50 border-orange-200",
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200 sm:rounded-lg rounded-t-xl shadow-lg w-full sm:max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div>
            <h3 className="text-gray-900 font-bold text-sm">Drop &quot;{album.title}&quot;</h3>
            <div className="text-gray-400 text-xs">{artist?.name} · {albumSongs.length} tracks</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition text-sm">✕</button>
        </div>

        <div className="p-3 space-y-3">
          {/* Album strategy banner */}
          {strategy && (
            <div className={`rounded border px-3 py-2 space-y-1 text-xs ${CATEGORY_COLORS[strategy.category]}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  {strategy.category === "Short" && `Short Album (${ALBUM_MIN_TRACKS}–${ALBUM_SHORT_MAX} tracks)`}
                  {strategy.category === "Medium" && `Medium Album (${ALBUM_SHORT_MAX + 1}–${ALBUM_LONG_MIN - 1} tracks)`}
                  {strategy.category === "Long" && `Long Album (${ALBUM_LONG_MIN}+ tracks)`}
                </span>
                <div className="flex gap-2 text-[10px]">
                  {strategy.qualityBonus > 0 && <span className="text-green-600">+{strategy.qualityBonus} Quality</span>}
                  {strategy.qualityBonus < 0 && <span className="text-red-500">{strategy.qualityBonus} Quality</span>}
                  {strategy.repBonus > 0 && <span className="text-blue-600">+{strategy.repBonus} Rep</span>}
                  {estViralMult > 1 && <span className="text-yellow-600">+{Math.round((estViralMult - 1) * 100)}% Viral</span>}
                </div>
              </div>
              {strategy.fits.length > 0 && strategy.fits.map((f, i) => (
                <div key={i} className="text-green-600 flex items-center gap-1">✓ {f}</div>
              ))}
              {strategy.clashes.length > 0 && strategy.clashes.map((c, i) => (
                <div key={i} className="text-red-500 flex items-center gap-1">✗ {c}</div>
              ))}
            </div>
          )}

          {/* Artist approval panel */}
          {approval && !approval.approved && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-red-600 font-bold">Artist Resistance</span>
                {approval.moralePenalty < 0 && (
                  <span className="text-red-500 font-medium">{approval.moralePenalty} morale</span>
                )}
              </div>
              <p className="text-red-500">{approval.summary}</p>
              {approval.issues.map((issue, i) => (
                <div key={i} className="text-red-500 flex items-start gap-1">✗ {issue}</div>
              ))}
            </div>
          )}
          {approval && approval.approved && approval.moralePenalty < 0 && (
            <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-1.5 flex items-center justify-between text-xs">
              <p className="text-yellow-700">{approval.summary}</p>
              <span className="text-yellow-600 font-medium shrink-0 ml-2">{approval.moralePenalty} morale</span>
            </div>
          )}

          {/* Track list */}
          <ol className="list-decimal list-inside text-xs text-gray-600 max-h-28 overflow-y-auto space-y-0.5">
            {albumSongs.map((s) => (
              <li key={s.id}>{s.title} <span className="text-gray-400">Q{s.quality} VP{s.viralPotential}</span></li>
            ))}
          </ol>

          {/* Marketing budget */}
          <div>
            <label className="text-gray-500 text-xs mb-1 block">Marketing Budget</label>
            <div className="flex gap-1.5 flex-wrap">
              {BUDGETS.map((b) => (
                <button
                  key={b}
                  onClick={() => setMarketingBudget(b)}
                  className={`text-xs px-2 py-1 rounded border transition ${marketingBudget === b ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"}`}
                >
                  {b === 0 ? "None" : `$${(b / 1000).toFixed(0)}K`}
                </button>
              ))}
            </div>
          </div>

          {/* Estimates */}
          <div className="bg-gray-50 border border-gray-200 rounded p-2 space-y-1 text-xs">
            <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px] mb-1">Estimates</div>
            <div className="flex justify-between"><span className="text-gray-500">Avg Song Quality</span><span className="text-gray-900">{avgQuality}/100</span></div>
            <div className="flex justify-between">
              <span className="text-gray-500">Projected Score</span>
              <span className="text-blue-600 font-bold">
                {estQuality}/100
                {(strategy?.qualityBonus ?? 0) !== 0 && (
                  <span className={`ml-1 text-[10px] ${(strategy?.qualityBonus ?? 0) > 0 ? "text-green-600" : "text-red-500"}`}>
                    ({(strategy?.qualityBonus ?? 0) > 0 ? "+" : ""}{strategy?.qualityBonus})
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Est. Fan Gain</span><span className="text-green-600">+{estFanGain.toLocaleString()}</span></div>
            <div className="flex justify-between">
              <span className="text-gray-500">Est. Rep Gain</span>
              <span className="text-green-600">+{baseRepGain}{estRepBonus > 0 ? ` +${estRepBonus} bonus` : ""}</span>
            </div>
            <div className="flex justify-between"><span className="text-gray-500">Marketing Cost</span><span className={canAfford ? "text-gray-900" : "text-red-500"}>${marketingBudget.toLocaleString()}</span></div>
            <div className="text-gray-400 text-[10px] mt-1">All {albumSongs.length} tracks drop simultaneously.</div>
          </div>

          {!canAfford && <p className="text-red-500 text-xs">Not enough cash.</p>}

          <button
            onClick={() => onRelease(marketingBudget)}
            disabled={!canAfford}
            className={`w-full font-bold py-2 rounded text-sm transition disabled:opacity-40 disabled:cursor-not-allowed text-white ${
              approval && !approval.approved
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {approval && !approval.approved
              ? `Force Release${marketingBudget > 0 ? ` — $${(marketingBudget / 1000).toFixed(0)}K` : ""}`
              : `Release Album${marketingBudget > 0 ? ` — $${(marketingBudget / 1000).toFixed(0)}K` : ""}`
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Album metrics helper ──────────────────────────────────────────────────────

function computeAlbumMetrics(
  albumSongs: Song[],
  artistPopularity: number
) {
  const n = albumSongs.length;
  if (n === 0) return { quality: 0, cohesion: 0, commercial: 0 };
  const avgQuality = albumSongs.reduce((s, x) => s + x.quality, 0) / n;
  const variance = albumSongs.reduce((s, x) => s + Math.pow(x.quality - avgQuality, 2), 0) / n;
  const cohesion = Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(variance) * 2)));
  const avgViral = albumSongs.reduce((s, x) => s + x.viralPotential, 0) / n;
  const commercial = Math.round(avgViral * 0.6 + artistPopularity * 0.4);
  return { quality: Math.round(avgQuality), cohesion, commercial };
}

// ── Album Dashboard Modal ─────────────────────────────────────────────────────

type AlbumStatus = "confirmed" | "maybe" | "scrap";

const STANDALONE_MAX = 3;

function AlbumDashboardModal({
  album,
  songs,
  artists,
  turn,
  onAdd,
  onRemove,
  onSetStatus,
  onScrap,
  onDropAlbum,
  onClose,
}: {
  album: Album;
  songs: Song[];
  artists: Artist[];
  turn: number;
  onAdd: (songId: string) => string | null;
  onRemove: (songId: string) => string | null;
  onSetStatus: (songId: string, status: AlbumStatus) => void;
  onScrap: (songId: string) => string | null;
  onDropAlbum: () => void;
  onClose: () => void;
}) {
  void turn;
  const [dashError, setDashError] = useState("");
  const artist = artists.find((a) => a.id === album.artistId);

  const rawAlbumSongs = songs.filter((s) => album.songIds.includes(s.id));
  const [order, setOrder] = useState<string[]>(() => album.songIds);

  const currentIds = album.songIds;
  const syncedOrder = [
    ...order.filter((id) => currentIds.includes(id)),
    ...currentIds.filter((id) => !order.includes(id)),
  ];
  if (syncedOrder.join() !== order.join()) setOrder(syncedOrder);

  const albumSongs = syncedOrder.map((id) => rawAlbumSongs.find((s) => s.id === id)).filter(Boolean) as typeof rawAlbumSongs;

  const confirmed = albumSongs.filter((s) => s.albumStatus === "confirmed");
  const maybe     = albumSongs.filter((s) => s.albumStatus !== "confirmed" && s.albumStatus !== "scrap");
  const scrapped  = albumSongs.filter((s) => s.albumStatus === "scrap");

  const standaloneSlotsUsed = albumSongs.filter((s) => s.wasStandalone).length;

  // Unreleased songs not on this album
  const unreleasedNotOnAlbum = songs.filter(
    (s) => s.artistId === album.artistId && !album.songIds.includes(s.id) && !s.released
  );
  // Released singles that are album-eligible (not already linked to a released album)
  const eligibleReleasedSingles = songs.filter(
    (s) => s.artistId === album.artistId && !album.songIds.includes(s.id) && s.released && s.albumEligible && !s.linkedAlbumId
  );
  const standaloneAvailable = unreleasedNotOnAlbum.filter((s) => s.wasStandalone);
  const otherAlbumAvailable = unreleasedNotOnAlbum.filter((s) => !s.wasStandalone && s.albumId && s.albumId !== album.id);

  const confirmedCount = confirmed.length;
  const metrics = computeAlbumMetrics(confirmed, artist?.popularity ?? 0);
  const ready = confirmedCount >= ALBUM_MIN_TRACKS;
  const maxSingles = Math.floor(confirmedCount / 4);
  const releasedFromAlbum = songs.filter((s) => s.albumId === album.id && s.released).length;

  const minQ = artist?.minSongQuality ?? 0;
  const singleQualityThreshold = artist && artist.traits.fameMotivation > 60
    ? 50 + Math.floor((artist.traits.fameMotivation - 60) / 2)
    : null;

  function act(fn: () => string | null) {
    const err = fn();
    if (err) setDashError(err);
    else setDashError("");
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...syncedOrder];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrder(next);
  }
  function moveDown(idx: number) {
    if (idx === syncedOrder.length - 1) return;
    const next = [...syncedOrder];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setOrder(next);
  }

  const STATUS_STYLES: Record<AlbumStatus, string> = {
    confirmed: "bg-green-50 text-green-800 border-green-200",
    maybe:     "bg-gray-50 text-gray-600 border-gray-200",
    scrap:     "bg-red-50 text-red-600 border-red-200",
  };

  function SongRow({ s, i, bucket }: { s: typeof albumSongs[0]; i: number; bucket: AlbumStatus }) {
    const belowStandard = minQ > 0 && s.quality < minQ;
    const isSingle = s.released;
    return (
      <div className={`flex items-center gap-1.5 rounded px-2 py-1 border text-xs ${STATUS_STYLES[bucket]}`}>
        <div className="flex flex-col gap-0 shrink-0">
          <button onClick={() => moveUp(syncedOrder.indexOf(s.id))} className="text-gray-400 hover:text-gray-700 leading-none text-[10px]">▲</button>
          <button onClick={() => moveDown(syncedOrder.indexOf(s.id))} className="text-gray-400 hover:text-gray-700 leading-none text-[10px]">▼</button>
        </div>
        <span className="text-gray-400 w-4 shrink-0">{i + 1}.</span>
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-gray-900">{s.title}</span>
          <span className={belowStandard ? "text-red-500 font-medium" : "text-gray-500"}>
            Q{s.quality}{belowStandard ? ` (min ${minQ})` : ""}
          </span>
          <span className="text-gray-400">VP{s.viralPotential}</span>
          {isSingle && <span className="text-blue-600 bg-blue-50 px-1 py-0.5 rounded text-[10px]">single</span>}
          {s.wasStandalone && !isSingle && <span className="text-yellow-600 text-[10px]">standalone</span>}
        </div>
        <div className="flex gap-0.5 shrink-0">
          {bucket !== "confirmed" && (
            <button onClick={() => onSetStatus(s.id, "confirmed")} className="text-[10px] px-1 py-0.5 rounded border border-green-200 text-green-600 hover:bg-green-100 transition">Yes</button>
          )}
          {bucket !== "maybe" && (
            <button onClick={() => onSetStatus(s.id, "maybe")} className="text-[10px] px-1 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 transition">Maybe</button>
          )}
          {bucket !== "scrap" && (
            <button onClick={() => onSetStatus(s.id, "scrap")} className="text-[10px] px-1 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-100 transition">Scrap</button>
          )}
          <button onClick={() => act(() => onRemove(s.id))} className="text-[10px] px-1 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-gray-700 transition" title="Remove from album">✕</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white border border-gray-200 sm:rounded-lg rounded-t-xl shadow-lg w-full sm:max-w-2xl h-[85vh] sm:h-auto sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-3 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-gray-900 font-bold text-sm">&quot;{album.title}&quot;</h3>
            <div className="text-gray-400 text-xs">{artist?.name} · Started Week {album.turnStarted}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 transition text-sm leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-3">
          {/* Metrics summary — compact inline */}
          <div className="flex gap-4 text-xs">
            <div className="text-center">
              <div className={`text-lg font-black ${ready ? "text-green-600" : "text-gray-900"}`}>{confirmedCount}<span className="text-gray-400 text-xs font-normal">/{ALBUM_MIN_TRACKS}</span></div>
              <div className="text-gray-400">Confirmed</div>
            </div>
            <div className="text-center">
              <div className={`text-lg font-black ${metrics.quality < minQ && metrics.quality > 0 ? "text-red-500" : "text-gray-700"}`}>{metrics.quality}</div>
              <div className="text-gray-400">Avg Q</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-black text-yellow-600">{releasedFromAlbum}<span className="text-gray-400 text-xs font-normal">/{Math.max(maxSingles, 1)}</span></div>
              <div className="text-gray-400">Singles</div>
            </div>
          </div>

          {/* Artist Wants panel */}
          {artist && (
            <div className="bg-gray-50 border border-gray-200 rounded p-2 space-y-1 text-xs">
              <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px]">Artist Standards</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Min Song Q</span>
                  <span className={`font-bold ${metrics.quality > 0 && metrics.quality < minQ ? "text-red-500" : "text-gray-700"}`}>
                    {minQ > 0 ? minQ : "None"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Pref Length</span>
                  <span className={`font-bold ${
                    confirmedCount === 0 ? "text-gray-400" :
                    Math.abs(confirmedCount - artist.preferredAlbumLength) <= 2 ? "text-green-600" :
                    Math.abs(confirmedCount - artist.preferredAlbumLength) <= 4 ? "text-yellow-600" : "text-red-500"
                  }`}>
                    ~{artist.preferredAlbumLength}
                    {confirmedCount > 0 && (
                      <span className="text-gray-400 font-normal ml-1">
                        ({confirmedCount < artist.preferredAlbumLength
                          ? `${artist.preferredAlbumLength - confirmedCount} short`
                          : confirmedCount > artist.preferredAlbumLength
                          ? `${confirmedCount - artist.preferredAlbumLength} over`
                          : "ok"})
                      </span>
                    )}
                  </span>
                </div>
                {singleQualityThreshold !== null && (
                  <div className="flex items-center justify-between col-span-2">
                    <span className="text-gray-500">Single Q Min</span>
                    <span className="font-bold text-purple-600">{singleQualityThreshold}+ <span className="text-gray-400 font-normal">(fame-driven)</span></span>
                  </div>
                )}
                <div className="flex items-center justify-between col-span-2">
                  <span className="text-gray-500">Personality</span>
                  <span className="text-gray-700 text-right">
                    {[
                      artist.traits.moneyMotivation > 65 && "Money",
                      artist.traits.competitiveness > 65 && "Competitive",
                      artist.traits.fameMotivation > 65 && "Fame",
                      artist.traits.workEthic > 70 && "Work ethic",
                      artist.traits.loyalty > 70 && "Loyal",
                      artist.traits.controversyRisk > 65 && "Controversy",
                    ].filter(Boolean).join(" · ") || "Balanced"}
                  </span>
                </div>
              </div>
              {confirmedCount > 0 && (() => {
                const badTracks = confirmed.filter((s) => minQ > 0 && s.quality < minQ);
                if (badTracks.length === 0) return null;
                return (
                  <div className="bg-red-50 border border-red-200 rounded px-2 py-1 text-xs text-red-500">
                    {badTracks.length} track{badTracks.length > 1 ? "s" : ""} below standard ({minQ}). Morale hit on release.
                  </div>
                );
              })()}
            </div>
          )}

          {releasedFromAlbum >= maxSingles && confirmedCount > 0 && (
            <p className="text-yellow-600 text-xs">Single cap reached ({maxSingles} max for {confirmedCount} tracks).</p>
          )}

          {dashError && <p className="text-red-500 text-xs">{dashError}</p>}

          {/* Confirmed */}
          <div>
            <div className="text-green-600 text-xs font-medium uppercase tracking-wider mb-1">Confirmed ({confirmed.length})</div>
            {confirmed.length === 0
              ? <p className="text-gray-400 text-xs">No confirmed tracks yet.</p>
              : <div className="space-y-1">{confirmed.map((s, i) => <SongRow key={s.id} s={s} i={i} bucket="confirmed" />)}</div>
            }
          </div>

          {/* Maybe */}
          {maybe.length > 0 && (
            <div>
              <div className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Maybe ({maybe.length})</div>
              <div className="space-y-1">{maybe.map((s, i) => <SongRow key={s.id} s={s} i={confirmed.length + i} bucket="maybe" />)}</div>
            </div>
          )}

          {/* Scrapped */}
          {scrapped.length > 0 && (
            <div>
              <div className="text-red-500 text-xs font-medium uppercase tracking-wider mb-1">Scrap ({scrapped.length})</div>
              <div className="space-y-1">{scrapped.map((s, i) => <SongRow key={s.id} s={s} i={confirmed.length + maybe.length + i} bucket="scrap" />)}</div>
            </div>
          )}

          {/* Standalone singles available to add */}
          {standaloneAvailable.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-yellow-600 text-xs font-medium uppercase tracking-wider">
                  Standalone Singles ({standaloneSlotsUsed}/{STANDALONE_MAX} slots)
                </div>
                {standaloneSlotsUsed >= STANDALONE_MAX && (
                  <span className="text-red-500 text-[10px]">Limit reached</span>
                )}
              </div>
              <div className="space-y-1">
                {standaloneAvailable.map((s) => {
                  const belowStandard = minQ > 0 && s.quality < minQ;
                  const atLimit = standaloneSlotsUsed >= STANDALONE_MAX;
                  return (
                    <div key={s.id} className="flex items-center gap-1.5 bg-gray-50 border border-yellow-200 rounded px-2 py-1 text-xs">
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-700">{s.title}</span>
                        <span className={`ml-1 ${belowStandard ? "text-red-500" : "text-gray-400"}`}>
                          Q{s.quality}{belowStandard ? " !" : ""} VP{s.viralPotential}
                        </span>
                        {s.released && <span className="text-blue-600 ml-1">(released)</span>}
                      </div>
                      <button
                        onClick={() => act(() => onAdd(s.id))}
                        disabled={atLimit}
                        className="text-[10px] text-yellow-600 hover:text-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed border border-yellow-300 hover:border-yellow-500 px-1.5 py-0.5 rounded transition shrink-0"
                      >
                        + Add
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Eligible released singles */}
          {eligibleReleasedSingles.length > 0 && (
            <div>
              <div className="text-blue-600 text-xs font-medium uppercase tracking-wider mb-1">
                Eligible Released Singles ({eligibleReleasedSingles.length})
              </div>
              <div className="space-y-1">
                {eligibleReleasedSingles.map((s) => {
                  const currentSinglesOnAlbum = albumSongs.filter((as) => as.released).length;
                  const currentTrackCount = album.songIds.length + 1;
                  const maxSingles = Math.min(4, Math.floor(currentTrackCount * 0.4));
                  const atSinglesCap = currentSinglesOnAlbum >= maxSingles;
                  return (
                    <div key={s.id} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs">
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-700 font-medium">{s.title}</span>
                        <span className="text-gray-400 ml-1">Q{s.quality} VP{s.viralPotential}</span>
                        <span className="text-blue-600 ml-1">{(s.streamsTotal / 1000).toFixed(0)}K streams</span>
                      </div>
                      <button
                        onClick={() => act(() => onAdd(s.id))}
                        disabled={atSinglesCap}
                        className="text-[10px] text-blue-600 hover:text-blue-500 disabled:opacity-40 disabled:cursor-not-allowed border border-blue-300 hover:border-blue-500 px-1.5 py-0.5 rounded transition shrink-0"
                        title={atSinglesCap ? "Singles cap reached for this album" : undefined}
                      >
                        + Add Single
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Songs from other albums available to move */}
          {otherAlbumAvailable.length > 0 && (
            <div>
              <div className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">Move from Another Album</div>
              <div className="space-y-1">
                {otherAlbumAvailable.map((s) => (
                  <div key={s.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs">
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-700">{s.title}</span>
                      <span className="text-gray-400 ml-1">Q{s.quality} VP{s.viralPotential}</span>
                      <span className="text-yellow-600 ml-1">(from other album)</span>
                    </div>
                    <button
                      onClick={() => act(() => onAdd(s.id))}
                      className="text-[10px] text-blue-600 hover:text-blue-500 border border-blue-200 hover:border-blue-400 px-1.5 py-0.5 rounded transition shrink-0"
                    >
                      + Move
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 flex items-center justify-between gap-2 shrink-0">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-xs transition">Close</button>
          <button
            onClick={onDropAlbum}
            disabled={!ready}
            title={ready ? undefined : `Need ${ALBUM_MIN_TRACKS - confirmedCount} more confirmed tracks`}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-3 py-1.5 rounded text-xs transition"
          >
            {ready ? "Drop Album" : `${confirmedCount}/${ALBUM_MIN_TRACKS} — Not ready`}
          </button>
        </div>
      </div>
    </div>
  );
}
