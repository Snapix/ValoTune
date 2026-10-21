# Valotune

Music streaming web app: Home, Discover, Library, Settings.
React + Vite frontend, small Express API using `ytmusic-api`, playback via the YouTube IFrame player.
UI uses React Bits `GooeyNav` (navigation) and `ElasticSlider` (seek + volume).

## Run
```
npm install
npm run dev        # API on :3001, app on http://localhost:5173
```
Production: `npm run build && npm start` (serves dist + API on :3001).

Liked songs, history and settings are stored in the browser (localStorage).
