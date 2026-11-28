import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import ElasticSlider from './components/ElasticSlider';
import { PlayIcon, PauseIcon, VolumeIcon, NextIcon, PreviousIcon, CloseIcon } from './components/PlayerIcons';
import { usePlayer } from './player';
import './stability.css';
import { useLocal } from './store';
import { fmt, type Artist, type Section, type Settings, type Song, type ThemeConfig, type ThemePreset } from './types';

const THEME_PRESETS: Record<ThemePreset, { label: string; surface: ThemeConfig['surface']; accent: string; dynamicArt: boolean }> = {
  oled: { label: 'OLED Pitch Black', surface: 'oled', accent: '#ffffff', dynamicArt: false },
  midnight: { label: 'Midnight Slate', surface: 'charcoal', accent: '#8ab4ff', dynamicArt: false },
  vinyl: { label: 'Warm Vinyl', surface: 'charcoal', accent: '#d59a5b', dynamicArt: false },
  paper: { label: 'Paper Light', surface: 'light', accent: '#242424', dynamicArt: false },
  adaptive: { label: 'Adaptive Cover Art', surface: 'charcoal', accent: '#ffffff', dynamicArt: true }
};
const ACCENT_SWATCHES = ['#ffffff','#8ab4ff','#d59a5b','#e58b75','#8dd3a8','#c5a7ff','#62c7d9','#f2cf5b'];
const DEFAULT_THEME: ThemeConfig = { preset: 'midnight', surface: 'charcoal', accent: '#8ab4ff', dynamicArt: false, glow: 18, density: 'comfortable', navigation: 'top', homeFeed: 'editorial', radius: 'rounded', playerStyle: 'docked', coverMotion: 'tilt', lyricsStyle: 'karaoke', fontPairing: 'geometric', reduceMotion: false, highContrast: false };

