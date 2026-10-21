import { useCallback, useEffect, useRef, useState } from 'react';
import type { Song } from './types';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
const loadApi = () => {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>(resolve => {
    if (window.YT?.Player) return resolve();
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return apiPromise;
};

export function usePlayer(initialVolume: number, autoplay: boolean, onPlayed: (s: Song) => void) {
  const host = useRef<HTMLDivElement>(null);
  const yt = useRef<any>(null);
  const ready = useRef(false);
  const pending = useRef<string | null>(null);
  const queueRef = useRef<Song[]>([]);
  const indexRef = useRef(-1);
  const autoRef = useRef(autoplay);
  const playedRef = useRef(onPlayed);
  autoRef.current = autoplay;
  playedRef.current = onPlayed;

  const [current, setCurrent] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(initialVolume);
  const volRef = useRef(initialVolume);

  const load = useCallback((song: Song) => {
    setCurrent(song);
    setTime(0);
    setDuration(song.duration || 0);
    playedRef.current(song);
    if (ready.current) yt.current.loadVideoById(song.videoId);
    else pending.current = song.videoId;
  }, []);

  const play = useCallback((song: Song, list?: Song[]) => {
    const l = list && list.length ? list : [song];
    queueRef.current = l;
    setQueue(l);
    indexRef.current = Math.max(0, l.findIndex(s => s.videoId === song.videoId));
    load(song);
  }, [load]);

  const step = useCallback((dir: 1 | -1) => {
    const q = queueRef.current;
    if (!q.length) return;
    if (dir === -1 && yt.current && ready.current && yt.current.getCurrentTime() > 4) {
      yt.current.seekTo(0, true);
      return;
    }
    let i = indexRef.current + dir;
    if (i >= q.length) i = 0;
    if (i < 0) i = q.length - 1;
    indexRef.current = i;
    load(q[i]);
  }, [load]);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    let dead = false;
    loadApi().then(() => {
      if (dead || !host.current) return;
      yt.current = new window.YT.Player(host.current, {
        height: '220', width: '220',
        playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0 },
        events: {
          onReady: () => {
            ready.current = true;
            yt.current.setVolume(volRef.current);
            if (pending.current) {
              yt.current.loadVideoById(pending.current);
              pending.current = null;
            }
          },
          onStateChange: (e: any) => {
            const S = window.YT.PlayerState;
            setPlaying(e.data === S.PLAYING || e.data === S.BUFFERING);
            if (e.data === S.PLAYING) setDuration(yt.current.getDuration() || 0);
            if (e.data === S.ENDED) {
              if (autoRef.current) stepRef.current(1);
              else setPlaying(false);
            }
          },
          onError: () => stepRef.current(1)
        }
      });
    });
    const t = setInterval(() => {
      if (ready.current && yt.current?.getCurrentTime) setTime(yt.current.getCurrentTime() || 0);
    }, 500);
    return () => {
      dead = true;
      clearInterval(t);
      try { yt.current?.destroy(); } catch { /* ignore */ }
    };
  }, []);

  const toggle = useCallback(() => {
    if (!ready.current) return;
    const S = window.YT.PlayerState;
    yt.current.getPlayerState() === S.PLAYING ? yt.current.pauseVideo() : yt.current.playVideo();
  }, []);
  const seek = useCallback((t: number) => {
    if (!ready.current) return;
    yt.current.seekTo(t, true);
    setTime(t);
  }, []);
  const setVolume = useCallback((v: number) => {
    volRef.current = v;
    setVolumeState(v);
    if (ready.current) yt.current.setVolume(v);
  }, []);

  return { host, current, queue, playing, time, duration, volume, play, toggle, seek, setVolume, next: () => step(1), prev: () => step(-1) };
}
