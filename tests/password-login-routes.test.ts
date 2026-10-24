import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
vi.mock('../src/lib/server/storage-mode',()=>({CLOUD_BUILD:false,isCloud:()=>true}));
const id='10000000-0000-4000-8000-000000000001';
beforeEach(()=>{vi.stubEnv('FRAME_THEME','ikari');vi.stubEnv('ORIGIN','https://studio.test');vi.stubEnv('IKARI_STUDIO_ACCESS_KEY','a'.repeat(43));vi.stubEnv('IKARI_OWNER_LOGIN','artist@example.test');vi.stubEnv('IKARI_OWNER_EMAIL','owner@example.test');});
afterEach(()=>vi.unstubAllEnvs());
function fixture(origin='https://studio.test'){
 const signInWithPassword=vi.fn(async()=>({error:null as Error|null})),signOut=vi.fn(async()=>({error:null}));
 const client={auth:{signInWithPassword,signOut,getUser:async()=>({data:{user:{id}},error:null}),getClaims:async()=>({data:{claims:{sub:id,session_id:randomUUID(),amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)}]}},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:id},error:null})})})})};
 return {request:new Request('https://studio.test/admin/entrar',{method:'POST',headers:{origin},body:new URLSearchParams({email:'artist@example.test',password:'FixturePassword123!'})}),url:new URL('https://studio.test/mesa-ikari/'+'a'.repeat(43)),params:{key:'a'.repeat(43)},locals:{supabase:client},getClientAddress:()=>randomUUID(),setHeaders:vi.fn(),cookies:{getAll:()=>[{name:'sb-fixture-auth-token.0',value:'old-session'}],delete:vi.fn()},client};
}
it('requires credentials at the exclusive URL and never invokes a magic link or grants a session',async()=>{
 const event=fixture();const {GET}=await import('../src/routes/mesa-ikari/[key]/+server');
 await expect(GET(event as never)).rejects.toMatchObject({status:303,location:'/admin/entrar'});
 expect(event.client.auth.signOut).toHaveBeenCalledWith({scope:'local'});expect(event.client.auth.signInWithPassword).not.toHaveBeenCalled();
 expect(event.cookies.delete).toHaveBeenCalledWith('sb-fixture-auth-token.0',{path:'/'});
 expect(event.setHeaders).toHaveBeenCalledWith(expect.objectContaining({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}));
});
it('accepts valid password credentials and then checks verified owner authorization',async()=>{
 const event=fixture();const {actions}=await import('../src/routes/(admin)/admin/entrar/+page.server');
 await expect(actions.default!(event as never)).rejects.toMatchObject({status:303,location:'/admin/pedidos'});
 expect(event.client.auth.signInWithPassword).toHaveBeenCalledWith({email:'owner@example.test',password:'FixturePassword123!'});
});
it('rejects incorrect passwords with a neutral message and rejects forged origins before Auth',async()=>{
 const {actions}=await import('../src/routes/(admin)/admin/entrar/+page.server');const denied=fixture();denied.client.auth.signInWithPassword.mockResolvedValueOnce({error:Error('private provider diagnostics')});
 const result=await actions.default!(denied as never) as any;expect(result.status).toBe(400);expect(JSON.stringify(result)).not.toContain('private provider diagnostics');
 const cross=fixture('https://attacker.test');expect((await actions.default!(cross as never) as any).status).toBe(403);expect(cross.client.auth.signInWithPassword).not.toHaveBeenCalled();
});
