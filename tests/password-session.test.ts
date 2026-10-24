import {afterEach,expect,it,vi} from 'vitest';
import {hasRecentPassword} from '../src/lib/server/password-session';
afterEach(()=>vi.unstubAllEnvs());
const id='10000000-0000-4000-8000-000000000001',now=1_800_000_000;
const claims=(method='password',timestamp=now)=>({sub:id,session_id:'20000000-0000-4000-8000-000000000001',amr:[{method,timestamp}]});
it('accepts only recent password authentication from verified matching owner claims',()=>{
 expect(hasRecentPassword(claims(),id,now)).toBe(true);
 for(const candidate of [undefined,{},claims('otp'),claims('magiclink'),claims('recovery'),claims('password',now-1800),claims('password',now+31),{...claims(),sub:'another'},{...claims(),session_id:null}])expect(hasRecentPassword(candidate,id,now)).toBe(false);
});
it('requires password AMR in owner authorization even for a valid allowlisted magic-link identity',async()=>{
 vi.stubEnv('FRAME_THEME','ikari');vi.stubEnv('IKARI_STUDIO_ACCESS_KEY','a'.repeat(43));
 const {requireCloudOwner}=await import('../src/lib/server/cloud/auth');
 const from=vi.fn(()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:id},error:null})})})}));
 const getClaims=vi.fn(async()=>({data:{claims:claims('otp',Math.floor(Date.now()/1000))},error:null}));
 const supabase={auth:{getUser:async()=>({data:{user:{id}},error:null}),getClaims},from};
 await expect(requireCloudOwner({supabase:supabase as never})).rejects.toThrow();expect(from).not.toHaveBeenCalled();
 getClaims.mockResolvedValueOnce({data:{claims:claims('password',Math.floor(Date.now()/1000))},error:null});
 await expect(requireCloudOwner({supabase:supabase as never})).resolves.toEqual({id});
});
