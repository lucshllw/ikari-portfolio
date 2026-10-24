import { it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'frame-seed-'));
process.env.DATA_DIR = directory;
process.env.BETTER_AUTH_SECRET = 'test-only-bootstrap-secret-at-least-thirty-two-characters';
process.env.ORIGIN = 'http://localhost:4173';
it('local demo seed works before owner without enabling HTTP signup or private writes', async () => {
  const { sqlite } = await import('../src/lib/server/db');
  try {
    const { seedDemo } = await import('../src/lib/server/seed');
    const projects = await import('../src/lib/server/projects');
    const { provisionOwner, auth } = await import('../src/lib/server/auth');
    expect(seedDemo()).toBe(4);
    expect(projects.getPublicProjects()).toHaveLength(4);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM owner').get()).toMatchObject({ n: 0 });
    expect(() => projects.listProjects('anonymous')).toThrow();
    const owner = await provisionOwner('fixture@example.test', 'StrongTestPassword123!');
    expect(projects.listProjects(owner)).toHaveLength(4);
    expect(seedDemo()).toBe(0);
    const signup = await auth.handler(new Request('http://localhost:4173/api/auth/sign-up/email', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:4173' }, body: JSON.stringify({ name: 'Visitor', email: 'visitor@example.test', password: 'StrongTestPassword123!' }) }));
    expect(signup.ok).toBe(false);
  } finally { sqlite.close(); rmSync(directory, { recursive: true, force: true, maxRetries: 3 }); }
}, 60_000);
