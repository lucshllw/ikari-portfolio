import { fail } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/access';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import { formMessage, boundedForm } from '$lib/http.server';
import { assertSameOrigin } from '$lib/server/security';
import { getPublicProjects } from '$lib/server/catalog';
import type { InquiryStatus } from '$lib/domain/types';
import type { Actions } from '@sveltejs/kit';
export const actions: Actions = {
  status: async ({ locals, request }) => {
    const actor = await requireOwner(locals);
    try {
      assertSameOrigin(request); const form = await boundedForm(request, 131_072), id = String(form.get('id') || '');
      const status = String(form.get('status') || '') as InquiryStatus;
      if ((CLOUD_BUILD || isCloud())) await (await import('$lib/server/cloud/inquiries')).updateCloudInquiry(locals, id, status);
      else (await import('$lib/server/inquiries')).updateInquiryStatus(id, status, actor.id);
      return { success: 'Estado da cena atualizado.' };
    } catch (error) { return fail(400, { error: formMessage(error) }); }
  },
  save: async ({ locals, request }) => {
    const actor = await requireOwner(locals);
    try {
      assertSameOrigin(request); const form = await boundedForm(request, 131_072), id = String(form.get('id') || '');
      const input = { status: String(form.get('status') || ''), priority: String(form.get('priority') || ''), notes: String(form.get('notes') || ''),...(form.has('name')?{name:String(form.get('name')||''),email:String(form.get('email')||''),service:String(form.get('service')||''),brief:String(form.get('brief')||''),referenceId:String(form.get('referenceId')||'')}:{}),quoteCents:Number(form.get('quoteCents')||0),dueDate:String(form.get('dueDate')||''),checklist:{rough:form.has('rough'),cleanup:form.has('cleanup'),edit:form.has('edit'),render:form.has('render')} };
      if('referenceId' in input&&input.referenceId&&!(await getPublicProjects()).some(p=>p.id===input.referenceId))throw new Error('Referência indisponível.');
      if ((CLOUD_BUILD || isCloud())) await (await import('$lib/server/cloud/inquiries')).saveCloudInquiryStudio(locals, id, input);
      else (await import('$lib/server/inquiries')).saveInquiryStudio(id, input, actor.id);
      return { success: 'Notas de direção salvas.', savedId: id };
    } catch (error) { return fail(400, { error: formMessage(error) }); }
  },
  create: async ({ locals, request }) => {
    const actor = await requireOwner(locals);
    try {
      assertSameOrigin(request); const form = await boundedForm(request, 131_072);
      const input = { name: String(form.get('name') || ''), email: String(form.get('email') || ''), service: String(form.get('service') || ''), brief: String(form.get('brief') || ''), referenceId: String(form.get('referenceId') || '') };
      if (input.referenceId && !(await getPublicProjects()).some(p => p.id === input.referenceId)) throw new Error('A referência não está disponível.');
      const key = String(form.get('requestKey') || '');
      if ((CLOUD_BUILD || isCloud())) await (await import('$lib/server/cloud/inquiries')).createManualCloudInquiry(locals, input, key);
      else (await import('$lib/server/inquiries')).createManualInquiry(input, key, actor.id);
      return { success: 'Nova cena adicionada à mesa.', created: true };
    } catch (error) { return fail(400, { error: formMessage(error) }); }
  },
  import: async ({locals,request})=>{
    const actor=await requireOwner(locals);try{assertSameOrigin(request);const form=await boundedForm(request,24_000_000);const file=form.get('backup');if(!(file instanceof File)||file.size>20_000_000)throw new Error('Arquivo inválido.');const input=JSON.parse(await file.text());const dryRun=form.get('confirm')!=='yes';
    const {inquiryBackupSchema}=await import('$lib/server/inquiry-studio');const backup=inquiryBackupSchema.parse(input);const projects=await getPublicProjects();if(backup.inquiries.some(row=>row.referenceId&&!projects.some(p=>p.id===row.referenceId)))throw new Error('Há referências indisponíveis no backup.');
    const result=(CLOUD_BUILD || isCloud())?await(await import('$lib/server/cloud/inquiries')).importCloudInquiries(locals,backup,dryRun):(await import('$lib/server/inquiries')).importLocalInquiries(backup,actor.id,dryRun);
    return {success:(dryRun?'Prévia validada. ':'Importação concluída. ')+result.added+' fichas novas; '+result.skipped+' IDs existentes preservados.',importResult:result};
    }catch(error){return fail(400,{error:formMessage(error)});}
  },
  delete: async ({ locals, request }) => {
    const actor = await requireOwner(locals);
    try {
      assertSameOrigin(request); const form = await boundedForm(request, 8192), id = String(form.get('id') || '');
      if ((CLOUD_BUILD || isCloud())) await (await import('$lib/server/cloud/inquiries')).deleteCloudInquiry(locals, id);
      else (await import('$lib/server/inquiries')).deleteInquiry(id, actor.id);
      return { success: 'Ficha retirada da mesa. Dados preservados por exclusão lógica.', deleted: true };
    } catch (error) { return fail(400, { error: formMessage(error) }); }
  }
};
