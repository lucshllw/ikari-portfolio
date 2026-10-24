import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, parse, resolve, sep } from 'node:path';
import { z } from 'zod';
import type { Project } from '../domain/types';
import { excerptManifestSchema, type ProjectExcerpt } from './excerpt-schema';
export { excerptEntrySchema, excerptManifestSchema } from './excerpt-schema';
export type { ExcerptEntry, ProjectExcerpt } from './excerpt-schema';
export { parseByteRange } from './byte-range';

// Não importar config.ts aqui: a validação de pacotes também usa este módulo,
// e comandos de leitura não devem provisionar diretórios nem segredos.
function runtimeDataDir() {
  return resolve(process.env.DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'Frame', 'data'));
}
function regularFile(path: string) {
  const absolute = resolve(path), volume = parse(absolute).root;
  let current = volume;
  for (const part of absolute.slice(volume.length).split(sep).filter(Boolean)) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new Error('Links não permitidos nos trechos.');
  }
  const stat = lstatSync(absolute);
  if (!stat.isFile()) throw new Error('Trecho inválido.');
  return stat;
}
export function readExcerptManifest(root: string) {
  const path = join(resolve(root), 'excerpts', 'manifest.json');
  const expected = regularFile(path);
  if (expected.size > 2 * 1024 * 1024) throw new Error('Manifesto de trechos muito grande.');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.size !== expected.size || opened.dev !== expected.dev || opened.ino !== expected.ino) throw new Error('Manifesto alterado durante leitura.');
    return excerptManifestSchema.parse(JSON.parse(readFileSync(fd, 'utf8')));
  } finally { closeSync(fd); }
}
function findProjectExcerpt(project: Project) {
  if (!z.uuid().safeParse(project.id).success || !project.sourceUrl) return null;
  const root = runtimeDataDir();
  const entry = readExcerptManifest(root).entries.find((item) => item.sourceUrl === project.sourceUrl);
  if (!entry) return null;
  const path = join(root, 'excerpts', entry.filename), stat = regularFile(path);
  if (stat.size !== entry.size) return null;
  return { excerpt: { ...entry, src: `/trechos/${project.id}` }, path, stat };
}
export function getProjectExcerpt(project: Project): ProjectExcerpt | null {
  try { return findProjectExcerpt(project)?.excerpt || null; }
  catch { return null; }
}
/** O descritor é validado antes da resposta e deve ser fechado pelo consumidor. */
export function openProjectExcerpt(project: Project): { excerpt: ProjectExcerpt; fd: number } | null {
  let fd: number | undefined;
  try {
    const result = findProjectExcerpt(project);
    if (!result) return null;
    fd = openSync(result.path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const opened = fstatSync(fd);
    if (!opened.isFile() || opened.size !== result.stat.size || opened.dev !== result.stat.dev || opened.ino !== result.stat.ino) {
      closeSync(fd); return null;
    }
    return { excerpt: result.excerpt, fd };
  } catch { if (fd !== undefined) closeSync(fd); return null; }
}
