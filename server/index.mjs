import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YTMusic from 'ytmusic-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());

const yt = new YTMusic();
await yt.initialize();

const norm = s => ({
  videoId: s.videoId,
  name: s.name,
  artist: s.artist?.name || '',
  thumb: s.thumbnails?.length ? s.thumbnails[s.thumbnails.length - 1].url : '',
  duration: s.duration || 0
});

const cache = new Map();
const cached = async (key, ttl, fn) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
};

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ songs: [], artists: [] });
  try {
    const out = await cached(`s:${q}`, 5 * 60e3, async () => {
      const [songs, artists] = await Promise.all([yt.searchSongs(q), yt.searchArtists(q).catch(() => [])]);
      return {
        songs: songs.filter(s => s.videoId).map(norm),
        artists: artists.slice(0, 8).map(a => ({
          name: a.name,
          thumb: a.thumbnails?.length ? a.thumbnails[a.thumbnails.length - 1].url : ''
        }))
      };
    });
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get('/api/suggest', async (req, res) => {
  try {
    res.json(await yt.getSearchSuggestions(String(req.query.q || '')));
  } catch {
    res.json([]);
  }
});

const HOME = [
  ['Trending now', 'top hits 2026'],
  ['Chill vibes', 'chill lofi songs'],
  ['Workout fuel', 'workout gym songs'],
  ['Late night drive', 'late night drive songs']
];

app.get('/api/home', async (_req, res) => {
  try {
    const sections = await cached('home', 15 * 60e3, () =>
      Promise.all(HOME.map(async ([title, q]) => ({
        title,
        songs: (await yt.searchSongs(q)).filter(s => s.videoId).slice(0, 12).map(norm)
      })))
    );
    res.json(sections);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

const dist = path.join(__dirname, '..', 'dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Valotune API on http://localhost:${port}`));
