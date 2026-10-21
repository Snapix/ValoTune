import express from 'express';
import cors from 'cors';
import YTMusic from 'ytmusic-api';

const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: true }));
app.use(express.json({ limit: '32kb' }));

const yt = new YTMusic();
let initPromise;
const ensureReady = () => {
  if (!initPromise) {
    initPromise = yt.initialize().catch(error => {
      initPromise = undefined;
      throw error;
    });
  }
  return initPromise;
};

const cache = new Map();
async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < ttl) return hit.value;
  const value = await fn();
  cache.set(key, { time: Date.now(), value });
  if (cache.size > 150) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].time - b[1].time).slice(0, 40);
    oldest.forEach(([oldKey]) => cache.delete(oldKey));
  }
  return value;
}

function normalizeSong(song) {
  const thumb = song?.thumbnails?.at?.(-1)?.url || song?.thumbnails?.[0]?.url || '';
  const artist = Array.isArray(song?.artists)
    ? song.artists.map(a => typeof a === 'string' ? a : a?.name).filter(Boolean).join(', ')
    : song?.artist?.name || (typeof song?.artist === 'string' ? song.artist : '');
  return {
    videoId: String(song?.videoId || ''),
    name: String(song?.name || song?.title || 'Untitled'),
    artist: artist || 'Unknown artist',
    thumb: String(thumb),
    duration: Number(song?.duration) || 0
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'valotune-api' }));

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 160);
  if (!q) return res.status(400).json({ error: 'Enter a song, artist, or mood to search.' });
  try {
    const data = await cached('search:' + q.toLowerCase(), 5 * 60_000, async () => {
      await ensureReady();
      const [songs, artists] = await Promise.all([
        yt.searchSongs(q),
        yt.searchArtists(q).catch(() => [])
      ]);
      return {
        songs: (Array.isArray(songs) ? songs : []).filter(s => s?.videoId).slice(0, 30).map(normalizeSong),
        artists: (Array.isArray(artists) ? artists : []).slice(0, 8).map(a => ({
          name: String(a?.name || 'Unknown artist'),
          thumb: String(a?.thumbnails?.at?.(-1)?.url || a?.thumbnails?.[0]?.url || '')
        }))
      };
    });
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    return res.json(data);
  } catch (error) {
    console.error('Search failed:', error?.message || error);
    return res.status(502).json({ error: 'Music search is temporarily unavailable. Please try again.' });
  }
});

app.get('/api/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (!q) return res.json([]);
  try {
    await ensureReady();
    const suggestions = await yt.getSearchSuggestions(q);
    return res.json(Array.isArray(suggestions) ? suggestions.slice(0, 8) : []);
  } catch {
    return res.json([]);
  }
});

const HOME = [
  { title: 'Trending now', query: 'top hits 2026' },
  { title: 'Popular songs', query: 'most popular songs worldwide' },
  { title: 'Chill vibes', query: 'chill lofi songs' },
  { title: 'Bollywood favourites', query: 'popular Bollywood songs' },
  { title: 'Tamil hits', query: 'popular Tamil songs' },
  { title: 'Late night drive', query: 'late night drive songs' }
];

app.get('/api/home', async (_req, res) => {
  try {
    const sections = await cached('home-v2', 15 * 60_000, async () => {
      await ensureReady();
      return Promise.all(HOME.map(async section => {
        const songs = await yt.searchSongs(section.query);
        return { title: section.title, songs: (Array.isArray(songs) ? songs : []).filter(s => s?.videoId).slice(0, 12).map(normalizeSong) };
      }));
    });
    return res.json(sections);
  } catch (error) {
    console.error('Home collections failed:', error?.message || error);
    return res.status(502).json({ error: 'Music collections are temporarily unavailable.' });
  }
});


export default app;
