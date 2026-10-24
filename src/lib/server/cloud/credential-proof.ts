import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { z } from 'zod';
import { cloudAuthOrigin, getCloudAuthClient, type CloudAuthLocals } from './auth';
import { getCloudServiceClient } from './client';
const cookieName = 'ikari_credential_proof';
const cookiePath = '/admin/redefinir';
const lifetime = 600;
const payloadSchema = z.object({ v: z.literal(1), uid: z.uuid(), sid: z.uuid(), nonce: z.string().regex(/^[A-Za-z0-9_-]{43}$/), exp: z.number().int().positive() }).strict();
type Proof = z.infer<typeof payloadSchema>;
function signingKey(): Buffer {
  const raw = process.env.INQUIRY_ENCRYPTION_KEY || '';
  if (!/^[A-Za-z0-9+/]{43}=$/.test(raw)) throw new Error('Prova de acesso indisponível.');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32 || key.toString('base64') !== raw) throw new Error('Prova de acesso indisponível.');
  return Buffer.from(hkdfSync('sha256', key, 'ikari:credential-proof:v1', 'password-recovery-ticket', 32));
}
function sign(encoded: string) { return createHmac('sha256', signingKey()).update(encoded).digest('base64url'); }
function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
function decode(value: string): Proof {
  if (!value || value.length > 1024) throw new Error('Prova de acesso inválida.');
  const [encoded, signature, extra] = value.split('.');
  if (!encoded || !signature || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) throw new Error('Prova de acesso inválida.');
  const expected = Buffer.from(sign(encoded)), received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error('Prova de acesso inválida.');
  const proof = payloadSchema.parse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
  const now = Math.floor(Date.now()/1000);
  if (proof.exp <= now || proof.exp > now+lifetime+1) throw new Error('Prova de acesso expirada.');
  return proof;
}
/** Only verified JWT claims can bind a recovery ticket to a current Auth session. */
export async function credentialSession(locals: CloudAuthLocals, ownerId: string, accessToken?: string) {
  const { data, error } = await getCloudAuthClient(locals).auth.getClaims(accessToken);
  if (error || !data || data.claims.sub !== ownerId || !z.uuid().safeParse(data.claims.session_id).success) throw new Error('Sessão de recuperação inválida.');
  return { id: data.claims.session_id as string, claims: data.claims };
}
export async function issueCredentialProof(locals: CloudAuthLocals, cookies: Cookies, ownerId: string, accessToken: string, verifiedType: 'invite'|'recovery'|'pkce') {
  const session = await credentialSession(locals, ownerId, accessToken);
  if (verifiedType === 'pkce') {
    const now = Math.floor(Date.now()/1000), methods = session.claims.amr;
    if (!Array.isArray(methods) || !methods.some(item => item && typeof item === 'object' && item.method === 'recovery' && Number.isInteger(item.timestamp) && item.timestamp <= now+30 && item.timestamp > now-lifetime)) throw new Error('Este link não comprova recuperação de senha.');
  }
  const proof: Proof = {v:1,uid:ownerId,sid:session.id,nonce:randomBytes(32).toString('base64url'),exp:Math.floor(Date.now()/1000)+lifetime};
  const encoded=Buffer.from(JSON.stringify(proof)).toString('base64url'),value=`${encoded}.${sign(encoded)}`;
  const {data,error}=await getCloudServiceClient().rpc('ikari_issue_password_recovery',{ticket_digest:digest(value),owner_uuid:ownerId,auth_session:session.id,valid_until:new Date(proof.exp*1000).toISOString()});
  if(error||data!==true)throw new Error('Não foi possível preparar a recuperação.');
  cookies.set(cookieName,value,{path:cookiePath,httpOnly:true,secure:cloudAuthOrigin().startsWith('https:'),sameSite:'strict',maxAge:lifetime});
}
export function clearCredentialProof(cookies:Cookies){cookies.delete(cookieName,{path:cookiePath});}
export async function checkCredentialProof(locals:CloudAuthLocals,cookies:Cookies,ownerId:string,consume=false){
  const value=cookies.get(cookieName)||'',proof=decode(value);
  if(proof.uid!==ownerId)throw new Error('Prova de acesso inválida.');
  const session=await credentialSession(locals,ownerId);
  if(session.id!==proof.sid)throw new Error('Prova de acesso pertence a outra sessão.');
  const {data,error}=await getCloudServiceClient().rpc(consume?'ikari_consume_password_recovery':'ikari_check_password_recovery',{ticket_digest:digest(value),owner_uuid:ownerId,auth_session:session.id});
  if(error||data!==true)throw new Error('Prova de acesso expirada ou já utilizada.');
  if(consume)clearCredentialProof(cookies);
}
