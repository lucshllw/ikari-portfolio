export function assertSameOrigin(request: Request) {
  const origin = process.env.ORIGIN || 'http://127.0.0.1:4173';
  const actual=new URL(request.url).origin;const studioHost=process.env.IKARI_STUDIO_HOST;
  const trusted=actual===new URL(origin).origin||!!studioHost&&/^[a-z0-9.-]+(?::\d+)?$/i.test(studioHost)&&actual==='https://'+studioHost;
  if (!trusted || request.headers.get('origin')!==actual) throw new Error('Origem de requisição inválida.');
}
const windows = new Map<string, { count: number; until: number }>();
export function consumeRateLimit(key: string, max = 6, windowMs = 60_000): void {
  const now = Date.now();
  for (const [id, entry] of windows) if (entry.until <= now) windows.delete(id);
  const entry = windows.get(key);
  if (entry && entry.count >= max) throw new Error('Muitas tentativas. Aguarde antes de tentar novamente.');
  if (!entry && windows.size >= 5000) throw new Error('Serviço temporariamente ocupado.');
  windows.set(key, { count: (entry?.count || 0) + 1, until: entry?.until || now + windowMs });
}
