import { useCallback, useEffect, useRef, useState } from 'react';
import type { Song } from './types';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Playback requires a browser.'));
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    const timer = window.setTimeout(() => {
      apiPromise = null;
      reject(new Error('YouTube player failed to load.'));
    }, 15000);
    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timer);
      previous?.();
      resolve();
    };
    let script = document.querySelector<HTMLScriptElement>('script[data-youtube-iframe-api]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.youtubeIframeApi = 'true';
      script.onerror = () => {
        window.clearTimeout(timer);
        apiPromise = null;
        reject(new Error('Unable to load YouTube playback.'));
      };
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

export function usePlayer(initialVolume: number, autoplay: boolean, onPlayed: (song: Song) => void) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const ready = useRef(false);
  const pending = useRef<Song | null>(null);
  const queueRef = useRef<Song[]>([]);
  const indexRef = useRef(0);
  const autoplayRef = useRef(autoplay);
  const playedRef = useRef(onPlayed);
  const volumeRef = useRef(initialVolume);
  const [current, setCurrent] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(initialVolume);
  autoplayRef.current = autoplay;
  playedRef.current = onPlayed;

  const load = useCallback((song: Song) => {
    if (!song?.videoId) return;
    setCurrent(song);
    setTime(0);
    setDuration(song.duration || 0);
    playedRef.current(song);
    if (ready.current && player.current) player.current.loadVideoById(song.videoId);
    else pending.current = song;
  }, []);

  const play = useCallback((song: Song, list?: Song[]) => {
    const valid = (list?.length ? list : [song]).filter(item => item?.videoId);
    if (!valid.length) return;
    queueRef.current = valid;
    setQueue(valid);
    indexRef.current = Math.max(0, valid.findIndex(item => item.videoId === song.videoId));
    load(valid[indexRef.current] || song);
  }, [load]);

  const step = useCallback((direction: 1 | -1) => {
    const list = queueRef.current;
    if (!list.length) return;
    if (direction === -1 && ready.current && player.current && player.current.getCurrentTime() > 4) {
      player.current.seekTo(0, true);
      return;
    }
    indexRef.current = (indexRef.current + direction + list.length) % list.length;
    load(list[indexRef.current]);
  }, [load]);
  const stepRef = useRef(step);
  stepRef.current = step;

  useEffect(() => {
    let cancelled = false;
    const interval = window.setInterval(() => {
      if (!ready.current || !player.current) return;
      try {
        const t = player.current.getCurrentTime();
        const d = player.current.getDuration();
        if (Number.isFinite(t)) setTime(t);
        if (Number.isFinite(d) && d > 0) setDuration(d);
      } catch { /* player may still be initializing */ }
    }, 500);

    loadYouTubeApi().then(() => {
      if (cancelled || !host.current || !window.YT?.Player) return;
      player.current = new window.YT.Player(host.current, {
        width: '200', height: '200',
        playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: (event: any) => {
            if (cancelled) { event.target.destroy(); return; }
            player.current = event.target;
            ready.current = true;
            event.target.setVolume(volumeRef.current);
            if (pending.current) {
              const song = pending.current;
              pending.current = null;
              event.target.loadVideoById(song.videoId);
            }
          },
          onStateChange: (event: any) => {
            const states = window.YT?.PlayerState;
            setPlaying(event.data === states?.PLAYING || event.data === states?.BUFFERING);
            if (event.data === states?.PLAYING) {
              const d = event.target.getDuration();
              if (Number.isFinite(d)) setDuration(d);
            }
            if (event.data === states?.ENDED) {
              if (autoplayRef.current) stepRef.current(1);
              else setPlaying(false);
            }
          },
          onError: () => { setPlaying(false); if (queueRef.current.length > 1) stepRef.current(1); }
        }
      });
    }).catch(error => console.warn(error.message));
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      ready.current = false;
      try { player.current?.destroy(); } catch { /* ignore teardown errors */ }
      player.current = null;
    };
  }, []);

  useEffect(() => {
    volumeRef.current = Math.max(0, Math.min(100, initialVolume));
    setVolumeState(volumeRef.current);
    if (ready.current) player.current?.setVolume(volumeRef.current);
  }, [initialVolume]);

  const toggle = useCallback(() => {
    if (!ready.current || !player.current) return;
    const state = player.current.getPlayerState();
    if (state === window.YT?.PlayerState?.PLAYING || state === window.YT?.PlayerState?.BUFFERING) player.current.pauseVideo();
    else player.current.playVideo();
  }, []);
  const seek = useCallback((seconds: number) => {
    if (!ready.current || !player.current || !Number.isFinite(seconds)) return;
    const target = Math.max(0, Math.min(duration || seconds, seconds));
    player.current.seekTo(target, true);
    setTime(target);
  }, [duration]);
  const setVolume = useCallback((next: number) => {
    const safe = Math.max(0, Math.min(100, Number(next) || 0));
    volumeRef.current = safe;
    setVolumeState(safe);
    if (ready.current) player.current?.setVolume(safe);
  }, []);

  return { host, current, queue, playing, time, duration, volume, play, toggle, seek, setVolume, next: () => step(1), prev: () => step(-1) };
}
