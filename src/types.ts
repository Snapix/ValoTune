export interface Song {
  videoId: string;
  name: string;
  artist: string;
  thumb: string;
  duration: number;
}
export interface Section { title: string; songs: Song[] }
export interface Artist { name: string; thumb: string }
export type ThemePreset = 'oled' | 'midnight' | 'vinyl' | 'paper' | 'adaptive';
export interface ThemeConfig {
  preset: ThemePreset;
  surface: 'oled' | 'charcoal' | 'light';
  accent: string;
  dynamicArt: boolean;
  glow: number;
  density: 'compact' | 'comfortable' | 'spacious';
  navigation: 'sidebar' | 'top' | 'dock';
  homeFeed: 'editorial' | 'grid';
  radius: 'sharp' | 'rounded' | 'soft';
  playerStyle: 'docked' | 'floating';
  coverMotion: 'static' | 'tilt' | 'vinyl';
  lyricsStyle: 'karaoke' | 'teleprompter' | 'minimal';
  fontPairing: 'geometric' | 'editorial' | 'mono';
  reduceMotion: boolean;
  highContrast: boolean;
}
export interface Settings {
  volume: number;
  autoplay: boolean;
  crossfade: number;
  normalization: boolean;
  streamingQuality: 'auto' | 'high' | 'standard' | 'data-saver';
  lyricsSyncSpeed: number;
  ambientGlow: number;
  lyricsProvider: 'lrclib' | 'ytmusic';
  showHomeShelves: boolean;
  showGenres: boolean;
  showNavLabels: boolean;
}
export const fmt = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};
