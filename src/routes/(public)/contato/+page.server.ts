import { randomUUID } from 'node:crypto';
import { fail } from '@sveltejs/kit';
import {getPublicProjects} from '$lib/server/catalog';
import { boundedForm } from '$lib/http.server';
import { commissionFormInput, receivePublicCommission } from '$lib/server/public-commission';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad=async({url})=>{
  const projects=await getPublicProjects();
  const requested=url.searchParams.get('referencia')||'';
  const legacy=url.searchParams.get('projeto')||'';
  const reference=projects.find(p=>requested?p.id===requested:p.slug===legacy);
  return {requestKey:randomUUID(),project:'',contactCover:process.env.FRAME_THEME==='ikari'?projects[0]||null:null,references:projects.map(({id,title,coverUrl,coverAlt})=>({id,title,coverUrl,coverAlt})),referenceId:reference?.id||'',referenceUnavailable:!!(requested||legacy)&&!reference};
};
export const actions:Actions={default:async({request,getClientAddress})=>{
  let form:FormData;
  try{form=await boundedForm(request);}catch{return fail(413,{error:'O formulário é muito grande. Resuma o briefing.',values:{name:'',email:'',service:'',brief:''},referenceId:'',fieldErrors:{} as Record<string,string>});}
  const result=await receivePublicCommission(commissionFormInput(form),getClientAddress());
  if(!result.success){const {status,...details}=result;return fail(status,details);}
  return result;
}};
