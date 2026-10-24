/** Consume verified Supabase claims only, never a decoded/unverified cookie. */
export const STUDIO_PASSWORD_MAX_AGE = 30 * 60;
export function passwordLoginRequired() { return process.env.FRAME_THEME === 'ikari' && Boolean(process.env.IKARI_STUDIO_ACCESS_KEY); }
export function hasRecentPassword(claims: unknown, ownerId: string, now = Math.floor(Date.now()/1000)): boolean {
  if (!claims || typeof claims !== 'object') return false;
  const value=claims as {sub?:unknown;session_id?:unknown;amr?:unknown};
  if(value.sub!==ownerId || typeof value.session_id!=='string' || !Array.isArray(value.amr))return false;
  return value.amr.some(method=>method && typeof method==='object' && method.method==='password' && typeof method.timestamp==='number' && Number.isInteger(method.timestamp) && method.timestamp<=now+30 && method.timestamp>now-STUDIO_PASSWORD_MAX_AGE);
}
