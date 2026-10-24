import adapter from '@sveltejs/adapter-node';
import vercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { preprocess: vitePreprocess(), kit: { adapter: process.env.FRAME_DEPLOYMENT === 'vercel' && process.env.FRAME_CLOUD_AUDIT !== '1' ? vercel({ runtime: 'nodejs24.x' }) : adapter() } };
