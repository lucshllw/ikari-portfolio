import { json, isActionFailure } from '@sveltejs/kit';
import { z } from 'zod';
import { receivePublicCommission } from '$lib/server/public-commission';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import { assertCloudAuthOrigin } from '$lib/server/cloud/auth';
import { requireOwner } from '$lib/server/access';
import { createHash } from 'node:crypto';
import { actions } from '$lib/server/studio-actions';
import type { RequestHandler } from './$types';

const inputSchema=z.object({name:z.string(),email:z.string(),service:z.string(),brief:z.string(),referenceId:z.string().default(''),requestKey:z.string(),website:z.string().default('')});
const MAX_BYTES=32768;

/** Public submissions and authenticated editor mutations share persistence. */
export const POST: RequestHandler=async(event)=>{
  const {request,getClientAddress}=event;
  const reply=(body:unknown,status=200)=>json(body,{status,headers:{'Cache-Control':'no-store'}});
  try{
    if(CLOUD_BUILD||isCloud())assertCloudAuthOrigin(request);
    else if(request.headers.get('origin')!==new URL(request.url).origin)throw new Error('Invalid origin');
  }catch{return reply({success:false,error:'Origem de envio não autorizada.'},403);}
  if(request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({success:false,error:'Envie o pedido como JSON.'},415);
  if(Number(request.headers.get('content-length')||0)>MAX_BYTES)return reply({success:false,error:'O formulário é muito grande. Resuma o briefing.'},413);
  let body:unknown;
  try{
    const reader=request.body?.getReader();if(!reader)throw new Error('Missing body');
    const chunks:Uint8Array[]=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>MAX_BYTES){await reader.cancel();return reply({success:false,error:'O formulário é muito grande. Resuma o briefing.'},413);}chunks.push(part.value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  }catch{return reply({success:false,error:'Não foi possível ler o pedido.'},400);}
  if (body && typeof body === 'object' && 'action' in body) {
    const value=body as Record<string,unknown>;
    if(!['create','save','status','delete'].includes(String(value.action)))return reply({success:false,error:'Ação inválida.'},400);
    try{await requireOwner(event.locals);}catch{return reply({success:false,error:'Acesso necessário.'},401);}
    const form=new FormData();
    for(const [name,item] of Object.entries(value))if(name!=='action'&&typeof item==='string')form.set(name,item);
    const action=actions[String(value.action)];
    if(!action)return reply({success:false},400);
    const headers=new Headers(request.headers);headers.delete('content-length');headers.delete('content-type');
    const result=await action({...event,request:new Request(request.url,{method:'POST',headers,body:form})});
    return isActionFailure(result)?reply({success:false,...(result.data && typeof result.data==='object'?result.data:{})},result.status):reply({success:true,...(result as object)});
  }
  const parsed=inputSchema.safeParse(body);
  if(!parsed.success)return reply({success:false,error:'Confira os campos do pedido.'},400);
  const result=await receivePublicCommission(parsed.data,getClientAddress());
  if(!result.success)return reply({success:false,error:result.error,fieldErrors:result.fieldErrors},result.status);
  return reply({...result,accepted:true},201);
};

/** Authenticated metadata only; unchanged polls avoid decrypting the inbox. */
export const GET: RequestHandler=async({locals,request})=>{
  let actor:{id:string};try{actor=await requireOwner(locals);}catch{return json({error:'Acesso necessário.'},{status:401,headers:{'Cache-Control':'private, no-store'}});}
  let fingerprint:string,metrics:unknown;
  if(CLOUD_BUILD||isCloud()){
    const {getCloudAuthClient}=await import('$lib/server/cloud/auth');
    const latest=await getCloudAuthClient(locals).from('ikari_inquiries').select('id,updatedAt',{count:'exact'}).order('updatedAt',{ascending:false}).order('id').limit(1);
    if(latest.error)return json({error:'Sincronização indisponível.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
    fingerprint=JSON.stringify([latest.count,latest.data]);
  }else{
    const rows=(await import('$lib/server/inquiries')).listInquiries(actor.id);
    fingerprint=JSON.stringify(rows.map(row=>[row.id,row.updatedAt]));
  }
  const version='"'+createHash('sha256').update(fingerprint).digest('hex')+'"';
  const headers={'Cache-Control':'private, no-store','ETag':version,'Vary':'Cookie'};
  if(request.headers.get('if-none-match')===version)return new Response(null,{status:304,headers});
  if(CLOUD_BUILD||isCloud())metrics=await(await import('$lib/server/cloud/inquiries')).cloudStudioMetrics(locals);
  else metrics=(await import('$lib/server/inquiries')).localStudioMetrics(actor.id);
  return json({version,metrics},{headers});
};
