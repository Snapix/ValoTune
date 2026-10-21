import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ElasticSlider from "./components/ElasticSlider.jsx";

const initialSettings = { theme: "dark", accent: "lime", compact: false, volume: 70, reduceMotion: false, autoplayFull: false };
const accents = { lime: "#d7f17b", violet: "#c7a7ff", blue: "#8fc9ff", coral: "#ffad99" };
const collections = [
  { id: "top", eyebrow: "QUICK PICKS", title: "Top 10 songs", query: "top 10 global songs", action: "Refresh" },
  { id: "popular", eyebrow: "HEAVY ROTATION", title: "Popular right now", query: "popular songs right now", action: "More" },
  { id: "trending", eyebrow: "TRENDING NOW", title: "Trending", query: "trending music hits", action: "More" },
  { id: "fresh", eyebrow: "JUST ADDED", title: "Fresh finds", query: "new music releases", action: "More" }
];
const genres = [
  ["Pop", "global pop hits"], ["Indie & alternative", "indie alternative songs"], ["Hip-hop", "hip hop hits"],
  ["R&B and soul", "rnb soul essentials"], ["Rock", "rock classics hits"], ["Chill & lo-fi", "lofi chill beats"],
  ["Tamil hits", "tamil trending songs"], ["Hindi hits", "hindi popular songs"]
];
const discoverGroups = [
  { title: "Charts & popular", eyebrow: "TOP CHARTS", items: [["Global Top Songs", "global top songs chart"], ["India Top Songs", "India top songs chart"], ["Viral & trending", "viral trending songs"], ["Popular this week", "popular songs this week"]] },
  { title: "Find your atmosphere", eyebrow: "MOOD PICKS", items: [["Feel-good energy", "feel good upbeat songs"], ["Late-night R&B", "late night R&B songs"], ["Focus mode", "focus instrumental ambient music"], ["Acoustic calm", "acoustic mellow songs"], ["Workout", "gym workout high energy songs"], ["Love songs", "romantic songs love hits"]] },
  { title: "Closer to home", eyebrow: "REGIONAL SPOTLIGHT", items: [["Tamil", "Tamil latest hit songs"], ["Telugu", "Telugu latest hit songs"], ["Malayalam", "Malayalam hit songs"], ["Hindi", "Hindi latest hit songs"], ["Punjabi", "Punjabi popular songs"], ["K-pop", "K-pop trending songs"]] }
];
const readStorage = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const keyOf = (track) => track?.videoId || track?.id || track?.title;
const formatTime = (value) => { const seconds = Math.max(0, Math.floor(Number(value) || 0)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; };

function TrackCard({ track, onPlay, onLike, liked, compact = false, index }) {
  return <article className={`track-card ${compact ? "track-card--compact" : ""}`}>
    <button className="artwork" onClick={() => onPlay(track)} aria-label={`Play ${track.title}`}>
      {track.thumbnail ? <img src={track.thumbnail} alt="" loading="lazy" /> : <span className="artwork-fallback">♫</span>}
      <span className="artwork-play">▶</span>
      {Number.isFinite(index) && <span className="track-rank">{index + 1}</span>}
    </button>
    <div className="track-info"><button className="track-title" onClick={() => onPlay(track)} title={track.title}>{track.title || "Untitled"}</button><span>{track.artist || "Unknown artist"}</span></div>
    <button className={`like-button ${liked ? "is-liked" : ""}`} onClick={() => onLike(track)} aria-label={liked ? "Remove from liked songs" : "Like song"}>{liked ? "♥" : "♡"}</button>
  </article>;
}
function MusicSection({ item, tracks, loading, onLoad, onPlay, onLike, isLiked, onSearch }) {
  return <section className="music-section">
    <div className="section-heading"><div><small>{item.eyebrow}</small><h2>{item.title}</h2></div><button className="text-button" onClick={() => onSearch(item.query)}>{item.action} ↗</button></div>
    {loading && !tracks?.length ? <div className="loading-row">{[0,1,2,3,4].map(n => <div className="skeleton" key={n} />)}</div> :
      tracks?.length ? <div className="track-carousel">{tracks.slice(0, 10).map((track, i) => <TrackCard key={keyOf(track) + i} track={track} index={item.id === "top" ? i : undefined} onPlay={onPlay} onLike={onLike} liked={isLiked(track)} />)}</div> :
      <div className="empty-inline"><span>Couldn’t load tracks.</span><button className="text-button" onClick={onLoad}>Try again</button></div>}
  </section>;
}
function GenreGrid({ items, onChoose }) {
  return <div className="genre-grid">{items.map(([label, query], i) => <button key={label} className={`genre-tile genre-${i % 8}`} onClick={() => onChoose(query)}><span>{label}</span><span aria-hidden="true">↗</span></button>)}</div>;
}

export default function App() {
  const [page, setPage] = useState("home");
  const [results, setResults] = useState([]);
  const [collectionsState, setCollectionsState] = useState({});
  const [loadingCollections, setLoadingCollections] = useState({});
  const [liked, setLiked] = useState(() => readStorage("vt-liked", []));
  const [recent, setRecent] = useState(() => readStorage("vt-recent", []));
  const [settings, setSettings] = useState(() => ({ ...initialSettings, ...readStorage("vt-settings", {}) }));
  const [track, setTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [fullPlayer, setFullPlayer] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [resultTitle, setResultTitle] = useState("Pick a collection");
  const [filter, setFilter] = useState("all");
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [toast, setToast] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [health, setHealth] = useState("checking");
  const iframeRef = useRef(null);
  const toastTimer = useRef(null);

  const notify = useCallback((message) => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 2400); }, []);
  const search = useCallback(async (query, { target = "results", title = query } = {}) => {
    const q = String(query || "").trim();
    if (!q) return;
    if (target === "results") { setResultTitle(title || q); setResults([]); setSearchQuery(q); setFilter("all"); }
    else setLoadingCollections(v => ({ ...v, [target]: true }));
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed");
      const found = Array.isArray(data.results) ? data.results : [];
      if (target === "results") setResults(found);
      else setCollectionsState(v => ({ ...v, [target]: found }));
    } catch (error) {
      if (target === "results") { setResults([]); notify(error.message || "Search unavailable. Try again."); }
      else setCollectionsState(v => ({ ...v, [target]: [] }));
    } finally { if (target !== "results") setLoadingCollections(v => ({ ...v, [target]: false })); }
  }, [notify]);

  useEffect(() => { collections.forEach(item => search(item.query, { target: item.id, title: item.title })); }, [search]);
  useEffect(() => { fetch("/api/health").then(r => r.json()).then(() => setHealth("online")).catch(() => setHealth("offline")); }, []);
  useEffect(() => { localStorage.setItem("vt-liked", JSON.stringify(liked)); }, [liked]);
  useEffect(() => { localStorage.setItem("vt-recent", JSON.stringify(recent)); }, [recent]);
  useEffect(() => { localStorage.setItem("vt-settings", JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.style.setProperty("--accent", accents[settings.accent] || accents.lime);
    document.documentElement.style.setProperty("--player-height", track ? "92px" : "0px");
    document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
  }, [settings, track]);

  useEffect(() => {
    const onMessage = (event) => {
      if (!event.origin.includes("youtube.com")) return;
      let data = event.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch { return; } }
      if (data?.event === "infoDelivery" && data.info) {
        if (Number.isFinite(data.info.duration)) setDuration(data.info.duration);
        if (Number.isFinite(data.info.currentTime)) setCurrentTime(data.info.currentTime);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const isLiked = useCallback((song) => liked.some(item => keyOf(item) === keyOf(song)), [liked]);
  const toggleLike = useCallback((song) => {
    setLiked(current => current.some(item => keyOf(item) === keyOf(song)) ? current.filter(item => keyOf(item) !== keyOf(song)) : [song, ...current]);
  }, []);
  const playTrack = useCallback((song, source = []) => {
    const nextQueue = source.length ? source : (results.length ? results : Object.values(collectionsState).flat());
    setQueue(nextQueue);
    setTrack(song);
    setPlaying(true);
    setDuration(0); setCurrentTime(0);
    setRecent(current => [song, ...current.filter(item => keyOf(item) !== keyOf(song))].slice(0, 50));
    if (settings.autoplayFull) setFullPlayer(true);
  }, [collectionsState, results, settings.autoplayFull]);
  const playNext = useCallback((direction = 1) => {
    if (!queue.length) return;
    const index = queue.findIndex(item => keyOf(item) === keyOf(track));
    const nextIndex = shuffle ? Math.floor(Math.random() * queue.length) : (index + direction + queue.length) % queue.length;
    const next = queue[nextIndex];
    if (next) { setTrack(next); setPlaying(true); setDuration(0); setCurrentTime(0); setRecent(current => [next, ...current.filter(item => keyOf(item) !== keyOf(next))].slice(0, 50)); }
  }, [queue, track, shuffle]);
  const sendPlayerCommand = (func, args = []) => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  useEffect(() => { if (track?.videoId) { setPlaying(true); } }, [track?.videoId]);
  useEffect(() => {
    if (!track?.videoId || !playing) return;
    const timer = setInterval(() => sendPlayerCommand("getCurrentTime"), 1000);
    return () => clearInterval(timer);
  }, [track?.videoId, playing]);

  const filteredResults = useMemo(() => filter === "all" ? results : results.filter(item => String(item.type || "").toLowerCase().includes(filter)), [results, filter]);
  const currentList = page === "library" ? (resultTitle === "Recently played" ? recent : liked) : filteredResults;
  const chooseSearch = (query) => { setPage("discover"); search(query, { title: query }); };
  const onSearchSubmit = (event) => { event.preventDefault(); search(searchQuery, { title: searchQuery }); };
  const updateSetting = (key, value) => setSettings(current => ({ ...current, [key]: value }));
  const clearData = () => {
    if (!window.confirm("Clear likes, listening history, and preferences from this browser?")) return;
    setLiked([]); setRecent([]); setSettings(initialSettings); localStorage.removeItem("vt-liked"); localStorage.removeItem("vt-recent"); localStorage.removeItem("vt-settings"); notify("Local data cleared.");
  };
  const exportLibrary = () => {
    const blob = new Blob([JSON.stringify({ liked, recent, settings }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "valotune-library.json"; link.click(); URL.revokeObjectURL(url);
  };
  const visibleLibrary = resultTitle === "Recently played" ? recent : liked;

  return <div className={`app-shell ${settings.compact ? "compact" : ""}`}>
    <main className="main-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setPage("home")} aria-label="ValoTune home">♫ valo<span>tune</span></button>
        <nav className="gooey-nav" aria-label="Main navigation">{["home", "discover", "library", "settings"].map(item => <button key={item} className={`nav ${page === item ? "active" : ""}`} aria-current={page === item ? "page" : undefined} onClick={() => setPage(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav>
        <div className={`service-status ${health}`} title={health === "online" ? "Music service connected" : "Music service status"}><i />{health === "online" ? "Connected" : health === "offline" ? "Offline" : "Connecting"}</div>
      </header>

      {page === "home" && <section className="page active">
        <div className="welcome-row"><div><small className="eyebrow">YOUR SOUND, YOUR WAY</small><h1>Find your <em>next favourite.</em></h1></div><button className="secondary" onClick={() => setPage("discover")}>Explore music ↗</button></div>
        {collections.map(item => <MusicSection key={item.id} item={item} tracks={collectionsState[item.id] || []} loading={loadingCollections[item.id]} onLoad={() => search(item.query, { target: item.id })} onPlay={song => playTrack(song, collectionsState[item.id] || [])} onLike={toggleLike} isLiked={isLiked} onSearch={chooseSearch} />)}
        <section className="music-section"><div className="section-heading"><div><small>EXPLORE GENRES</small><h2>Explore by sound</h2></div></div><GenreGrid items={genres} onChoose={chooseSearch} /></section>
      </section>}

      {page === "discover" && <section className="page active">
        <div className="discover-feature"><small className="eyebrow">DISCOVER MUSIC</small><h1>What are you in the <em>mood for?</em></h1><form className="search-form" onSubmit={onSearchSubmit} role="search"><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} type="search" placeholder="Try “Tamil indie”, “jazz”, “workout”…" aria-label="Search music" /><button className="primary" type="submit">Search ↗</button></form></div>
        {discoverGroups.map((group, i) => <section className="music-section" key={group.title}><div className="section-heading"><div><small>{group.eyebrow}</small><h2>{group.title}</h2></div></div><GenreGrid items={group.items} onChoose={chooseSearch} /></section>)}
        <section className="music-section"><div className="section-heading"><div><small>SEARCH RESULTS</small><h2>{resultTitle}</h2></div><span className="result-count">{filteredResults.length} tracks</span></div><div className="filter-row">{["all","song","album","artist"].map(value => <button key={value} className={filter === value ? "selected" : ""} onClick={() => setFilter(value)}>{value[0].toUpperCase() + value.slice(1)}{value === "all" ? "" : "s"}</button>)}</div>{filteredResults.length ? <div className="results-list">{filteredResults.map((song, i) => <TrackCard key={keyOf(song) + i} track={song} index={i} compact onPlay={item => playTrack(item, filteredResults)} onLike={toggleLike} liked={isLiked(song)} />)}</div> : <p className="hint">{searchQuery ? "Search for a song, artist, or mood to see real results." : "Choose a chart or mood above, or search for a track."}</p>}</section>
      </section>}

      {page === "library" && <section className="page active"><small className="eyebrow">YOUR PERSONAL COLLECTION</small><h1 className="page-title">Your <em>library.</em></h1><div className="filter-row library-tabs"><button className={resultTitle !== "Recently played" ? "selected" : ""} onClick={() => setResultTitle("Liked songs")}>Liked songs <span>{liked.length}</span></button><button className={resultTitle === "Recently played" ? "selected" : ""} onClick={() => setResultTitle("Recently played")}>Recently played</button><button onClick={() => { setLiked([]); setRecent([]); notify("Library cleared."); }}>Clear library</button></div>{visibleLibrary.length ? <div className="results-list">{visibleLibrary.map((song, i) => <TrackCard key={keyOf(song) + i} track={song} index={i} compact onPlay={item => playTrack(item, visibleLibrary)} onLike={toggleLike} liked={isLiked(song)} />)}</div> : <div className="empty-state"><span>♫</span><h2>{resultTitle === "Recently played" ? "Nothing played yet" : "Your liked songs live here"}</h2><p>Play a track and save the ones you want to come back to.</p><button className="primary" onClick={() => setPage("discover")}>Discover music</button></div>}</section>}

      {page === "settings" && <section className="page active settings-page"><small className="eyebrow">TUNE THE EXPERIENCE</small><h1 className="page-title">Settings<span>.</span></h1><p className="page-intro">Preferences are stored in this browser.</p>
        <div className="settings-group"><div className="settings-heading"><h2>Appearance</h2><p>Make ValoTune feel right for you.</p></div><label className="setting-row"><span><strong>Colour theme</strong><small>Choose a dark or light interface.</small></span><select value={settings.theme} onChange={e => updateSetting("theme", e.target.value)}><option value="dark">Dark</option><option value="light">Light</option></select></label><label className="setting-row"><span><strong>Accent colour</strong><small>Used for active navigation and controls.</small></span><select value={settings.accent} onChange={e => updateSetting("accent", e.target.value)}><option value="lime">Lime</option><option value="violet">Violet</option><option value="blue">Blue</option><option value="coral">Coral</option></select></label><label className="setting-row"><span><strong>Compact track lists</strong><small>Show more songs on screen.</small></span><input type="checkbox" checked={settings.compact} onChange={e => updateSetting("compact", e.target.checked)} /></label></div>
        <div className="settings-group"><div className="settings-heading"><h2>Playback</h2><p>Control the listening experience.</p></div><label className="setting-row"><span><strong>Default volume</strong><small>Applies to the embedded player.</small></span><div className="volume-setting"><ElasticSlider className="volume-elastic" value={settings.volume} startingValue={0} maxValue={100} ariaLabel="Default volume" valuePosition="none" thickness={5} activeThickness={10} rangeColor="var(--accent)" trackColor="rgba(255,255,255,.16)" onChange={volume => { updateSetting("volume", volume); sendPlayerCommand("setVolume", [volume]); }} onChangeEnd={volume => { updateSetting("volume", volume); sendPlayerCommand("setVolume", [volume]); }} /><output>{settings.volume}%</output></div></label><label className="setting-row"><span><strong>Open full player when starting a track</strong><small>Open the expanded player automatically.</small></span><input type="checkbox" checked={settings.autoplayFull} onChange={e => updateSetting("autoplayFull", e.target.checked)} /></label></div>
        <div className="settings-group"><div className="settings-heading"><h2>Accessibility & data</h2><p>Manage motion and local data.</p></div><label className="setting-row"><span><strong>Reduce animations</strong><small>Use less motion throughout the interface.</small></span><input type="checkbox" checked={settings.reduceMotion} onChange={e => updateSetting("reduceMotion", e.target.checked)} /></label><div className="setting-row"><span><strong>Export library</strong><small>Download liked songs, history, and preferences.</small></span><button className="secondary" onClick={exportLibrary}>Export JSON</button></div><div className="setting-row"><span><strong>Clear local data</strong><small>Remove likes, history, and preferences.</small></span><button className="danger" onClick={clearData}>Clear data</button></div></div>
      </section>}
      <footer><span>VALOTUNE</span><span>GOOD MUSIC, RIGHT WHEN YOU NEED IT.</span><span>REACT UI · YOUTUBE MUSIC SEARCH</span></footer>
    </main>

    {track && <aside className="player" aria-label="Music player">
      <button className="player-now" onClick={() => setFullPlayer(true)}><span className="mini-cover">{track.thumbnail ? <img src={track.thumbnail} alt="" /> : "♫"}</span><span className="player-meta"><strong>{track.title}</strong><small>{track.artist}</small></span></button>
      <button className="like-button player-like" onClick={() => toggleLike(track)} aria-label={isLiked(track) ? "Unlike" : "Like"}>{isLiked(track) ? "♥" : "♡"}</button>
      <div className="player-controls"><div className="control-buttons"><button onClick={() => playNext(-1)} aria-label="Previous track">|◀</button><button className="play-button" onClick={() => { sendPlayerCommand(playing ? "pauseVideo" : "playVideo"); setPlaying(!playing); }} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button><button onClick={() => playNext(1)} aria-label="Next track">▶|</button></div><div className="mini-progress"><span>{formatTime(currentTime)}</span><input type="range" min="0" max={Math.max(1, duration)} value={Math.min(currentTime, duration || 1)} onChange={e => { const seconds = Number(e.target.value); setCurrentTime(seconds); sendPlayerCommand("seekTo", [seconds, true]); }} aria-label="Track progress" /><span>{formatTime(duration)}</span></div></div>
      <div className="player-right"><button className={shuffle ? "selected" : ""} onClick={() => setShuffle(!shuffle)} aria-pressed={shuffle} title="Shuffle">⤨</button><button className={repeat ? "selected" : ""} onClick={() => setRepeat(!repeat)} aria-pressed={repeat} title="Repeat">↻</button><button onClick={() => setFullPlayer(true)} aria-label="Open full player">⤢</button></div>
    </aside>}

    {track?.videoId && <iframe ref={iframeRef} className="audio-frame" title="YouTube audio playback" src={`https://www.youtube.com/embed/${encodeURIComponent(track.videoId)}?autoplay=1&enablejsapi=1&playsinline=1&controls=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`} allow="autoplay; encrypted-media; picture-in-picture" />}
    {fullPlayer && track && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setFullPlayer(false); }}><section className="full-player" role="dialog" aria-modal="true" aria-label="Now playing"><div className="full-player-top"><span className="brand">♫ valo<span>tune</span></span><button className="icon-button" onClick={() => setFullPlayer(false)} aria-label="Close player">×</button></div><div className="full-player-content"><div className="full-art">{track.thumbnail ? <img src={track.thumbnail} alt="" /> : "♫"}</div><div className="full-meta"><small className="eyebrow">NOW PLAYING</small><h2>{track.title}</h2><p>{track.artist}</p><div className="full-controls"><button onClick={() => playNext(-1)}>|◀</button><button className="play-button" onClick={() => { sendPlayerCommand(playing ? "pauseVideo" : "playVideo"); setPlaying(!playing); }}>{playing ? "Ⅱ Pause" : "▶ Play"}</button><button onClick={() => playNext(1)}>▶|</button><button className="like-button" onClick={() => toggleLike(track)}>{isLiked(track) ? "♥" : "♡"}</button></div><div className="full-seek"><div><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div><input type="range" min="0" max={Math.max(1, duration)} value={Math.min(currentTime, duration || 1)} onChange={e => { const seconds = Number(e.target.value); setCurrentTime(seconds); sendPlayerCommand("seekTo", [seconds, true]); }} aria-label="Seek track" /></div><div className="queue-heading"><h3>Up next</h3><span>{queue.length} tracks</span></div><div className="queue-list">{queue.slice(0, 8).map((song, i) => <button key={keyOf(song) + i} className={keyOf(song) === keyOf(track) ? "queue-item current" : "queue-item"} onClick={() => playTrack(song, queue)}><span>{song.thumbnail ? <img src={song.thumbnail} alt="" /> : "♫"}</span><span><strong>{song.title}</strong><small>{song.artist}</small></span>{keyOf(song) === keyOf(track) ? "♫" : "▶"}</button>)}</div></div></div></section></div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}