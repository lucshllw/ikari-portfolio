import {getPublicProjects,listCategories} from '$lib/server/catalog';
import type {PageServerLoad} from './$types';
export const load:PageServerLoad=async({url})=>{
  const all=await getPublicProjects();
  const categories=(await listCategories()).map(category=>({...category,count:all.filter(project=>project.categoryId===category.id).length})).filter(category=>category.count>0);
  const requested=url.searchParams.get('categoria')||'';
  const selected=categories.some(category=>category.slug===requested)?requested:'';
  const id=categories.find(category=>category.slug===selected)?.id;
  return {projects:id?all.filter(project=>project.categoryId===id):all,categories,selected,total:all.length};
};
