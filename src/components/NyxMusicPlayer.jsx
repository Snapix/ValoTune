import { useState } from "react";
import "./NyxMusicPlayer.css";

export default function NyxMusicPlayer({track,queue=[],playing,currentTime=0,duration=0,volume=70,liked,onLike,onPlayPause,onNext,onPrevious,onSeek,onVolume,onSelect,onShare}) {
  const [expanded,setExpanded]=useState(false);
  const [showQueue,setShowQueue]=useState(false);
  const progress=duration>0?Math.min(100,(currentTime/duration)*100):0;
  return <section className={`nyx-player ${expanded?"is-expanded":"is-collapsed"}`} aria-label="Music player">
    {expanded ? <div className="nyx-expanded">
      <div className="nyx-ambient" style={{backgroundImage:track.thumbnail?`url("${track.thumbnail}")`:"none"}}/>
      <header className="nyx-header"><button onClick={()=>setExpanded(false)} aria-label="Collapse player">⌄</button><span>NOW PLAYING</span><button onClick={()=>setShowQueue(v=>!v)} aria-label="Toggle queue">•••</button></header>
      <div className="nyx-cover">{track.thumbnail?<img src={track.thumbnail} alt="" />:<span>♫</span>}</div>
      <div className="nyx-trackline"><div className="nyx-tracktext"><strong>{track.title}</strong><span>{track.artist}{track.album? ` · ${track.album}`:""}</span></div><button className={liked?"liked":""} onClick={onLike} aria-label={liked?"Unlike track":"Like track"}>{liked?"♥":"♡"}</button></div>
      <div className="nyx-seek"><input type="range" min="0" max={Math.max(1,duration)} value={Math.min(currentTime,duration||1)} onChange={e=>onSeek(Number(e.target.value))} aria-label="Seek track"/><div><span>{format(currentTime)}</span><span>{format(duration)}</span></div></div>
      <div className="nyx-transport"><button onClick={()=>{}} aria-label="Shuffle" title="Shuffle">⤨</button><button onClick={onPrevious} aria-label="Previous track">|◀</button><button className="nyx-play" onClick={onPlayPause} aria-label={playing?"Pause":"Play"}>{playing?"Ⅱ":"▶"}</button><button onClick={onNext} aria-label="Next track">▶|</button><button onClick={()=>{}} aria-label="Repeat" title="Repeat">↻</button></div>
      <div className="nyx-volume"><span>◖</span><input type="range" min="0" max="100" value={volume} onChange={e=>onVolume(Number(e.target.value))} aria-label="Volume"/><span>◖))</span></div>
      <div className="nyx-utilities"><button onClick={()=>setShowQueue(v=>!v)}>☷<small>Queue</small></button><button onClick={()=>{}}>≋<small>Lyrics</small></button><button onClick={onShare}>↗<small>Share</small></button></div>
      {showQueue&&<div className="nyx-queue"><strong>Up next</strong>{queue.slice(0,8).map((song,i)=><button key={(song.videoId||song.id||song.title)+i} onClick={()=>onSelect(song)}><img src={song.thumbnail||""} alt=""/><span><b>{song.title}</b><small>{song.artist}</small></span>{(song.videoId||song.id)===(track.videoId||track.id)?"♫":"▶"}</button>)}</div>}
    </div> : <button className="nyx-pill" onClick={()=>setExpanded(true)} aria-label="Expand music player"><span className="nyx-pill-cover">{track.thumbnail?<img src={track.thumbnail} alt=""/>:"♫"}</span><span className="nyx-pill-meta"><strong>{track.title}</strong><small>{track.artist}</small></span><span className="nyx-pill-progress"><i style={{width:`${progress}%`}}/></span><span className="nyx-pill-actions"><span role="button" tabIndex="0" onClick={e=>{e.stopPropagation();onLike()}}>{liked?"♥":"♡"}</span><span role="button" tabIndex="0" onClick={e=>{e.stopPropagation();onPlayPause()}}>{playing?"Ⅱ":"▶"}</span></span></button>}
  </section>;
}
function format(n){n=Math.max(0,Math.floor(Number(n)||0));return `${Math.floor(n/60)}:${String(n%60).padStart(2,"0")}`;}
