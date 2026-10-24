import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { boundedForm, permitRequest } from '$lib/http.server';
import { assertCloudAuthOrigin, cloudAuthOrigin, getCloudAuthClient } from '$lib/server/cloud/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' });
  return {};
};

export const actions: Actions = { default: async ({ request, locals, getClientAddress }) => {
  try { assertCloudAuthOrigin(request); } catch { return fail(403, { error: 'Não foi possível validar o envio. Reabra esta página.', email: '' }); }
  if (!permitRequest(`cloud-recovery:${getClientAddress()}`, 3)) return fail(429, { error: 'Aguarde um minuto antes de pedir outro link.', email: '' });
  let email = '';
  try { email = String((await boundedForm(request, 8192)).get('email') || '').trim().toLowerCase(); }
  catch { return fail(413, { error: 'O formulário é muito grande. Tente novamente.', email }); }
  if (!z.email().max(254).safeParse(email).success) return fail(400, { error: 'Informe um e-mail válido.', email: email.slice(0, 254) });
  let client;
  try { client = getCloudAuthClient(locals); } catch { return fail(503, { error: 'Recuperação indisponível no momento. Tente novamente mais tarde.', email }); }
  // Provider errors must not reveal account existence. This is not a delivery receipt.
  try { await client.auth.resetPasswordForEmail(email, { redirectTo: `${cloudAuthOrigin()}/auth/callback?next=recovery` }); } catch { /* Same neutral response, without logging email/provider details. */ }
  return { requested: true, email, message: 'Se o endereço estiver apto e o envio estiver disponível, as instruções de recuperação chegarão por e-mail. Confira também o spam.' };
} };
