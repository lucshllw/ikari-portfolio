import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const state=vi.hoisted(()=>({save:vi.fn(),cloud:false,cloudSave:vi.fn(),projects:[{id:'public-id',title:'Título real — Artista'}]}));
vi.mock('../src/lib/server/catalog',()=>({getPublicProjects:()=>state.projects}));
vi.mock('../src/lib/server/inquiries',()=>({createInquiry:state.save}));
vi.mock('../src/lib/server/cloud/inquiries',()=>({createCloudInquiry:state.cloudSave}));
vi.mock('../src/lib/server/storage-mode',()=>({CLOUD_BUILD:false,isCloud:()=>state.cloud}));
import { POST } from '../src/routes/api/commissions/+server';
import { notifyCommission } from '../src/lib/server/public-commission';

const payload=()=>({name:'Visitante',email:'visitor@example.test',service:'Animação 2D',brief:'Uma ideia real para o próximo projeto.',requestKey:randomUUID()});
function event(body:unknown,origin='https://ikari.test',address:string=randomUUID(),contentType='application/json'){
 return {request:new Request('https://ikari.test/api/commissions',{method:'POST',headers:{origin,'content-type':contentType},body:typeof body==='string'?body:JSON.stringify(body)}),getClientAddress:()=>address} as Parameters<typeof POST>[0];
}
beforeEach(()=>{state.cloud=false;state.save.mockReset();state.save.mockReturnValue({id:'bbb3d918-63cb-48c6-a93a-a035728cc703',created:true});state.cloudSave.mockReset();vi.stubEnv('RESEND_API_KEY','');vi.stubEnv('IKARI_NOTIFICATION_OWNER_ID','');});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});

it('accepts a real persisted request and returns its stable identifier without exposing customer data',async()=>{
 const input=payload(),response=await POST(event(input)),result=await response.json();
 expect(response.status).toBe(201);expect(response.headers.get('cache-control')).toBe('no-store');
 expect(result).toEqual({success:true,id:'bbb3d918-63cb-48c6-a93a-a035728cc703',protocol:'TAKE #BBB3D918-63CB-48C6-A93A-A035728CC703',accepted:true});
 expect(state.save).toHaveBeenCalledWith(expect.objectContaining({brief:input.brief}),input.requestKey);
});
it('blocks cross-origin requests, missing origins and non-JSON bodies before persistence',async()=>{
 expect((await POST(event(payload(),'https://attacker.test'))).status).toBe(403);
 expect((await POST(event(payload(),''))).status).toBe(403);
 expect((await POST(event(payload(),'https://ikari.test',randomUUID(),'text/plain'))).status).toBe(415);
 expect(state.save).not.toHaveBeenCalled();
});
it('bounds JSON bodies and rejects malformed JSON or invalid idempotency identifiers',async()=>{
 expect((await POST(event('x'.repeat(33000)))).status).toBe(413);
 expect((await POST(event('{broken'))).status).toBe(400);
 expect((await POST(event({...payload(),requestKey:'fake'}))).status).toBe(400);
 expect(state.save).not.toHaveBeenCalled();
});
it('resolves public reference titles server-side and rejects unavailable references',async()=>{
 expect((await POST(event({...payload(),referenceId:'private'}))).status).toBe(400);expect(state.save).not.toHaveBeenCalled();
 expect((await POST(event({...payload(),referenceId:'public-id',referenceTitle:'Forged title'}))).status).toBe(201);
 expect(state.save.mock.calls[0][0].brief).toContain('Título real — Artista\nIdentificador: public-id');expect(state.save.mock.calls[0][0].brief).not.toContain('Forged');
});
it('keeps validation errors local to their fields and never confirms a failed write',async()=>{
 const invalid=await POST(event({...payload(),email:'invalid',brief:'short'}));expect((await invalid.json()).fieldErrors).toEqual(expect.objectContaining({email:expect.any(String),brief:expect.any(String)}));
 state.save.mockImplementationOnce(()=>{throw Error('Unavailable');});const failed=await POST(event(payload()));expect(failed.status).toBe(400);expect((await failed.json()).success).toBe(false);
});
it('shares the form rate limit and rejects a honeypot submission',async()=>{
 const address=randomUUID();for(let index=0;index<6;index++)expect((await POST(event(payload(),'https://ikari.test',address))).status).toBe(201);
 expect((await POST(event(payload(),'https://ikari.test',address))).status).toBe(429);
 state.save.mockClear();expect((await POST(event({...payload(),website:'spam'}))).status).toBe(400);expect(state.save).not.toHaveBeenCalled();
});
it('uses encrypted cloud persistence with the client address when cloud mode is active',async()=>{
 state.cloud=true;vi.stubEnv('ORIGIN','https://ikari.test');const id=randomUUID();state.cloudSave.mockResolvedValue({id});const input=payload();
 expect((await POST(event(input,'https://ikari.test','client-address'))).status).toBe(201);
 expect(state.cloudSave).toHaveBeenCalledWith(expect.objectContaining({name:input.name}),input.requestKey,'client-address');expect(state.save).not.toHaveBeenCalled();
});
it('notifies only the configured recipient, without private data and with a stable provider idempotency key',async()=>{
 vi.stubEnv('RESEND_API_KEY','test-only-key');vi.stubEnv('IKARI_NOTIFICATION_TO','editor@example.test');vi.stubEnv('IKARI_NOTIFICATION_FROM','Ikari <studio@example.test>');vi.stubEnv('ORIGIN','https://ikari.test');
 const fetcher=vi.fn().mockResolvedValue(new Response('{}',{status:200}));vi.stubGlobal('fetch',fetcher);
 const id=randomUUID();expect(await notifyCommission(id)).toBe('accepted');const [url,options]=fetcher.mock.calls[0];
 expect(url).toBe('https://api.resend.com/emails');expect(options.headers['Idempotency-Key']).toBe(`ikari-commission:${id}`);
 const body=JSON.parse(options.body);expect(body.to).toEqual(['editor@example.test']);expect(body.text).toContain('https://ikari.test/admin/pedidos');expect(body.text).not.toContain('visitor@example.test');
 fetcher.mockRejectedValueOnce(Error('timeout'));expect(await notifyCommission(id)).toBe('failed');
});
it('keeps a persisted request confirmed if the optional notification provider fails',async()=>{
 vi.stubEnv('RESEND_API_KEY','test-only-key');vi.stubEnv('IKARI_NOTIFICATION_TO','editor@example.test');vi.stubEnv('IKARI_NOTIFICATION_FROM','Ikari <studio@example.test>');vi.stubEnv('ORIGIN','https://ikari.test');
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('Provider unavailable')));const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
 try{const response=await POST(event(payload()));expect(response.status).toBe(201);expect((await response.json()).success).toBe(true);expect(state.save).toHaveBeenCalledTimes(1);}finally{warning.mockRestore();}
});
it('does not notify again for an idempotent replay and returns no private workflow status',async()=>{
 vi.stubEnv('RESEND_API_KEY','test-only-key');vi.stubEnv('IKARI_NOTIFICATION_TO','editor@example.test');vi.stubEnv('IKARI_NOTIFICATION_FROM','Ikari <studio@example.test>');vi.stubEnv('ORIGIN','https://ikari.test');
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);state.save.mockReturnValueOnce({id:'bbb3d918-63cb-48c6-a93a-a035728cc703',created:false});
 const response=await POST(event(payload()));expect(response.status).toBe(201);expect(fetcher).not.toHaveBeenCalled();expect((await response.json()).status).toBeUndefined();
});
