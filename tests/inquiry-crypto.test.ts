import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';

const requestKey = '10000000-0000-4000-8000-000000000001';
const payload = { name: 'Pessoa de teste', email: 'fixture@example.test', service: 'Animação 2D', brief: 'Briefing sintético com acentuação e 🎬.' };
const cryptoModule = () => import('../src/lib/server/cloud/inquiry-crypto');

beforeEach(() => vi.stubEnv('INQUIRY_ENCRYPTION_KEY', randomBytes(32).toString('base64')));
afterEach(() => vi.unstubAllEnvs());

// Independent producer verifies authenticated data is validated after decryption, too.
function sealedRaw(value: unknown) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(process.env.INQUIRY_ENCRYPTION_KEY!, 'base64'), nonce);
  cipher.setAAD(Buffer.from(`ikari:inquiry:v1:${requestKey}`, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return `v1.${nonce.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

it('round-trips the private payload without storing its plaintext in the envelope', async () => {
  const { encryptInquiry, decryptInquiry } = await cryptoModule();
  const ciphertext = encryptInquiry(payload, requestKey);
  expect(decryptInquiry(ciphertext, requestKey)).toEqual(payload);
  for (const field of Object.values(payload)) expect(ciphertext.includes(field)).toBe(false);
});

it('uses a fresh 12-byte nonce and a 16-byte authentication tag for each request', async () => {
  const { encryptInquiry, decryptInquiry } = await cryptoModule();
  const first = encryptInquiry(payload, requestKey), second = encryptInquiry(payload, requestKey);
  const [version, nonce, tag] = first.split('.');
  expect(version).toBe('v1');
  expect(Buffer.from(nonce, 'base64')).toHaveLength(12);
  expect(Buffer.from(tag, 'base64')).toHaveLength(16);
  expect(first).not.toBe(second);
  expect(first.split('.')[1]).not.toBe(second.split('.')[1]);
  expect(decryptInquiry(second, requestKey)).toEqual(payload);
});

it('binds ciphertext authentication to the request UUID', async () => {
  const { encryptInquiry, decryptInquiry } = await cryptoModule();
  const ciphertext = encryptInquiry(payload, requestKey);
  expect(() => decryptInquiry(ciphertext, randomUUID())).toThrow();
});

it.each([0, 1, 2, 3])('rejects tampering in envelope component %i', async (component) => {
  const { encryptInquiry, decryptInquiry } = await cryptoModule();
  const parts = encryptInquiry(payload, requestKey).split('.');
  if (component === 0) parts[0] = 'v2';
  else { const bytes = Buffer.from(parts[component], 'base64'); bytes[0] ^= 1; parts[component] = bytes.toString('base64'); }
  expect(() => decryptInquiry(parts.join('.'), requestKey)).toThrow();
});

it.each(['', 'not-a-uuid', requestKey + ' ', '../inquiries'])('rejects malformed request identifiers in both operations: %s', async (invalidId) => {
  const { encryptInquiry, decryptInquiry } = await cryptoModule();
  const ciphertext = encryptInquiry(payload, requestKey);
  expect(() => encryptInquiry(payload, invalidId)).toThrow();
  expect(() => decryptInquiry(ciphertext, invalidId)).toThrow();
});

it.each([
  { label: 'missing', key: undefined }, { label: 'empty', key: '' }, { label: 'malformed', key: 'not-base64' },
  { label: '31 bytes', key: Buffer.alloc(31).toString('base64') }, { label: '33 bytes', key: Buffer.alloc(33).toString('base64') }
])('fails closed when the encryption key is $label', async ({ key }) => {
  const { encryptInquiry, decryptInquiry } = await cryptoModule();
  const ciphertext = encryptInquiry(payload, requestKey);
  if (key === undefined) delete process.env.INQUIRY_ENCRYPTION_KEY;
  else process.env.INQUIRY_ENCRYPTION_KEY = key;
  expect(() => encryptInquiry(payload, requestKey)).toThrow();
  expect(() => decryptInquiry(ciphertext, requestKey)).toThrow();
});

it('rejects noncanonical or whitespace-padded key encodings', async () => {
  const { encryptInquiry } = await cryptoModule();
  const canonical = process.env.INQUIRY_ENCRYPTION_KEY!;
  for (const invalid of [canonical.trimEnd().slice(0, -1), canonical + '\n', ' ' + canonical, canonical.replace(/=$/, '==')]) {
    process.env.INQUIRY_ENCRYPTION_KEY = invalid;
    expect(() => encryptInquiry(payload, requestKey)).toThrow();
  }
});

it('fails authentication after replacing the configured server key', async () => {
  const { encryptInquiry, decryptInquiry } = await cryptoModule();
  const ciphertext = encryptInquiry(payload, requestKey);
  process.env.INQUIRY_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  expect(() => decryptInquiry(ciphertext, requestKey)).toThrow();
});

it('rejects plaintext, malformed envelopes and incorrect nonce or tag lengths', async () => {
  const { encryptInquiry, decryptInquiry } = await cryptoModule();
  const ciphertext = encryptInquiry(payload, requestKey), parts = ciphertext.split('.');
  const malformed = [JSON.stringify(payload), Buffer.from(JSON.stringify(payload)).toString('base64'), '', ciphertext + '.extra', ciphertext + '\n', 'v1...'];
  for (const [index, bytes] of [[1, 11], [1, 13], [2, 15], [2, 17]] as const) {
    const changed = [...parts]; changed[index] = randomBytes(bytes).toString('base64'); malformed.push(changed.join('.'));
  }
  for (const index of [1, 2, 3]) { const changed = [...parts]; changed[index] += '!'; malformed.push(changed.join('.')); }
  for (const invalid of malformed) expect(() => decryptInquiry(invalid, requestKey)).toThrow();
});

it('validates payload fields and maximum lengths before encryption and after decryption', async () => {
  const { encryptInquiry, decryptInquiry } = await cryptoModule();
  const invalidPayloads = [
    { ...payload, name: 'A' }, { ...payload, name: 'x'.repeat(121) }, { ...payload, email: 'not-email' },
    { ...payload, email: 'a'.repeat(245) + '@example.test' }, { ...payload, service: '' },
    { ...payload, service: 'x'.repeat(121) }, { ...payload, brief: 'short' }, { ...payload, brief: 'x'.repeat(4001) },
    { ...payload, brief: 123 }, { ...payload, extra: 'unexpected private field' }, null,
  ];
  for (const invalid of invalidPayloads) {
    expect(() => encryptInquiry(invalid as never, requestKey)).toThrow();
    expect(() => decryptInquiry(sealedRaw(invalid), requestKey)).toThrow();
  }
});

it('accepts boundary lengths and preserves Unicode while normalizing the existing trimmed fields', async () => {
  const { encryptInquiry, decryptInquiry } = await cryptoModule();
  const boundary = { ...payload, name: 'á'.repeat(120), service: 'ç'.repeat(120), brief: '界'.repeat(4000) };
  expect(decryptInquiry(encryptInquiry(boundary, requestKey), requestKey)).toEqual(boundary);
  expect(decryptInquiry(encryptInquiry({ ...payload, name: '  Pessoa de teste ', service: ' Animação 2D ', brief: ' Briefing válido aqui. ' }, requestKey), requestKey))
    .toEqual({ ...payload, brief: 'Briefing válido aqui.' });
});

it('does not return secrets or personal data through errors', async () => {
  const { decryptInquiry } = await cryptoModule();
  try { decryptInquiry(JSON.stringify(payload), requestKey); throw Error('expected rejection'); }
  catch (error) {
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).not.toBe('expected rejection');
    for (const sensitive of [...Object.values(payload), process.env.INQUIRY_ENCRYPTION_KEY!]) expect(message.includes(sensitive)).toBe(false);
  }
});
