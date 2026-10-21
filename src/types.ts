export interface Song {
  videoId: string;
  name: string;
  artist: string;
  thumb: string;
  duration: number;
}
export interface Section { title: string; songs: Song[] }
export interface Artist { name: string; thumb: string }
export interface Settings { accent: string; volume: number; autoplay: boolean }
export const fmt = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};
