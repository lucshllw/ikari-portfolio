import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { requireOwner } from '$lib/server/access';
import { beginImageUpload, completeImageUpload } from '$lib/server/catalog';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import type { RequestHandler } from './$types';

const schema = z.object({ phase: z.enum(['begin', 'complete']), uploadId: z.uuid().optional(), filename: z.string().min(1).max(200), mime: z.string().max(100), alt: z.string().max(300), size: z.number().int().positive().max(12 * 1024 * 1024) });
const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
export const POST: RequestHandler = async ({ locals, request }) => {
  if (!(CLOUD_BUILD || isCloud())) return json({ error: 'Envio direto indisponível nesta instalação.' }, { status: 404, headers });
  const actor = await requireOwner(locals);
  const expected = process.env.ORIGIN;
  if (!expected || request.headers.get('origin') !== new URL(expected).origin || new URL(request.url).origin !== new URL(expected).origin) return json({ error: 'Origem de requisição inválida.' }, { status: 403, headers });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Formato inválido.' }, { status: 415, headers });
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Dados ausentes.');
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > 8192) { await reader.cancel(); return json({ error: 'Dados de envio muito grandes.' }, { status: 413, headers }); }
      chunks.push(part.value);
    }
    const body = Buffer.concat(chunks), value = schema.parse(JSON.parse(body.toString('utf8')));
    const info = { filename: value.filename, mime: value.mime, alt: value.alt };
    if (value.phase === 'begin') return json(await beginImageUpload(info, actor.id), { headers });
    if (!value.uploadId) throw new Error('Identificador ausente.');
    const media = await completeImageUpload(value.uploadId, info, actor.id);
    return json({ media }, { headers });
  } catch { return json({ error: 'Não foi possível adicionar a imagem. Confira o formato e tente novamente.' }, { status: 400, headers }); }
};
