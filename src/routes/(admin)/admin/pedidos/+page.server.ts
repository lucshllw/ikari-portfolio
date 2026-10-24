import { randomUUID } from 'node:crypto';
import { fail } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/access';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import { formMessage, boundedForm } from '$lib/http.server';
import { assertSameOrigin } from '$lib/server/security';
import { getPublicProjects } from '$lib/server/catalog';
import { matchesInquiry, inquiryStatuses, studioQuerySchema } from '$lib/server/inquiry-studio';
import type { InquiryStatus } from '$lib/domain/types';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals, url, parent }) => {
  const actor = await requireOwner(locals);
  const page = Math.max(1, Math.min(100000, Math.floor(Number(url.searchParams.get('pagina'))) || 1));
  const status = inquiryStatuses.safeParse(url.searchParams.get('estado')).success ? url.searchParams.get('estado')! : '';
  const { search, service,priority } = studioQuerySchema.parse({ search: (url.searchParams.get('busca') || '').slice(0, 120), service: (url.searchParams.get('servico') || '').slice(0, 120),priority:url.searchParams.get('prioridade')||'' });
  const window = Math.max(0,Math.min(2499,Math.floor(Number(url.searchParams.get('janela')))||0));
  const searching = (CLOUD_BUILD || isCloud()) && Boolean(search || service);
  const { settings } = await parent();
  let archive: {inquiries: import('$lib/domain/types').Inquiry[];total:number;limited:boolean;hasNextWindow:boolean;services:string[]};
  if ((CLOUD_BUILD || isCloud())) {
    const api = await import('$lib/server/cloud/inquiries');
    if(searching){const result=await api.cloudStudioArchive(locals,window);const filtered=result.inquiries.filter(i=>(!status||i.status===status)&&(!priority||(i.priority||'normal')===priority)&&matchesInquiry(i,search,service));archive={inquiries:filtered.slice((page-1)*25,page*25),total:filtered.length,limited:result.limited,hasNextWindow:result.hasNextWindow,services:[]};}
    else {const result=await api.listCloudInquiries(locals,page,status,priority);archive={...result,limited:false,hasNextWindow:false,services:[]};}
  } else { const result=(await import('$lib/server/inquiries')).localStudioPage(actor.id,page,status,search,service,priority);archive={...result,limited:false,hasNextWindow:false}; }
  const metrics = (CLOUD_BUILD || isCloud()) ? await (await import('$lib/server/cloud/inquiries')).cloudStudioMetrics(locals) : (await import('$lib/server/inquiries')).localStudioMetrics(actor.id);
  const projects = await getPublicProjects();
  const inquiries = archive.inquiries.map(inquiry => {
    const id = inquiry.referenceId || inquiry.brief.match(/\nIdentificador: ([a-f0-9-]{36})(?:\n|$)/i)?.[1];
    const ref = projects.find(project => project.id === id);
    return { ...inquiry, reference: ref ? { id: ref.id, title: ref.title, coverUrl: ref.coverUrl, coverAlt: ref.coverAlt } : null };
  });
  return { inquiries, metrics, total: archive.total, page, pageSize: 25, status, search, service,priority, window, hasNextWindow:archive.hasNextWindow, limited: archive.limited, services: [...new Set([...archive.services,...settings.servicesText.split('\n').filter(Boolean),...archive.inquiries.map(i => i.service),service].filter(Boolean))].sort(), references: projects.map(p => ({ id: p.id, title: p.title })), requestKey: randomUUID() };
};
export { actions } from '$lib/server/studio-actions';
