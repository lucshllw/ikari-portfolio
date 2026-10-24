import { error } from '@sveltejs/kit';
import { getMediaFile } from '$lib/server/catalog';
import { requireOwner } from '$lib/server/access';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ locals, params }) => {
  let actorId: string | undefined;
  try { actorId = (await requireOwner(locals)).id; } catch { /* anonymous public covers */ }
  const result = await getMediaFile(params.id, actorId);
  if (!result) error(404, 'Imagem não encontrada.');
  return new Response(new Uint8Array(result.bytes), { headers: { 'content-type': result.media.mime, 'content-length': String(result.bytes.length), 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'" } });
};
