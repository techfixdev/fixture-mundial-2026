import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',
  adapter: vercel({
    runtime: 'nodejs22.x',
  }),
  devToolbar: { enabled: false }
});
