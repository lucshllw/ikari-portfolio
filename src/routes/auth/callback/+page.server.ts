import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { getCloudAuthClient, requireCloudOwner } from '$lib/server/cloud/auth';
import { issueCredentialProof } from '$lib/server/cloud/credential-proof';
import type { PageServerLoad } from './$types';

const credential = z.string().min(1).max(2048).regex(/^[A-Za-z0-9._-]+$/);
const invalidLink = { error: 'Não foi possível validar este link. Ele pode ter expirado ou já ter sido usado. Solicite outro link de acesso.' };

export const load: PageServerLoad = async ({ locals, url, setHeaders, cookies }) => {
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' });
  const next = url.searchParams.get('next'), code = url.searchParams.get('code'), tokenHash = url.searchParams.get('token_hash'), type = url.searchParams.get('type');
  if (url.searchParams.has('error') || (next !== null && next !== 'recovery' && next !== 'invite' && next !== 'account') || Boolean(code) === Boolean(tokenHash)) return invalidLink;
  if ((code && !credential.safeParse(code).success) || (tokenHash && (!credential.safeParse(tokenHash).success || (type !== 'invite' && type !== 'recovery' && type !== 'email_change')))) return invalidLink;
  if (tokenHash && next !== null && next !== (type === 'email_change' ? 'account' : type)) return invalidLink;
  const flowId = url.searchParams.get('sb_flow_id');
  if (flowId && !credential.safeParse(flowId).success) return invalidLink;
  let client;
  try { client = getCloudAuthClient(locals); } catch { return invalidLink; }
  let exchanged = false;
  let credentialFlow = false;
  try {
    // Admin invitations do not support PKCE: a private email template can use
    // token_hash + type=invite; never accept an arbitrary verification type.
    const { data, error } = code
      ? await (flowId ? client.auth.exchangeCodeForSession(code, { flowId }) : client.auth.exchangeCodeForSession(code))
      : await client.auth.verifyOtp({ token_hash: tokenHash!, type: type as 'invite' | 'recovery' | 'email_change' });
    if (error || !data.session || !data.user) return invalidLink;
    exchanged = true;
    const owner = await requireCloudOwner(locals);
    credentialFlow = (!code && (type === 'recovery' || type === 'invite')) || (!!code && next === 'recovery');
    if(credentialFlow){
      if(!data.session.access_token)throw new Error('Sessão sem prova verificável.');
      await issueCredentialProof(locals,cookies,owner.id,data.session.access_token,code?'pkce':type as 'invite'|'recovery');
    }
  } catch {
    if (exchanged) { try { await client.auth.signOut({ scope: 'local' }); } catch { /* No authorization is granted even if cleanup fails. */ } }
    return invalidLink;
  }
  redirect(303, credentialFlow ? '/admin/redefinir' : (next === 'account' || type === 'email_change') ? '/admin/conta' : '/admin');
};
