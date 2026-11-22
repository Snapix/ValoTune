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

const AUDIODB_V1_KEY = process.env.AUDIODB_V1_KEY || '2';
const AUDIODB_V2_KEY = process.env.AUDIODB_API_KEY || '';
const AUDIODB_ORIGIN = 'https://www.theaudiodb.com';

async function audioDbRequest(v2Path, v1Path) {
  const url = AUDIODB_V2_KEY
    ? AUDIODB_ORIGIN + '/api/v2/json/' + v2Path
    : AUDIODB_ORIGIN + '/api/v1/json/' + AUDIODB_V1_KEY + '/' + v1Path;
  const response = await fetch(url, AUDIODB_V2_KEY ? { headers: { 'X-API-KEY': AUDIODB_V2_KEY } } : undefined);
  if (!response.ok) throw new Error('TheAudioDB request failed (' + response.status + ')');
  return response.json();
}

app.get('/api/audiodb/search/:type/:query', async (req, res) => {
  const type = String(req.params.type || '').toLowerCase();
  const query = decodeURIComponent(String(req.params.query || '')).trim().slice(0, 100);
  const paths = {
    artist: ['search/artist/' + encodeURIComponent(query), 'search.php?s=' + encodeURIComponent(query)],
    album: ['search/album/' + encodeURIComponent(query), 'searchalbum.php?s=' + encodeURIComponent(query)],
    track: ['search/track/' + encodeURIComponent(query), 'searchtrack.php?s=' + encodeURIComponent(query)]
  };
  if (!paths[type] || !query) return res.status(400).json({ error: 'Supported AudioDB searches are artist, album, and track.' });
  try {
    const data = await cached('audiodb:search:' + type + ':' + query.toLowerCase(), 30 * 60_000, () => audioDbRequest(paths[type][0], paths[type][1]));
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
    return res.json(data);
  } catch (error) {
    console.error('AudioDB search failed:', error?.message || error);
    return res.status(502).json({ error: 'AudioDB metadata is temporarily unavailable.' });
  }
});

app.get('/api/audiodb/lookup/:type/:id', async (req, res) => {
  const type = String(req.params.type || '').toLowerCase();
  const id = decodeURIComponent(String(req.params.id || '')).trim().slice(0, 100);
  const paths = {
    artist: ['lookup/artist/' + encodeURIComponent(id), 'artist.php?i=' + encodeURIComponent(id)],
    album: ['lookup/album/' + encodeURIComponent(id), 'album.php?m=' + encodeURIComponent(id)],
    track: ['lookup/track/' + encodeURIComponent(id), 'track.php?h=' + encodeURIComponent(id)]
  };
  if (!paths[type] || !id) return res.status(400).json({ error: 'Supported AudioDB lookups are artist, album, and track.' });
  try {
    const data = await cached('audiodb:lookup:' + type + ':' + id, 60 * 60_000, () => audioDbRequest(paths[type][0], paths[type][1]));
    res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    return res.json(data);
  } catch (error) {
    console.error('AudioDB lookup failed:', error?.message || error);
    return res.status(502).json({ error: 'AudioDB metadata is temporarily unavailable.' });
  }
});

app.get('/api/audiodb/discography/:id', async (req, res) => {
  const id = decodeURIComponent(String(req.params.id || '')).trim().slice(0, 32);
  if (!/^\\d+$/.test(id)) return res.status(400).json({ error: 'A numeric AudioDB artist ID is required.' });
  try {
    const data = await cached('audiodb:discography:' + id, 60 * 60_000, async () => {
      if (AUDIODB_V2_KEY) return audioDbRequest('list/discography/' + id, 'discography.php?s=' + id);
      const artistData = await audioDbRequest('lookup/artist/' + id, 'artist.php?i=' + id);
      const artist = Array.isArray(artistData?.artists) ? artistData.artists[0] : null;
      if (!artist?.strArtist) return { albums: [] };
      return audioDbRequest('list/discography/' + id, 'discography.php?s=' + encodeURIComponent(artist.strArtist));
    });
    res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    return res.json(data);
  } catch (error) {
    console.error('AudioDB discography failed:', error?.message || error);
    return res.status(502).json({ error: 'AudioDB discography is temporarily unavailable.' });
  }
});



app.get('/api/lyrics', async (req, res) => {
  const videoId = String(req.query.videoId || '').trim().slice(0, 32);
  if (!videoId) return res.status(400).json({ error: 'A YouTube video ID is required.' });
  try {
    const result = await cached('lyrics:' + videoId, 30 * 60_000, async () => {
      await ensureReady();
      if (typeof yt.getLyrics !== 'function') throw new Error('Lyrics are not supported by the installed YouTube Music client.');
      return await yt.getLyrics(videoId);
    });
    if (!result) return res.status(404).json({ error: 'No lyrics found for this track.' });
    return res.json(result);
  } catch (error) {
    console.error('Lyrics lookup failed:', error?.message || error);
    return res.status(502).json({ error: 'YouTube Music lyrics are temporarily unavailable.' });
  }
});

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

app.get('/api/home', async (req, res) => {
  try {
    const artists = String(req.query.artists || '')
      .split('|')
      .map(value => value.trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 3);

    const cacheKey = artists.length ? 'home-personal:' + artists.map(a => a.toLowerCase()).sort().join('|') : 'home-v2';
    const sections = await cached(cacheKey, 15 * 60_000, async () => {
      await ensureReady();

      const personalized = artists.length
        ? await Promise.all(artists.slice(0, 2).map(async artistName => {
            const songs = await yt.searchSongs(artistName + ' songs');
            return {
              title: 'Because you listened to ' + artistName,
              songs: (Array.isArray(songs) ? songs : []).filter(s => s?.videoId).slice(0, 12).map(normalizeSong)
            };
          }))
        : [];

      const base = await Promise.all(HOME.map(async section => {
        const songs = await yt.searchSongs(section.query);
        return { title: section.title, songs: (Array.isArray(songs) ? songs : []).filter(s => s?.videoId).slice(0, 12).map(normalizeSong) };
      }));

      return [...personalized, ...base];
    });

    res.set('Cache-Control', 'private, max-age=0, stale-while-revalidate=60');
    return res.json(sections);
  } catch (error) {
    console.error('Home collections failed:', error?.message || error);
    return res.status(502).json({ error: 'Music collections are temporarily unavailable.' });
  }
});


export default app;
