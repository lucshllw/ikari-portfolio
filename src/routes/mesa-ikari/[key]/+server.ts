import { error, redirect } from '@sveltejs/kit';
import { validStudioKey } from '$lib/server/studio-entry';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import { consumeRateLimit } from '$lib/server/security';
import { getCloudAuthClient } from '$lib/server/cloud/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url, cookies, getClientAddress, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive' });
  if (!(CLOUD_BUILD || isCloud()) || process.env.FRAME_THEME !== 'ikari') error(404);
  if (process.env.IKARI_STUDIO_HOST && url.host !== process.env.IKARI_STUDIO_HOST) error(404);
  try { consumeRateLimit('studio-entry:' + getClientAddress(), 12); } catch { error(429, 'Aguarde antes de tentar novamente.'); }
  if (!validStudioKey(params.key)) error(404);
  // The URL locates the login; it can never mint an owner session.
  try { await getCloudAuthClient(locals).auth.signOut({scope:'local'}); } finally {
    // Never let an unavailable sign-out endpoint turn this entry into auto-login.
    for(const {name} of cookies.getAll())if(/^sb-.+-auth-token(?:\.\d+)?$/.test(name))cookies.delete(name,{path:'/'});
  }
  redirect(303, '/admin/entrar');
};
