import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { passwordLoginRequired, hasRecentPassword } from '../password-session';

export type CloudAuthLocals = { supabase?: SupabaseClient | null };

/** Use only the request-scoped client created by SSR hooks, never the service client. */
export function getCloudAuthClient(locals: CloudAuthLocals): SupabaseClient {
  if (!locals.supabase) throw new Error('Autenticação indisponível.');
  return locals.supabase;
}

export async function requireCloudOwner(locals: CloudAuthLocals): Promise<{ id: string }> {
  try {
    const client = getCloudAuthClient(locals);
    const { data: identity, error: authError } = await client.auth.getUser();
    if (authError || !identity.user || !z.uuid().safeParse(identity.user.id).success) throw new Error();
    if (passwordLoginRequired()) {
      const { data, error } = await client.auth.getClaims();
      if(error || !hasRecentPassword(data?.claims, identity.user.id))throw new Error();
    }
    const { data: editor, error: policyError } = await client.from('ikari_editors').select('user_id').eq('user_id', identity.user.id).maybeSingle();
    if (policyError || editor?.user_id !== identity.user.id) throw new Error();
    return { id: identity.user.id };
  } catch {
    throw new Error('Acesso administrativo necessário.');
  }
}

export function cloudAuthOrigin(): string {
  const configured = process.env.ORIGIN;
  if (!configured) throw new Error('Origem da aplicação não configurada.');
  let parsed: URL;
  try { parsed = new URL(configured); } catch { throw new Error('Origem da aplicação inválida.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if ((parsed.protocol !== 'https:' && !(loopback && parsed.protocol === 'http:')) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Origem da aplicação inválida.');
  return parsed.origin;
}

export function assertCloudAuthOrigin(request: Request): void {
  const trusted = cloudAuthOrigin();
  const actual=new URL(request.url).origin,host=process.env.IKARI_STUDIO_HOST;
  const allowed=actual===trusted||!!host&&/^[a-z0-9.-]+(?::\d+)?$/i.test(host)&&actual==='https://'+host;
  if (!allowed || request.headers.get('origin')!==actual) throw new Error('Origem de requisição inválida.');
}

/** Reconfirm a sensitive account action with the verified owner's own email.
 * Never use form input or locals.user for choosing the identity to authenticate. */
export async function reauthenticateCloudOwner(locals: CloudAuthLocals, password: string, expectedId: string): Promise<void> {
  const client = getCloudAuthClient(locals);
  const actor = await requireCloudOwner(locals);
  if (actor.id !== expectedId) throw new Error('Não foi possível confirmar sua credencial.');
  const { data: current, error } = await client.auth.getUser();
  if (error || current.user?.id !== expectedId || !current.user.email) throw new Error('Não foi possível confirmar sua credencial.');
  const result = await client.auth.signInWithPassword({ email: current.user.email, password });
  if (result.error || result.data.user?.id !== expectedId) throw new Error('Não foi possível confirmar sua credencial.');
  if ((await requireCloudOwner(locals)).id !== expectedId) throw new Error('Não foi possível confirmar sua credencial.');
}
