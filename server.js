import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YTMusic from "ytmusic-api";
const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;
const music = new YTMusic();
let initPromise;
app.use(express.static(path.join(root, "public")));
async function initMusic() { if (!initPromise) initPromise = music.initialize(); await initPromise; }
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "ValoTune" }));
app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Enter a song, artist, album, or playlist." });
  if (q.length > 160) return res.status(400).json({ error: "Search query is too long." });
  try {
    await initMusic();
    const items = await music.search(q);
    res.json({ results: (Array.isArray(items) ? items : []).map((item, i) => ({
      id: item.videoId || item.browseId || `${q}-${i}`, videoId: item.videoId || "",
      title: item.name || item.title || "Untitled",
      artist: Array.isArray(item.artists) ? item.artists.map(a => a.name || a).join(", ") : item.artist || item.author || "YouTube Music",
      album: item.album?.name || item.album || "", thumbnail: item.thumbnails?.at(-1)?.url || "",
      type: item.type || "song", duration: item.duration || null
    })) });
  } catch (error) {
    console.error("Music search failed:", error?.message || error);
    res.status(502).json({ error: "YouTube Music search is unavailable. Try again shortly." });
  }
});
app.get("*", (_req, res) => res.sendFile(path.join(root, "public", "index.html")));
app.listen(port, () => console.log(`ValoTune running on port ${port}`));