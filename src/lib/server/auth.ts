import { betterAuth } from 'better-auth';
import { hashPassword } from 'better-auth/crypto';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db, sqlite, recordAudit } from './db';
import * as schema from './db/schema';
import { authSecret, origin } from './config';

export const auth = betterAuth({
  appName: 'FRAME', baseURL: origin, secret: authSecret,
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, revokeSessionsOnPasswordReset: true },
  trustedOrigins: [origin],
  session: { expiresIn: 60 * 60 * 24, disableSessionRefresh: true, cookieCache: { enabled: false } },
  rateLimit: { enabled: true, window: 60, max: 30, customRules: { '/sign-in/email': { window: 60, max: 6 } } },
  advanced: { useSecureCookies: origin.startsWith('https://') }
});

export function assertOwner(actorId: string): { id: string } {
  if (!actorId || !sqlite.prepare('SELECT userId FROM owner WHERE id = 1 AND userId = ?').get(actorId)) throw new Error('Acesso administrativo necessário.');
  return { id: actorId };
}
export function requireOwner(locals: App.Locals): { id: string } {
  if (!locals.user || !locals.session || locals.session.userId !== locals.user.id || new Date(locals.session.expiresAt).getTime() <= Date.now()) throw new Error('Sessão administrativa necessária.');
  const session = sqlite.prepare('SELECT id FROM session WHERE id = ? AND userId = ? AND expiresAt > ?').get(locals.session.id, locals.user.id, Date.now());
  if (!session) throw new Error('Sessão administrativa expirada.');
  return assertOwner(locals.user.id);
}
export async function provisionOwner(email: string, password: string): Promise<string> {
  const normalized = z.email().max(254).parse(email.trim().toLowerCase());
  z.string().min(12).max(128).parse(password);
  // Hash uses the public Better Auth implementation; the SQLite transaction reserves the singleton.
  const hashed = await hashPassword(password);
  const id = randomUUID(), timestamp = Date.now();
  sqlite.transaction(() => {
    if (sqlite.prepare('SELECT userId FROM owner WHERE id = 1').get()) throw new Error('O proprietário já foi provisionado.');
    sqlite.prepare('INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?, ?, ?, 1, ?, ?)').run(id, 'Proprietário', normalized, timestamp, timestamp);
    sqlite.prepare('INSERT INTO account (id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), id, 'credential', id, hashed, timestamp, timestamp);
    sqlite.prepare('INSERT INTO owner VALUES (1, ?)').run(id);
    recordAudit(id, 'owner.provision', id);
  }).immediate();
  return id;
}
// Return Set-Cookie headers to the action: Asta applies them to event.cookies explicitly.
export async function signInOwner(email: string, password: string, requestHeaders: Headers): Promise<Headers> {
  const response = await auth.api.signInEmail({ body: { email, password, rememberMe: false }, headers: requestHeaders, asResponse: true });
  if (!response.ok) throw new Error('Não foi possível entrar. Confira suas credenciais.');
  const payload = await response.clone().json() as { user?: { id: string } };
  if (!payload.user?.id) throw new Error('Não foi possível entrar.');
  assertOwner(payload.user.id);
  return response.headers;
}
export async function signOutOwner(requestHeaders: Headers): Promise<Headers> {
  const response = await auth.api.signOut({ headers: requestHeaders, asResponse: true });
  if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
  return response.headers;
}
