import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

// Node loads this for both standalone CLI scripts and SSR runtime, before configuration.
if (existsSync('.env')) process.loadEnvFile('.env');
export const dataDir = resolve(process.env.DATA_DIR || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'Frame', 'data'));
mkdirSync(dataDir, { recursive: true });
export const origin = process.env.ORIGIN || 'http://127.0.0.1:4173';
const configured = new URL(origin);
if (!['http:', 'https:'].includes(configured.protocol) || configured.username || configured.password || configured.pathname !== '/') throw new Error('ORIGIN precisa ser uma origem HTTP(S) válida.');
const secretPath = join(dataDir, 'auth-secret');
if (!process.env.BETTER_AUTH_SECRET && !existsSync(secretPath)) {
  try { writeFileSync(secretPath, randomBytes(48).toString('base64url'), { flag: 'wx', mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
}
export const authSecret = process.env.BETTER_AUTH_SECRET || readFileSync(secretPath, 'utf8').trim();
if (authSecret.length < 32) throw new Error('BETTER_AUTH_SECRET precisa ter pelo menos 32 caracteres.');
