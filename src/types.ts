export interface Song {
  videoId: string;
  name: string;
  artist: string;
  thumb: string;
  duration: number;
}

export interface Section {
  title: string;
  songs: Song[];
}

export interface Artist {
  name: string;
  thumb: string;
}

export interface Settings {
  accent: string;
  volume: number;
  autoplay: boolean;
}

export const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
