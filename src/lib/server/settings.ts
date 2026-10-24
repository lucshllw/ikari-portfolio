import { z } from 'zod';
import { sqlite, recordAudit } from './db';
import { assertOwner } from './auth';
import type { SettingsInput, SiteSettings, PublicSiteSettings } from '../domain/types';
const defaults: SiteSettings = {
  brandName: 'FRAME', headline: 'Cada corte,\numa intenção.', subheadline: 'Histórias ganham outra vida quando encontram o olhar certo. Edição, motion e narrativa para ideias que permanecem.',
  about: 'Modelo demonstrativo de portfólio para edição de vídeo e motion design. Substitua os exemplos pela sua identidade e pelos seus trabalhos.',
  email: '', instagramUrl: '', accentColor: '#344ccd', servicesText: 'Edição\nMotion\nNarrativa', availability: 'Vamos conversar sobre o próximo projeto.'
};
export function getPublicSettings(): PublicSiteSettings { const row = sqlite.prepare('SELECT value FROM site_settings WHERE id=1').get() as { value: string } | undefined; return row ? { ...defaults, ...JSON.parse(row.value) } : { ...defaults }; }
export function saveSettings(input: SettingsInput, actorId: string): SiteSettings {
  assertOwner(actorId);
  const value = z.object({ brandName: z.string().trim().min(1).max(60), headline: z.string().trim().min(1).max(180), subheadline: z.string().trim().max(300), about: z.string().trim().max(4000), email: z.union([z.literal(''), z.email().max(254)]), instagramUrl: z.string().trim().max(300), accentColor: z.string().regex(/^#[a-fA-F0-9]{6}$/), servicesText: z.string().trim().max(2000), availability: z.string().trim().max(200) }).parse(input);
  if (value.instagramUrl) { let url: URL; try { url = new URL(value.instagramUrl); } catch { throw new Error('Link inválido.'); } if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error('O link precisa usar HTTPS sem credenciais.'); }
  sqlite.transaction(() => { sqlite.prepare('INSERT INTO site_settings VALUES (1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(value)); recordAudit(actorId, 'settings.update', '1'); })();
  return value;
}
