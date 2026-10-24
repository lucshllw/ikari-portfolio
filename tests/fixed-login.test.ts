import { afterEach, expect, it, vi } from 'vitest';
import { ownerLoginEmail, blocksCredentialRoute } from '../src/lib/server/fixed-login';

afterEach(() => vi.unstubAllEnvs());
it.each(['artist@example.test', 'ARTIST@EXAMPLE.TEST', 'email: artist@example.test'])('accepts the owner email %s when the setup included an email label', (login) => {
  vi.stubEnv('IKARI_OWNER_LOGIN', 'email: artist@example.test');
  vi.stubEnv('IKARI_OWNER_EMAIL', 'owner@example.test');
  expect(ownerLoginEmail(login)).toBe('owner@example.test');
  expect(() => ownerLoginEmail('other@example.test')).toThrow();
});
it('maps only the configured exact login to the private owner email', () => {
  vi.stubEnv('IKARI_OWNER_LOGIN', 'Direction');
  vi.stubEnv('IKARI_OWNER_EMAIL', 'owner@example.test');
  expect(ownerLoginEmail('Direction')).toBe('owner@example.test');
  expect(() => ownerLoginEmail('direction')).toThrow();
  expect(() => ownerLoginEmail('owner@example.test')).toThrow();
});
it('fails closed for partial fixed-login configuration and preserves other installations', () => {
  vi.stubEnv('IKARI_OWNER_LOGIN', 'Direction');
  vi.stubEnv('IKARI_OWNER_EMAIL', '');
  expect(() => ownerLoginEmail('Direction')).toThrow();
  vi.stubEnv('IKARI_OWNER_LOGIN', '');
  expect(ownerLoginEmail('OWNER@EXAMPLE.TEST')).toBe('owner@example.test');
});
it.each(['/admin/recuperar', '/admin/redefinir', '/admin/conta', '/auth/callback', '/api/auth/change-password', '/api/auth/request-password-reset'])('disables the obsolete credential route %s for Ikari', (path) => {
  vi.stubEnv('FRAME_THEME', 'ikari');
  expect(blocksCredentialRoute(path)).toBe(true);
});
it.each(['/admin/entrar', '/admin/pedidos', '/admin/sair', '/api/auth/get-session', '/api/auth/sign-in/email', '/contato', '/api/commissions'])('preserves %s', (path) => {
  vi.stubEnv('FRAME_THEME', 'ikari');
  expect(blocksCredentialRoute(path)).toBe(false);
});
