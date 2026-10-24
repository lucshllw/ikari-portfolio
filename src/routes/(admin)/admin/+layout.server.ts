import { redirect } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/access';
import { getPublicSettings } from '$lib/server/catalog';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import type { LayoutServerLoad } from './$types';
export const load:LayoutServerLoad=async({locals,url})=>{const settings=await getPublicSettings();if(['/admin/entrar','/admin/recuperar','/admin/redefinir'].includes(url.pathname))return {user:null,settings,cloud:(CLOUD_BUILD || isCloud())};try{await requireOwner(locals);}catch{redirect(303,'/admin/entrar');}return {user:locals.user,settings,cloud:(CLOUD_BUILD || isCloud())};};
