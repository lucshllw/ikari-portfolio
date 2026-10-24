import { timingSafeEqual } from 'node:crypto';

function normalizedLogin(value: string): string {
  const email = /^(?:e-?mail\s*:\s*)?([^\s@]+@[^\s@]+\.[^\s@]+)$/i.exec(value.trim());
  return email ? email[1].toLowerCase() : value.trim();
}

/** The public login is an alias; the underlying Auth identity stays server-only. */
export function ownerLoginEmail(login: string): string {
  const expected = process.env.IKARI_OWNER_LOGIN;
  const email = process.env.IKARI_OWNER_EMAIL;
  if (!expected && !email) return login.toLowerCase();
  if (!expected || !email) throw new Error('Acesso não configurado.');
  const actualBytes = Buffer.from(normalizedLogin(login)), expectedBytes = Buffer.from(normalizedLogin(expected));
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) throw new Error('Credencial inválida.');
  return email;
}

export function blocksCredentialRoute(pathname: string): boolean {
  if (process.env.FRAME_THEME !== 'ikari') return false;
  const path = pathname.replace(/\/+$/, '') || '/';
  if (process.env.IKARI_STUDIO_ACCESS_KEY && ['/admin/identidade','/estudio','/api/auth/sign-in/email'].includes(path)) return true;
  if (['/admin/recuperar', '/admin/redefinir', '/admin/conta', '/auth/callback'].includes(path)) return true;
  return path.startsWith('/api/auth/') && !['/api/auth/get-session', '/api/auth/sign-in/email', '/api/auth/sign-out'].includes(path);
}
