<script lang="ts">
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { SubmitFunction } from '@sveltejs/kit';
import type { PageData, ActionData } from './$types';
import Icon from '$lib/components/Icon.svelte';
export let data: PageData;
export let form: ActionData;
let uploading = false, uploadError = '', uploadSuccess = '';
async function uploadDirect(formData: FormData, element: HTMLFormElement) {
  try {
    const file = formData.get('file');
    if (!(file instanceof File) || !file.size || file.size > 12 * 1024 * 1024) throw new Error('Escolha uma imagem PNG, JPEG ou WebP de até 12 MiB.');
    const info = { filename: file.name, mime: file.type, alt: String(formData.get('alt') || ''), size: file.size };
    const begin = await fetch('/admin/midia/envio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phase: 'begin', ...info }) });
    if (!begin.ok) throw new Error('Não foi possível preparar o envio. Sua sessão pode ter expirado.');
    const ticket: { uploadId: string; signedUrl: string } = await begin.json();
    const stored = await fetch(ticket.signedUrl, { method: 'PUT', credentials: 'omit', headers: { 'content-type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: file });
    if (!stored.ok) throw new Error('O envio da imagem falhou. O arquivo continua selecionado para tentar novamente.');
    const complete = await fetch('/admin/midia/envio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phase: 'complete', uploadId: ticket.uploadId, ...info }) });
    if (!complete.ok) throw new Error('A imagem não pôde ser validada. Confira o formato e tente novamente.');
    uploadSuccess = 'Imagem adicionada à biblioteca.';
    element.reset();
    await invalidateAll();
  } catch (error) { uploadError = error instanceof Error ? error.message : 'Não foi possível adicionar a imagem. Tente novamente.'; }
  finally { uploading = false; }
}
const submitUpload: SubmitFunction = ({ formData, cancel, formElement }) => {
  uploadError = ''; uploadSuccess = ''; uploading = true;
  if (data.directUpload) { cancel(); void uploadDirect(formData, formElement); return; }
  return async ({ update }) => { try { await update(); } finally { uploading = false; } };
};
</script>
<svelte:head><title>Biblioteca — FRAME</title></svelte:head><div class="admin-heading"><div><h1>Biblioteca</h1><p>Capas próprias, organizadas e prontas para entrar nos trabalhos.</p></div><span class="pill">{data.media.length} imagens</span></div>{#if uploadError}<div class="alert" role="alert">{uploadError}</div>{:else if uploadSuccess}<div class="alert success" role="status">{uploadSuccess}</div>{:else if form?.error}<div class="alert" role="alert">{form.error}</div>{:else if form?.success}<div class="alert success" role="status">{form.success}</div>{/if}<section class="panel"><div class="panel-title"><h2>Adicionar uma imagem</h2></div><form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance={submitUpload} aria-busy={uploading}><div class="form-grid"><div class="field"><label for="file">Imagem</label><input id="file" type="file" name="file" accept="image/png,image/jpeg,image/webp" required/><small>PNG, JPEG ou WebP. Até 12 MiB e 24 megapixels.</small></div><div class="field"><label for="alt">Descrição acessível</label><input id="alt" name="alt" maxlength="300" placeholder="O que aparece na imagem?" required/><small>Ajuda quem utiliza um leitor de tela.</small></div></div><div class="form-actions"><button class="btn small accent" disabled={uploading}><Icon name="plus" size={15}/>{uploading?'Adicionando…':'Adicionar à biblioteca'}</button></div></form></section><section class="media-grid" aria-label="Imagens da biblioteca">{#each data.media as media}<article class="media-item"><img loading="lazy" src={media.url} alt={media.alt||'Imagem da biblioteca'} width={media.width} height={media.height}/><p>{media.alt||media.filename}</p><small>{media.width} × {media.height} · {Math.round(media.size/1024)} KB</small><form method="POST" action="?/delete" style="margin-top:12px" onsubmit={event=>{if(!confirm('Excluir esta imagem da biblioteca?'))event.preventDefault();}}><input type="hidden" name="id" value={media.id}/><button class="btn small secondary">Excluir</button></form></article>{:else}<div class="empty" style="grid-column:1/-1">Sua biblioteca começa com uma imagem.<br/>Adicione uma capa acima para usar nos trabalhos.</div>{/each}</section>
