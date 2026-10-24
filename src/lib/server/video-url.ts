/** Pure URL parser shared by local and cloud catalogs. No local initialization. */
export function parseVideoUrl(value: string): { provider: 'youtube' | 'vimeo'; embedUrl: string; watchUrl: string } | null {
  if (!value.trim()) return null;
  let url: URL; try { url = new URL(value); } catch { throw new Error('URL de vídeo inválida.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) throw new Error('Use uma URL HTTPS válida do YouTube ou Vimeo.');
  const host = url.hostname.toLowerCase();
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
    const id = host === 'youtu.be' ? url.pathname.slice(1) : url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(?:shorts|embed)\/([^/]+)$/.exec(url.pathname)?.[1];
    if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) throw new Error('Identificador de vídeo YouTube inválido.');
    return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}`, watchUrl: `https://www.youtube.com/watch?v=${id}` };
  }
  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const id = /^\/(?:video\/)?([0-9]{1,12})$/.exec(url.pathname)?.[1];
    if (!id) throw new Error('Identificador de vídeo Vimeo inválido.');
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}`, watchUrl: `https://vimeo.com/${id}` };
  }
  throw new Error('Use apenas vídeos YouTube ou Vimeo.');
}
