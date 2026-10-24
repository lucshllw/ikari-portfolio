import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { boundedForm, permitRequest } from '$lib/http.server';
import { assertCloudAuthOrigin, cloudAuthOrigin, getCloudAuthClient, requireCloudOwner } from '$lib/server/cloud/auth';
import { checkCredentialProof, clearCredentialProof } from '$lib/server/cloud/credential-proof';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, setHeaders, cookies }) => {
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' });
  try { const actor=await requireCloudOwner(locals);await checkCredentialProof(locals,cookies,actor.id); } catch { clearCredentialProof(cookies); redirect(303, '/admin/recuperar'); }
  return {};
};

export const actions: Actions = { default: async ({ locals, request, getClientAddress, cookies }) => {
  try { assertCloudAuthOrigin(request); } catch { return fail(403, { error: 'Não foi possível validar o envio. Reabra esta página.' }); }
  let actor;
  try { actor = await requireCloudOwner(locals); } catch { return fail(403, { error: 'Sua sessão não permite redefinir esta senha. Solicite um novo link.' }); }
  if (!permitRequest(`cloud-password:${actor.id}:${getClientAddress()}`, 5)) return fail(429, { error: 'Aguarde um minuto antes de tentar novamente.' });
  let form: FormData;
  try { form = await boundedForm(request, 8192); } catch { return fail(413, { error: 'O formulário é muito grande. Tente novamente.' }); }
  const parsed = z.object({ password: z.string().min(12).max(128), confirmation: z.string().min(12).max(128) })
    .refine((value) => value.password === value.confirmation).safeParse({ password: String(form.get('password') || ''), confirmation: String(form.get('confirmation') || '') });
  if (!parsed.success) return fail(400, { error: 'Use de 12 a 128 caracteres e repita a mesma senha nos dois campos.' });
  // Consume atomically before changing the password. A provider failure requires
  // a fresh email link rather than allowing replay across server instances.
  try { await checkCredentialProof(locals,cookies,actor.id,true); } catch { clearCredentialProof(cookies); return fail(403,{error:'Este acesso de recuperação expirou ou já foi utilizado. Solicite um novo link.'}); }
  const client = getCloudAuthClient(locals);
  try {
    const { data, error } = await client.auth.updateUser({ password: parsed.data.password });
    if (error || data.user?.id !== actor.id) return fail(400, { error: 'Não foi possível alterar a senha. Solicite um novo link de recuperação para tentar novamente.' });
  } catch { return fail(400, { error: 'Não foi possível confirmar a alteração. Solicite um novo link antes de tentar novamente.' }); }
  let warning = '';
  try {
    const { error } = await client.auth.signOut({ scope: 'others' });
    if (error) throw error;
  } catch { warning = 'A senha foi alterada, mas não foi possível confirmar o encerramento das outras sessões.'; }
  // A consumed ticket cannot reload this form after success. This short-lived
  // flag is presentation-only and never grants access to any endpoint.
  cookies.set('ikari_password_changed',warning?'changed-with-warning':'changed',{path:'/admin/conta',httpOnly:true,secure:cloudAuthOrigin().startsWith('https:'),sameSite:'strict',maxAge:60});
  redirect(303,'/admin/conta');
} };
