import { fail } from '@sveltejs/kit';
import { requireOwner } from '$lib/server/access';
import { listMedia, uploadImage, deleteMedia } from '$lib/server/catalog';
import { CLOUD_BUILD, isCloud } from '$lib/server/storage-mode';
import { formMessage } from '$lib/http.server';
import type { Actions, PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ locals }) => ({ media: await listMedia((await requireOwner(locals)).id), directUpload: (CLOUD_BUILD || isCloud()) });
export const actions: Actions = {
  upload: async ({ locals, request }) => {
    const actor = await requireOwner(locals);
    if ((CLOUD_BUILD || isCloud())) return fail(400, { error: 'Ative o JavaScript para enviar imagens diretamente à biblioteca.' });
    const { assertSameOrigin } = await import('$lib/server/security');
    assertSameOrigin(request);
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 13 * 1024 * 1024) return fail(413, { error: 'A imagem pode ter até 12 MiB.' });
    try {
      const form = await request.formData(), file = form.get('file');
      if (!(file instanceof File) || !file.size || file.size > 12 * 1024 * 1024) return fail(400, { error: 'Escolha uma imagem PNG, JPEG ou WebP de até 12 MiB.' });
      await uploadImage(new Uint8Array(await file.arrayBuffer()), { filename: file.name, mime: file.type, alt: String(form.get('alt') || '') }, actor.id);
      return { success: 'Imagem adicionada à biblioteca.' };
    } catch (error) { return fail(400, { error: formMessage(error) }); }
  },
  delete: async ({ locals, request }) => {
    const actor = await requireOwner(locals);
    try {
      const form = await request.formData(); await deleteMedia(String(form.get('id') || ''), actor.id);
      return { success: 'Imagem excluída.' };
    } catch { return fail(400, { error: 'Remova esta imagem dos trabalhos que a utilizam antes de excluí-la.' }); }
  }
};
