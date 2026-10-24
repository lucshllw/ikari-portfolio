import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// This module is server-only by its SvelteKit directory. Never re-export it
// from a shared/browser module: the service key bypasses RLS.
let client: SupabaseClient | undefined;
let configuration: string | undefined;

export function getCloudServiceClient(): SupabaseClient {
  const url = process.env.CLOUD_SUPABASE_URL?.trim();
  const key = process.env.CLOUD_SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) throw new Error('Persistência cloud não configurada.');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('URL do Supabase inválida.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('URL do Supabase inválida.');
  const next = `${url}\n${key}`;
  if (!client || configuration !== next) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    configuration = next;
  }
  return client;
}
