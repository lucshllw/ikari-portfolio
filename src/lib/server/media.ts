import sharp from 'sharp';
import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, existsSync } from 'node:fs';
import { writeFile, rename, unlink } from 'node:fs/promises';
import { resolve, sep, join } from 'node:path';
import { z } from 'zod';
import { assertOwner } from './auth';
import { sqlite, dataDir, recordAudit } from './db';
import type { Media } from '../domain/types';
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 24_000_000;
const root = join(dataDir, 'media'), originals = join(dataDir, 'originals'), temporary = join(dataDir, 'tmp');
for (const directory of [root, originals, temporary]) mkdirSync(directory, { recursive: true });
let processing = 0;
function pathWithin(directory: string, filename: string): string { const path = resolve(directory, filename); if (!path.startsWith(resolve(directory) + sep)) throw new Error('Caminho inválido.'); return path; }
function asMedia(row: unknown): Media { return { ...(row as Media), url: `/media/${(row as Media).id}` }; }
export { parseVideoUrl } from './video-url';
export function listMedia(actorId: string): Media[] { assertOwner(actorId); return sqlite.prepare('SELECT * FROM media ORDER BY createdAt DESC').all().map(asMedia); }
export async function uploadImage(bytes: Uint8Array, info: { filename: string; mime: string; alt: string }, actorId: string): Promise<Media> {
  assertOwner(actorId);
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Imagem excede o limite de 12 MiB.');
  if (!info.filename || info.filename.length > 200 || /[\\/\x00-\x1f]/.test(info.filename)) throw new Error('Nome de arquivo inválido.');
  const allowed: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
  // Some browsers/OS combinations provide no raster MIME association. Treat
  // that as a missing hint; the decoder below still validates actual bytes.
  const unknownMime = info.mime === '' || info.mime === 'application/octet-stream';
  if (!unknownMime && !Object.values(allowed).includes(info.mime)) throw new Error('Envie JPEG, PNG ou WebP estático.');
  z.string().max(300).parse(info.alt);
  if (processing >= 2) throw new Error('Aguarde a imagem anterior terminar.');
  processing++;
  const id = randomUUID(), filename = `${id}.webp`, finalPath = pathWithin(root, filename), tempPath = pathWithin(temporary, `${id}.tmp`);
  let originalPath: string | undefined;
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!metadata.format || !allowed[metadata.format] || (!unknownMime && allowed[metadata.format] !== info.mime) || (metadata.pages || 1) !== 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) throw new Error('Formato, animação ou dimensões de imagem não permitidos.');
    const result = await image.rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const stored = (sqlite.prepare('SELECT COALESCE(SUM(size),0) AS size FROM media').get() as { size: number }).size;
    if (stored + result.data.byteLength > 512 * 1024 * 1024) throw new Error('A biblioteca atingiu o limite local.');
    originalPath = pathWithin(originals, `${id}.${metadata.format === 'jpeg' ? 'jpg' : metadata.format}`);
    await writeFile(originalPath, bytes, { flag: 'wx' });
    await writeFile(tempPath, result.data, { flag: 'wx' });
    await rename(tempPath, finalPath);
    const media: Media = { id, filename, mime: 'image/webp', size: result.data.byteLength, width: result.info.width, height: result.info.height, alt: info.alt.trim(), createdAt: new Date().toISOString(), url: `/media/${id}` };
    sqlite.transaction(() => { sqlite.prepare('INSERT INTO media (id,filename,mime,size,width,height,alt,createdAt,checksum) VALUES (@id,@filename,@mime,@size,@width,@height,@alt,@createdAt,@checksum)').run({ ...media, checksum: createHash('sha256').update(result.data).digest('hex') }); recordAudit(actorId, 'media.upload', id); })();
    return media;
  } catch (error) {
    for (const path of [tempPath, finalPath, originalPath]) if (path) await unlink(path).catch(() => {});
    if (error instanceof Error && !error.message.startsWith('Input buffer') && !error.message.startsWith('Vips')) throw error;
    throw new Error('A imagem enviada não pôde ser decodificada.');
  } finally { processing--; }
}
export function getMediaFile(id: string, actorId?: string): { media: Media; bytes: Buffer } | null {
  if (!z.uuid().safeParse(id).success) return null;
  if (actorId) assertOwner(actorId);
  else if (!sqlite.prepare("SELECT id FROM projects WHERE coverMediaId=? AND status='published'").get(id)) return null;
  const row = sqlite.prepare('SELECT * FROM media WHERE id=?').get(id);
  if (!row) return null;
  const media = asMedia(row), path = pathWithin(root, media.filename);
  if (!existsSync(path)) return null;
  return { media, bytes: readFileSync(path) };
}
export function deleteMedia(id: string, actorId: string) {
  assertOwner(actorId);
  if (sqlite.prepare('SELECT id FROM projects WHERE coverMediaId=?').get(id)) throw new Error('Esta imagem está associada a um trabalho.');
  const media = sqlite.prepare('SELECT * FROM media WHERE id=?').get(id) as Media | undefined;
  if (!media) return;
  sqlite.transaction(() => { sqlite.prepare('DELETE FROM media WHERE id=?').run(id); recordAudit(actorId, 'media.delete', id); })();
  const path = pathWithin(root, media.filename); if (existsSync(path)) unlinkSync(path);
  for (const extension of ['jpg', 'png', 'webp']) { const path = pathWithin(originals, `${id}.${extension}`); if (existsSync(path)) unlinkSync(path); }
}
