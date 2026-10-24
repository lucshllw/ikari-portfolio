import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { dataDir } from '../config';
import * as schema from './schema';
export { dataDir };
export const sqlite = new Database(join(dataDir, 'frame.sqlite'));
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('busy_timeout = 5000');
export function migrate() {
  if (Number(sqlite.pragma('user_version', { simple: true })) > 3) throw new Error('Esta versão do aplicativo não suporta o schema encontrado. Preserve o backup antes de atualizar.');
  // SQLite cannot extend a CHECK in place. Rebuild atomically, preserving UUIDs and metadata FKs.
  sqlite.pragma('foreign_keys = OFF');
  try { sqlite.transaction(() => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS session (id TEXT PRIMARY KEY, expiresAt INTEGER NOT NULL, token TEXT NOT NULL UNIQUE, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE);
    CREATE INDEX IF NOT EXISTS session_user ON session(userId);
    CREATE TABLE IF NOT EXISTS account (id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt INTEGER, refreshTokenExpiresAt INTEGER, scope TEXT, password TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS account_user ON account(userId);
    CREATE TABLE IF NOT EXISTS verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt INTEGER NOT NULL, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK(id = 1), userId TEXT NOT NULL UNIQUE REFERENCES user(id));
    CREATE TABLE IF NOT EXISTS installation (id INTEGER PRIMARY KEY CHECK(id = 1), uuid TEXT NOT NULL UNIQUE, schemaVersion INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, sortOrder INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, filename TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, alt TEXT NOT NULL, createdAt TEXT NOT NULL, checksum TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, summary TEXT NOT NULL, description TEXT NOT NULL, categoryId TEXT REFERENCES categories(id) ON DELETE RESTRICT, coverMediaId TEXT REFERENCES media(id) ON DELETE RESTRICT, coverUrl TEXT NOT NULL, coverAlt TEXT NOT NULL, videoUrl TEXT NOT NULL, featured INTEGER NOT NULL DEFAULT 0, sortOrder INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL CHECK(status IN ('draft','published')), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS published_projects ON projects(status, sortOrder);
    CREATE TABLE IF NOT EXISTS site_settings (id INTEGER PRIMARY KEY CHECK(id = 1), value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS inquiries (id TEXT PRIMARY KEY, requestKey TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL, service TEXT NOT NULL, brief TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('new','in_progress','converted','archived')), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS inquiry_studio (inquiryId TEXT PRIMARY KEY REFERENCES inquiries(id) ON DELETE CASCADE, priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('normal','urgent','planning')), notes TEXT NOT NULL DEFAULT '', referenceId TEXT NOT NULL DEFAULT '', deletedAt TEXT);
    CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, actorId TEXT NOT NULL, action TEXT NOT NULL, resourceId TEXT NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS demo_seed (key TEXT PRIMARY KEY, projectId TEXT NOT NULL);
  `);
  const studioColumns = sqlite.pragma('table_info(inquiry_studio)') as {name:string}[];
  for(const [name,definition] of Object.entries({quoteCents:'INTEGER NOT NULL DEFAULT 0 CHECK(quoteCents BETWEEN 0 AND 100000000)',dueDate:"TEXT NOT NULL DEFAULT ''",checklist:`TEXT NOT NULL DEFAULT '{"rough":false,"cleanup":false,"edit":false,"render":false}'` })){if(!studioColumns.some(c=>c.name===name))sqlite.exec('ALTER TABLE inquiry_studio ADD COLUMN '+name+' '+definition);}
  const columns = sqlite.pragma('table_info(projects)') as { name: string }[];
  if (!columns.some((column) => column.name === 'sourceUrl')) sqlite.exec("ALTER TABLE projects ADD COLUMN sourceUrl TEXT NOT NULL DEFAULT ''");
  const inquirySql = (sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='inquiries'").get() as {sql:string}).sql;
  if (!inquirySql.includes("'review'")) {
    sqlite.exec(`CREATE TABLE inquiries_v3 (id TEXT PRIMARY KEY, requestKey TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL, service TEXT NOT NULL, brief TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('new','review','in_progress','converted','completed','archived')), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      INSERT INTO inquiries_v3 (id,requestKey,name,email,service,brief,status,createdAt,updatedAt) SELECT id,requestKey,name,email,service,brief,status,createdAt,updatedAt FROM inquiries;
      DROP TABLE inquiries; ALTER TABLE inquiries_v3 RENAME TO inquiries;`);
  }
  if ((sqlite.pragma('foreign_key_check') as unknown[]).length) throw new Error('A atualização encontrou referências inconsistentes. Restaure o backup antes de continuar.');
  sqlite.prepare('INSERT OR IGNORE INTO installation (id, uuid, schemaVersion) VALUES (1, ?, 3)').run(randomUUID());
  sqlite.prepare('UPDATE installation SET schemaVersion=3 WHERE id=1').run();
  sqlite.pragma('user_version = 3');
  })(); } finally { sqlite.pragma('foreign_keys = ON'); }
}
migrate();
export const db = drizzle(sqlite, { schema });
export function recordAudit(actorId: string, action: string, resourceId: string) {
  sqlite.prepare('INSERT INTO audit VALUES (?, ?, ?, ?, ?)').run(randomUUID(), actorId, action, resourceId, new Date().toISOString());
}