const GENRES = ['Pop', 'Hip hop', 'Lofi', 'Rock', 'Bollywood', 'Tamil hits', 'Electronic', 'Jazz', 'Classical', 'K-pop', 'Indie', 'Romance'];
const TABS = ['Home', 'Library', 'Discover', 'Settings', 'App'];
type SearchData = { songs: Song[]; artists: Artist[] };
type ViewProps = { play: (song: Song, list?: Song[]) => void; queueSong: (song: Song) => void; liked: Set<string>; toggleLike: (song: Song) => void; currentId?: string; playing: boolean };
const api = async <T,>(url: string, signal?: AbortSignal): Promise<T> => {
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const response = await fetch(`${apiBase}${url}`, { signal });
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
  const [installedPwa, setInstalledPwa] = useState(() => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  const nativeApp = Capacitor.isNativePlatform();
  const showAppMenu = !nativeApp && !installedPwa;
  useEffect(() => { if (!showAppMenu && tab === 4) setTab(0); }, [showAppMenu, tab]);
  const navItems = (showAppMenu ? TABS : TABS.slice(0, 4)).map(label => ({ label }));
  const [pendingSearch, setPendingSearch] = useState('');
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalledPwa(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    media.addEventListener?.('change', update);
    window.addEventListener('appinstalled', update);
    update();
    return () => { media.removeEventListener?.('change', update); window.removeEventListener('appinstalled', update); };
  }, []);
  const [settings, setSettings] = useLocal<Settings>('vt:settings', { volume: 70, autoplay: true, crossfade: 0, normalization: false, streamingQuality: 'auto', lyricsSyncSpeed: 1, ambientGlow: 18, lyricsProvider: 'lrclib', showHomeShelves: true, showGenres: true, showNavLabels: true });
  const [theme, setTheme] = useLocal<ThemeConfig>('app-theme', DEFAULT_THEME);
  const [liked, setLiked] = useLocal<Song[]>('vt:liked', []);
  const [recent, setRecent] = useLocal<Song[]>('vt:recent', []);
  const [toast, setToast] = useState('');
  const [fullscreenPlayer, setFullscreenPlayer] = useState(false);
  const [fullscreenAmbientLyric, setFullscreenAmbientLyric] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const onPlayed = useCallback((song: Song) => setRecent(items => [song, ...items.filter(item => item.videoId !== song.videoId)].slice(0, 50)), [setRecent]);
  const player = usePlayer(settings.volume, settings.autoplay, onPlayed, settings.crossfade, settings.normalization, settings.streamingQuality);
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
    if (settings.playerTheme !== 'blur') setSettings(current => ({ ...current, playerTheme: 'blur' }));
  }, [settings.playerTheme, setSettings]);

  useEffect(() => {
    if (!fullscreenPlayer) setFullscreenAmbientLyric('');
  }, [fullscreenPlayer]);
  useEffect(() => {
    if (!fullscreenPlayer) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setFullscreenPlayer(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreenPlayer]);
  const view: ViewProps = { play: player.play, queueSong: player.addToQueue, liked: likedIds, toggleLike, currentId: player.current?.videoId, playing: player.playing };
  const setPreference = <K extends keyof Settings>(field: K, value: Settings[K]) => {
    setSettings(current => ({ ...current, [field]: value }));
    notify('Saved');
  };
  const resetAll = () => {
    setTheme(DEFAULT_THEME);
    setSettings({ volume: 70, autoplay: true, crossfade: 0, normalization: false, streamingQuality: 'auto', lyricsSyncSpeed: 1, ambientGlow: 18, lyricsProvider: 'lrclib', showHomeShelves: true, showGenres: true, showNavLabels: true });
    notify('Saved');
  };
  const setThemeConfig = <K extends keyof ThemeConfig>(field: K, value: ThemeConfig[K]) => {
    setTheme(current => ({ ...current, [field]: value }));
    notify('Saved');
  };
  useEffect(() => {
    const root = document.documentElement;
    const preset = THEME_PRESETS[theme.preset];
    const surface = theme.surface === 'oled' ? '#000000' : theme.surface === 'light' ? '#FAFAFA' : '#121214';
    const text = theme.surface === 'light' ? '#111111' : '#F5F5F5';
    const muted = theme.surface === 'light' ? '#6B6B6B' : '#9A9AA0';
    const elevated = theme.surface === 'light' ? '#FFFFFF' : '#1B1B1F';
    const accent = theme.accent || preset.accent;
    const hex = accent.replace('#','');
    const n = Number.parseInt(hex.length === 3 ? hex.split('').map(c => c+c).join('') : hex, 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const luminance = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
    const fg = luminance > 0.58 ? '#000000' : '#ffffff';
    root.style.setProperty('--bg-base', surface); root.style.setProperty('--bg-surface', elevated); root.style.setProperty('--bg-elevated', theme.surface === 'light' ? '#F2F2F2' : '#242429');
    root.style.setProperty('--text-primary', text); root.style.setProperty('--text-muted', muted); root.style.setProperty('--accent', accent); root.style.setProperty('--accent-fg', fg);
    root.style.setProperty('--spacing-scale', theme.density === 'compact' ? '.82' : theme.density === 'spacious' ? '1.22' : '1');
    root.style.setProperty('--radius-base', theme.radius === 'sharp' ? '4px' : theme.radius === 'soft' ? '20px' : '12px');
    root.style.setProperty('--ambient-glow', String(Math.min(40, Math.max(0, theme.glow ?? 0))));
    root.dataset.theme = theme.preset;
  }, [theme]);

  return <div className="app" data-player-layout={theme.playerStyle} data-reduce-motion={theme.reduceMotion ? 'true' : 'false'} data-navigation={theme.navigation} data-home-feed={theme.homeFeed} data-cover-motion={theme.coverMotion} data-lyrics-style={theme.lyricsStyle} data-density={theme.density} data-playing={player.playing ? 'true' : 'false'} data-high-contrast={theme.highContrast ? 'true' : 'false'}>
    <header className="top">
      <button className="brand" onClick={() => setTab(0)} aria-label="ValoTune home"><span className="logo"><img className="logo-bloub" src="/valotune-icon.svg" alt="" aria-hidden="true" /></span><span>valo<span className="brand-light">tune</span></span></button>
      <nav className="top-nav" aria-label="Primary navigation">
        {navItems.map((item, index) => <button key={item.label} className={index === tab ? 'active' : ''} onClick={() => setTab(index)} aria-current={index === tab ? 'page' : undefined}>{item.label}</button>)}
      </nav>
    </header>
    <main className="content" key={tab}>
      {tab === 0 && <Home {...view} recent={recent} showHomeShelves={settings.showHomeShelves} showGenres={settings.showGenres} onExplore={term => { setPendingSearch(term); setTab(2); }} />}
      {tab === 1 && <Library {...view} likedList={liked} recent={recent} />}
      {tab === 2 && <Discover {...view} notify={notify} initialQuery={pendingSearch} />}
      {tab === 3 && <SettingsView settings={settings} setPreference={setPreference} theme={theme} setThemeConfig={setThemeConfig} clear={() => { setLiked([]); setRecent([]); notify('Library cleared.'); }} notify={notify} resetAll={resetAll} />}
      {tab === 4 && showAppMenu && <AppDownloads />}
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {navItems.slice(0, 4).map((item, index) => <button key={item.label} className={index === tab ? 'active' : ''} onClick={() => setTab(index)} aria-current={index === tab ? 'page' : undefined}>
        <span aria-hidden="true">{['⌂','♡','⌕','⚙'][index]}</span>
        {settings.showNavLabels && <small>{item.label}</small>}
      </button>)}
    </nav>
    <div className="yt-host" aria-label="YouTube playback"><div ref={player.host} /></div>
    {player.current && !fullscreenPlayer && <footer className="player" aria-label="Music player" onClick={event => {
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
    {fullscreenPlayer && player.current && <section className="fullscreen-player" data-player-theme="blur" role="dialog" aria-modal="true" aria-label="Fullscreen music player">
      <div className="fullscreen-blur-backdrop" aria-hidden="true" />
      <button className="fullscreen-close" onClick={() => setFullscreenPlayer(false)} aria-label="Close player">Close</button>
      {fullscreenAmbientLyric && <div className="fullscreen-lyric-ambient" aria-hidden="true"><span key={fullscreenAmbientLyric}>{fullscreenAmbientLyric}</span></div>}
      <div className="fullscreen-layout">
        <aside className="fullscreen-left">
          <div className="fullscreen-panel-switcher" role="tablist" aria-label="Player panels">
            <button className="fullscreen-panel-tab active" role="tab" aria-selected="true">Queue & Lyrics</button>
          </div>
          <FullscreenPanels player={player} settings={settings} setPreference={setPreference} onAmbientLyricChange={setFullscreenAmbientLyric} />
        </aside>
        <section className="fullscreen-right">
          <div className="fullscreen-artwork"><img src={artwork(player.current)} alt={player.current.name ? `Artwork for ${player.current.name}` : 'Track artwork'} onError={event => { event.currentTarget.style.visibility = 'hidden'; }} /></div>
          <div className="fullscreen-track">
            <small>NOW PLAYING</small>
            <h1>{player.current.name || 'Unknown track'}</h1>
            <p>{player.current.artist || 'Unknown artist'}</p>
            <div className="fullscreen-track-actions" aria-label="Track actions">
              <button className={likedIds.has(player.current.videoId) ? 'fullscreen-track-action is-liked' : 'fullscreen-track-action'} onClick={() => toggleLike(player.current!)} aria-label={likedIds.has(player.current.videoId) ? 'Unlike song' : 'Like song'} aria-pressed={likedIds.has(player.current.videoId)}>
                <span aria-hidden="true">♡</span>
              </button>
              <button className="fullscreen-track-action" onClick={() => { player.addToQueue(player.current!); notify('Added to queue.'); }} aria-label="Add to queue">
                <span aria-hidden="true">＋</span>
              </button>
              <button className="fullscreen-track-action" onClick={async () => { try { await navigator.clipboard?.writeText(window.location.href); notify('Link copied.'); } catch { notify('Share link unavailable.'); } }} aria-label="Share song">
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
          <div className="fullscreen-seek"><div className="fullscreen-time"><span>{fmt(player.time)}</span><span>{fmt(player.duration)}</span></div><ElasticSlider value={player.time} maxValue={Math.max(1, player.duration)} onChange={player.seek} ariaLabel="Seek through track" /></div>
          <div className="fullscreen-controls">
            <button className="fullscreen-icon" onClick={player.prev} aria-label="Previous track"><PreviousIcon size={32} /></button>
            <button className="fullscreen-play" onClick={player.toggle} aria-label={player.playing ? 'Pause' : 'Play'}>{player.playing ? <PauseIcon size={32} /> : <PlayIcon size={32} />}</button>
            <button className="fullscreen-icon" onClick={player.next} aria-label="Next track"><NextIcon size={32} /></button>
          </div>
          <div className="fullscreen-volume"><VolumeIcon size={20} /><ElasticSlider value={settings.volume} onChange={v => { setPreference('volume', v); player.setVolume(v); }} ariaLabel="Playback volume" /></div>
        </section>
      </div>
    </section>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

function FullscreenPanels({ player, settings, onAmbientLyricChange }: { player: ReturnType<typeof usePlayer>; settings: Settings; setPreference: <K extends keyof Settings>(field: K, value: Settings[K]) => void; onAmbientLyricChange: (text: string) => void }) {
  const [panel, setPanel] = useState<'queue' | 'lyrics'>('lyrics');
  return <div className="fullscreen-panel-body">
    <div className="panel-switcher" role="tablist" aria-label="Player panels">
      <button className={panel === 'lyrics' ? 'active' : ''} role="tab" aria-selected={panel === 'lyrics'} onClick={() => setPanel('lyrics')}>Lyrics</button>
      <button className={panel === 'queue' ? 'active' : ''} role="tab" aria-selected={panel === 'queue'} onClick={() => setPanel('queue')}>Queue <span>{player.queue.length}</span></button>
    </div>
    {panel === 'queue'
      ? <QueuePanel player={player} />
      : <LyricsPanel song={player.current!} time={player.time} provider={settings.lyricsProvider} onSeek={player.seek} onAmbientLyricChange={onAmbientLyricChange} />}
  </div>;
}

function QueuePanel({ player }: { player: ReturnType<typeof usePlayer> }) {
  return <section className="queue-panel" aria-label="Up next queue">
    <div className="queue-heading"><div><small>UP NEXT</small><h2>Queue</h2></div><span>{player.queue.length} tracks</span></div>
    {player.queue.length ? <div className="queue-list">
      {player.queue.map((song, index) => {
        const active = song.videoId === player.current?.videoId;
        return <div className={'queue-item' + (active ? ' is-current' : '')} key={song.videoId + '-' + index}>
          <button className="queue-main" onClick={() => player.play(song, player.queue)} aria-current={active ? 'true' : undefined}>
            <span className="queue-index">{active && player.playing ? 'Ⅱ' : String(index + 1).padStart(2, '0')}</span>
            <img src={song.thumb} alt="" loading="lazy" />
            <span className="queue-info"><b>{song.name}</b><small>{song.artist}</small></span>
            <span className="queue-duration">{fmt(song.duration)}</span>
          </button>
          {!active && <button className="queue-remove" type="button" onClick={() => player.removeFromQueue(song.videoId)} aria-label={"Remove " + song.name + " from queue"}>×</button>}
        </div>;
      })}
    </div> : <div className="lyrics-state">Nothing queued yet. Play a track from a shelf to build your queue.</div>}
  </section>;
}

function Home(v: ViewProps & { recent: Song[]; onExplore: (term: string) => void; showHomeShelves: boolean; showGenres: boolean }) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const artists = [...new Set(v.recent.map(song => song.artist).filter(Boolean))].slice(0, 3);
    const params = artists.length ? '?artists=' + encodeURIComponent(artists.join('|')) : '';
    api<Section[]>('/api/home' + params, controller.signal).then(data => {
      if (active) setSections(data);
    }).catch(e => {
      if (active && e.name !== 'AbortError') setError(e.message);
    });
    return () => { active = false; controller.abort(); };
  }, []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return <section>
    <div className="hero-row"><div><small className="eyebrow">YOUR SOUND, YOUR WAY</small><h1>{greeting}<br /><em>find your next favourite.</em></h1><p className="sub">Real songs, real artists. Pick a sound and press play.</p></div><img className="home-brand-mark" src="/valotune-icon.svg" alt="ValoTune" /></div>
    {v.recent.length > 0 && <Shelf section={{ title: "Continue listening", songs: v.recent.slice(0, 12) }} {...v} /> }
    {error && <div className="notice" role="alert"><b>Music is taking a moment.</b><span>{error}</span><button onClick={() => { setError(''); setSections(null); api<Section[]>('/api/home' + (() => { const artists = [...new Set(v.recent.map(song => song.artist).filter(Boolean))].slice(0, 3); return artists.length ? '?artists=' + encodeURIComponent(artists.join('|')) : ''; })()).then(setSections).catch(e => setError(e.message)); }}>Retry</button></div>}
    {!sections && !error && <div className="skeleton-row">{Array.from({ length: 6 }, (_, i) => <div className="sk" key={i} />)}</div>}
    {v.showHomeShelves && sections?.map(section => <Shelf key={section.title} section={section} {...v} />)}
    {v.showGenres && <section className="genre-section"><div className="section-title"><div><small className="eyebrow">FOLLOW THE FEELING</small><h2>Explore by mood</h2></div></div><div className="genre-grid">{GENRES.map((genre, i) => <button key={genre} className={`genre genre-${i % 6}`} onClick={() => v.onExplore(genre + ' songs')}><span>{['✦','◉','☾','↗','♫','♡'][i % 6]}</span>{genre}<b>↗</b></button>)}</div></section>}
  </section>;
}

function Shelf({ section, play, queueSong, liked, toggleLike, currentId, playing }: { section: Section } & ViewProps) {
  return <section className="shelf"><div className="section-title"><div><small className="eyebrow">CURATED FOR YOU</small><h2>{section.title}</h2></div><span>{section.songs.length} tracks</span></div><div className="scroller">{section.songs.map(song => <Card key={song.videoId} song={song} list={section.songs} play={play} queueSong={queueSong} liked={liked} toggleLike={toggleLike} currentId={currentId} playing={playing} />)}</div></section>;
}
function Card({ song, list, play, queueSong, liked, toggleLike, currentId, playing }: { song: Song; list: Song[] } & ViewProps) {
  const isCurrent = currentId === song.videoId;
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dominant, setDominant] = useState('#3a3530');
  useEffect(() => {
    setFailed(false); setLoaded(false);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 12;
        canvas.width = size; canvas.height = size;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return;
        context.drawImage(image, 0, 0, size, size);
        const data = context.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; count++; }
        if (count) setDominant('rgb(' + Math.round(r / count) + ' ' + Math.round(g / count) + ' ' + Math.round(b / count) + ')');
      } catch { /* remote art may not permit canvas sampling */ }
    };
    image.src = song.thumb || '';
  }, [song.thumb]);
  return <article className={`card ${isCurrent ? 'is-current' : ''}`}>
    <div className="cover-wrap">
      <button className="cover-button" style={{ '--cover-color': dominant } as CSSProperties} onClick={() => play(song, list)} aria-label={`Play ${song.name}`}>
        {!failed && <img src={song.thumb} alt="" loading="lazy" onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(false); }} />}
        {failed && <span className="cover-fallback" aria-hidden="true">♫</span>}
        <span className="cover-skeleton" style={{ opacity: loaded || failed ? 0 : 1 }} aria-hidden="true" />
        <span className="cover-play">{isCurrent && playing ? 'Ⅱ' : '▶'}</span>
      </button>
      <button className={liked.has(song.videoId) ? 'cover-like liked' : 'cover-like'} onClick={() => toggleLike(song)} aria-label={liked.has(song.videoId) ? 'Unlike song' : 'Like song'}>{liked.has(song.videoId) ? '♥' : '♡'}</button>
      <button className="cover-queue" onClick={() => queueSong(song)} aria-label={"Add " + song.name + " to queue"}>＋</button>
    </div>
    <button className="card-title" onClick={() => play(song, list)} title={song.name}>{song.name}</button><span className="card-artist">{song.artist}</span>
  </article>;
}

