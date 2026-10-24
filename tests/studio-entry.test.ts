import { afterEach, expect, it, vi } from 'vitest';
import { validStudioKey } from '../src/lib/server/studio-entry';
import { blocksCredentialRoute } from '../src/lib/server/fixed-login';
vi.mock('../src/lib/server/storage-mode',()=>({CLOUD_BUILD:false,isCloud:()=>true}));

afterEach(()=>vi.unstubAllEnvs());
it('fails closed for missing, weak, incorrect and oversized capabilities',()=>{
  expect(validStudioKey('anything','')).toBe(false);
  expect(validStudioKey('short','short')).toBe(false);
  const key='a'.repeat(43);
  expect(validStudioKey(key,key)).toBe(true);
  expect(validStudioKey('b'.repeat(43),key)).toBe(false);
  expect(validStudioKey('a'.repeat(257),key)).toBe(false);
});
it('blocks obsolete routes while restoring password login',()=>{
  vi.stubEnv('FRAME_THEME','ikari');vi.stubEnv('IKARI_STUDIO_ACCESS_KEY','a'.repeat(43));
  for(const path of ['/admin/identidade','/estudio','/api/auth/sign-in/email'])expect(blocksCredentialRoute(path)).toBe(true);
  expect(blocksCredentialRoute('/admin/entrar')).toBe(false);
  expect(blocksCredentialRoute('/admin/pedidos')).toBe(false);
  expect(blocksCredentialRoute('/api/commissions')).toBe(false);
});
it('ends only this browser session and returns to the public portfolio',async()=>{
  vi.stubEnv('FRAME_THEME','ikari');vi.stubEnv('IKARI_STUDIO_ACCESS_KEY','a'.repeat(43));vi.stubEnv('ORIGIN','https://studio.test');
  const signOut=vi.fn(async()=>({error:null}));
  const {POST}=await import('../src/routes/(admin)/admin/sair/+server');
  const event={request:new Request('https://studio.test/admin/sair',{method:'POST',headers:{origin:'https://studio.test'}}),locals:{supabase:{auth:{signOut}}}};
  await expect(POST(event as never)).rejects.toMatchObject({status:303,location:'/'});
  expect(signOut).toHaveBeenCalledWith({scope:'local'});
});
