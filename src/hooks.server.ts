import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { createServerClient } from '@supabase/ssr';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import { error } from '@sveltejs/kit';
import { blocksCredentialRoute } from '$lib/server/fixed-login';

export const handle: Handle = async ({ event, resolve }) => {
  if (blocksCredentialRoute(event.url.pathname)) error(404, 'Página indisponível.');
  event.locals.user = null; event.locals.session = null;
  let response: Response;
  if ((CLOUD_BUILD || isCloud())) {
    const url = process.env.CLOUD_SUPABASE_URL, key = process.env.CLOUD_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('Autenticação cloud não configurada.');
    event.locals.supabase = createServerClient(url, key, {
      cookieOptions: { httpOnly: true, secure: event.url.protocol === 'https:', sameSite: 'lax', path: '/' },
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll: (cookies) => { for (const { name, value, options } of cookies) event.cookies.set(name, value, { ...options, path: '/' }); }
      }
    });
    response = await resolve(event);
  } else {
    const { auth } = await import('$lib/server/auth');
    const { svelteKitHandler } = await import('better-auth/svelte-kit');
    if (!building) {
    const session = await auth.api.getSession({ headers: event.request.headers });
    if (session) { event.locals.user = session.user; event.locals.session = session.session; }
    }
    response = await svelteKitHandler({ event, resolve, auth, building });
  }
  if (event.url.pathname.startsWith('/admin') || event.url.pathname.startsWith('/auth') || event.url.pathname.startsWith('/api/auth') || response.headers.has('set-cookie')) response.headers.set('Cache-Control', 'private, no-store');
  if(event.url.pathname.startsWith('/admin'))response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  if (event.url.pathname.startsWith('/auth')) response.headers.set('Referrer-Policy', 'no-referrer');
  else if (event.url.pathname.startsWith('/admin')) response.headers.set('Referrer-Policy', 'same-origin');
  else if (!response.headers.has('Referrer-Policy')) response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
};
