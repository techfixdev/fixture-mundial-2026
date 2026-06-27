import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

// The site is static by default (the fixture rarely changes), so Vercel serves
// pre-rendered HTML from the edge. Only the /api/live endpoint opts into
// on-demand execution (via `export const prerender = false`) so it can read the
// server-side API key and hit API-Football. This keeps cost and request count low.
export default defineConfig({
  adapter: vercel(),
});
