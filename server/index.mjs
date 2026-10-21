import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './app.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
app.use(express.static(dist, { index: false, maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(dist, 'index.html'), error => { if (error) next(error); });
});
app.use((error, _req, res, _next) => {
  console.error('Request failed:', error?.message || error);
  res.status(500).json({ error: 'Unexpected server error.' });
});

const port = Number(process.env.PORT) || 3001;
if (!process.env.VERCEL) app.listen(port, () => console.log(`ValoTune server listening on http://localhost:${port}`));

export default app;