function Discover(v: ViewProps & { notify: (message: string) => void; initialQuery: string }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [result, setResult] = useState<SearchData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'songs' | 'artists' | 'audiodb'>('songs');
  const [recentTerms, setRecentTerms] = useState<string[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const searchController = useRef<AbortController | null>(null);
  const suggestionController = useRef<AbortController | null>(null);
  const run = useCallback(async (term: string) => {
    const value = term.trim();
    if (!value) return;
    setQuery(value); setSuggestions([]); setBusy(true); setError('');
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    try {
      const data = await api<SearchData>('/api/search?q=' + encodeURIComponent(value), controller.signal);
      setResult({ songs: data.songs || [], artists: data.artists || [] });
      setRecentTerms(items => [value, ...items.filter(item => item.toLowerCase() !== value.toLowerCase())].slice(0, 6));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Search failed.'); setResult(null);
    } finally {
      if (searchController.current === controller) setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (v.initialQuery) { setQuery(v.initialQuery); void run(v.initialQuery); }
  }, [v.initialQuery, run]);
  useEffect(() => {
    window.clearTimeout(timer.current);
    const value = query.trim();
    if (value.length < 2) { setSuggestions([]); return; }
    suggestionController.current?.abort();
    const controller = new AbortController();
    suggestionController.current = controller;
    timer.current = window.setTimeout(() => {
      api<string[]>('/api/suggest?q=' + encodeURIComponent(value), controller.signal).then(setSuggestions).catch(error => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setSuggestions([]);
      });
    }, 280);
    return () => { window.clearTimeout(timer.current); controller.abort(); };
  }, [query]);
  const songs = result?.songs || [];
  return <section className="discover-page">
    <small className="eyebrow">THE WORLD OF MUSIC</small><h1 className="page-heading">Find your <em>frequency.</em></h1><p className="sub">Search real tracks and artists. No placeholder playlists.</p>
    <form className="search" role="search" onSubmit={e => { e.preventDefault(); void run(query); }}><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Songs, artists, albums, moods…" aria-label="Search music" /><button type="submit" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button></form>
    {suggestions.length > 0 && <div className="suggestions">{suggestions.map(item => <button key={item} onClick={() => void run(item)}>⌕ <span>{item}</span> ↗</button>)}</div>}
    {recentTerms.length > 0 && <div className="recent-terms"><span>Recent searches</span>{recentTerms.map(term => <button key={term} onClick={() => void run(term)}>{term}</button>)}</div>}
    {error && <div className="notice" role="alert">{error}<button onClick={() => void run(query)}>Retry</button></div>}
    <div className="section-title results-heading"><div><small className="eyebrow">YOUR RESULTS</small><h2>{result ? `Results for “${query}”` : 'Start exploring'}</h2></div>{result && <span>{songs.length} songs · {result.artists.length} artists</span>}</div>
    <div className="filter-tabs"><button className={filter === 'songs' ? 'active' : ''} onClick={() => setFilter('songs')}>Songs</button><button className={filter === 'artists' ? 'active' : ''} onClick={() => setFilter('artists')}>Artists</button><button className={filter === 'audiodb' ? 'active' : ''} onClick={() => setFilter('audiodb')}>AudioDB</button></div>
    {busy && <div className="skeleton-row">{Array.from({ length: 5 }, (_, i) => <div className="sk" key={i} />)}</div>}
    {!busy && filter === 'songs' && songs.length > 0 && <div className="result-list">{songs.map(song => <div className="result-row" key={song.videoId}><button className="result-play" onClick={() => v.play(song, songs)} aria-label={`Play ${song.name}`}><img src={song.thumb} alt="" loading="lazy" /><span>{v.currentId === song.videoId && v.playing ? 'Ⅱ' : '▶'}</span></button><button className="result-info" onClick={() => v.play(song, songs)}><b>{song.name}</b><span>{song.artist}</span></button><span className="result-duration">{fmt(song.duration)}</span><button className="icon-btn" onClick={() => v.queueSong(song)} aria-label={"Add " + song.name + " to queue"}>＋</button><button className={v.liked.has(song.videoId) ? 'icon-btn liked' : 'icon-btn'} onClick={() => v.toggleLike(song)} aria-label="Like song">{v.liked.has(song.videoId) ? '♥' : '♡'}</button></div>)}</div>}
    {!busy && filter === 'artists' && (result?.artists.length ?? 0) > 0 && <div className="artist-grid">{result!.artists.map(artist => <button key={artist.name} onClick={() => void run(artist.name)}><img src={artist.thumb} alt="" loading="lazy" /><b>{artist.name}</b><span>Search artist tracks ↗</span></button>)}</div>}
    {!busy && result && (filter === 'songs' ? songs.length === 0 : result.artists.length === 0) && <div className="empty"><span>♫</span><b>No {filter} found</b><p>Try a different title, artist, or spelling.</p></div>}
    {filter === 'audiodb' && <AudioDBPanel initialQuery={query} onFindOnValo={term => { setFilter('songs'); void run(term); }} />}
    {!result && !busy && !error && filter !== 'audiodb' && <div className="discover-empty"><span>♫</span><b>What are you in the mood for?</b><p>Search above or pick a popular genre.</p><div>{GENRES.slice(0, 6).map(genre => <button key={genre} onClick={() => void run(genre + ' songs')}>{genre}</button>)}</div></div>}
  </section>;
}


type AudioDbType = 'artist' | 'album' | 'track';
type AudioDbRecord = Record<string, any>;

function audioDbRecords(data: any, type: AudioDbType): AudioDbRecord[] {
  const keys = type === 'artist' ? ['artists', 'artist'] : type === 'album' ? ['albums', 'album'] : ['tracks', 'track'];
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function audioDbImage(item: AudioDbRecord) {
  return item.strArtistThumb || item.strArtistFanart || item.strAlbumThumb || item.strAlbumThumbHQ || item.strTrackThumb || item.strArtistLogo || '';
}

function audioDbTitle(item: AudioDbRecord, type: AudioDbType) {
  return type === 'artist' ? item.strArtist || item.name || 'Unknown artist' : type === 'album' ? item.strAlbum || item.name || 'Unknown album' : item.strTrack || item.name || 'Unknown track';
}

function AudioDBPanel({ initialQuery, onFindOnValo }: { initialQuery: string; onFindOnValo: (term: string) => void }) {
  const [type, setType] = useState<AudioDbType>('artist');
  const [query, setQuery] = useState(initialQuery || '');
  const [records, setRecords] = useState<AudioDbRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<AudioDbRecord | null>(null);
  const [discography, setDiscography] = useState<AudioDbRecord[]>([]);
  const [discBusy, setDiscBusy] = useState(false);

  const search = useCallback(async () => {
    const value = query.trim();
    if (!value) return;
    setBusy(true); setError(''); setDetail(null);
    try {
      const data = await api<any>('/api/audiodb/search/' + type + '/' + encodeURIComponent(value));
      setRecords(audioDbRecords(data, type).slice(0, 10));
    } catch (e) {
      setRecords([]);
      setError(e instanceof Error ? e.message : 'AudioDB search failed.');
    } finally { setBusy(false); }
  }, [query, type]);

  const lookup = async (item: AudioDbRecord) => {
    const id = item.idArtist || item.idAlbum || item.idTrack;
    if (!id) return;
    setDetail(item);
    try {
      const data = await api<any>('/api/audiodb/lookup/' + type + '/' + encodeURIComponent(String(id)));
      const records = audioDbRecords(data, type);
      setDetail(records[0] || item);
      if (type === 'artist') {
        setDiscBusy(true);
        try {
          const disc = await api<any>('/api/audiodb/discography/' + encodeURIComponent(String(id)));
          setDiscography(audioDbRecords(disc, 'album').slice(0, 20));
        } catch { setDiscography([]); }
        finally { setDiscBusy(false); }
      }
    } catch { /* keep search result visible */ }
  };

  return <section className="audiodb-panel">
    <div className="audiodb-header"><div><small className="eyebrow">THEAUDIODB METADATA</small><h2>Artwork & music details</h2><p>Posters, artist info, album details and discographies from TheAudioDB.</p></div></div>
    <form className="audiodb-search" onSubmit={event => { event.preventDefault(); void search(); }}>
      <select value={type} onChange={event => { setType(event.target.value as AudioDbType); setRecords([]); setDetail(null); }} aria-label="AudioDB search type"><option value="artist">Artist</option><option value="album">Album</option><option value="track">Track</option></select>
      <input value={query} onChange={event => setQuery(event.target.value)} placeholder={type === 'artist' ? 'Coldplay' : type === 'album' ? 'Parachutes' : 'Yellow'} aria-label="AudioDB search" />
      <button type="submit" disabled={busy}>{busy ? 'Searching…' : 'Search'}</button>
    </form>
    {error && <div className="notice" role="alert">{error}</div>}
    {busy && <div className="audiodb-grid">{Array.from({ length: 6 }, (_, i) => <div className="audiodb-skeleton" key={i} />)}</div>}
    {!busy && records.length > 0 && <div className="audiodb-grid">{records.map((item, index) => {
      const title = audioDbTitle(item, type);
      const image = audioDbImage(item);
      return <article className="audiodb-card" key={String(item.idArtist || item.idAlbum || item.idTrack || index)}>
        <div className="audiodb-art">{image ? <img src={image} alt="" loading="lazy" /> : <span>♫</span>}</div>
        <div className="audiodb-card-copy"><b>{title}</b><span>{type === 'track' ? item.strArtist || 'Track' : type === 'album' ? item.strArtist || item.intYearReleased || 'Album' : item.strGenre || item.strCountry || 'Artist'}</span></div>
        <div className="audiodb-actions"><button type="button" onClick={() => void lookup(item)}>Details</button>{type !== 'album' && <button type="button" onClick={() => onFindOnValo(type === 'artist' ? title : item.strArtist || title)}>Play on ValoTune</button>}</div>
      </article>;
    })}</div>}
    {!busy && !records.length && !error && <div className="empty"><span>♫</span><b>Search TheAudioDB</b><p>Use the artist, album or track endpoint to bring metadata into ValoTune.</p></div>}
    {detail && <aside className="audiodb-detail">
      <div className="audiodb-detail-art">{audioDbImage(detail) ? <img src={audioDbImage(detail)} alt="" /> : <span>♫</span>}</div>
      <div><small className="eyebrow">{type.toUpperCase()} DETAILS</small><h3>{audioDbTitle(detail, type)}</h3><p>{detail.strDescriptionEN || detail.strGenre || detail.strStyle || detail.strAlbum || detail.strArtist || 'Metadata available from TheAudioDB.'}</p>{detail.strArtist && <span className="audiodb-meta">{detail.strArtist}{detail.intYearReleased ? ' · ' + detail.intYearReleased : ''}</span>}</div>
      {type === 'artist' && <div className="audiodb-discography"><b>Discography</b>{discBusy ? <span>Loading albums…</span> : discography.length ? <div>{discography.map((album, index) => <button key={String(album.idAlbum || index)} onClick={() => { setType('album'); setQuery(album.strAlbum || ''); }}>{album.strAlbum || 'Album'}</button>)}</div> : <span>No discography available.</span>}</div>}
    </aside>}
  </section>;
}

function Library({ play, queueSong, liked, toggleLike, currentId, playing, likedList, recent }: ViewProps & { likedList: Song[]; recent: Song[] }) {
  const [mode, setMode] = useState<'liked' | 'recent'>('liked');
  const songs = mode === 'liked' ? likedList : recent;
  return <section className="library-page"><small className="eyebrow">YOUR PERSONAL COLLECTION</small><h1 className="page-heading">Your <em>library.</em></h1><p className="sub">Saved on this device, ready whenever you are.</p><div className="filter-tabs library-tabs"><button className={mode === 'liked' ? 'active' : ''} onClick={() => setMode('liked')}>Liked songs <span>{likedList.length}</span></button><button className={mode === 'recent' ? 'active' : ''} onClick={() => setMode('recent')}>Recently played <span>{recent.length}</span></button></div>
    {songs.length ? <div className="result-list">{songs.map(song => <div className="result-row" key={song.videoId}><button className="result-play" onClick={() => play(song, songs)} aria-label={`Play ${song.name}`}><img src={song.thumb} alt="" loading="lazy" /><span>{currentId === song.videoId && playing ? 'Ⅱ' : '▶'}</span></button><button className="result-info" onClick={() => play(song, songs)}><b>{song.name}</b><span>{song.artist}</span></button><span className="result-duration">{fmt(song.duration)}</span><button className="icon-btn" onClick={() => queueSong(song)} aria-label={"Add " + song.name + " to queue"}>＋</button>{mode === 'liked' && <button className="icon-btn liked" onClick={() => toggleLike(song)} aria-label="Remove from liked songs">♥</button>}</div>)}</div> : <div className="empty"><span>♫</span><b>{mode === 'liked' ? 'Your liked songs live here' : 'Nothing played yet'}</b><p>{mode === 'liked' ? 'Save tracks with the heart button and they will appear here.' : 'Play a song and it will show up in your listening history.'}</p></div>}
  </section>;
}

function SettingsView({ settings, setPreference, theme, setThemeConfig, clear, notify, resetAll }: { settings: Settings; setPreference: <K extends keyof Settings>(field: K, value: Settings[K]) => void; theme: ThemeConfig; setThemeConfig: <K extends keyof ThemeConfig>(field: K, value: ThemeConfig[K]) => void; clear: () => void; notify: (message: string) => void; resetAll: () => void }) {
  const [category, setCategory] = useState<'account'|'audio'|'lyrics'|'integrations'>('audio');
  const [customAccent, setCustomAccent] = useState(theme.accent);
  const confirmReset = () => { if (window.confirm('Reset ValoTune settings?')) resetAll(); };
  const row = (title: string, description: string, control: ReactNode) => <div className="setting-row"><div className="setting-copy"><b>{title}</b><span>{description}</span></div><div className="setting-control">{control}</div></div>;
  const toggle = (title: string, description: string, field: keyof Settings) => row(title, description, <button type="button" className={`setting-switch ${settings[field] ? 'on' : ''}`} role="switch" aria-checked={Boolean(settings[field])} onClick={() => setPreference(field, !settings[field] as Settings[typeof field])}><i /></button>);
  const slider = (title: string, description: string, field: keyof Settings, min: number, max: number, step: number, suffix='') => row(title, description, <div className="setting-slider"><input type="range" min={min} max={max} step={step} value={Number(settings[field])} onChange={e => setPreference(field, Number(e.target.value) as Settings[typeof field])}/><output>{Number(settings[field])}{suffix}</output></div>);
  const categories = [['account','Account','Library and portability'],['audio','Audio & Playback','Sound and playback'],['lyrics','Lyrics & Visuals','Lyrics, themes and motion'],['integrations','Integrations','Providers and connections']] as const;
  const preview = <div className="theme-preview"><div className="preview-track"><span className="preview-art">♫</span><span><b>Now Playing</b><small>ValoTune preview</small></span><button className="preview-play" type="button" aria-label="Preview play">▶</button></div><p className="preview-lyric">This is the line that is playing now</p></div>;
  return <section className="settings-page">
    <div className="settings-head"><small className="eyebrow">CONTROL CENTER</small><h1 className="page-heading">Settings</h1><p className="sub">Tune the player, visuals, and playback without leaving your music.</p></div>
    <nav className="settings-tabs" aria-label="Settings categories">{categories.map(([id,label,desc]) => <button key={id} className={category===id?'active':''} onClick={()=>setCategory(id)}><b>{label}</b><span>{desc}</span></button>)}</nav>
    <div className="settings-column">
      {category==='account' && <>
        {row('Liked & history','Remove local listening data stored on this device.',<button className="setting-action" onClick={()=>{if(confirm('Clear liked songs and history?')) clear();}}>Clear</button>)}
        {row('Information density','Choose how much content fits on screen.',<select value={theme.density} onChange={e=>setThemeConfig('density',e.target.value as ThemeConfig['density'])}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select>)}
        {row('Navigation layout','Choose the primary navigation treatment.',<select value={theme.navigation} onChange={e=>setThemeConfig('navigation',e.target.value as ThemeConfig['navigation'])}><option value="sidebar">Left Sidebar</option><option value="top">Top Bar</option><option value="dock">Floating Pill Dock</option></select>)}
        {row('Home feed','Choose the home feed composition.',<select value={theme.homeFeed} onChange={e=>setThemeConfig('homeFeed',e.target.value as ThemeConfig['homeFeed'])}><option value="editorial">Editorial + Rows</option><option value="grid">Dense Grid</option></select>)}
        {row('Shape','Set the interface corner treatment.',<select value={theme.radius} onChange={e=>setThemeConfig('radius',e.target.value as ThemeConfig['radius'])}><option value="sharp">Sharp</option><option value="rounded">Rounded</option><option value="soft">Pill / Soft</option></select>)}
        {row('Reset everything','Restore ValoTune defaults.',<button className="setting-action" onClick={confirmReset}>Reset</button>)}
      </>}
      {category==='audio' && <>
        {row('Default volume','Set the player starting level.',<div className="setting-slider"><input type="range" min="0" max="100" value={settings.volume} onChange={e=>setPreference('volume',Number(e.target.value))}/><output>{settings.volume}%</output></div>)}
        {row('Crossfade','Fade out before the next track begins.',<select value={settings.crossfade} onChange={e=>setPreference('crossfade',Number(e.target.value))}><option value="0">Off</option><option value="2">2 sec</option><option value="4">4 sec</option><option value="6">6 sec</option><option value="8">8 sec</option></select>)}
        {toggle('Volume normalization','Keep playback level more consistent between tracks.', 'normalization')}
        {row('Streaming quality','Preferred YouTube stream quality when available.',<select value={settings.streamingQuality} onChange={e=>setPreference('streamingQuality',e.target.value as Settings['streamingQuality'])}><option value="auto">Auto</option><option value="high">High</option><option value="standard">Standard</option><option value="data-saver">Data saver</option></select>)}
        {toggle('Autoplay next','Continue into the next queued track.', 'autoplay')}
        {row('Player bar','Docked full width or a floating island.',<select value={theme.playerStyle} onChange={e=>setThemeConfig('playerStyle',e.target.value as ThemeConfig['playerStyle'])}><option value="docked">Full-width Docked</option><option value="floating">Floating Island</option></select>)}
        {row('Cover motion','Add restrained motion to active artwork.',<select value={theme.coverMotion} onChange={e=>setThemeConfig('coverMotion',e.target.value as ThemeConfig['coverMotion'])}><option value="static">Static</option><option value="tilt">Subtle Hover Tilt</option><option value="vinyl">Spinning Vinyl</option></select>)}
      </>}
      {category==='lyrics' && <>
        <div className="theme-section"><div className="section-label">Presets & Moods</div><div className="theme-pills">{Object.entries(THEME_PRESETS).map(([id,p])=><button key={id} className={theme.preset===id?'active':''} onClick={()=>{const preset=id as ThemePreset; setTheme(current=>({...current,...THEME_PRESETS[preset],preset,glow:current.glow})); notify('Saved')}}>{THEME_PRESETS[id as ThemePreset].label}</button>)}</div>{preview}</div>
        {row('Base surface','Pitch black, charcoal, or light.',<select value={theme.surface} onChange={e=>setThemeConfig('surface',e.target.value as ThemeConfig['surface'])}><option value="oled">Pitch Black</option><option value="charcoal">Dark Charcoal</option><option value="light">Soft Light</option></select>)}
        <div className="theme-section"><div className="section-label">Accent color</div><div className="accent-grid">{ACCENT_SWATCHES.map((color,i)=><button key={i} className="accent-swatch" style={{'--swatch':color} as React.CSSProperties} aria-label="Accent swatch" onClick={()=>setThemeConfig('accent',color)} />)}<label className="accent-custom">Custom<input type="color" value={customAccent} onChange={e=>{setCustomAccent(e.target.value);setThemeConfig('accent',e.target.value)}}/></label></div></div>
        {slider('Ambient background glow','Let the current cover subtly bleed into the background.', 'ambientGlow',0,40,1,'%')}
        {row('Lyrics style','Choose how the active line is presented.',<select value={theme.lyricsStyle} onChange={e=>setThemeConfig('lyricsStyle',e.target.value as ThemeConfig['lyricsStyle'])}><option value="karaoke">Karaoke Spotlight</option><option value="teleprompter">Classic Teleprompter</option><option value="minimal">Minimal 2-Line Subtitle</option></select>)}
        {slider('Lyrics sync speed','Adjust automatic lyric timing.', 'lyricsSyncSpeed',0.5,1.5,0.1,'x')}
        {row('Font pairing','Choose the type system for the player.',<select value={theme.fontPairing} onChange={e=>setThemeConfig('fontPairing',e.target.value as ThemeConfig['fontPairing'])}><option value="geometric">Clean Geometric</option><option value="editorial">Editorial Serif</option><option value="mono">Monospace Tech</option></select>)}
        {toggle('Reduce motion','Disable nonessential motion and transitions.', 'reduceMotion' as keyof Settings)}
        {row('High contrast borders','Add crisp borders to controls and surfaces.',<button type="button" className={`setting-switch ${theme.highContrast?'on':''}`} role="switch" aria-checked={theme.highContrast} onClick={()=>setThemeConfig('highContrast',!theme.highContrast)}><i/></button>)}
      </>}
      {category==='integrations' && <>
        {row('Lyrics provider','Select the source used for synchronized lyrics.',<select value={settings.lyricsProvider} onChange={e=>setPreference('lyricsProvider',e.target.value as Settings['lyricsProvider'])}><option value="lrclib">LRCLIB</option><option value="ytmusic">YouTube Music</option></select>)}
        {row('Mobile navigation labels','Show text labels in the mobile dock.',<button type="button" className={`setting-switch ${settings.showNavLabels?'on':''}`} role="switch" aria-checked={settings.showNavLabels} onClick={()=>setPreference('showNavLabels',!settings.showNavLabels)}><i/></button>)}
        {row('Home shelves','Show curated music rows on Home.',<button type="button" className={`setting-switch ${settings.showHomeShelves?'on':''}`} role="switch" aria-checked={settings.showHomeShelves} onClick={()=>setPreference('showHomeShelves',!settings.showHomeShelves)}><i/></button>)}
        {row('Genres & moods','Show discovery shortcuts on Home.',<button type="button" className={`setting-switch ${settings.showGenres?'on':''}`} role="switch" aria-checked={settings.showGenres} onClick={()=>setPreference('showGenres',!settings.showGenres)}><i/></button>)}
        {row('Share theme code','Copy a portable theme JSON/Base64 code.',<button className="setting-action" onClick={async()=>{const raw=JSON.stringify(theme);const code=btoa(unescape(encodeURIComponent(raw)));await navigator.clipboard?.writeText(code);notify('Theme code copied');}}>Copy</button>)}
        {row('Import theme','Paste a theme JSON/Base64 code.',<button className="setting-action" onClick={async()=>{const code=prompt('Paste theme code');if(!code)return;try{const raw=decodeURIComponent(escape(atob(code)));const parsed=JSON.parse(raw) as ThemeConfig;setTheme(parsed);notify('Theme imported')}catch{notify('Invalid theme code')}}}>Import</button>)}
      </>}
    </div>
  </section>;
}

type LyricLine = { time: number | null; text: string };
type LyricsRecord = { name?: string; trackName?: string; artistName?: string; plainLyrics?: string | null; syncedLyrics?: string | null; instrumental?: boolean; lyrics?: string | Array<{ time?: number; startTime?: number; start_time?: number; text: string }>; hasTimestamps?: boolean; source?: string };
function parseLrc(value: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const sourceLine of value.split(/\r?\n/)) {
    const matches = [...sourceLine.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
    const text = sourceLine.replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim();
    if (!matches.length) {
      if (text) lines.push({ time: null, text });
      continue;
    }
    for (const match of matches) {
      const fraction = match[3] ? Number('0.' + match[3]) : 0;
      if (text) lines.push({ time: Number(match[1]) * 60 + Number(match[2]) + fraction, text });
    }
  }
  return lines.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
}
function LyricsPanel({ song, time, provider, onSeek, onAmbientLyricChange }: { song: Song; time: number; provider: Settings['lyricsProvider']; onSeek?: (seconds: number) => void; onAmbientLyricChange?: (text: string) => void }) {
  const [record, setRecord] = useState<LyricsRecord | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [retryKey, setRetryKey] = useState(0);
  const activeLine = useRef<HTMLDivElement | null>(null);
  const linesViewport = useRef<HTMLDivElement | null>(null);
  const manualScroll = useRef(false);
  const resumeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setRecord(null); setStatus('loading'); manualScroll.current = false;
    const loadLyrics = async () => {
      try {
        let data: LyricsRecord | null = null;
        if (provider === 'lrclib') {
          const params = new URLSearchParams({ track_name: song.name, artist_name: song.artist });
          if (song.duration > 0 && song.duration <= 3600) params.set('duration', String(Math.round(song.duration)));
          let response = await fetch('https://lrclib.net/api/get?' + params.toString(), { signal: controller.signal, headers: { 'X-User-Agent': 'ValoTune/2.0.0' } });
          if (response.status === 404) {
            const search = new URLSearchParams({ q: song.name + ' ' + song.artist });
            response = await fetch('https://lrclib.net/api/search?' + search.toString(), { signal: controller.signal });
            if (response.ok) {
              const candidates = await response.json() as LyricsRecord[];
              const title = song.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              const artist = song.artist.toLowerCase().replace(/[^a-z0-9]/g, '');
              data = candidates.find(item => (item.trackName || item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === title && (item.artistName || '').toLowerCase().replace(/[^a-z0-9]/g, '').includes(artist)) || candidates[0] || null;
            }
          } else if (response.ok) data = await response.json() as LyricsRecord;
          else if (response.status === 429) throw new Error('Lyrics provider is rate-limiting requests.');
          else throw new Error('Lyrics request failed.');
        } else {
          const response = await fetch('/api/lyrics?videoId=' + encodeURIComponent(song.videoId), { signal: controller.signal });
          if (response.status === 404) data = null;
          else if (!response.ok) throw new Error('YouTube Music could not load lyrics.');
          else data = await response.json() as LyricsRecord;
        }
        if (cancelled) return;
        setRecord(data);
        setStatus(data && (data.syncedLyrics || data.plainLyrics || data.lyrics) ? 'ready' : 'empty');
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        setStatus('error');
      }
    };
    void loadLyrics();
    return () => { cancelled = true; controller.abort(); window.clearTimeout(resumeTimer.current); };
  }, [song.videoId, song.name, song.artist, song.duration, provider, retryKey]);

  const lines = useMemo<LyricLine[]>(() => {
    if (!record) return [];
    if (typeof record.syncedLyrics === 'string' && record.syncedLyrics.trim()) return parseLrc(record.syncedLyrics);
    if (Array.isArray(record.lyrics)) return record.lyrics.map(line => { const rawTime = line.time ?? line.startTime ?? line.start_time ?? null; return { time: rawTime === null ? null : Number(rawTime) > 1000 ? Number(rawTime) / 1000 : Number(rawTime), text: String(line.text || '') }; }).filter(line => line.text);
    const plain = record.plainLyrics || (typeof record.lyrics === 'string' ? record.lyrics : '');
    return plain.split(/\r?\n/).map(text => ({ time: null, text: text.trim() })).filter(line => line.text);
  }, [record]);

  const currentLine = lines.reduce((active, line, index) => line.time !== null && line.time <= time ? index : active, -1);

  useEffect(() => {
    if (!onAmbientLyricChange) return;
    const text = status === 'ready' && currentLine >= 0 && lines[currentLine]?.time !== null ? lines[currentLine].text : '';
    onAmbientLyricChange(text);
  }, [status, currentLine, lines, onAmbientLyricChange]);

  useEffect(() => {
    if (manualScroll.current || !activeLine.current) return;
    activeLine.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentLine]);

  const onLyricsScroll = () => {
    manualScroll.current = true;
    window.clearTimeout(resumeTimer.current);
    resumeTimer.current = window.setTimeout(() => { manualScroll.current = false; }, 1800);
  };

  return <section className="lyrics-panel" aria-label="Song lyrics">
    <div className="lyrics-heading"><div><small>FOLLOW ALONG</small><h2>Lyrics</h2></div><span>{provider === 'lrclib' ? 'LRCLIB' : 'YouTube Music'}</span></div>
    {status === 'loading' && <div className="lyrics-state" role="status">Finding lyrics for this track…</div>}
    {status === 'error' && <div className="lyrics-state"><p>Lyrics could not be loaded.</p><button className="lyrics-retry" onClick={() => setRetryKey(value => value + 1)}>Try again</button></div>}
    {status === 'empty' && <div className="lyrics-state">{record?.instrumental ? 'This track is marked as instrumental.' : 'No lyrics found for this track.'}</div>}
    {status === 'ready' && <div ref={linesViewport} className="lyrics-lines" onScroll={onLyricsScroll}>
      {lines.map((line, index) => {
        const seekable = line.time !== null;
        return <div key={index} ref={index === currentLine ? activeLine : null} className={'lyrics-line' + (index === currentLine ? ' is-current' : '') + (seekable ? ' is-seekable' : '')}
          onClick={() => { if (line.time !== null) onSeek?.(line.time); }}
          onKeyDown={event => { if (seekable && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onSeek?.(line.time!); } }}
          role={seekable ? 'button' : undefined} tabIndex={seekable ? 0 : undefined}>
          <span className="lyrics-line-text">{line.text}</span>
        </div>;
      })}
    </div>}
    <p className="lyrics-credit">Lyrics provided by {provider === 'lrclib' ? 'LRCLIB' : 'YouTube Music'}.</p>
  </section>;
}


function AppDownloads() {
  const [showAndroidNotice, setShowAndroidNotice] = useState(false);
  return <section className="app-downloads">
    <div className="app-download-hero">
      <div className="app-hero-copy">
        <span className="app-kicker"><i /> THE VALOTUNE DESKTOP & MOBILE EXPERIENCE</span>
        <h1 className="app-hero-title">Your music.<br /><em>Beyond the browser.</em></h1>
        <p className="app-hero-sub">A home for ValoTune on every screen. Get closer to your music with an experience made for your device.</p>
      </div>
      <div className="app-hero-orbit" aria-hidden="true">
        <div className="app-orbit-ring app-orbit-ring-one" />
        <div className="app-orbit-ring app-orbit-ring-two" />
        <div className="app-orbit-disc app-orbit-bloub"><img src="/valotune-icon.svg" alt="" /></div>
        <div className="app-orbit-caption">PLAY IT YOUR WAY</div>
      </div>
    </div>

    <div className="app-section-heading">
      <div><span className="app-kicker">PICK YOUR PLATFORM</span><h2>Find your ValoTune.</h2></div>
      <span className="app-section-note">One sound. Every device.</span>
    </div>

    <div className="download-grid">
      <article className="download-card download-card-featured">
        <div className="download-card-top"><span className="download-platform">ANDROID</span><span className="download-status"><i /> AVAILABLE NOW</span></div>
        <div className="download-icon download-icon-android"><img src="/platform-icons/android.svg" alt="" /></div>
        <h3>ValoTune for Android</h3>
        <p>Take your listening experience with you. Install ValoTune directly on your Android device.</p>
        <button className="download-action" type="button" onClick={() => setShowAndroidNotice(true)}>Get the Android APK <span>↗</span></button>
        <small className="download-note">Current build: debug APK · Download the latest successful workflow artifact.</small>
        <span className="download-featured-watermark" aria-hidden="true">01</span>
      </article>

      <article className="download-card download-card-soon">
        <div className="download-card-top"><span className="download-platform">LINUX</span><span className="download-status download-status-soon">IN DEVELOPMENT</span></div>
        <div className="download-icon download-icon-linux"><img src="/platform-icons/linux.svg" alt="" /></div>
        <h3>ValoTune for Linux</h3>
        <p>A portable desktop app for your Linux setup. No complicated installation process.</p>
        <div className="download-soon" aria-disabled="true">AppImage <span>COMING SOON</span></div>
        <small className="download-note">A portable Linux build is in development.</small>
        <span className="download-featured-watermark" aria-hidden="true">02</span>
      </article>

      <article className="download-card download-card-soon">
        <div className="download-card-top"><span className="download-platform">WINDOWS</span><span className="download-status download-status-soon">IN DEVELOPMENT</span></div>
        <div className="download-icon download-icon-windows"><img src="/platform-icons/windows.svg" alt="" /></div>
        <h3>ValoTune for Windows</h3>
        <p>A dedicated Windows desktop experience, ready to live alongside your everyday apps.</p>
        <div className="download-soon" aria-disabled="true">EXE installer <span>COMING SOON</span></div>
        <small className="download-note">A packaged and signed installer is not available yet.</small>
        <span className="download-featured-watermark" aria-hidden="true">03</span>
      </article>
    </div>
    <div className="app-download-footer"><img className="app-footer-mark" src="/valotune-icon.svg" alt="" /><p>Made for the way you listen.<br /><strong>ValoTune, wherever you are.</strong></p><span className="app-footer-equalizer"><i /><i /><i /><i /><i /></span></div>
    {showAndroidNotice && <div className="android-notice-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAndroidNotice(false); }}>
      <section className="android-notice" role="dialog" aria-modal="true" aria-labelledby="android-notice-title">
        <button className="android-notice-close" type="button" aria-label="Close" onClick={() => setShowAndroidNotice(false)}>×</button>
        <span className="android-notice-kicker">BEFORE YOU INSTALL</span>
        <h2 id="android-notice-title">A quick note about Android installation</h2>
        <p>After you download <strong>valotune.apk</strong>, Android may show a Google Play Protect warning because the app was downloaded outside the Play Store.</p>
        <p>If the APK came from ValoTune’s official download link, review the warning and app details, then choose <strong>Continue installing</strong> if you want to proceed. Don’t install APKs from unknown sources.</p>
        <small className="android-notice-assurance">Built with Capacitor.js — ValoTune’s web experience packaged for Android.</small>
        <a className="android-notice-continue" href="https://github.com/Snapix/ValoTune/releases/tag/Native_app" target="_blank" rel="noreferrer" onClick={() => setShowAndroidNotice(false)}>Continue to APK download <span>↗</span></a>
      </section>
    </div>}
  </section>;
}
