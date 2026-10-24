import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { requireOwner } from '$lib/server/access';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import { assertSameOrigin } from '$lib/server/security';
import { applyAuthCookies, boundedForm, permitRequest } from '$lib/http.server';
import { cloudAuthOrigin, getCloudAuthClient, reauthenticateCloudOwner } from '$lib/server/cloud/auth';
import type { Actions, PageServerLoad } from './$types';

const passwordInput = z.object({
  currentPassword: z.string().min(1).max(128), password: z.string().min(12).max(128), confirmation: z.string().min(12).max(128)
}).refine(value => value.password === value.confirmation && value.password !== value.currentPassword);
const emailInput = z.object({ currentPassword: z.string().min(1).max(128), email: z.email().max(254) });
export const load: PageServerLoad = async ({ locals, setHeaders, cookies }) => {
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' });
  try { await requireOwner(locals); } catch { redirect(303, '/admin/entrar'); }
  const notice=cookies.get('ikari_password_changed');
  cookies.delete('ikari_password_changed',{path:'/admin/conta'});
  const passwordChanged=notice==='changed'||notice==='changed-with-warning', passwordWarning=notice==='changed-with-warning';
  if ((CLOUD_BUILD || isCloud())) {
    const { data, error } = await getCloudAuthClient(locals).auth.getUser();
    if (error || !data.user) redirect(303, '/admin/entrar');
    return { loginEmail: data.user.email || '', pendingEmail: data.user.new_email || '', cloud: true, passwordChanged, passwordWarning };
  }
  return { loginEmail: locals.user?.email || '', pendingEmail: '', cloud: false, passwordChanged, passwordWarning };
};

export const actions: Actions = {
  password: async ({ locals, request, cookies, getClientAddress }) => {
    try { assertSameOrigin(request); } catch { return fail(403, { kind: 'password', error: 'Reabra esta página antes de alterar sua senha.' }); }
    let actor;
    try { actor = await requireOwner(locals); } catch { return fail(403, { kind: 'password', error: 'Entre novamente para alterar sua conta.' }); }
    if (!permitRequest(`account-password:${actor.id}:${getClientAddress()}`, 5)) return fail(429, { kind: 'password', error: 'Aguarde um minuto antes de tentar novamente.' });
    let form: FormData;
    try { form = await boundedForm(request, 8192); } catch { return fail(413, { kind: 'password', error: 'O formulário é muito grande.' }); }
    const parsed = passwordInput.safeParse({ currentPassword: String(form.get('currentPassword') || ''), password: String(form.get('password') || ''), confirmation: String(form.get('confirmation') || '') });
    if (!parsed.success) return fail(400, { kind: 'password', error: 'Confira a senha atual. A nova senha precisa ter de 12 a 128 caracteres, ser diferente da atual e coincidir nos dois campos.' });
    let warning = '';
    try {
      if ((CLOUD_BUILD || isCloud())) {
        await reauthenticateCloudOwner(locals, parsed.data.currentPassword, actor.id);
        const client = getCloudAuthClient(locals);
        const { data, error } = await client.auth.updateUser({ password: parsed.data.password });
        if (error || data.user?.id !== actor.id) throw new Error();
        try { const { error } = await client.auth.signOut({ scope: 'others' }); if (error) throw error; }
        catch { warning = 'A senha mudou, mas não foi possível confirmar o encerramento das outras sessões.'; }
      } else {
        const { auth } = await import('$lib/server/auth');
        const response = await auth.api.changePassword({ headers: request.headers, body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.password, revokeOtherSessions: true }, asResponse: true });
        if (!response.ok) throw new Error();
        applyAuthCookies(response.headers, cookies);
      }
    } catch { return fail(400, { kind: 'password', error: 'Não foi possível alterar a senha. Confira sua senha atual ou utilize a recuperação de acesso.' }); }
    return { kind: 'password', success: true, warning };
  },
  email: async ({ locals, request, getClientAddress }) => {
    try { assertSameOrigin(request); } catch { return fail(403, { kind: 'email', error: 'Reabra esta página antes de alterar seu e-mail.' }); }
    let actor;
    try { actor = await requireOwner(locals); } catch { return fail(403, { kind: 'email', error: 'Entre novamente para alterar sua conta.' }); }
    if (!(CLOUD_BUILD || isCloud())) return fail(400, { kind: 'email', error: 'A alteração do e-mail de acesso está disponível na instalação Supabase com confirmação por e-mail. Ela não está habilitada nesta instalação local.' });
    if (!permitRequest(`account-email:${actor.id}:${getClientAddress()}`, 3)) return fail(429, { kind: 'email', error: 'Aguarde um minuto antes de solicitar outra alteração.' });
    let form: FormData;
    try { form = await boundedForm(request, 8192); } catch { return fail(413, { kind: 'email', error: 'O formulário é muito grande.' }); }
    const parsed = emailInput.safeParse({ currentPassword: String(form.get('currentPassword') || ''), email: String(form.get('email') || '').trim().toLowerCase() });
    if (!parsed.success) return fail(400, { kind: 'email', error: 'Informe um e-mail válido e sua senha atual.' });
    try {
      await reauthenticateCloudOwner(locals, parsed.data.currentPassword, actor.id);
      const client = getCloudAuthClient(locals);
      const { data: current, error: currentError } = await client.auth.getUser();
      if (currentError || !current.user || current.user.email?.toLowerCase() === parsed.data.email) return fail(400, { kind: 'email', error: 'Escolha um e-mail diferente do endereço atual.' });
      const { data, error } = await client.auth.updateUser({ email: parsed.data.email }, { emailRedirectTo: `${cloudAuthOrigin()}/auth/callback?next=account` });
      if (error || data.user?.id !== actor.id) throw new Error();
      // Do not claim delivery or replace our displayed identity before Auth confirms.
      return { kind: 'email', requested: true };
    } catch { return fail(400, { kind: 'email', error: 'Não foi possível solicitar a alteração. Confira sua senha atual e tente novamente.' }); }
  }
};
