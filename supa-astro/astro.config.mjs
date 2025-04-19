import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless'; // or /edge depending on target

export default defineConfig({
  output: 'server',
  adapter: vercel(),
});
