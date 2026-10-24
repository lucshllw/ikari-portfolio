import { ikariCoverCache } from '../ikari-cover-cache';
import { CLOUD_BUILD, isCloud } from './storage-mode';
import type { CategoryInput, Project, ProjectInput, SettingsInput } from '../domain/types';

// Dynamic imports are essential: the cloud graph never initializes SQLite,
// local auth secrets, data directories or local media folders.
const projects = () => (CLOUD_BUILD || isCloud()) ? import('./cloud/catalog') : import('./projects');
const settings = () => (CLOUD_BUILD || isCloud()) ? import('./cloud/catalog') : import('./settings');
const media = () => (CLOUD_BUILD || isCloud()) ? import('./cloud/catalog') : import('./media');

function publicCover(project:Project):Project{return process.env.FRAME_THEME==='ikari'&&ikariCoverCache[project.coverUrl]?{...project,coverUrl:ikariCoverCache[project.coverUrl]}:project;}
export async function getPublicProjects(category?: string) { const rows=await (await projects()).getPublicProjects(category);return rows.map(publicCover); }
export async function getPublicProject(slug: string) { const row=await(await projects()).getPublicProject(slug);return row?publicCover(row):null; }
export async function listProjects(actorId: string) { return (await projects()).listProjects(actorId); }
export async function getProject(id: string, actorId: string) { return (await projects()).getProject(id, actorId); }
export async function saveProject(input: ProjectInput, actorId: string) { return (await projects()).saveProject(input, actorId); }
export async function deleteProject(id: string, actorId: string) { return (await projects()).deleteProject(id, actorId); }
export async function moveProject(id: string, direction: number, actorId: string) { return (await projects()).moveProject(id, direction, actorId); }
export async function listCategories() { return (await projects()).listCategories(); }
export async function saveCategory(input: CategoryInput, actorId: string) { return (await projects()).saveCategory(input, actorId); }
export async function deleteCategory(id: string, actorId: string) { return (await projects()).deleteCategory(id, actorId); }
export async function getPublicSettings() { return (await settings()).getPublicSettings(); }
export async function saveSettings(input: SettingsInput, actorId: string) { return (await settings()).saveSettings(input, actorId); }
export async function listMedia(actorId: string) { return (await media()).listMedia(actorId); }
export async function uploadImage(bytes: Uint8Array, info: { filename: string; mime: string; alt: string }, actorId: string) { return (await media()).uploadImage(bytes, info, actorId); }
export async function deleteMedia(id: string, actorId: string) { return (await media()).deleteMedia(id, actorId); }
export async function getMediaFile(id: string, actorId?: string) { return (await media()).getMediaFile(id, actorId); }
export async function getProjectExcerpt(project: Project) {
  return (CLOUD_BUILD || isCloud()) ? (await import('./cloud/catalog')).getProjectExcerpt(project) : (await import('./excerpts')).getProjectExcerpt(project);
}
export async function beginImageUpload(info: { filename: string; mime: string; alt: string }, actorId: string) {
  if (!(CLOUD_BUILD || isCloud())) throw new Error('Envio direto disponível somente na instalação cloud.');
  return (await import('./cloud/catalog')).beginImageUpload(info, actorId);
}
export async function completeImageUpload(uploadId: string, info: { filename: string; mime: string; alt: string }, actorId: string) {
  if (!(CLOUD_BUILD || isCloud())) throw new Error('Envio direto disponível somente na instalação cloud.');
  return (await import('./cloud/catalog')).completeImageUpload(uploadId, info, actorId);
}
