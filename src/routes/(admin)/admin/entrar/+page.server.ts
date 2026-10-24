import { fail, redirect } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/access';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import { applyAuthCookies, boundedForm, permitRequest } from '$lib/http.server';
import { assertSameOrigin } from '$lib/server/security';
import { ownerLoginEmail } from '$lib/server/fixed-login';
import type { Actions, PageServerLoad } from './$types';
export const load:PageServerLoad=async({locals})=>{let valid=false;try{await requireOwner(locals);valid=true;}catch{}if(valid)redirect(303,process.env.FRAME_THEME==='ikari'?'/admin/pedidos':'/admin');return {cloud:(CLOUD_BUILD || isCloud())};};
export const actions:Actions={default:async({request,cookies,getClientAddress,locals})=>{
try{assertSameOrigin(request);}catch{return fail(403,{error:'Reabra a página para entrar.'});}
if(!permitRequest(`login:${getClientAddress()}`,5))return fail(429,{error:'Aguarde um minuto antes de tentar novamente.'});
try{const form=await boundedForm(request,8192),login=String(form.get('email')||'').trim(),password=String(form.get('password')||'');if(!login||login.length>254||!password||password.length>128)throw new Error();const email=ownerLoginEmail(login);
if((CLOUD_BUILD || isCloud())){if(!locals.supabase)throw new Error();const {error}=await locals.supabase.auth.signInWithPassword({email,password});if(error)throw new Error();try{await requireOwner(locals);}catch{await locals.supabase.auth.signOut({scope:'local'});throw new Error();}}
else{const {signInOwner}=await import('$lib/server/auth');applyAuthCookies(await signInOwner(email,password,request.headers),cookies);}
}catch{return fail(400,{error:'Não foi possível entrar. Confira seu login e sua senha.'});}redirect(303,process.env.FRAME_THEME==='ikari'?'/admin/pedidos':'/admin');}};
