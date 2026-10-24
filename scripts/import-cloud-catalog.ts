/** Manual public-catalog import. --dry-run validates locally without a client,
 * credentials or network. Production keys come only from private environment. */
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { excerptEntrySchema } from '../src/lib/server/excerpt-schema';
import { parseVideoUrl } from '../src/lib/server/video-url';

// The Free plan's documented global ceiling is 50 MB. Do not silently recode
// larger originals or raise this ceiling because an individual bucket allows it.
export const MAX_CLOUD_ASSET_BYTES = 50_000_000;
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/), uuid = z.uuid();
const slug = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const order = z.number().int().min(0).max(10000), date = z.iso.datetime({ offset: true });
const secureUrl = z.string().max(2048).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !/[\x00-\x20\x7f\\]/.test(value); } catch { return false; }
});
const categorySchema = z.object({ id: uuid, name: z.string().min(1).max(100), slug, sortOrder: order }).strict();
const projectSchema = z.object({ id: uuid, slug, title: z.string().min(1).max(160), summary: z.string().max(500), description: z.string().max(10000), categoryId: uuid.nullable(), coverMediaId: uuid.nullable(), coverUrl: z.string().max(250), coverAlt: z.string().max(300), videoUrl: secureUrl, sourceUrl: secureUrl, featured: z.boolean(), sortOrder: order, status: z.literal('published'), createdAt: date, updatedAt: date }).strict();
const mediaSchema = z.object({ id: uuid, filename: z.string(), mime: z.literal('image/webp'), size: z.number().int().positive().max(4 * 1024 * 1024), width: z.number().int().min(1).max(1800), height: z.number().int().min(1).max(1800), alt: z.string().max(300), createdAt: date, checksum: checksumSchema, storageKey: z.string(), originalKey: z.null() }).strict();
const settingsSchema = z.object({ brandName: z.string().min(1).max(60), headline: z.string().min(1).max(180), subheadline: z.string().max(300), about: z.string().max(4000), email: z.union([z.literal(''), z.email().max(254)]), instagramUrl: secureUrl, accentColor: z.string().regex(/^#[a-fA-F0-9]{6}$/), servicesText: z.string().max(2000), availability: z.string().max(200) }).strict();
const catalogSchema = z.object({ version: z.literal(1), exportedAt: date, projects: z.array(projectSchema).max(10000), categories: z.array(categorySchema).max(10000), settings: settingsSchema, media: z.array(mediaSchema).max(10000), excerpts: z.array(z.object({ projectId: uuid, entry: excerptEntrySchema, storageKey: z.string() }).strict()).max(10000) }).strict();
const assetSchema = z.object({ path: z.string().max(250), storageKey: z.string().max(200), sha256: checksumSchema, size: z.number().int().positive().max(MAX_CLOUD_ASSET_BYTES), contentType: z.enum(['image/webp', 'video/mp4']), publicUrl: z.string().max(250) }).strict();
const countsSchema = z.object({ projects: z.number().int().nonnegative(), categories: z.number().int().nonnegative(), media: z.number().int().nonnegative(), excerpts: z.number().int().nonnegative(), assets: z.number().int().nonnegative() }).strict();
const manifestSchema = z.object({ version: z.literal(1), assets: z.array(assetSchema).max(20000), counts: countsSchema }).strict();
type Catalog = z.infer<typeof catalogSchema>;
type Asset = z.infer<typeof assetSchema>;
type PreparedAsset = Asset & { bytes: Buffer };
const inside = (parent: string, child: string) => { const path = relative(parent, child); return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`)); };
function regularFile(path: string, maxBytes: number): Buffer {
  const absolute = resolve(path), root = parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(sep).filter(Boolean)) { current = join(current, part); if (lstatSync(current).isSymbolicLink()) throw new Error('Links não são permitidos no pacote.'); }
  const expected = lstatSync(absolute);
  if (!expected.isFile() || expected.size > maxBytes) throw new Error('Arquivo inválido ou maior que o limite permitido.');
  const fd = openSync(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== expected.dev || opened.ino !== expected.ino || opened.size !== expected.size) throw new Error('Arquivo alterado durante leitura.');
    return readFileSync(fd);
  } finally { closeSync(fd); }
}
function unique(values: string[], label: string) { if (new Set(values).size !== values.length) throw new Error(`${label} duplicado no pacote.`); }
export function readCloudCatalogBundle(directory: string): { catalog: Catalog; assets: PreparedAsset[]; counts: z.infer<typeof countsSchema> } {
  const root = resolve(directory), repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (inside(repo, root)) throw new Error('O pacote deve permanecer fora do repositório.');
  const catalog = catalogSchema.parse(JSON.parse(regularFile(join(root, 'catalog.json'), 16 * 1024 * 1024).toString('utf8')));
  const manifest = manifestSchema.parse(JSON.parse(regularFile(join(root, 'assets-manifest.json'), 16 * 1024 * 1024).toString('utf8')));
  const counts = { projects: catalog.projects.length, categories: catalog.categories.length, media: catalog.media.length, excerpts: catalog.excerpts.length, assets: manifest.assets.length };
  for (const key of Object.keys(counts) as (keyof typeof counts)[]) if (counts[key] !== manifest.counts[key]) throw new Error('Contagens do catálogo e manifesto divergentes.');
  unique(catalog.projects.map(p => p.id), 'ID de trabalho'); unique(catalog.projects.map(p => p.slug), 'Slug de trabalho');
  unique(catalog.categories.map(c => c.id), 'ID de categoria'); unique(catalog.categories.map(c => c.slug), 'Slug de categoria');
  unique(catalog.media.map(m => m.id), 'ID de mídia'); unique(catalog.excerpts.map(e => e.projectId), 'Trecho');
  unique(manifest.assets.map(a => a.storageKey), 'Asset'); unique(manifest.assets.map(a => a.path), 'Caminho');
  const expectedAssets = new Map<string, { sha256?: string; size?: number; contentType: Asset['contentType']; publicUrl: string }>();
  for (const item of catalog.media) {
    if (!catalog.projects.some(project => project.coverMediaId === item.id)) throw new Error('Mídia sem referência pública no pacote.');
    if (item.filename !== `${item.id}.webp` || item.storageKey !== `media/${item.id}.webp`) throw new Error('Caminho de mídia inválido.');
    expectedAssets.set(item.storageKey, { sha256: item.checksum, size: item.size, contentType: 'image/webp', publicUrl: `/media/${item.id}` });
  }
  for (const project of catalog.projects) {
    if (project.categoryId && !catalog.categories.some(c => c.id === project.categoryId)) throw new Error('Categoria referenciada ausente.');
    if (project.coverMediaId) {
      if (!catalog.media.some(m => m.id === project.coverMediaId) || project.coverUrl !== `/media/${project.coverMediaId}`) throw new Error('Capa referenciada ausente ou divergente.');
    } else if (project.coverUrl) {
      if (!/^\/demo\/[a-zA-Z0-9_-]+\.webp$/.test(project.coverUrl)) throw new Error('Capa pública inválida.');
      expectedAssets.set(`static${project.coverUrl}`, { contentType: 'image/webp', publicUrl: project.coverUrl });
    }
    if (project.videoUrl) parseVideoUrl(project.videoUrl);
  }
  for (const excerpt of catalog.excerpts) {
    const project = catalog.projects.find(p => p.id === excerpt.projectId);
    if (!project || project.sourceUrl !== excerpt.entry.sourceUrl || excerpt.storageKey !== `excerpts/${excerpt.entry.filename}`) throw new Error('Referência de trecho divergente.');
    const existing = expectedAssets.get(excerpt.storageKey);
    if (existing && (existing.sha256 !== excerpt.entry.sha256 || existing.size !== excerpt.entry.size)) throw new Error('Trechos com bytes divergentes.');
    if (!existing) expectedAssets.set(excerpt.storageKey, { sha256: excerpt.entry.sha256, size: excerpt.entry.size, contentType: 'video/mp4', publicUrl: `/trechos/${project.id}` });
  }
  if (expectedAssets.size !== manifest.assets.length) throw new Error('Assets extras ou ausentes no pacote.');
  const assets = manifest.assets.map(asset => {
    const expected = expectedAssets.get(asset.storageKey);
    if (!expected || asset.path !== `assets/${asset.storageKey}` || asset.contentType !== expected.contentType || asset.publicUrl !== expected.publicUrl || (expected.sha256 && asset.sha256 !== expected.sha256) || (expected.size && asset.size !== expected.size)) throw new Error('Manifesto de asset divergente do catálogo.');
    if (!/^(?:media\/[a-f0-9-]{36}\.webp|excerpts\/[1-9][0-9]{0,24}\.mp4|static\/demo\/[a-zA-Z0-9_-]+\.webp)$/.test(asset.storageKey)) throw new Error('Caminho de asset inválido.');
    const path = resolve(root, asset.path);
    if (!inside(root, path)) throw new Error('Caminho fora do pacote.');
    const bytes = regularFile(path, MAX_CLOUD_ASSET_BYTES);
    if (bytes.length !== asset.size || sha256(bytes) !== asset.sha256) throw new Error('Integridade de asset divergente.');
    return { ...asset, bytes };
  });
  return { catalog, assets, counts };
}
function storageNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as { code?: unknown }).code === 'NoSuchKey') return true;
  const status = (error as { statusCode?: unknown; status?: unknown }).statusCode ?? (error as { status?: unknown }).status;
  return String(status) === '404';
}
export async function importCloudCatalog(directory: string, options: { dryRun?: boolean; client?: SupabaseClient } = {}) {
  // Validate every local file before making any network request or reading keys.
  const prepared = readCloudCatalogBundle(directory);
  const summary = { dryRun: Boolean(options.dryRun), ...prepared.counts, bytes: prepared.assets.reduce((total, asset) => total + asset.size, 0), uploaded: 0, reused: 0 };
  if (options.dryRun) return summary;
  const client = options.client || (await import('../src/lib/server/cloud/client')).getCloudServiceClient();
  const bucket = client.storage.from('ikari-media');
  // No overwrite: an existing object must have exactly the approved bytes.
  // This makes retries safe and refuses accidental replacement of CMS assets.
  for (const asset of prepared.assets) {
    // /demo is already deployed from static/. Its package copy verifies the
    // public snapshot, but is never uploaded as an unreachable Storage object.
    if (asset.storageKey.startsWith('static/')) continue;
    const remote = await bucket.download(asset.storageKey);
    if (!remote.error && remote.data) {
      if (remote.data.size !== asset.size || sha256(new Uint8Array(await remote.data.arrayBuffer())) !== asset.sha256) throw new Error('Asset remoto diverge do pacote; importação interrompida sem sobrescrever.');
      summary.reused++;
      continue;
    }
    if (!storageNotFound(remote.error)) throw new Error('Não foi possível verificar o asset remoto; nenhuma substituição foi feita.');
    const uploaded = await bucket.upload(asset.storageKey, asset.bytes, { contentType: asset.contentType, cacheControl: '60', upsert: false });
    if (uploaded.error) {
      // A concurrent manual import may have created the immutable key first.
      const raced = await bucket.download(asset.storageKey);
      if (raced.error || !raced.data || raced.data.size !== asset.size || sha256(new Uint8Array(await raced.data.arrayBuffer())) !== asset.sha256) throw new Error('Não foi possível importar o asset sem sobrescrever.');
      summary.reused++;
    } else {
      // Round-trip confirmation precedes publication of metadata.
      const verification = await bucket.download(asset.storageKey);
      if (verification.error || !verification.data || verification.data.size !== asset.size || sha256(new Uint8Array(await verification.data.arrayBuffer())) !== asset.sha256) throw new Error('Verificação do asset remoto falhou; catálogo ainda não alterado.');
      summary.uploaded++;
    }
  }
  const imported = await client.rpc('ikari_import_catalog', { batch: prepared.catalog });
  if (imported.error) throw new Error('Assets preparados; transação do catálogo falhou. Reexecute a importação após corrigir o schema.');
  for (const key of ['projects', 'categories', 'media', 'excerpts'] as const) if (!imported.data || imported.data[key] !== prepared.counts[key]) throw new Error('Resposta da transação diverge do catálogo; confira o estado remoto antes de continuar.');
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2); let directory: string | undefined, dryRun = false;
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--dry-run' && !dryRun) dryRun = true;
      else if (args[index] === '--bundle' && !directory && args[index + 1]) directory = args[++index];
      else throw new Error('Argumentos inválidos.');
    }
    if (!directory) throw new Error('Diretório do pacote ausente.');
    const summary = await importCloudCatalog(directory, { dryRun });
    console.info(`${dryRun ? 'Dry-run local' : 'Importação verificada'}: ${summary.projects} trabalhos, ${summary.categories} categorias, ${summary.media} imagens, ${summary.excerpts} trechos; ${summary.uploaded} uploads, ${summary.reused} assets reutilizados.`);
  } catch {
    // No raw SDK error, environment value, signed URL, local path or key in logs.
    console.error('Não foi possível concluir a importação. Confira pacote, hashes, limites e schema. Uso: tsx scripts/import-cloud-catalog.ts --bundle DIRETORIO [--dry-run]');
    process.exitCode = 1;
  }
}
