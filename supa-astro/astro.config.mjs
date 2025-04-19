import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel'; // or /edge depending on target

import react from '@astrojs/react';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
});