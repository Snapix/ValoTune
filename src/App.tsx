import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GooeyNav from './components/GooeyNav';
import ElasticSlider from './components/ElasticSlider';
import { PlayIcon, PauseIcon, VolumeIcon, NextIcon, PreviousIcon, CloseIcon } from './components/PlayerIcons';
import { usePlayer } from './player';
import { useLocal } from './store';
import { fmt, type Artist, type Section, type Settings, type Song } from './types';

const ACCENTS = ['#8b5cf6', '#ec4899', '#22d3ee', '#34d399', '#f59e0b', '#f43f5e'];
const GENRES = ['Pop', 'Hip hop', 'Lofi', 'Rock', 'Bollywood', 'Tamil hits', 'Electronic', 'Jazz', 'Classical', 'K-pop', 'Indie', 'Romance'];
const TABS = ['Home', 'Discover', 'Library', 'Settings'];
type SearchData = { songs: Song[]; artists: Artist[] };
type ViewProps = { play: (song: Song, list?: Song[]) => void; liked: Set<string>; toggleLike: (song: Song) => void; currentId?: string; playing: boolean };
const api = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).error || message; } catch { /* ignore */ }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};
const key = (song: Song) => song.videoId;
const artwork = (song: Song) => song.thumb || '';

export default function App() {
  const [tab, setTab] = useState(0);
  const [pendingSearch, setPendingSearch] = useState('');
  const [settings, setSettings] = useLocal<Settings>('vt:settings', { accent: ACCENTS[0], volume: 70, autoplay: true, theme: 'dark', compactPlayer: false, reduceMotion: false, ambientBackground: true, showHomeShelves: true, showGenres: true, showNavLabels: true });
  const [liked, setLiked] = useLocal<Song[]>('vt:liked', []);
  const [recent, setRecent] = useLocal<Song[]>('vt:recent', []);
  const [toast, setToast] = useState('');
  const [fullscreenPlayer, setFullscreenPlayer] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const onPlayed = useCallback((song: Song) => setRecent(items => [song, ...items.filter(item => item.videoId !== song.videoId)].slice(0, 50)), [setRecent]);
  const player = usePlayer(settings.volume, settings.autoplay, onPlayed);
  const likedIds = useMemo(() => new Set(liked.map(key)), [liked]);
  const notify = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);
  const toggleLike = useCallback((song: Song) => {
    setLiked(items => items.some(item => key(item) === key(song)) ? items.filter(item => key(item) !== key(song)) : [song, ...items]);
  }, [setLiked]);
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', settings.accent);
    return () => window.clearTimeout(toastTimer.current);
  }, [settings.accent]);
  useEffect(() => {
    if (!fullscreenPlayer) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullscreenPlayer(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreenPlayer]);
  const navItems = useMemo(() => TABS.map(label => ({ label })), []);
  const view: ViewProps = { play: player.play, liked: likedIds, toggleLike, currentId: player.current?.videoId, playing: player.playing };
  const setPreference = <K extends keyof Settings>(field: K, value: Settings[K]) => setSettings(current => ({ ...current, [field]: value }));

  return <div className="app" data-theme={settings.theme} data-player-layout={settings.compactPlayer ? 'compact' : 'default'} data-reduce-motion={settings.reduceMotion ? 'true' : 'false'} data-ambient={settings.ambientBackground ? 'true' : 'false'} data-nav-labels={settings.showNavLabels ? 'true' : 'false'}>
    <header className="top">
      <button className="brand" onClick={() => setTab(0)} aria-label="ValoTune home"><span className="logo">♫</span><span>valo<span className="brand-light">tune</span></span></button>
      <GooeyNav items={navItems} activeIndex={tab} onChange={setTab} color={settings.accent} />
      <div className="top-status"><i /> REAL MUSIC. NO MOCKS.</div>
    </header>
    <main className="content" key={tab}>
      {tab === 0 && <Home {...view} showHomeShelves={settings.showHomeShelves} showGenres={settings.showGenres} onExplore={term => { setPendingSearch(term); setTab(1); }} />}
      {tab === 1 && <Discover {...view} notify={notify} initialQuery={pendingSearch} />}
      {tab === 2 && <Library {...view} likedList={liked} recent={recent} />}
      {tab === 3 && <SettingsView settings={settings} setPreference={setPreference} clear={() => { setLiked([]); setRecent([]); notify('Library cleared.'); }} />}
    </main>
    <div className="yt-host" aria-label="YouTube playback"><div ref={player.host} /></div>
    {player.current && <footer className="player" aria-label="Music player" onClick={event => {
      if (!(event.target as HTMLElement).closest('button,input,label')) setFullscreenPlayer(true);
    }} onKeyDown={event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) { event.preventDefault(); setFullscreenPlayer(true); }
    }} tabIndex={0} role="group" aria-description="Select the player background to open the fullscreen player">
      <div className="np">
        <img src={artwork(player.current)} alt="" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />
        <div className="np-text"><b title={player.current.name}>{player.current.name}</b><span>{player.current.artist}</span></div>
        <button className={likedIds.has(player.current.videoId) ? 'icon-btn liked' : 'icon-btn'} onClick={() => toggleLike(player.current!)} aria-label={likedIds.has(player.current.videoId) ? 'Unlike song' : 'Like song'}>{likedIds.has(player.current.videoId) ? '♥' : '♡'}</button>
      </div>
      <div className="controls">
        <div className="buttons">
          <button className="icon-btn player-control" onClick={player.prev} aria-label="Previous track"><PreviousIcon size={20} /></button>
          <button className="play-btn" onClick={player.toggle} aria-label={player.playing ? 'Pause' : 'Play'}>{player.playing ? <PauseIcon size={20} /> : <PlayIcon size={20} />}</button>
          <button className="icon-btn player-control" onClick={player.next} aria-label="Next track"><NextIcon size={20} /></button>
        </div>
        <div className="seek"><span>{fmt(player.time)}</span><ElasticSlider value={player.time} maxValue={Math.max(1, player.duration)} onChange={player.seek} ariaLabel="Seek through track" /><span>{fmt(player.duration)}</span></div>
      </div>
      <div className="volume"><VolumeIcon size={20} aria-hidden="true" /><ElasticSlider value={settings.volume} onChange={v => { setPreference('volume', v); player.setVolume(v); }} ariaLabel="Playback volume" /></div>
    </footer>}
    {fullscreenPlayer && player.current && <section className="fullscreen-player" role="dialog" aria-modal="true" aria-label="Fullscreen music player">
      <button className="fullscreen-close" onClick={() => setFullscreenPlayer(false)} aria-label="Minimize player"><CloseIcon size={24} /><span>Minimize</span></button>
      <div className="fullscreen-inner">
        <div className="fullscreen-artwork"><img src={artwork(player.current)} alt={player.current.name ? `Artwork for ${player.current.name}` : 'Track artwork'} onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /></div>
        <div className="fullscreen-track"><small>NOW PLAYING</small><h1>{player.current.name || 'Unknown track'}</h1><p>{player.current.artist || 'Unknown artist'}</p></div>
        <div className="fullscreen-seek"><div className="fullscreen-time"><span>{fmt(player.time)}</span><span>{fmt(player.duration)}</span></div><ElasticSlider value={player.time} maxValue={Math.max(1, player.duration)} onChange={player.seek} ariaLabel="Seek through track" /></div>
        <div className="fullscreen-controls">
          <button className="fullscreen-icon" onClick={player.prev} aria-label="Previous track"><PreviousIcon size={32} /></button>
          <button className="fullscreen-play" onClick={player.toggle} aria-label={player.playing ? 'Pause' : 'Play'}>{player.playing ? <PauseIcon size={32} /> : <PlayIcon size={32} />}</button>
          <button className="fullscreen-icon" onClick={player.next} aria-label="Next track"><NextIcon size={32} /></button>
        </div>
        <div className="fullscreen-volume"><VolumeIcon size={20} /><ElasticSlider value={settings.volume} onChange={v => { setPreference('volume', v); player.setVolume(v); }} ariaLabel="Playback volume" /></div>
      </div>
    </section>}
    <nav className="mobile-nav" aria-label="Mobile navigation">{TABS.map((label, index) => <button key={label} className={tab === index ? 'active' : ''} onClick={() => setTab(index)} aria-current={tab === index ? 'page' : undefined}><span>{['⌂', '⌕', '▤', '⚙'][index]}</span><small>{label}</small></button>)}</nav>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function Home(v: ViewProps & { onExplore: (term: string) => void; showHomeShelves: boolean; showGenres: boolean }) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<Section[]>('/api/home').then(data => { if (active) setSections(data); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return <section>
    <div className="hero-row"><div><small className="eyebrow">YOUR SOUND, YOUR WAY</small><h1>{greeting}<br /><em>find your next favourite.</em></h1><p className="sub">Real songs, real artists. Pick a sound and press play.</p></div><div className="hero-note"><span>♫</span><b>Made for the moment</b><small>Discover something new today.</small></div></div>
    {error && <div className="notice" role="alert"><b>Music is taking a moment.</b><span>{error}</span><button onClick={() => { setError(''); setSections(null); api<Section[]>('/api/home').then(setSections).catch(e => setError(e.message)); }}>Retry</button></div>}
    {!sections && !error && <div className="skeleton-row">{Array.from({ length: 6 }, (_, i) => <div className="sk" key={i} />)}</div>}
    {v.showHomeShelves && sections?.map(section => <Shelf key={section.title} section={section} {...v} />)}
    {v.showGenres && <section className="genre-section"><div className="section-title"><div><small className="eyebrow">FOLLOW THE FEELING</small><h2>Explore by mood</h2></div></div><div className="genre-grid">{GENRES.map((genre, i) => <button key={genre} className={`genre genre-${i % 6}`} onClick={() => v.onExplore(genre + ' songs')}><span>{['✦','◉','☾','↗','♫','♡'][i % 6]}</span>{genre}<b>↗</b></button>)}</div></section>}
  </section>;
}

function Shelf({ section, play, liked, toggleLike, currentId, playing }: { section: Section } & ViewProps) {
  return <section className="shelf"><div className="section-title"><div><small className="eyebrow">CURATED FOR YOU</small><h2>{section.title}</h2></div><span>{section.songs.length} tracks</span></div><div className="scroller">{section.songs.map(song => <Card key={song.videoId} song={song} list={section.songs} play={play} liked={liked} toggleLike={toggleLike} currentId={currentId} playing={playing} />)}</div></section>;
}
function Card({ song, list, play, liked, toggleLike, currentId, playing }: { song: Song; list: Song[] } & ViewProps) {
  const isCurrent = currentId === song.videoId;
  return <article className={`card ${isCurrent ? 'is-current' : ''}`}>
    <div className="cover-wrap"><button className="cover-button" onClick={() => play(song, list)} aria-label={`Play ${song.name}`}><img src={song.thumb} alt="" loading="lazy" onError={e => { e.currentTarget.style.opacity = '0'; }} /><span>{isCurrent && playing ? 'Ⅱ' : '▶'}</span></button><button className={liked.has(song.videoId) ? 'cover-like liked' : 'cover-like'} onClick={() => toggleLike(song)} aria-label={liked.has(song.videoId) ? 'Unlike song' : 'Like song'}>{liked.has(song.videoId) ? '♥' : '♡'}</button></div>
    <button className="card-title" onClick={() => play(song, list)} title={song.name}>{song.name}</button><span className="card-artist">{song.artist}</span>
  </article>;
}

function Discover(v: ViewProps & { notify: (message: string) => void; initialQuery: string }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [result, setResult] = useState<SearchData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'songs' | 'artists'>('songs');
  const [recentTerms, setRecentTerms] = useState<string[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const run = useCallback(async (term: string) => {
    const value = term.trim();
    if (!value) return;
    setQuery(value); setSuggestions([]); setBusy(true); setError('');
    try {
      const data = await api<SearchData>('/api/search?q=' + encodeURIComponent(value));
      setResult({ songs: data.songs || [], artists: data.artists || [] });
      setRecentTerms(items => [value, ...items.filter(item => item.toLowerCase() !== value.toLowerCase())].slice(0, 6));
    } catch (e) { setError(e instanceof Error ? e.message : 'Search failed.'); setResult(null); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    if (v.initialQuery) { setQuery(v.initialQuery); void run(v.initialQuery); }
  }, [v.initialQuery, run]);
  useEffect(() => {
    window.clearTimeout(timer.current);
    const value = query.trim();
    if (value.length < 2) { setSuggestions([]); return; }
    timer.current = window.setTimeout(() => { api<string[]>('/api/suggest?q=' + encodeURIComponent(value)).then(setSuggestions).catch(() => setSuggestions([])); }, 280);
    return () => window.clearTimeout(timer.current);
  }, [query]);
  const songs = result?.songs || [];
  return <section className="discover-page">
    <small className="eyebrow">THE WORLD OF MUSIC</small><h1 className="page-heading">Find your <em>frequency.</em></h1><p className="sub">Search real tracks and artists. No placeholder playlists.</p>
    <form className="search" role="search" onSubmit={e => { e.preventDefault(); void run(query); }}><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Songs, artists, albums, moods…" aria-label="Search music" /><button type="submit" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button></form>
    {suggestions.length > 0 && <div className="suggestions">{suggestions.map(item => <button key={item} onClick={() => void run(item)}>⌕ <span>{item}</span> ↗</button>)}</div>}
    {recentTerms.length > 0 && <div className="recent-terms"><span>Recent searches</span>{recentTerms.map(term => <button key={term} onClick={() => void run(term)}>{term}</button>)}</div>}
    {error && <div className="notice" role="alert">{error}<button onClick={() => void run(query)}>Retry</button></div>}
    <div className="section-title results-heading"><div><small className="eyebrow">YOUR RESULTS</small><h2>{result ? `Results for “${query}”` : 'Start exploring'}</h2></div>{result && <span>{songs.length} songs · {result.artists.length} artists</span>}</div>
    <div className="filter-tabs"><button className={filter === 'songs' ? 'active' : ''} onClick={() => setFilter('songs')}>Songs</button><button className={filter === 'artists' ? 'active' : ''} onClick={() => setFilter('artists')}>Artists</button></div>
    {busy && <div className="skeleton-row">{Array.from({ length: 5 }, (_, i) => <div className="sk" key={i} />)}</div>}
    {!busy && filter === 'songs' && songs.length > 0 && <div className="result-list">{songs.map(song => <div className="result-row" key={song.videoId}><button className="result-play" onClick={() => v.play(song, songs)} aria-label={`Play ${song.name}`}><img src={song.thumb} alt="" loading="lazy" /><span>{v.currentId === song.videoId && v.playing ? 'Ⅱ' : '▶'}</span></button><button className="result-info" onClick={() => v.play(song, songs)}><b>{song.name}</b><span>{song.artist}</span></button><span className="result-duration">{fmt(song.duration)}</span><button className={v.liked.has(song.videoId) ? 'icon-btn liked' : 'icon-btn'} onClick={() => v.toggleLike(song)} aria-label="Like song">{v.liked.has(song.videoId) ? '♥' : '♡'}</button></div>)}</div>}
    {!busy && filter === 'artists' && (result?.artists.length ?? 0) > 0 && <div className="artist-grid">{result!.artists.map(artist => <button key={artist.name} onClick={() => void run(artist.name)}><img src={artist.thumb} alt="" loading="lazy" /><b>{artist.name}</b><span>Search artist tracks ↗</span></button>)}</div>}
    {!busy && result && (filter === 'songs' ? songs.length === 0 : result.artists.length === 0) && <div className="empty"><span>♫</span><b>No {filter} found</b><p>Try a different title, artist, or spelling.</p></div>}
    {!result && !busy && !error && <div className="discover-empty"><span>♫</span><b>What are you in the mood for?</b><p>Search above or pick a popular genre.</p><div>{GENRES.slice(0, 6).map(genre => <button key={genre} onClick={() => void run(genre + ' songs')}>{genre}</button>)}</div></div>}
  </section>;
}

function Library({ play, liked, toggleLike, currentId, playing, likedList, recent }: ViewProps & { likedList: Song[]; recent: Song[] }) {
  const [mode, setMode] = useState<'liked' | 'recent'>('liked');
  const songs = mode === 'liked' ? likedList : recent;
  return <section className="library-page"><small className="eyebrow">YOUR PERSONAL COLLECTION</small><h1 className="page-heading">Your <em>library.</em></h1><p className="sub">Saved on this device, ready whenever you are.</p><div className="filter-tabs library-tabs"><button className={mode === 'liked' ? 'active' : ''} onClick={() => setMode('liked')}>Liked songs <span>{likedList.length}</span></button><button className={mode === 'recent' ? 'active' : ''} onClick={() => setMode('recent')}>Recently played <span>{recent.length}</span></button></div>
    {songs.length ? <div className="result-list">{songs.map(song => <div className="result-row" key={song.videoId}><button className="result-play" onClick={() => play(song, songs)} aria-label={`Play ${song.name}`}><img src={song.thumb} alt="" loading="lazy" /><span>{currentId === song.videoId && playing ? 'Ⅱ' : '▶'}</span></button><button className="result-info" onClick={() => play(song, songs)}><b>{song.name}</b><span>{song.artist}</span></button><span className="result-duration">{fmt(song.duration)}</span>{mode === 'liked' && <button className="icon-btn liked" onClick={() => toggleLike(song)} aria-label="Remove from liked songs">♥</button>}</div>)}</div> : <div className="empty"><span>♫</span><b>{mode === 'liked' ? 'Your liked songs live here' : 'Nothing played yet'}</b><p>{mode === 'liked' ? 'Save tracks with the heart button and they will appear here.' : 'Play a song and it will show up in your listening history.'}</p></div>}
  </section>;
}

function SettingsView({ settings, setPreference, clear }: { settings: Settings; setPreference: <K extends keyof Settings>(field: K, value: Settings[K]) => void; clear: () => void }) {
  const resetPreferences = () => {
    if (!window.confirm('Reset appearance and playback preferences to their defaults?')) return;
    setPreference('accent', ACCENTS[0]);
    setPreference('volume', 70);
    setPreference('autoplay', true);
    setPreference('theme', 'dark');
    setPreference('compactPlayer', false);
    setPreference('reduceMotion', false);
    setPreference('ambientBackground', true);
    setPreference('showHomeShelves', true);
    setPreference('showGenres', true);
    setPreference('showNavLabels', true);
  };
  const toggle = (label: string, description: string, field: 'compactPlayer' | 'reduceMotion' | 'ambientBackground' | 'showHomeShelves' | 'showGenres' | 'showNavLabels' | 'autoplay') => (
    <div className="panel" key={field}><div><b>{label}</b><span>{description}</span></div><button type="button" className={`toggle ${settings[field] ? 'on' : ''}`} role="switch" aria-label={label} aria-checked={settings[field]} onClick={() => setPreference(field, !settings[field])}><i /></button></div>
  );
  return <section className="settings-page"><small className="eyebrow">TUNE THE EXPERIENCE</small><h1 className="page-heading">Settings</h1><p className="sub">Straightforward controls. Your preferences stay in this browser.</p>
    <div className="settings-group"><div className="settings-title"><h2>Appearance</h2><p>Make ValoTune feel like yours.</p></div>
      <div className="panel"><div><b>Theme</b><span>Choose dark, light, or follow your device.</span></div><select className="settings-select" value={settings.theme} onChange={event => setPreference('theme', event.target.value as Settings['theme'])} aria-label="Theme"><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select></div>
      <div className="panel"><div><b>Accent colour</b><span>Used for active navigation and playback controls.</span></div><div className="swatches">{ACCENTS.map(color => <button key={color} className={settings.accent === color ? 'on' : ''} style={{ background: color }} onClick={() => setPreference('accent', color)} aria-label={`Accent ${color}`} aria-pressed={settings.accent === color} />)}</div></div>
      {toggle('Ambient background', 'Keep the subtle colour wash behind the page.', 'ambientBackground')}
    </div>
    <div className="settings-group"><div className="settings-title"><h2>Player</h2><p>Choose a comfortable player layout.</p></div>
      {toggle('Compact player', 'Use a shorter bottom player on larger screens.', 'compactPlayer')}
      <div className="panel"><div><b>Default volume</b><span>{settings.volume}%</span></div><div className="panel-slider"><ElasticSlider value={settings.volume} onChange={value => setPreference('volume', value)} ariaLabel="Default volume" /></div></div>
      {toggle('Autoplay next', 'Continue to the next song when a track ends.', 'autoplay')}
    </div>
    <div className="settings-group"><div className="settings-title"><h2>Home screen</h2><p>Keep only the sections you use.</p></div>
      {toggle('Music shelves', 'Show curated song rows on the home screen.', 'showHomeShelves')}
      {toggle('Explore by mood', 'Show the genre and mood shortcuts.', 'showGenres')}
    </div>
    <div className="settings-group"><div className="settings-title"><h2>Motion & navigation</h2><p>Keep interactions comfortable and readable.</p></div>
      {toggle('Reduce animations', 'Minimise transitions and moving effects.', 'reduceMotion')}
      {toggle('Show mobile navigation labels', 'Keep text labels under the mobile navigation icons.', 'showNavLabels')}
    </div>
    <div className="settings-group"><div className="settings-title"><h2>Data & reset</h2><p>Manage preferences and locally saved listening data.</p></div>
      <div className="panel"><div><b>Clear library</b><span>Remove liked songs and listening history from this browser.</span></div><button className="btn" onClick={() => { if (window.confirm('Clear liked songs and listening history from this browser?')) clear(); }}>Clear data</button></div>
      <div className="panel"><div><b>Reset preferences</b><span>Restore the default appearance and playback options.</span></div><button className="btn" onClick={resetPreferences}>Reset settings</button></div>
    </div>
    <p className="about">ValoTune uses YouTube Music search and the YouTube player. Playback availability depends on YouTube, regional restrictions, and the track. Settings are saved locally in this browser.</p>
  </section>;
}
