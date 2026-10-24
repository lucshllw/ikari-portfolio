import { createHash, timingSafeEqual } from 'node:crypto';

/** A capability is a credential: it stays on the server and out of public markup. */
export function validStudioKey(candidate: string, expected = process.env.IKARI_STUDIO_ACCESS_KEY): boolean {
  if (!expected || expected.length < 43 || candidate.length > 256) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(candidate), digest(expected));
}
