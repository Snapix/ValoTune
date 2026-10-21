import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YTMusic from "ytmusic-api";
const root = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;
const TITLE_NOISE = /\b(?:official\s+(?:music\s+)?video|official\s+audio|lyrics?|lyric\s+video|hd\s+remaster(?:ed)?|visuali[sz]er|music\s+video|with\s+lyrics)\b/gi;
const COMPILATION_NOISE = /\b(?:top\s*\d+|best\s+global\s+hits?|trending\s+songs?|top\s+songs?|top\s+music|playlist|compilation|nonstop|mega\s+hits?|hits?\s+202[0-9]|songs?\s+202[0-9])\b/gi;
function cleanTitle(value) {
  const original = String(value || "Untitled").normalize("NFKC");
  const cleaned = original.replace(TITLE_NOISE, " ").replace(COMPILATION_NOISE, " ").replace(/\b(?:19|20)\d{2}\b/g, " ").replace(/[🎵🎶🎧🌍🔥✨💥💯❤️💕🎤📀🔊▶️]/gu, " ").replace(/[|~•·]+/g, " ").replace(/\s+/g, " ").replace(/^[-–—:,. \s]+|[-–—:,. \s]+$/g, "").trim();
  return cleaned || original.trim();
}
function squareThumbnail(url) { return String(url || "").replace(/=w\d+-h\d+[^&]*/i, "=w800-h800-l90-rj").replace(/=s\d+[^&]*/i, "=w800-h800-l90-rj"); }

const music = new YTMusic();
let initPromise;
app.use(express.static(path.join(root, "dist")));
async function initMusic() { if (!initPromise) initPromise = music.initialize(); await initPromise; }
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Valomusic" }));
app.get("/api/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Enter a song, artist, album, or playlist." });
  if (q.length > 160) return res.status(400).json({ error: "Search query is too long." });
  try {
    await initMusic();
    const items = await music.search(q);
    res.json({ results: (Array.isArray(items) ? items : []).map((item, i) => ({
      id: item.videoId || item.browseId || `${q}-${i}`, videoId: item.videoId || "",
      title: cleanTitle(item.name || item.title || "Untitled"),
      artist: (Array.isArray(item.artists) ? item.artists.map(a => typeof a === "string" ? a : a?.name).filter(Boolean).join(", ") : "") || (typeof item.artist === "string" ? item.artist : (item.artist?.name && !/^\d{1,2}:\d{2}$/.test(item.artist.name) ? item.artist.name : "")) || (typeof item.author === "string" ? item.author : item.author?.name) || "YouTube Music",
      album: item.album?.name || item.album || "", thumbnail: squareThumbnail(item.thumbnails?.at(-1)?.url || item.thumbnails?.[0]?.url || ""),
      type: item.type || "song", duration: item.duration || null
    })) });
  } catch (error) {
    console.error("Music search failed:", error?.message || error);
    res.status(502).json({ error: "YouTube Music search is unavailable. Try again shortly." });
  }
});
app.get("*", (_req, res) => res.sendFile(path.join(root, "dist", "index.html")));
export default app;

if (!process.env.VERCEL) app.listen(port, () => console.log(`Valomusic running on port ${port}`));