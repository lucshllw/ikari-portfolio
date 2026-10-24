import { z } from 'zod';
import { requireOwner } from '$lib/server/access';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import type { Project } from '$lib/domain/types';
import type { RequestHandler } from './$types';

const serve: RequestHandler = async ({ locals, params, request }) => {
  const baseHeaders = { 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' };
  const missing = () => new Response(null, { status: 404, headers: baseHeaders });
  if (!z.uuid().safeParse(params.id).success) return missing();
  if ((CLOUD_BUILD || isCloud())) {
    let actorId: string | undefined;
    try { actorId = (await requireOwner(locals)).id; } catch { /* public published clips */ }
    const file = await (await import('$lib/server/cloud/catalog')).getExcerptFile(params.id, actorId);
    if (!file) return missing();
    return new Response(null, { status: 307, headers: { ...baseHeaders, location: file.signedUrl, 'referrer-policy': 'no-referrer' } });
  }
  const { sqlite } = await import('$lib/server/db');
  const { parseByteRange } = await import('$lib/server/byte-range');
  const { openProjectExcerpt } = await import('$lib/server/excerpts');
  const { closeSync, createReadStream } = await import('node:fs');
  const { Readable } = await import('node:stream');
  const project = sqlite.prepare('SELECT * FROM projects WHERE id=?').get(params.id) as Project | undefined;
  if (!project) return missing();
  if (project.status !== 'published') {
    try { await requireOwner(locals); } catch { return missing(); }
  }
  const result = openProjectExcerpt(project);
  if (!result) return missing();
  const { excerpt, fd } = result;
  const headers = new Headers({ ...baseHeaders, 'content-type': 'video/mp4', 'accept-ranges': 'bytes' });
  const rangeHeader = request.headers.get('range');
  const range = rangeHeader === null ? { start: 0, end: excerpt.size - 1 } : parseByteRange(rangeHeader, excerpt.size);
  if (!range) {
    closeSync(fd); headers.set('content-range', `bytes */${excerpt.size}`);
    headers.set('content-length', '0');
    return new Response(null, { status: 416, headers });
  }
  const status = rangeHeader === null ? 200 : 206;
  headers.set('content-length', String(range.end - range.start + 1));
  if (status === 206) headers.set('content-range', `bytes ${range.start}-${range.end}/${excerpt.size}`);
  if (request.method === 'HEAD') { closeSync(fd); return new Response(null, { status, headers }); }
  const stream = createReadStream('', { fd, autoClose: true, start: range.start, end: range.end, signal: request.signal });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status, headers });
};
export const GET = serve;
export const HEAD = serve;
