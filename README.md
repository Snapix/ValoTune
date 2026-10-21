# ValoTune

A responsive music discovery and playback app built with React, TypeScript, Vite, Express, and YouTube Music search. Playback uses the official YouTube IFrame Player API.

## Development

```bash
npm install
npm run dev
```

Vite runs on http://localhost:5173 and proxies `/api` to the local API on port 3001.

## Production

```bash
npm run build
npm start
```

Liked songs, recently played tracks, and preferences are stored in the browser. Music search depends on the unofficial `ytmusic-api` package and can be temporarily unavailable if YouTube changes its endpoints.
