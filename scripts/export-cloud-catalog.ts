/** Read-only public export. Never imports app config, auth or SQLite migrations. */
import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { constants, closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { readExcerptManifest } from '../src/lib/server/excerpts';
import type { Category, Project, SiteSettings } from '../src/lib/domain/types';

const uuid = z.uuid();
const projectColumns = 'id,slug,title,summary,description,categoryId,coverMediaId,coverUrl,coverAlt,videoUrl,sourceUrl,featured,sortOrder,status,createdAt,updatedAt';
const settingsKeys = ['brandName', 'headline', 'subheadline', 'about', 'email', 'instagramUrl', 'accentColor', 'servicesText', 'availability'] as const;
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inside = (parent: string, child: string) => { const path = relative(parent, child); return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path)); };
function noLinks(path: string): void {
  const absolute = resolve(path), root = parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    try { if (lstatSync(current).isSymbolicLink()) throw new Error('Links simbólicos não são permitidos na exportação.'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
}
function readRegular(path: string): Buffer {
  noLinks(path);
  const expected = lstatSync(path);
  if (!expected.isFile()) throw new Error('Asset inválido.');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.dev !== expected.dev || opened.ino !== expected.ino || opened.size !== expected.size) throw new Error('Asset alterado durante leitura.');
    return readFileSync(fd);
  } finally { closeSync(fd); }
}
type Asset = { path: string; storageKey: string; sha256: string; size: number; contentType: string; publicUrl: string };
export function exportCloudCatalog(dataPath: string, destination: string) {
  const dataDir = resolve(dataPath), output = resolve(destination);
  noLinks(dataDir); noLinks(output);
  if (inside(repo, dataDir) || inside(repo, output)) throw new Error('Dados e exportação devem permanecer fora do repositório.');
  if (existsSync(output)) throw new Error('A pasta de saída já existe; escolha uma nova pasta.');
  if (!existsSync(dataDir) || realpathSync(dataDir) !== dataDir) throw new Error('Diretório de dados inválido.');
  const dbPath = join(dataDir, 'frame.sqlite'); noLinks(dbPath);
  const database = new Database(dbPath, { readonly: true, fileMustExist: true });
  const assets: Asset[] = [];
  const files = new Map<string, Buffer>();
  try {
    database.pragma('query_only = ON');
    // All DB reads share one consistent snapshot. Explicit column allowlists
    // prevent future private columns from silently entering the bundle.
    const result = database.transaction(() => {
      const projects = database.prepare(`SELECT ${projectColumns} FROM projects WHERE status='published' ORDER BY sortOrder,createdAt DESC,id`).all().map(row => ({ ...(row as Project), featured: Boolean((row as Project).featured) }));
      for (const project of projects) {
        uuid.parse(project.id);
        if (project.categoryId) uuid.parse(project.categoryId);
        if (project.coverMediaId) { uuid.parse(project.coverMediaId); project.coverUrl = `/media/${project.coverMediaId}`; }
        for (const url of [project.sourceUrl, project.videoUrl]) {
          if (!url) continue;
          let parsed: URL;
          try { parsed = new URL(url); } catch { throw new Error('URL pública inválida no catálogo.'); }
          if (parsed.protocol !== 'https:' || parsed.username || parsed.password || /[\x00-\x20\x7f\\]/.test(url)) throw new Error('URL pública inválida no catálogo.');
        }
      }
      const categories = database.prepare("SELECT id,name,slug,sortOrder FROM categories WHERE id IN (SELECT categoryId FROM projects WHERE status='published') ORDER BY sortOrder,name").all() as Category[];
      const settingRow = database.prepare('SELECT value FROM site_settings WHERE id=1').get() as { value: string } | undefined;
      if (!settingRow) throw new Error('Configuração pública ausente.');
      const rawSettings: unknown = JSON.parse(settingRow.value);
      const parsedSettings = z.record(z.string(), z.unknown()).parse(rawSettings);
      const settings = Object.fromEntries(settingsKeys.map(key => [key, z.string().parse(parsedSettings[key])])) as unknown as SiteSettings;
      const mediaRows = database.prepare("SELECT id,filename,mime,size,width,height,alt,createdAt,checksum FROM media WHERE id IN (SELECT coverMediaId FROM projects WHERE status='published') ORDER BY id").all() as { id: string; filename: string; mime: string; size: number; width: number; height: number; alt: string; createdAt: string; checksum: string }[];
      const media = mediaRows.map(row => {
        uuid.parse(row.id);
        if (row.filename !== `${row.id}.webp` || row.mime !== 'image/webp') throw new Error('Nome ou formato de mídia inválido.');
        const bytes = readRegular(join(dataDir, 'media', row.filename));
        const checksum = createHash('sha256').update(bytes).digest('hex');
        if (bytes.length !== row.size || checksum !== row.checksum) throw new Error('Checksum de mídia divergente.');
        const storageKey = `media/${row.id}.webp`, path = `assets/${storageKey}`;
        files.set(path, bytes);
        assets.push({ path, storageKey, sha256: checksum, size: bytes.length, contentType: 'image/webp', publicUrl: `/media/${row.id}` });
        return { ...row, storageKey, originalKey: null };
      });
      const manifest = readExcerptManifest(dataDir);
      const excerpts = projects.flatMap(project => {
        const entry = manifest.entries.find(item => item.sourceUrl === project.sourceUrl);
        if (!entry) return [];
        const bytes = readRegular(join(dataDir, 'excerpts', entry.filename));
        if (bytes.length !== entry.size || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('Checksum de trecho divergente.');
        const storageKey = `excerpts/${entry.filename}`, path = `assets/${storageKey}`;
        if (!files.has(path)) {
          files.set(path, bytes);
          assets.push({ path, storageKey, sha256: entry.sha256, size: entry.size, contentType: 'video/mp4', publicUrl: `/trechos/${project.id}` });
        }
        return [{ projectId: project.id, entry, storageKey }];
      });
      for (const project of projects) {
        if (project.coverMediaId && !media.some(item => item.id === project.coverMediaId)) throw new Error('Capa publicada ausente.');
        if (!project.coverMediaId && project.coverUrl) {
          if (!/^\/demo\/[a-zA-Z0-9_-]+\.webp$/.test(project.coverUrl)) throw new Error('Capa pública sem asset gerenciado.');
          const filename = project.coverUrl.slice('/demo/'.length), bytes = readRegular(join(repo, 'static', 'demo', filename));
          const path = `assets/static/demo/${filename}`, storageKey = `static/demo/${filename}`;
          if (!files.has(path)) { files.set(path, bytes); assets.push({ path, storageKey, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, contentType: 'image/webp', publicUrl: project.coverUrl }); }
        }
      }
      return { version: 1, exportedAt: new Date().toISOString(), projects, categories, settings, media, excerpts };
    })();
    // No write to source data. The fresh output folder is never reused/overwritten.
    mkdirSync(output, { recursive: true });
    for (const [path, bytes] of files) {
      const target = join(output, path);
      if (!inside(output, target)) throw new Error('Destino de asset inválido.');
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
    }
    const manifest = { version: 1, assets, counts: { projects: result.projects.length, categories: result.categories.length, media: result.media.length, excerpts: result.excerpts.length, assets: assets.length } };
    writeFileSync(join(output, 'catalog.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    writeFileSync(join(output, 'assets-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    return manifest.counts;
  } finally { database.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), options = new Map<string, string>();
    for (let index = 0; index < args.length; index += 2) {
      if (!['--data-dir', '--out'].includes(args[index]) || !args[index + 1] || options.has(args[index])) throw new Error('Uso: tsx scripts/export-cloud-catalog.ts --data-dir DIRETORIO --out NOVA_PASTA');
      options.set(args[index], args[index + 1]);
    }
    const dataDir = resolve(options.get('--data-dir') || process.env.DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'Frame', 'data'));
    const output = options.get('--out') || join(dataDir, 'exports', `ikari-cloud-${randomUUID()}`);
    const counts = exportCloudCatalog(dataDir, output);
    console.info(`Exportação pública verificada: ${counts.projects} trabalhos, ${counts.categories} categorias, ${counts.media} imagens, ${counts.excerpts} trechos.`);
  } catch (error) {
    console.error(error instanceof Error && !error.message.includes('SQLITE') ? error.message : 'Não foi possível exportar o catálogo público.');
    process.exitCode = 1;
  }
}
