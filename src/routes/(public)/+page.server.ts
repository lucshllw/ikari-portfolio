import { getPublicProjects, listCategories } from '$lib/server/catalog';
export const load = async () => ({ projects: (await getPublicProjects()).sort((a,b)=>Number(b.featured)-Number(a.featured)), categories: await listCategories() });
