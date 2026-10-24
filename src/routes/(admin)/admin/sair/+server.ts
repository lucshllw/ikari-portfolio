import { error, redirect } from '@sveltejs/kit';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import { assertSameOrigin } from '$lib/server/security';
import { applyAuthCookies } from '$lib/http.server';
import type { RequestHandler } from './$types';
export const POST:RequestHandler=async({request,cookies,locals})=>{assertSameOrigin(request);if((CLOUD_BUILD || isCloud())){if(!locals.supabase)error(503,'Autenticação indisponível.');const result=await locals.supabase.auth.signOut({scope:'local'});if(result.error)error(503,'Não foi possível encerrar a sessão.');}else{const {signOutOwner}=await import('$lib/server/auth');applyAuthCookies(await signOutOwner(request.headers),cookies);}redirect(303,process.env.FRAME_THEME==='ikari'&&process.env.IKARI_STUDIO_ACCESS_KEY?'/':'/admin/entrar');};
