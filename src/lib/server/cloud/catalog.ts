import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { getCloudServiceClient } from './client';
import { excerptEntrySchema, type ProjectExcerpt } from '../excerpt-schema';
import { parseVideoUrl } from '../video-url';
import type { Category, CategoryInput, Media, Project, ProjectInput, PublicSiteSettings, SettingsInput, SiteSettings } from '../../domain/types';

const PROJECT_COLUMNS = 'id,slug,title,summary,description,categoryId,coverMediaId,coverUrl,coverAlt,videoUrl,sourceUrl,featured,sortOrder,status,createdAt,updatedAt';
const MEDIA_COLUMNS = 'id,filename,mime,size,width,height,alt,createdAt,checksum,storageKey,originalKey';
const BUCKET = 'ikari-media';
const UPLOAD_BUCKET = 'ikari-uploads';
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 24_000_000;
const slug = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const httpsUrl = (value: string) => {
  if (!value) return true;
  if (/[\x00-\x20\x7f\\]/.test(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; } catch { return false; }
};
const projectSchema = z.object({
  id: z.uuid().optional(), slug, title: z.string().trim().min(1).max(160), summary: z.string().trim().max(500), description: z.string().trim().max(10_000),
  categoryId: z.uuid().nullable(), coverMediaId: z.uuid().nullable(), coverUrl: z.string().max(250), coverAlt: z.string().trim().max(300),
  sourceUrl: z.string().trim().max(2048).default('').refine(httpsUrl, 'Use uma URL HTTPS de publicação, sem credenciais.'),
  videoUrl: z.string().trim().max(500), featured: z.boolean(), sortOrder: z.number().int().min(0).max(10000), status: z.enum(['draft', 'published'])
});
const settingsSchema = z.object({ brandName: z.string().trim().min(1).max(60), headline: z.string().trim().min(1).max(180), subheadline: z.string().trim().max(300), about: z.string().trim().max(4000), email: z.union([z.literal(''), z.email().max(254)]), instagramUrl: z.string().trim().max(300), accentColor: z.string().regex(/^#[a-fA-F0-9]{6}$/), servicesText: z.string().trim().max(2000), availability: z.string().trim().max(200) });
interface StoredMedia extends Omit<Media, 'url'> { checksum: string; storageKey: string; originalKey: string | null }
interface StoredExcerpt { projectId: string; entry: unknown; storageKey: string }
function asMedia(row: StoredMedia): Media {
  const { id, filename, mime, size, width, height, alt, createdAt } = row;
  return { id, filename, mime, size, width, height, alt, createdAt, url: `/media/${id}` };
}
function checked<T>(result: { data: T; error: unknown }): T {
  // Do not expose upstream diagnostics, URLs, request headers or keys to users.
  if (result.error) throw new Error('Não foi possível concluir a operação no catálogo.');
  return result.data;
}
export async function assertCloudEditor(actorId: string): Promise<void> {
  if (!z.uuid().safeParse(actorId).success) throw new Error('Acesso restrito ao proprietário.');
  const editor = checked(await getCloudServiceClient().from('ikari_editors').select('user_id').eq('user_id', actorId).maybeSingle());
  if (!editor) throw new Error('Acesso restrito ao proprietário.');
}

export async function getPublicProjects(category?: string): Promise<Project[]> {
  const client = getCloudServiceClient();
  let query = client.from('ikari_projects').select(PROJECT_COLUMNS).eq('status', 'published');
  if (category) {
    const row = checked(await client.from('ikari_categories').select('id').eq('slug', category).maybeSingle());
    if (!row) return [];
    query = query.eq('categoryId', row.id);
  }
  return checked(await query.order('sortOrder').order('createdAt', { ascending: false }).order('id')) as Project[];
}
export async function getPublicProject(value: string): Promise<Project | null> {
  return checked(await getCloudServiceClient().from('ikari_projects').select(PROJECT_COLUMNS).eq('slug', value).eq('status', 'published').maybeSingle()) as Project | null;
}
export async function listProjects(actorId: string): Promise<Project[]> {
  await assertCloudEditor(actorId);
  return checked(await getCloudServiceClient().from('ikari_projects').select(PROJECT_COLUMNS).order('sortOrder').order('createdAt', { ascending: false }).order('id')) as Project[];
}
export async function getProject(id: string, actorId: string): Promise<Project | null> {
  await assertCloudEditor(actorId);
  if (!z.uuid().safeParse(id).success) return null;
  return checked(await getCloudServiceClient().from('ikari_projects').select(PROJECT_COLUMNS).eq('id', id).maybeSingle()) as Project | null;
}
export async function saveProject(input: ProjectInput, actorId: string): Promise<Project> {
  await assertCloudEditor(actorId);
  const value = projectSchema.parse(input), client = getCloudServiceClient();
  if (value.videoUrl) parseVideoUrl(value.videoUrl);
  if (value.categoryId && !checked(await client.from('ikari_categories').select('id').eq('id', value.categoryId).maybeSingle())) throw new Error('Categoria não encontrada.');
  if (value.coverMediaId) {
    const media = checked(await client.from('ikari_media').select('id,alt').eq('id', value.coverMediaId).maybeSingle());
    if (!media) throw new Error('Imagem não encontrada.');
    value.coverUrl = `/media/${media.id}`;
    if (!value.coverAlt) value.coverAlt = media.alt;
  } else if (value.coverUrl && !/^\/demo\/[a-zA-Z0-9_-]+\.webp$/.test(value.coverUrl)) throw new Error('Selecione uma imagem da biblioteca.');
  const current = value.id ? checked(await client.from('ikari_projects').select(PROJECT_COLUMNS).eq('id', value.id).maybeSingle()) as Project | null : null;
  if (value.id && !current) throw new Error('Trabalho não encontrado.');
  const duplicate = checked(await client.from('ikari_projects').select('id').eq('slug', value.slug).maybeSingle());
  if (duplicate && duplicate.id !== value.id) throw new Error('Este endereço já pertence a outro trabalho.');
  const result: Project = { ...value, id: value.id || randomUUID(), createdAt: current?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const query = current ? client.from('ikari_projects').update(result).eq('id', result.id) : client.from('ikari_projects').insert(result);
  return checked(await query.select(PROJECT_COLUMNS).single()) as Project;
}
export async function deleteProject(id: string, actorId: string): Promise<void> {
  await assertCloudEditor(actorId); z.uuid().parse(id);
  checked(await getCloudServiceClient().from('ikari_projects').delete().eq('id', id));
}
export async function moveProject(id: string, direction: number, actorId: string): Promise<void> {
  await assertCloudEditor(actorId); z.uuid().parse(id);
  if (direction !== 1 && direction !== -1) throw new Error('Direção inválida.');
  // One locked database transaction, rather than partial sequential updates.
  checked(await getCloudServiceClient().rpc('ikari_move_project', { project_id: id, move_direction: direction, actor_id: actorId }));
}
export async function listCategories(): Promise<Category[]> {
  return checked(await getCloudServiceClient().from('ikari_categories').select('id,name,slug,sortOrder').order('sortOrder').order('name')) as Category[];
}
export async function saveCategory(input: CategoryInput, actorId: string): Promise<Category> {
  await assertCloudEditor(actorId);
  const value = z.object({ id: z.uuid().optional(), name: z.string().trim().min(1).max(100), slug, sortOrder: z.number().int().min(0).max(10000) }).parse(input), client = getCloudServiceClient();
  if (value.id && !checked(await client.from('ikari_categories').select('id').eq('id', value.id).maybeSingle())) throw new Error('Categoria não encontrada.');
  const duplicate = checked(await client.from('ikari_categories').select('id').eq('slug', value.slug).maybeSingle());
  if (duplicate && duplicate.id !== value.id) throw new Error('Endereço de categoria já utilizado.');
  const result = { ...value, id: value.id || randomUUID() };
  const query = value.id ? client.from('ikari_categories').update(result).eq('id', result.id) : client.from('ikari_categories').insert(result);
  return checked(await query.select('id,name,slug,sortOrder').single()) as Category;
}
export async function deleteCategory(id: string, actorId: string): Promise<void> {
  await assertCloudEditor(actorId); z.uuid().parse(id);
  const client = getCloudServiceClient();
  if (checked(await client.from('ikari_projects').select('id').eq('categoryId', id).limit(1))?.length) throw new Error('Mova os trabalhos desta categoria antes de excluí-la.');
  checked(await client.from('ikari_categories').delete().eq('id', id));
}
export async function getPublicSettings(): Promise<PublicSiteSettings> {
  const row = checked(await getCloudServiceClient().from('ikari_settings').select('value').eq('id', 1).maybeSingle());
  // Fail explicitly if import/provisioning is incomplete; don't substitute demo identity.
  if (!row) throw new Error('Configuração pública ainda não importada.');
  return settingsSchema.parse(row.value);
}
export async function saveSettings(input: SettingsInput, actorId: string): Promise<SiteSettings> {
  await assertCloudEditor(actorId);
  const value = settingsSchema.parse(input);
  if (value.instagramUrl) {
    if (!httpsUrl(value.instagramUrl) || new URL(value.instagramUrl).port) throw new Error('O link precisa usar HTTPS sem credenciais.');
  }
  checked(await getCloudServiceClient().from('ikari_settings').upsert({ id: 1, value }));
  return value;
}
export async function listMedia(actorId: string): Promise<Media[]> {
  await assertCloudEditor(actorId);
  const rows = checked(await getCloudServiceClient().from('ikari_media').select(MEDIA_COLUMNS).order('createdAt', { ascending: false }).order('id')) as StoredMedia[];
  return rows.map(asMedia);
}
type ImageInfo = { filename: string; mime: string; alt: string };
function validateImageInfo(info: ImageInfo) {
  if (!info.filename || info.filename.length > 200 || /[\\/\x00-\x1f]/.test(info.filename)) throw new Error('Nome de arquivo inválido.');
  if (!['', 'application/octet-stream', 'image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) throw new Error('Envie JPEG, PNG ou WebP estático.');
  z.string().max(300).parse(info.alt);
}
/** Upload browser -> private staging Storage, bypassing serverless body limits.
 * The signed URL is a short-lived capability: never log or persist its token. */
export async function beginImageUpload(info: ImageInfo, actorId: string): Promise<{ uploadId: string; signedUrl: string; token: string; path: string }> {
  await assertCloudEditor(actorId); validateImageInfo(info);
  const uploadId = randomUUID(), path = `${actorId}/${uploadId}`;
  const data = checked(await getCloudServiceClient().storage.from(UPLOAD_BUCKET).createSignedUploadUrl(path, { upsert: false }));
  if (!data) throw new Error('Não foi possível preparar o envio da imagem.');
  return { uploadId, signedUrl: data.signedUrl, token: data.token, path: data.path };
}
/** Authenticated finalization re-decodes actual bytes; client MIME is only a hint.
 * Staging is removed after success or failure; failed clients request a new URL. */
export async function completeImageUpload(uploadId: string, info: ImageInfo, actorId: string): Promise<Media> {
  await assertCloudEditor(actorId); z.uuid().parse(uploadId); validateImageInfo(info);
  const bucket = getCloudServiceClient().storage.from(UPLOAD_BUCKET), path = `${actorId}/${uploadId}`;
  try {
    const data = checked(await bucket.download(path));
    if (!data || !data.size || data.size > MAX_IMAGE_BYTES) throw new Error('Imagem excede o limite de 12 MiB.');
    return await uploadImage(new Uint8Array(await data.arrayBuffer()), info, actorId);
  } finally { await bucket.remove([path]).catch(() => {}); }
}
let processing = 0;
export async function uploadImage(bytes: Uint8Array, info: ImageInfo, actorId: string): Promise<Media> {
  await assertCloudEditor(actorId);
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) throw new Error('Imagem excede o limite de 12 MiB.');
  validateImageInfo(info);
  const allowed: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
  const unknownMime = info.mime === '' || info.mime === 'application/octet-stream';
  if (!unknownMime && !Object.values(allowed).includes(info.mime)) throw new Error('Envie JPEG, PNG ou WebP estático.');
  if (processing >= 2) throw new Error('Aguarde a imagem anterior terminar.');
  processing++;
  const client = getCloudServiceClient(), bucket = client.storage.from(BUCKET), id = randomUUID(), uploaded: string[] = [];
  try {
    const image = sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' }), metadata = await image.metadata();
    if (!metadata.format || !allowed[metadata.format] || (!unknownMime && allowed[metadata.format] !== info.mime) || (metadata.pages || 1) !== 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) throw new Error('Formato, animação ou dimensões de imagem não permitidos.');
    const result = await image.rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    if (result.data.byteLength > 4 * 1024 * 1024) throw new Error('Imagem normalizada excede o limite de entrega; envie uma versão menor.');
    const filename = `${id}.webp`, storageKey = `media/${filename}`, originalKey = `originals/${id}.${metadata.format === 'jpeg' ? 'jpg' : metadata.format}`;
    checked(await bucket.upload(originalKey, bytes, { contentType: allowed[metadata.format], upsert: false })); uploaded.push(originalKey);
    checked(await bucket.upload(storageKey, result.data, { contentType: 'image/webp', upsert: false })); uploaded.push(storageKey);
    const row: StoredMedia = { id, filename, mime: 'image/webp', size: result.data.byteLength, width: result.info.width, height: result.info.height, alt: info.alt.trim(), createdAt: new Date().toISOString(), checksum: createHash('sha256').update(result.data).digest('hex'), storageKey, originalKey };
    checked(await client.from('ikari_media').insert(row));
    return asMedia(row);
  } catch (error) {
    if (uploaded.length) await bucket.remove(uploaded).catch(() => {});
    if (error instanceof Error && !error.message.startsWith('Input buffer') && !error.message.startsWith('Vips')) throw error;
    throw new Error('A imagem enviada não pôde ser decodificada.');
  } finally { processing--; }
}
function validMediaKey(row: StoredMedia): boolean {
  return z.uuid().safeParse(row.id).success && row.filename === `${row.id}.webp` && row.storageKey === `media/${row.id}.webp`
    && (!row.originalKey || new RegExp(`^originals/${row.id}\\.(?:jpg|png|webp)$`).test(row.originalKey));
}
export async function getMediaFile(id: string, actorId?: string): Promise<{ media: Media; bytes: Buffer } | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const client = getCloudServiceClient();
  if (actorId) await assertCloudEditor(actorId);
  else if (!checked(await client.from('ikari_projects').select('id').eq('coverMediaId', id).eq('status', 'published').limit(1))?.length) return null;
  const row = checked(await client.from('ikari_media').select(MEDIA_COLUMNS).eq('id', id).maybeSingle()) as StoredMedia | null;
  if (!row || !validMediaKey(row)) return null;
  const { data, error } = await client.storage.from(BUCKET).download(row.storageKey);
  if (error || !data) return null;
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length !== row.size || createHash('sha256').update(bytes).digest('hex') !== row.checksum) return null;
  return { media: asMedia(row), bytes };
}
export async function deleteMedia(id: string, actorId: string): Promise<void> {
  await assertCloudEditor(actorId); z.uuid().parse(id);
  const client = getCloudServiceClient();
  if (checked(await client.from('ikari_projects').select('id').eq('coverMediaId', id).limit(1))?.length) throw new Error('Esta imagem está associada a um trabalho.');
  const row = checked(await client.from('ikari_media').select(MEDIA_COLUMNS).eq('id', id).maybeSingle()) as StoredMedia | null;
  if (!row) return;
  if (!validMediaKey(row)) throw new Error('Caminho de mídia inválido.');
  // Delete DB row first: FK prevents a concurrently attached image from losing bytes.
  checked(await client.from('ikari_media').delete().eq('id', id));
  checked(await client.storage.from(BUCKET).remove([row.storageKey, ...(row.originalKey ? [row.originalKey] : [])]));
}
async function excerptRecord(project: Project): Promise<{ entry: ProjectExcerpt; storageKey: string } | null> {
  if (!z.uuid().safeParse(project.id).success || !project.sourceUrl) return null;
  const row = checked(await getCloudServiceClient().from('ikari_excerpts').select('projectId,entry,storageKey').eq('projectId', project.id).maybeSingle()) as StoredExcerpt | null;
  if (!row) return null;
  const parsed = excerptEntrySchema.safeParse(row.entry);
  if (!parsed.success || parsed.data.sourceUrl !== project.sourceUrl || row.storageKey !== `excerpts/${parsed.data.filename}`) return null;
  return { entry: { ...parsed.data, src: `/trechos/${project.id}` }, storageKey: row.storageKey };
}
export async function getProjectExcerpt(project: Project): Promise<ProjectExcerpt | null> {
  return (await excerptRecord(project))?.entry || null;
}
/** Server-only proxy helper. Every call checks the persisted project visibility. */
export async function getExcerptFile(id: string, actorId?: string): Promise<{ excerpt: ProjectExcerpt; signedUrl: string } | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const client = getCloudServiceClient();
  if (actorId) await assertCloudEditor(actorId);
  let query = client.from('ikari_projects').select(PROJECT_COLUMNS).eq('id', id);
  if (!actorId) query = query.eq('status', 'published');
  const project = checked(await query.maybeSingle()) as Project | null;
  if (!project) return null;
  const result = await excerptRecord(project);
  if (!result) return null;
  // Storage serves byte ranges directly; no multi-megabyte response passes
  // through the Vercel Function. Each new URL rechecks persisted visibility.
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(result.storageKey, 60);
  if (error || !data) return null;
  return { excerpt: result.entry, signedUrl: data.signedUrl };
}
