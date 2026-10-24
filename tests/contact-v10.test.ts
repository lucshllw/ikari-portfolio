import {beforeEach,expect,it,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
const mocks=vi.hoisted(()=>({save:vi.fn((_input:{brief:string},_key:string)=>({id:'saved-inquiry'})),projects:[{id:'public-id',slug:'public-work',title:'Título real — Artista',coverUrl:'/media/cover',coverAlt:'Capa original'}]}));
vi.mock('../src/lib/server/projects',()=>({getPublicProjects:()=>mocks.projects}));
vi.mock('../src/lib/server/inquiries',()=>({createInquiry:mocks.save}));
import {actions,load} from '../src/routes/(public)/contato/+page.server';
beforeEach(()=>mocks.save.mockClear());
async function send(values:Record<string,string>={}){
 const request=new Request('http://localhost/contato',{method:'POST',body:new URLSearchParams({name:'Visitante',email:'test@example.test',service:'Animação 2D',brief:'Descrição real da ideia proposta.',requestKey:randomUUID(),...values})});
 return actions.default!({request,getClientAddress:()=>randomUUID()} as never) as any;
}
it('resolves only published identifiers and maintains the legacy reference link',async()=>{
 const current=await load({url:new URL('http://localhost/contato?referencia=public-id')} as never) as any;
 const legacy=await load({url:new URL('http://localhost/contato?projeto=public-work')} as never) as any;
 const invalid=await load({url:new URL('http://localhost/contato?referencia=private-id')} as never) as any;
 expect(current.referenceId).toBe('public-id');expect(legacy.referenceId).toBe('public-id');expect(invalid.referenceId).toBe('');expect(invalid.referenceUnavailable).toBe(true);
});
it('rejects forged or unpublished references without storing a request',async()=>{
 const result=await send({referenceId:'private-id'});expect(result.status).toBe(400);expect(result.data.fieldErrors.referenceId).toBeTruthy();expect(result.data.values.name).toBe('Visitante');expect(mocks.save).not.toHaveBeenCalled();
});
it('stores the server-owned title and identifier instead of a client-supplied title',async()=>{
 const key=randomUUID();const result=await send({referenceId:'public-id',referenceTitle:'Invented title',requestKey:key});expect(result.success).toBe(true);expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({brief:expect.stringContaining('Título real — Artista\nIdentificador: public-id')}),key);expect(mocks.save.mock.calls[0][0].brief).not.toContain('Invented');
});
it('accepts an idea without a selected work and keeps errors beside their fields',async()=>{
 expect((await send()).success).toBe(true);mocks.save.mockClear();const result=await send({name:'A',email:'invalid',brief:'short'});expect(result.status).toBe(400);expect(Object.keys(result.data.fieldErrors)).toEqual(expect.arrayContaining(['name','email','brief']));expect(result.data.values.brief).toBe('short');expect(mocks.save).not.toHaveBeenCalled();
});
it('preserves the draft when persistence fails instead of confirming a false success',async()=>{
 mocks.save.mockImplementationOnce(()=>{throw Error('database unavailable');});const result=await send();expect(result.status).toBe(400);expect(result.data.values.brief).toBe('Descrição real da ideia proposta.');expect(result.data.success).toBe(false);
});
