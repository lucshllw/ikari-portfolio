import { getPublicProjects, listCategories } from '$lib/server/catalog';
import type { PageServerLoad } from './$types';
import {redirect} from '@sveltejs/kit';
export const load: PageServerLoad = async ({ url }) => {
  if(process.env.FRAME_THEME==='ikari') redirect(307,`/indice${url.searchParams.get('categoria')?'?categoria='+encodeURIComponent(url.searchParams.get('categoria')!):''}`);
  const selected=url.searchParams.get('categoria')||'';
  const all=await getPublicProjects(selected||undefined);
  const raw=url.searchParams.get('pagina')||'1';
  const totalPages=Math.max(1,Math.ceil(all.length/12));
  const page=Math.min(totalPages,Math.max(1,/^\d+$/.test(raw)?Number(raw):1));
  return {projects:all.slice((page-1)*12,page*12),categories:await listCategories(),selected,pagination:{page,totalPages,total:all.length}};
};
