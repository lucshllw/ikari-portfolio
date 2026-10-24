import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
export default defineConfig(({command}) => {
  const cloudBuild = command === 'build' && process.env.FRAME_DEPLOYMENT === 'vercel';
  if (cloudBuild && process.env.FRAME_STORAGE !== 'supabase') throw new Error('O deploy Vercel exige FRAME_STORAGE=supabase. O banco local não pode ser publicado em disco efêmero.');
  return { define: { __IKARI_CLOUD_BUILD__: JSON.stringify(cloudBuild) }, plugins: [sveltekit()], test: { include: ['tests/**/*.test.ts'], environment: 'node', fileParallelism: false } };
});
