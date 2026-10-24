import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { readExcerptManifest } from '../src/lib/server/excerpts';

export interface BackupOptions { dataDir: string; destination?: string; serverStopped: boolean }
export interface RestoreOptions { dataDir: string; destination?: string }
interface OperationResult { directory: string; installationId: string; files: number; counts: { projects: number; media: number; inquiries: number } }
const fileSchema = z.object({ path: z.string().max(200), size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const manifestSchema = z.object({
  format: z.literal('frame-backup'), version: z.literal(1), backupId: z.uuid(), createdAt: z.iso.datetime(),
  installationId: z.uuid(), schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]), files: z.array(fileSchema).min(1).max(100_000)
}).strict();
type Manifest = z.infer<typeof manifestSchema>;
type FileEntry = z.infer<typeof fileSchema>;
const uuidPattern = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const mediaPattern = new RegExp(`^${uuidPattern}\\.webp$`, 'i');
const originalPattern = new RegExp(`^originals/${uuidPattern}\\.(jpg|png|webp)$`, 'i');
const excerptPattern = /^excerpts\/[1-9][0-9]{0,24}\.mp4$/;

// Importar config.ts criaria segredo/diretórios: comandos de leitura não fazem isso.
export function configuredDataDir(): string {
  if (existsSync('.env')) process.loadEnvFile('.env');
  return resolve(process.env.DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'Frame', 'data'));
}
function within(root: string, path: string): boolean {
  const suffix = relative(resolve(root), resolve(path));
  return suffix === '' || (!suffix.startsWith(`..${sep}`) && suffix !== '..' && !isAbsolute(suffix));
}
function noLinks(path: string): void {
  const absolute = resolve(path), volume = parse(absolute).root;
  let current = volume;
  for (const part of absolute.slice(volume.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    if (existsSync(current)) {
      if (lstatSync(current).isSymbolicLink()) throw new Error('Link/atalho não permitido no caminho da operação.');
    } else {
      // existsSync ignora links quebrados; lstat continua detectando-os.
      try { if (lstatSync(current).isSymbolicLink()) throw new Error('Link/atalho não permitido.'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
}
function checkedFile(root: string, path: string): string {
  if (path !== 'frame.sqlite' && path !== 'excerpts/manifest.json' && !excerptPattern.test(path) && !(path.startsWith('media/') && mediaPattern.test(path.slice(6))) && !originalPattern.test(path)) {
    throw new Error('Caminho de arquivo inválido no manifesto/banco.');
  }
  const absolute = join(root, path); noLinks(absolute);
  if (!lstatSync(absolute).isFile()) throw new Error('Arquivo ausente ou inválido no pacote.');
  return absolute;
}
async function entryFor(root: string, path: string): Promise<FileEntry> {
  const absolute = checkedFile(root, path), size = lstatSync(absolute).size;
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(absolute)) hash.update(chunk);
  if (lstatSync(absolute).size !== size) throw new Error('Arquivo alterado durante operação.');
  return { path, size, sha256: hash.digest('hex') };
}
function openReadOnly(path: string): Database.Database { return new Database(path, { readonly: true, fileMustExist: true, timeout: 5000 }); }
function inspectDatabase(db: Database.Database) {
  const version = Number(db.pragma('user_version', { simple: true }));
  if (![1, 2, 3].includes(version)) throw new Error('Versão de schema incompatível.');
  if (db.pragma('integrity_check', { simple: true }) !== 'ok' || (db.pragma('foreign_key_check') as unknown[]).length) throw new Error('Integridade do banco inválida.');
  const required = ['installation', 'user', 'owner', 'account', 'session', 'verification', 'categories', 'media', 'projects', 'site_settings', 'inquiries', 'audit'];
  const tables = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((row) => row.name));
  if (required.some((table) => !tables.has(table))) throw new Error('Schema do banco incompleto.');
  const installation = db.prepare('SELECT uuid, schemaVersion FROM installation WHERE id=1').get() as { uuid: string; schemaVersion: number } | undefined;
  if (!installation || installation.schemaVersion !== version || !z.uuid().safeParse(installation.uuid).success) throw new Error('Identificação/versão da instalação inválida.');
  if (version === 2 && !(db.pragma('table_info(projects)') as { name: string }[]).some((column) => column.name === 'sourceUrl')) throw new Error('Schema 2 sem publicação original.');
  const media = db.prepare('SELECT id,filename,checksum,size FROM media').all() as { id: string; filename: string; checksum: string; size: number }[];
  const counts = {
    projects: (db.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number }).n,
    media: media.length,
    inquiries: (db.prepare('SELECT COUNT(*) AS n FROM inquiries').get() as { n: number }).n
  };
  return { installation, media, counts };
}
function verifyReferences(db: Database.Database, manifest: Manifest, packageDir: string) {
  const info = inspectDatabase(db);
  if (info.installation.schemaVersion !== manifest.schemaVersion) throw new Error('Versão de schema do manifesto diverge do banco.');
  if (info.installation.uuid !== manifest.installationId) throw new Error('Banco pertence a outra instalação.');
  const entries = new Map(manifest.files.map((f) => [f.path, f]));
  const expected = new Set(['frame.sqlite']);
  for (const media of info.media) {
    if (!z.uuid().safeParse(media.id).success || media.filename !== `${media.id}.webp`) throw new Error('Caminho de mídia inválido no banco.');
    const key = `media/${media.filename}`, entry = entries.get(key);
    if (!entry || entry.sha256 !== media.checksum || entry.size !== media.size) throw new Error('Integridade/referência de mídia inválida.');
    expected.add(key);
    const originals = ['jpg', 'png', 'webp'].map((extension) => `originals/${media.id}.${extension}`).filter((path) => entries.has(path));
    if (originals.length !== 1) throw new Error('Original ausente ou ambíguo no pacote.');
    expected.add(originals[0]);
  }
  if ([...entries.keys()].some((path) => path.startsWith('excerpts/'))) {
    if (!entries.has('excerpts/manifest.json')) throw new Error('Manifesto de trechos ausente no pacote.');
    expected.add('excerpts/manifest.json');
    const excerpts = readExcerptManifest(packageDir);
    for (const excerpt of excerpts.entries) {
      const key = `excerpts/${excerpt.filename}`, entry = entries.get(key);
      if (!entry || entry.size !== excerpt.size || entry.sha256 !== excerpt.sha256) throw new Error('Integridade/referência de trecho inválida.');
      expected.add(key);
    }
  }
  if (expected.size !== entries.size || [...entries.keys()].some((path) => !expected.has(path))) throw new Error('Manifesto contém arquivo sem referência no banco.');
  return info;
}
function validateOutput(destination: string, forbidden: string[]): void {
  if (!isAbsolute(destination)) throw new Error('Destino precisa ser absoluto.');
  noLinks(destination);
  if (forbidden.some((root) => within(root, destination) || within(destination, root))) throw new Error('Destino coincide com origem, dados ativos ou código do projeto.');
  if (existsSync(destination)) throw new Error('Destino existente: não será sobrescrito.');
}
function removeOwnedStaging(staging: string, parent: string): void {
  if (dirname(staging) !== parent || !within(parent, staging) || !parse(staging).base.includes('.partial-')) throw new Error('Diretório de limpeza inválido.');
  noLinks(staging); rmSync(staging, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
function publishStaging(staging: string, destination: string) {
  noLinks(destination);
  // Windows não renomeia diretório sobre outro diretório, mesmo vazio.
  // Lock irmão reserva o destino sem materializar um pacote incompleto.
  const lock = `${destination}.operation-lock`; noLinks(lock);
  mkdirSync(lock, { mode: 0o700 });
  try {
    if (existsSync(destination)) throw new Error('Destino existente: não será sobrescrito.');
    renameSync(staging, destination);
  } finally { noLinks(lock); rmdirSync(lock); }
}
async function validatePackage(packageDir: string) {
  noLinks(packageDir);
  const manifestPath = join(packageDir, 'manifest.json'); noLinks(manifestPath);
  if (!existsSync(manifestPath) || !lstatSync(manifestPath).isFile() || lstatSync(manifestPath).size > 16 * 1024 * 1024) throw new Error('Manifesto ausente ou inválido.');
  let manifest: Manifest;
  try { manifest = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8'))); }
  catch { throw new Error('Manifesto inválido ou versão de schema incompatível.'); }
  const paths = new Set(manifest.files.map((file) => file.path.toLowerCase()));
  if (paths.size !== manifest.files.length) throw new Error('Entrada duplicada no manifesto.');
  if (!manifest.files.some((file) => file.path === 'frame.sqlite')) throw new Error('Banco ausente no manifesto.');
  for (const file of manifest.files) {
    const actual = await entryFor(packageDir, file.path);
    if (actual.size !== file.size || actual.sha256 !== file.sha256) throw new Error('Tamanho/hash de integridade inválido.');
  }
  // Pacote autossuficiente: sidecars WAL, segredos e arquivos não declarados não entram.
  const declared = new Set([...manifest.files.map((file) => file.path), 'manifest.json']);
  for (const item of readdirSync(packageDir, { withFileTypes: true })) {
    const itemPath = join(packageDir, item.name); noLinks(itemPath);
    if (item.isDirectory()) {
      if (!['media', 'originals', 'excerpts'].includes(item.name)) throw new Error('Diretório não declarado no pacote.');
      for (const child of readdirSync(itemPath, { withFileTypes: true })) {
        const key = `${item.name}/${child.name}`;
        if (!declared.has(key)) throw new Error('Arquivo não declarado no pacote.');
        checkedFile(packageDir, key);
      }
    } else if (!item.isFile() || !declared.has(item.name)) throw new Error('Arquivo não declarado no pacote (WAL/SHM não permitido).');
  }
  // Mesmo readonly pode criar WAL/SHM para banco com header WAL.
  // Inspecionar cópia privada evita qualquer escrita lateral no pacote recebido.
  const inspectionParent = resolve(tmpdir()); noLinks(inspectionParent);
  const inspection = mkdtempSync(join(inspectionParent, '.frame-inspect.partial-'));
  try {
    copyFileSync(checkedFile(packageDir, 'frame.sqlite'), join(inspection, 'frame.sqlite'));
    const actual = await entryFor(inspection, 'frame.sqlite');
    if (actual.sha256 !== manifest.files.find((file) => file.path === 'frame.sqlite')!.sha256) throw new Error('Hash do banco mudou durante leitura.');
    const db = openReadOnly(join(inspection, 'frame.sqlite'));
    try { return { manifest, info: verifyReferences(db, manifest, packageDir) }; }
    finally { db.close(); }
  } finally { removeOwnedStaging(inspection, inspectionParent); }
}

export async function createBackup(options: BackupOptions): Promise<OperationResult> {
  if (!options.serverStopped) throw new Error('Confirme que o servidor está parado antes do backup.');
  const dataDir = resolve(options.dataDir); noLinks(dataDir);
  const backupId = randomUUID();
  const destination = options.destination || join(dirname(dataDir), 'backups', `frame-${backupId}`);
  validateOutput(destination, [dataDir, process.cwd()]);
  const sourcePath = checkedFile(dataDir, 'frame.sqlite');
  const parent = dirname(destination); mkdirSync(parent, { recursive: true, mode: 0o700 }); noLinks(parent);
  const staging = mkdtempSync(join(parent, '.frame-backup.partial-'));
  const db = openReadOnly(sourcePath);
  try {
    await db.backup(join(staging, 'frame.sqlite'));
    const snapshot = new Database(join(staging, 'frame.sqlite'), { fileMustExist: true });
    let info: ReturnType<typeof inspectDatabase>;
    try {
      snapshot.pragma('wal_checkpoint(TRUNCATE)');
      snapshot.pragma('journal_mode = DELETE');
      info = inspectDatabase(snapshot);
    } finally { snapshot.close(); }
    const files: FileEntry[] = [await entryFor(staging, 'frame.sqlite')];
    for (const media of info.media) {
      if (!z.uuid().safeParse(media.id).success || media.filename !== `${media.id}.webp`) throw new Error('Caminho de mídia inválido no banco.');
      const originals = ['jpg', 'png', 'webp'].map((ext) => `originals/${media.id}.${ext}`).filter((path) => existsSync(join(dataDir, path)));
      if (originals.length !== 1) throw new Error('Original ausente ou ambíguo na instalação.');
      for (const path of [`media/${media.filename}`, ...originals]) {
        const source = checkedFile(dataDir, path), target = join(staging, path);
        mkdirSync(dirname(target), { recursive: true, mode: 0o700 }); copyFileSync(source, target);
        files.push(await entryFor(staging, path));
      }
    }
    const excerptDir = join(dataDir, 'excerpts'); noLinks(excerptDir);
    if (existsSync(excerptDir)) {
      if (!lstatSync(excerptDir).isDirectory()) throw new Error('Diretório de trechos inválido.');
      const excerpts = readExcerptManifest(dataDir);
      const paths = ['excerpts/manifest.json', ...excerpts.entries.map((entry) => `excerpts/${entry.filename}`)];
      const expected = new Set(paths);
      for (const item of readdirSync(excerptDir)) {
        if (!expected.has(`excerpts/${item}`)) throw new Error('Arquivo de trecho não declarado na instalação.');
      }
      for (const path of paths) {
        const source = checkedFile(dataDir, path), target = join(staging, path);
        mkdirSync(dirname(target), { recursive: true, mode: 0o700 }); copyFileSync(source, target);
        files.push(await entryFor(staging, path));
      }
    }
    const manifest: Manifest = { format: 'frame-backup', version: 1, backupId, createdAt: new Date().toISOString(), installationId: info.installation.uuid, schemaVersion: info.installation.schemaVersion as 1 | 2 | 3, files };
    writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
    await validatePackage(staging);
    publishStaging(staging, destination);
    return { directory: destination, installationId: manifest.installationId, files: files.length, counts: info.counts };
  } finally {
    db.close(); if (existsSync(staging)) removeOwnedStaging(staging, parent);
  }
}

export async function checkRestore(packageDir: string, options: RestoreOptions): Promise<OperationResult> {
  const source = resolve(packageDir), dataDir = resolve(options.dataDir);
  const destination = options.destination || join(tmpdir(), `frame-restore-check-${randomUUID()}`);
  validateOutput(destination, [dataDir, source, process.cwd()]);
  const { manifest, info } = await validatePackage(source);
  const parent = dirname(destination); mkdirSync(parent, { recursive: true, mode: 0o700 }); noLinks(parent);
  const staging = mkdtempSync(join(parent, '.frame-restore.partial-'));
  try {
    for (const file of manifest.files) {
      const target = join(staging, file.path); mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
      copyFileSync(checkedFile(source, file.path), target);
    }
    // Revalidar cópia detecta alteração entre a primeira leitura e a transferência.
    writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest), { flag: 'wx', mode: 0o600 });
    await validatePackage(staging);
    const restored = new Database(join(staging, 'frame.sqlite'), { fileMustExist: true, timeout: 5000 });
    try {
      restored.pragma('foreign_keys = ON');
      restored.transaction(() => { restored.exec('DELETE FROM session; DELETE FROM verification;'); })();
      inspectDatabase(restored);
      restored.pragma('wal_checkpoint(TRUNCATE)');
    } finally { restored.close(); }
    // O banco restaurado já diverge intencionalmente: manifesto original não é seu certificado.
    rmSync(join(staging, 'manifest.json'));
    writeFileSync(join(staging, 'restore-report.json'), JSON.stringify({
      format: 'frame-restore-check', version: 1, backupId: manifest.backupId,
      checkedAt: new Date().toISOString(), installationId: manifest.installationId,
      sessionsRevoked: true, counts: info.counts, databaseSha256: (await entryFor(staging, 'frame.sqlite')).sha256
    }, null, 2), { flag: 'wx', mode: 0o600 });
    publishStaging(staging, destination);
    return { directory: destination, installationId: manifest.installationId, files: manifest.files.length, counts: info.counts };
  } finally { if (existsSync(staging)) removeOwnedStaging(staging, parent); }
}
