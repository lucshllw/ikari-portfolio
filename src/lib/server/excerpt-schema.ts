import { z } from 'zod';

// Pure metadata contract: safe for cloud runtime and CLI validators. Keep local
// paths, filesystem access and DATA_DIR resolution in excerpts.ts only.
const postId = z.string().regex(/^[1-9][0-9]{0,24}$/);
const text = z.string().trim().min(1).max(300);
const secureUrl = (hosts: string[]) => z.string().max(2048).refine((value) => {
  if (/[\x00-\x20\x7f\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.includes(url.hostname);
  } catch { return false; }
});
export const excerptEntrySchema = z.object({
  postId,
  sourceUrl: secureUrl(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']),
  filename: z.string().regex(/^[1-9][0-9]{0,24}\.mp4$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  duration: z.number().positive().finite(),
  width: z.number().int().positive().max(16384),
  height: z.number().int().positive().max(16384),
  artist: text.optional(), track: text.optional(),
  spotifyUrl: secureUrl(['open.spotify.com']).optional(),
  youtubeUrl: secureUrl(['youtube.com', 'www.youtube.com', 'youtu.be']).optional(),
  coverProvider: text.optional()
}).strict().refine((entry) => {
  try {
    const source = new URL(entry.sourceUrl);
    return source.pathname.match(/^\/[a-zA-Z0-9_]{1,15}\/status\/([1-9][0-9]{0,24})$/)?.[1] === entry.postId
      && !source.search && !source.hash && entry.filename === `${entry.postId}.mp4`;
  } catch { return false; }
}, 'Publicação e nome de trecho divergentes.');
export const excerptManifestSchema = z.object({ version: z.literal(1), entries: z.array(excerptEntrySchema).max(10000) }).strict()
  .refine(({ entries }) => new Set(entries.map((entry) => entry.postId)).size === entries.length
    && new Set(entries.map((entry) => entry.sourceUrl)).size === entries.length, 'Trecho duplicado.');
export type ExcerptEntry = z.infer<typeof excerptEntrySchema>;
export type ProjectExcerpt = ExcerptEntry & { src: string };
