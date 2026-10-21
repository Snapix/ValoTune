import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import GooeyNav from './components/GooeyNav';
import ElasticSlider from './components/ElasticSlider';
import { usePlayer } from './player';
import { useLocal } from './store';
import { fmt, type Artist, type Section, type Settings, type Song } from './types';

const ACCENTS = ['#8b5cf6', '#ec4899', '#22d3ee', '#34d399', '#f59e0b', '#f43f5e'];
const GENRES = ['Pop', 'Hip hop', 'Lofi', 'Rock', 'Bollywood', 'Tamil hits', 'Electronic', 'Jazz', 'Classical', 'K-pop', 'Indie', 'Romance'];
const TABS = ['Home', 'Discover', 'Library', 'Settings'];

const I = {
  play: <path d="M8 5v14l11-7z" fill="currentColor" />,
  pause: <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />,
  next: <path d="M6 5l9 7-9 7zM17 5h2v14h-2z" fill="currentColor" />,
  prev: <path d="M18 5l-9 7 9 7zM5 5h2v14H5z" fill="currentColor" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  search: <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4-4" />,
  music: <path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
};
const Icon = ({ d, size = 20, fill = false }: { d: ReactNode; size?: number; fill?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
const api = async <T,>(url: string): Promise<T> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
};

export default function App() {
  const [tab, setTab] = useState(0);
  const [settings, setSettings] = useLocal<Settings>('vt:settings', { accent: ACCENTS[0], volume: 70, autoplay: true });
  const [liked, setLiked] = useLocal<Song[]>('vt:liked', []);
  const [recent, setRecent] = useLocal<Song[]>('vt:recent', []);
  const onPlayed = useCallback((s: Song) => setRecent(r => [s, ...r.filter(x => x.videoId !== s.videoId)].slice(0, 40)), [setRecent]);
  const p = usePlayer(settings.volume, settings.autoplay, onPlayed);
  const likedIds = useMemo(() => new Set(liked.map(s => s.videoId)), [liked]);
  const toggleLike = (s: Song) => setLiked(l => (l.some(x => x.videoId === s.videoId) ? l.filter(x => x.videoId !== s.videoId) : [s, ...l]));
  useEffect(() => { document.documentElement.style.setProperty('--accent', settings.accent); }, [settings.accent]);
  const navItems = useMemo(() => TABS.map(label => ({ label })), []);
  const view = { play: p.play, liked: likedIds, toggleLike, currentId: p.current?.videoId, playing: p.playing };

  return <div className="app">
    <header className="top"><div className="brand"><span className="logo"><Icon d={I.music} size={18} /></span><span>Valotune</span></div><GooeyNav items={navItems} activeIndex={tab} onChange={i => setTab(i)} color={settings.accent} size="md" /><div className="top-spacer" /></header>
    <main className="content">{tab === 0 && <Home {...view} />}{tab === 1 && <Discover {...view} />}{tab === 2 && <Library {...view} liked_list={liked} recent={recent} />}{tab === 3 && <SettingsView settings={settings} setSettings={s => { setSettings(s); if (s.volume !== settings.volume) p.setVolume(s.volume); }} clear={() => { setLiked([]); setRecent([]); }} />}</main>
    <div className="yt-host" aria-hidden="true"><div ref={p.host} /></div>
    <footer className="player">{p.current ? <>
      <div className="np"><img src={p.current.thumb} alt="" /><div className="np-text"><b>{p.current.name}</b><span>{p.current.artist}</span></div><button className={`icon-btn ${likedIds.has(p.current.videoId) ? 'on' : ''}`} onClick={() => toggleLike(p.current!)} aria-label="Like"><Icon d={I.heart} fill={likedIds.has(p.current.videoId)} /></button></div>
      <div className="controls"><div className="buttons"><button className="icon-btn" onClick={p.prev} aria-label="Previous"><Icon d={I.prev} fill /></button><button className="play-btn" onClick={p.toggle} aria-label={p.playing ? 'Pause' : 'Play'}><Icon d={p.playing ? I.pause : I.play} size={22} fill /></button><button className="icon-btn" onClick={p.next} aria-label="Next"><Icon d={I.next} fill /></button></div><Seek time={p.time} duration={p.duration} seek={p.seek} /></div>
      <div className="vol"><ElasticSlider value={p.volume} onChange={v => { p.setVolume(v); setSettings(s => ({ ...s, volume: v })); }} valuePosition="none" maxStretch={24} ariaLabel="Volume" /></div>
    </> : <div className="np-empty">Pick a song to start listening</div>}</footer>
  </div>;
}

function Seek({ time, duration, seek }: { time: number; duration: number; seek: (t: number) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const max = Math.max(1, duration);
  return <div className="seek"><span>{fmt(drag ?? time)}</span><ElasticSlider value={Math.min(drag ?? time, max)} startingValue={0} maxValue={max} leftIcon={null} rightIcon={null} valuePosition="none" restOpacity={1} maxStretch={18} style={{ width: '100%' }} ariaLabel="Seek" formatValue={fmt} onChange={v => setDrag(v)} onChangeEnd={v => { seek(v); setDrag(null); }} /><span>{fmt(duration)}</span></div>;
}
interface ViewProps { play: (s: Song, l?: Song[]) => void; liked: Set<string>; toggleLike: (s: Song) => void; currentId?: string; playing: boolean; }
function Row({ s, list, v, i }: { s: Song; list: Song[]; v: ViewProps; i?: number }) {
  const on = v.currentId === s.videoId;
  return <div className={`row ${on ? 'on' : ''}`} onDoubleClick={() => v.play(s, list)}><button className="row-play" onClick={() => v.play(s, list)} aria-label={`Play ${s.name}`}><img src={s.thumb} alt="" loading="lazy" /><span className="row-ov"><Icon d={on && v.playing ? I.pause : I.play} fill /></span></button><div className="row-text"><b>{i !== undefined ? `${i + 1}. ` : ''}{s.name}</b><span>{s.artist}</span></div><span className="row-dur">{s.duration ? fmt(s.duration) : ''}</span><button className={`icon-btn ${v.liked.has(s.videoId) ? 'on' : ''}`} onClick={() => v.toggleLike(s)} aria-label="Like"><Icon d={I.heart} size={18} fill={v.liked.has(s.videoId)} /></button></div>;
}
function Card({ s, list, v }: { s: Song; list: Song[]; v: ViewProps }) {
  const on = v.currentId === s.videoId;
  return <button className={`card ${on ? 'on' : ''}`} onClick={() => v.play(s, list)}><div className="card-art"><img src={s.thumb} alt="" loading="lazy" /><span className="card-play"><Icon d={on && v.playing ? I.pause : I.play} fill /></span></div><b>{s.name}</b><span>{s.artist}</span></button>;
}
const Empty = ({ text }: { text: string }) => <div className="empty">{text}</div>;

function Home(v: ViewProps) {
  const [data, setData] = useState<Section[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api<Section[]>('/api/home').then(setData).catch(e => setErr(e.message)); }, []);
  const hour = new Date().getHours();
  const hi = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return <section><h1 className="hero">{hi}</h1><p className="sub">Fresh picks for you on Valotune.</p>{err && <Empty text={`Couldn't load music: ${err}. Is the server running?`} />}{!data && !err && <div className="skeleton-row">{Array.from({ length: 6 }, (_, i) => <div key={i} className="sk" />)}</div>}{data?.map(sec => <div key={sec.title} className="shelf"><h2>{sec.title}</h2><div className="scroller">{sec.songs.map(s => <Card key={s.videoId} s={s} list={sec.songs} v={v} />)}</div></div>)}</section>;
}

function Discover(v: ViewProps) {
  const [q, setQ] = useState('');
  const [sugg, setSugg] = useState<string[]>([]);
  const [res, setRes] = useState<{ songs: Song[]; artists: Artist[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const timer = useRef<number>();
  const run = async (term: string) => {
    const t = term.trim(); if (!t) return;
    setQ(t); setSugg([]); setBusy(true); setErr('');
    try { setRes(await api(`/api/search?q=${encodeURIComponent(t)}`)); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const onType = (val: string) => {
    setQ(val); window.clearTimeout(timer.current); if (!val.trim()) return setSugg([]);
    timer.current = window.setTimeout(() => { api<string[]>(`/api/suggest?q=${encodeURIComponent(val)}`).then(setSugg).catch(() => setSugg([])); }, 250);
  };
  return <section><h1 className="hero">Discover</h1><form className="search" onSubmit={e => { e.preventDefault(); run(q); }}><Icon d={I.search} /><input value={q} onChange={e => onType(e.target.value)} placeholder="Search songs, artists…" aria-label="Search" />{sugg.length > 0 && <ul className="sugg">{sugg.slice(0, 7).map(s => <li key={s}><button type="button" onClick={() => run(s)}>{s}</button></li>)}</ul>}</form>
    {!res && !busy && <><h2>Browse genres</h2><div className="chips">{GENRES.map((g, i) => <button key={g} className="chip" style={{ ['--h' as any]: (i * 37) % 360 }} onClick={() => run(g + ' songs')}>{g}</button>)}</div></>}{busy && <Empty text="Searching…" />}{err && <Empty text={err} />}{res && !busy && <>{res.artists.length > 0 && <div className="shelf"><h2>Artists</h2><div className="scroller">{res.artists.map(a => <button key={a.name} className="artist" onClick={() => run(a.name)}><img src={a.thumb} alt="" /><span>{a.name}</span></button>)}</div></div>}<h2>Songs</h2>{res.songs.length === 0 && <Empty text="No songs found." />}<div className="list">{res.songs.map(s => <Row key={s.videoId} s={s} list={res.songs} v={v} />)}</div></>}</section>;
}

function Library({ liked_list, recent, ...v }: ViewProps & { liked_list: Song[]; recent: Song[] }) {
  const [t, setT] = useState<'liked' | 'recent'>('liked');
  const list = t === 'liked' ? liked_list : recent;
  return <section><h1 className="hero">Library</h1><div className="seg"><button className={t === 'liked' ? 'on' : ''} onClick={() => setT('liked')}>Liked ({liked_list.length})</button><button className={t === 'recent' ? 'on' : ''} onClick={() => setT('recent')}>Recently played ({recent.length})</button></div>{list.length === 0 ? <Empty text={t === 'liked' ? 'Tap the heart on any song to save it here.' : 'Songs you play will show up here.'} /> : <><button className="btn" onClick={() => v.play(list[0], list)}><Icon d={I.play} size={16} fill /> Play all</button><div className="list">{list.map((s, i) => <Row key={s.videoId} s={s} list={list} v={v} i={i} />)}</div></>}</section>;
}

function SettingsView({ settings, setSettings, clear }: { settings: Settings; setSettings: (s: Settings) => void; clear: () => void }) {
  return <section className="settings"><h1 className="hero">Settings</h1><div className="panel"><div><b>Accent color</b><span>Changes the highlight across Valotune.</span></div><div className="swatches">{ACCENTS.map(c => <button key={c} className={settings.accent === c ? 'on' : ''} style={{ background: c }} onClick={() => setSettings({ ...settings, accent: c })} aria-label={`Accent ${c}`} />)}</div></div><div className="panel"><div><b>Default volume</b><span>{settings.volume}%</span></div><div className="panel-slider"><ElasticSlider value={settings.volume} onChange={v => setSettings({ ...settings, volume: v })} valuePosition="none" ariaLabel="Default volume" /></div></div><div className="panel"><div><b>Autoplay next</b><span>Keep playing the queue when a song ends.</span></div><button className={`toggle ${settings.autoplay ? 'on' : ''}`} onClick={() => setSettings({ ...settings, autoplay: !settings.autoplay })} role="switch" aria-checked={settings.autoplay} aria-label="Autoplay"><i /></button></div><div className="panel"><div><b>Clear library</b><span>Removes liked songs and listening history from this browser.</span></div><button className="btn ghost" onClick={() => { if (confirm('Clear liked songs and history?')) clear(); }}>Clear</button></div><p className="about">Valotune · music data via YouTube Music (unofficial). For personal use.</p></section>;
}
