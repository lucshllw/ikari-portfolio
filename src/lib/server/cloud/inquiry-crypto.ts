import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { inquiryChecklist, inquiryDueDate } from '../inquiry-studio';

const payloadSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254),
  service: z.string().trim().min(1).max(120),
  brief: z.string().trim().min(10).max(4000),
  notes: z.string().trim().max(4000).optional(),
  referenceId: z.union([z.uuid(), z.literal('')]).optional(),
  quoteCents:z.number().int().min(0).max(100_000_000).optional(),dueDate:inquiryDueDate.optional(),checklist:inquiryChecklist.optional()
}).strict();
export type InquiryPayload = z.infer<typeof payloadSchema>;

const requestKeySchema = z.uuid();
const maxPayloadBytes = 32_768;
const maxEnvelopeLength = 44_000;

function strictBase64(value: string): Buffer {
  // Buffer.from(base64) alone silently accepts whitespace, bad characters and padding.
  if (!value || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('Codificação inválida.');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error('Codificação inválida.');
  return bytes;
}

function serverKey(): Buffer {
  const configured = process.env.INQUIRY_ENCRYPTION_KEY;
  if (!configured || configured.length !== 44) throw new Error('Configuração de criptografia inválida.');
  const key = strictBase64(configured);
  if (key.length !== 32) throw new Error('Configuração de criptografia inválida.');
  return key;
}

function authenticatedContext(requestKey: string): Buffer {
  requestKeySchema.parse(requestKey);
  return Buffer.from(`ikari:inquiry:v1:${requestKey}`, 'utf8');
}

/** Server-only encryption; persist this envelope with its unchanged requestKey. */
export function encryptInquiry(payload: InquiryPayload, requestKey: string): string {
  try {
    const key = serverKey(), aad = authenticatedContext(requestKey);
    const plaintext = Buffer.from(JSON.stringify(payloadSchema.parse(payload)), 'utf8');
    if (plaintext.length > maxPayloadBytes) throw new Error('Pedido muito grande.');
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return `v1.${nonce.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${ciphertext.toString('base64')}`;
  } catch {
    // Do not propagate validation input, provider errors or key material to callers/logs.
    throw new Error('Não foi possível proteger o pedido.');
  }
}

/** Call only after server-side owner authorization; this function is not an access gate. */
export function decryptInquiry(ciphertext: string, requestKey: string): InquiryPayload {
  try {
    const key = serverKey(), aad = authenticatedContext(requestKey);
    if (typeof ciphertext !== 'string' || ciphertext.length > maxEnvelopeLength) throw new Error('Envelope inválido.');
    const parts = ciphertext.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Envelope inválido.');
    const nonce = strictBase64(parts[1]), tag = strictBase64(parts[2]), encrypted = strictBase64(parts[3]);
    if (nonce.length !== 12 || tag.length !== 16 || encrypted.length > maxPayloadBytes) throw new Error('Envelope inválido.');
    const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    // final() must succeed before parsing or returning any unauthenticated bytes.
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
    return payloadSchema.parse(JSON.parse(decoded));
  } catch {
    throw new Error('Não foi possível ler o pedido protegido.');
  }
}
