import { error } from '@sveltejs/kit';
import { getPublicProject, getPublicProjects, listCategories, getProjectExcerpt } from '$lib/server/catalog';
import { parseVideoUrl } from '$lib/server/video-url';
import type { PageServerLoad } from './$types';
import {projectAccent,archiveReturn} from '$lib/server/project-presentation';
export const load: PageServerLoad = async ({ params,url }) => { const project = await getPublicProject(params.slug); if (!project) error(404,'Trabalho não encontrado.'); return { project, categories: await listCategories(), video: project.videoUrl ? parseVideoUrl(project.videoUrl) : null, excerpt: await getProjectExcerpt(project), ordinal:(await getPublicProjects()).findIndex(p=>p.id===project.id)+1, workAccent:process.env.FRAME_THEME==='ikari'?await projectAccent(project.coverUrl):'#344CCD',returnTo:archiveReturn(url.searchParams.get('arquivo')) }; };
