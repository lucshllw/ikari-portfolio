import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite, recordAudit } from './db';
import { assertOwner } from './auth';
import { parseVideoUrl } from './video-url';
import type { Project, ProjectInput, Category, CategoryInput } from '../domain/types';
const slug = z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens no endereço.');
const inputSchema = z.object({
  id: z.uuid().optional(), slug, title: z.string().trim().min(1).max(160), summary: z.string().trim().max(500), description: z.string().trim().max(10_000),
  categoryId: z.uuid().nullable(), coverMediaId: z.uuid().nullable(), coverUrl: z.string().max(250), coverAlt: z.string().trim().max(300),
  sourceUrl: z.string().trim().max(2048).default('').refine((value) => {
    if (!value) return true;
    if (!/^https:\/\//i.test(value) || /[\x00-\x20\x7f\\]/.test(value)) return false;
    try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password; }
    catch { return false; }
  }, 'Use uma URL HTTPS de publicação, sem credenciais.'),
  videoUrl: z.string().trim().max(500), featured: z.boolean(), sortOrder: z.number().int().min(0).max(10000), status: z.enum(['draft', 'published'])
});
function asProject(row: unknown): Project | null { return row ? { ...(row as Project), featured: Boolean((row as Project).featured) } : null; }
export function getPublicProjects(category?: string): Project[] {
  const rows = category ? sqlite.prepare("SELECT p.* FROM projects p JOIN categories c ON c.id=p.categoryId WHERE p.status='published' AND c.slug=? ORDER BY p.sortOrder,p.createdAt DESC").all(category) : sqlite.prepare("SELECT * FROM projects WHERE status='published' ORDER BY sortOrder,createdAt DESC").all();
  return rows.map((row) => asProject(row)!);
}
export function getPublicProject(value: string): Project | null { return asProject(sqlite.prepare("SELECT * FROM projects WHERE slug=? AND status='published'").get(value)); }
export function listProjects(actorId: string): Project[] { assertOwner(actorId); return sqlite.prepare('SELECT * FROM projects ORDER BY sortOrder,createdAt DESC').all().map((row) => asProject(row)!); }
export function getProject(id: string, actorId: string): Project | null { assertOwner(actorId); return asProject(sqlite.prepare('SELECT * FROM projects WHERE id=?').get(id)); }
export function saveProject(input: ProjectInput, actorId: string): Project {
  assertOwner(actorId);
  const value = inputSchema.parse(input);
  if (value.videoUrl) parseVideoUrl(value.videoUrl);
  if (value.categoryId && !sqlite.prepare('SELECT id FROM categories WHERE id=?').get(value.categoryId)) throw new Error('Categoria não encontrada.');
  if (value.coverMediaId) {
    const media = sqlite.prepare('SELECT id,alt FROM media WHERE id=?').get(value.coverMediaId) as { id: string; alt: string } | undefined;
    if (!media) throw new Error('Imagem não encontrada.');
    value.coverUrl = `/media/${media.id}`;
    if (!value.coverAlt) value.coverAlt = media.alt;
  } else if (value.coverUrl && !/^\/demo\/[a-zA-Z0-9_-]+\.webp$/.test(value.coverUrl)) throw new Error('Selecione uma imagem da biblioteca.');
  const current = value.id ? getProject(value.id, actorId) : null;
  if (value.id && !current) throw new Error('Trabalho não encontrado.');
  const duplicate = sqlite.prepare('SELECT id FROM projects WHERE slug=? AND id<>?').get(value.slug, value.id || '');
  if (duplicate) throw new Error('Este endereço já pertence a outro trabalho.');
  const result: Project = { ...value, id: value.id || randomUUID(), createdAt: current?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  sqlite.transaction(() => {
    sqlite.prepare(`INSERT INTO projects (id,slug,title,summary,description,categoryId,coverMediaId,coverUrl,coverAlt,videoUrl,sourceUrl,featured,sortOrder,status,createdAt,updatedAt)
      VALUES (@id,@slug,@title,@summary,@description,@categoryId,@coverMediaId,@coverUrl,@coverAlt,@videoUrl,@sourceUrl,@featured,@sortOrder,@status,@createdAt,@updatedAt)
      ON CONFLICT(id) DO UPDATE SET slug=excluded.slug,title=excluded.title,summary=excluded.summary,description=excluded.description,categoryId=excluded.categoryId,coverMediaId=excluded.coverMediaId,coverUrl=excluded.coverUrl,coverAlt=excluded.coverAlt,videoUrl=excluded.videoUrl,sourceUrl=excluded.sourceUrl,featured=excluded.featured,sortOrder=excluded.sortOrder,status=excluded.status,updatedAt=excluded.updatedAt`).run({ ...result, featured: Number(result.featured) });
    recordAudit(actorId, `project.${current ? 'update' : 'create'}`, result.id);
  })();
  return result;
}
export function deleteProject(id: string, actorId: string) { assertOwner(actorId); sqlite.transaction(() => { sqlite.prepare('DELETE FROM projects WHERE id=?').run(id); recordAudit(actorId, 'project.delete', id); })(); }
export function moveProject(id:string,direction:number,actorId:string):void {assertOwner(actorId);if(direction!==1&&direction!==-1)throw new Error('Direção inválida.');const ordered=listProjects(actorId);const index=ordered.findIndex(p=>p.id===id);if(index<0)throw new Error('Trabalho não encontrado.');const target=index+direction;if(target<0||target>=ordered.length)return;const [project]=ordered.splice(index,1);ordered.splice(target,0,project);sqlite.transaction(()=>{const update=sqlite.prepare('UPDATE projects SET sortOrder=?,updatedAt=? WHERE id=?');ordered.forEach((p,i)=>update.run(i,new Date().toISOString(),p.id));recordAudit(actorId,'project.reorder',id);})();}
export function listCategories(): Category[] { return sqlite.prepare('SELECT * FROM categories ORDER BY sortOrder,name').all() as Category[]; }
export function saveCategory(input: CategoryInput, actorId: string): Category {
  assertOwner(actorId);
  const value = z.object({ id: z.uuid().optional(), name: z.string().trim().min(1).max(100), slug, sortOrder: z.number().int().min(0).max(10000) }).parse(input);
  if (value.id && !sqlite.prepare('SELECT id FROM categories WHERE id=?').get(value.id)) throw new Error('Categoria não encontrada.');
  if (sqlite.prepare('SELECT id FROM categories WHERE slug=? AND id<>?').get(value.slug, value.id || '')) throw new Error('Endereço de categoria já utilizado.');
  const result = { ...value, id: value.id || randomUUID() };
  sqlite.transaction(() => { sqlite.prepare('INSERT INTO categories (id,name,slug,sortOrder) VALUES (@id,@name,@slug,@sortOrder) ON CONFLICT(id) DO UPDATE SET name=excluded.name,slug=excluded.slug,sortOrder=excluded.sortOrder').run(result); recordAudit(actorId, 'category.save', result.id); })();
  return result;
}
export function deleteCategory(id: string, actorId: string) {
  assertOwner(actorId);
  if (sqlite.prepare('SELECT id FROM projects WHERE categoryId=?').get(id)) throw new Error('Mova os trabalhos desta categoria antes de excluí-la.');
  sqlite.transaction(() => { sqlite.prepare('DELETE FROM categories WHERE id=?').run(id); recordAudit(actorId, 'category.delete', id); })();
}
