import { error } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/access';
import { assertSameOrigin } from '$lib/server/security';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import { inquiriesCsv,inquiriesBackup } from '$lib/server/inquiry-studio';
import type { RequestHandler } from './$types';
export const POST: RequestHandler = async ({ locals, request }) => {
  const owner = await requireOwner(locals); assertSameOrigin(request);const {boundedForm}=await import('$lib/http.server');const form=await boundedForm(request,8192);const json=form.get('format')==='json';
  const archive = CLOUD_BUILD || isCloud() ? await (await import('$lib/server/cloud/inquiries')).cloudStudioArchive(locals) : (await import('$lib/server/inquiries')).localStudioArchive(owner.id);
  if (archive.limited) error(413, 'O arquivo excede 1.000 fichas. Exporte por um processo assistido para preservar a completude.');
  if(json&&archive.inquiries.length>500)error(413,'O backup JSON aceita até 500 fichas por arquivo. Solicite uma exportação assistida.');
  return new Response(json?JSON.stringify(inquiriesBackup(archive.inquiries),null,2):inquiriesCsv(archive.inquiries), { headers: { 'Content-Type': json?'application/json; charset=utf-8':'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ikari-comissoes.'+(json?'json':'csv')+'"', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
};
