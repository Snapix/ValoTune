import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./NyxMusicPlayer.css";
import ElasticSlider from "./ElasticSlider";

const SEEK_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];

export default function NyxMusicPlayer({
  track, queue = [], playing, currentTime = 0, duration = 0, volume = 70, liked,
  shuffle = false, repeat = false, onToggleShuffle, onToggleRepeat,
  onLike, onPlayPause, onNext, onPrevious, onSeek, onVolume, onSelect, onShare
}) {
  const [expanded, setExpanded] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [draftTime, setDraftTime] = useState(null);
  const [seeking, setSeeking] = useState(false);
  const draftRef = useRef(null);
  const maxTime = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const safeTime = Number.isFinite(currentTime) ? Math.max(0, Math.min(currentTime, maxTime || currentTime)) : 0;
  const shownTime = seeking && draftTime !== null ? draftTime : safeTime;
  const progress = maxTime > 0 ? Math.min(100, Math.max(0, (shownTime / maxTime) * 100)) : 0;

  useEffect(() => {
    draftRef.current = null;
    setDraftTime(null);
    setSeeking(false);
  }, [track?.videoId, track?.id]);

  if (!track) return null;

  const trackId = track.videoId || track.id;

  const beginSeek = () => {
    if (!maxTime) return;
    draftRef.current = safeTime;
    setSeeking(true);
    setDraftTime(safeTime);
  };
  const previewSeek = (event) => {
    const value = Math.max(0, Math.min(maxTime, Number(event.currentTarget.value) || 0));
    draftRef.current = value;
    setSeeking(true);
    setDraftTime(value);
  };
  const commitSeek = () => {
    const value = draftRef.current;
    draftRef.current = null;
    if (value !== null && maxTime > 0) onSeek?.(Math.max(0, Math.min(maxTime, value)));
    setSeeking(false);
    setDraftTime(null);
  };
  const cancelSeek = () => {
    draftRef.current = null;
    setSeeking(false);
    setDraftTime(null);
  };

  const expandedView = <div className="nyx-expanded">
    <div className="nyx-ambient" style={{ backgroundImage: track.thumbnail ? `url("${track.thumbnail}")` : "none" }} />
    <header className="nyx-header">
      <button type="button" onClick={() => setExpanded(false)} aria-label="Collapse player">⌄</button>
      <span>NOW PLAYING</span>
      <button type="button" onClick={() => setShowQueue(v => !v)} aria-label={showQueue ? "Hide queue" : "Show queue"} aria-expanded={showQueue}>•••</button>
    </header>
    <div className="nyx-cover">{track.thumbnail ? <img src={track.thumbnail} alt="" /> : <span>♫</span>}</div>
    <div className="nyx-trackline">
      <div className="nyx-tracktext"><strong title={track.title}>{track.title || "Unknown track"}</strong><span>{track.artist || "Unknown artist"}{track.album ? ` · ${track.album}` : ""}</span></div>
      <button type="button" className={liked ? "liked" : ""} onClick={onLike} aria-label={liked ? "Unlike track" : "Like track"}>{liked ? "♥" : "♡"}</button>
    </div>
    <div className={`nyx-seek ${seeking ? "is-seeking" : ""}`}>
      <input
        type="range" min="0" max={maxTime || 1} step="0.1"
        value={Math.min(shownTime, maxTime || 1)} disabled={!maxTime}
        style={{ "--seek-progress": `${maxTime > 0 ? (shownTime / maxTime) * 100 : 0}%` }}
        onPointerDown={beginSeek} onChange={previewSeek} onPointerUp={commitSeek}
        onPointerCancel={cancelSeek} onLostPointerCapture={commitSeek}
        onKeyDown={event => { if (draftRef.current === null && SEEK_KEYS.includes(event.key)) beginSeek(); }}
        onKeyUp={event => { if (SEEK_KEYS.includes(event.key)) commitSeek(); }}
        onBlur={() => { if (draftRef.current !== null) commitSeek(); }}
        aria-label="Seek track" aria-valuetext={`${format(shownTime)} of ${format(maxTime)}`}
      />
      <div><span>{format(shownTime)}</span><span>{format(maxTime)}</span></div>
    </div>
    <div className="nyx-transport">
      <button type="button" className={shuffle ? "is-active" : ""} onClick={onToggleShuffle} aria-label={shuffle ? "Disable shuffle" : "Enable shuffle"} aria-pressed={shuffle} title="Shuffle">⤨</button>
      <button type="button" onClick={onPrevious} aria-label="Previous track">|◀</button>
      <button type="button" className="nyx-play" onClick={onPlayPause} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
      <button type="button" onClick={onNext} aria-label="Next track">▶|</button>
      <button type="button" className={repeat ? "is-active" : ""} onClick={onToggleRepeat} aria-label={repeat ? "Disable repeat" : "Enable repeat"} aria-pressed={repeat} title="Repeat">↻</button>
    </div>
    <div className="nyx-volume"><ElasticSlider value={volume} startingValue={0} maxValue={100} onChange={onVolume} ariaLabel="Volume" maxStretch={28} bounce={0.25} growOnHover wheel={false} orientation="horizontal" iconPlacement="outside" valuePosition="none" thickness={5} activeThickness={7} radius={40} restOpacity={0.9} fillFrom={0} isStepped={false} stepSize={1} ticks={false} thumb={true} jumpToClick style={{ width: "100%" }} /></div>
    <div className="nyx-utilities">
      <button type="button" onClick={() => setShowQueue(v => !v)} aria-expanded={showQueue}>☷<small>Queue</small></button>
      <button type="button" onClick={onShare}>↗<small>Share</small></button>
    </div>
    {showQueue && <div className="nyx-queue"><strong>Up next</strong>{queue.length ? queue.slice(0, 8).map((song, i) => {
      const id = song.videoId || song.id;
      const current = id !== undefined && id === trackId;
      return <button type="button" key={(id || song.title) + "-" + i} className={current ? "is-current" : ""} onClick={() => onSelect?.(song)}><img src={song.thumbnail || ""} alt="" /><span><b>{song.title}</b><small>{song.artist}</small></span>{current ? "♫" : "▶"}</button>;
    }) : <p className="nyx-queue-empty">No queued tracks available.</p>}</div>}
  </div>;

  return <section className={`nyx-player ${expanded ? "is-expanded" : "is-collapsed"}`} aria-label="Music player">
    {expanded
      ? (typeof document !== "undefined" ? createPortal(expandedView, document.body) : null)
      : <div className="nyx-pill">
        <button type="button" className="nyx-pill-main" onClick={() => setExpanded(true)} aria-label={`Expand player: ${track.title || "now playing"}`}>
          <span className="nyx-pill-cover">{track.thumbnail ? <img src={track.thumbnail} alt="" /> : "♫"}</span>
          <span className="nyx-pill-meta"><strong>{track.title || "Unknown track"}</strong><small>{track.artist || "Unknown artist"}</small></span>
        </button>
        <div className="nyx-pill-actions">
          <button type="button" onClick={onLike} aria-label={liked ? "Unlike track" : "Like track"}>{liked ? "♥" : "♡"}</button>
          <button type="button" onClick={onPlayPause} aria-label={playing ? "Pause" : "Play"}>{playing ? "Ⅱ" : "▶"}</button>
        </div>
        <div className="nyx-pill-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></div>
      </div>}
  </section>;
}

function format(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
