import { createHmac } from 'node:crypto';
import { z } from 'zod';
import { getCloudServiceClient } from './client';
import { requireCloudOwner } from './auth';
import { encryptInquiry, decryptInquiry } from './inquiry-crypto';
import type { Inquiry, InquiryInput, InquiryStatus } from '../../domain/types';
import { manualInquirySchema, studioUpdateSchema,inquiryBackupSchema } from '../inquiry-studio';
const statuses = z.enum(['new', 'review', 'in_progress', 'converted', 'completed', 'archived']);
export const INQUIRY_PAGE_SIZE = 25;

export async function createCloudInquiry(input: InquiryInput, requestKey: string, address: string): Promise<{ id: string; created: boolean }> {
  z.uuid().parse(requestKey);
  // Encryption validates both the payload and the installation's key before any write.
  const ciphertext = encryptInquiry(input, requestKey);
  const clientKey = createHmac('sha256', Buffer.from(process.env.INQUIRY_ENCRYPTION_KEY!, 'base64')).update('ikari:rate:v1:').update(address).digest('hex');
  const { data, error } = await getCloudServiceClient().rpc('ikari_receive_inquiry_v14', { request_key: requestKey, encrypted_payload: ciphertext, client_key: clientKey });
  const result=z.object({id:z.uuid(),created:z.boolean()}).safeParse(data);
  if (error || !result.success) throw new Error('Não foi possível confirmar o pedido.');
  return result.data;
}
export async function listCloudInquiries(locals: App.Locals, page = 1, status = '',priority='') {
  await requireCloudOwner(locals);
  const currentPage = Math.max(1, Math.min(100000, Math.floor(page) || 1));
  let query = locals.supabase!.from('ikari_inquiries').select('id,requestKey,payload,status,priority,deletedAt,createdAt,updatedAt', { count: 'exact' }).is('deletedAt', null).order('createdAt', { ascending: false }).order('id');
  if (status) query = query.eq('status', statuses.parse(status));
  if(priority)query=query.eq('priority',z.enum(['normal','urgent','planning']).parse(priority));
  const { data, error, count } = await query.range((currentPage - 1) * INQUIRY_PAGE_SIZE, currentPage * INQUIRY_PAGE_SIZE - 1);
  if (error) throw new Error('Não foi possível carregar os pedidos.');
  const inquiries: Inquiry[] = (data || []).map(row => ({ id: row.id, ...decryptInquiry(row.payload, row.requestKey), status: statuses.parse(row.status), priority: row.priority || 'normal', deletedAt: row.deletedAt || null, createdAt: row.createdAt, updatedAt: row.updatedAt }));
  return { inquiries, total: count || 0, page: currentPage, pageSize: INQUIRY_PAGE_SIZE, status };
}
export async function cloudInquirySummary(locals: App.Locals) {
  const result = await listCloudInquiries(locals, 1);
  const { count, error } = await locals.supabase!.from('ikari_inquiries').select('id', { count: 'exact', head: true }).is('deletedAt', null).eq('status', 'new');
  if (error) throw new Error('Não foi possível contar os pedidos.');
  return { inquiries: result.inquiries.slice(0, 3), total: result.total, newCount: count || 0 };
}
export async function updateCloudInquiry(locals: App.Locals, id: string, status: InquiryStatus): Promise<void> {
  await requireCloudOwner(locals); z.uuid().parse(id); statuses.parse(status);
  const { data, error } = await locals.supabase!.from('ikari_inquiries').update({ status, updatedAt: new Date().toISOString() }).eq('id', id).select('id').maybeSingle();
  if (error || !data) throw new Error('Não foi possível atualizar o pedido.');
}
export async function deleteCloudInquiry(locals: App.Locals, id: string): Promise<void> {
  await requireCloudOwner(locals); z.uuid().parse(id);
  const { data, error } = await locals.supabase!.from('ikari_inquiries').update({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).eq('id', id).select('id').maybeSingle();
  if (error || !data) throw new Error('Não foi possível excluir o pedido.');
}

/** Bounded decryption for private search/export. Never exposes this collection publicly. */
export async function cloudStudioArchive(locals: App.Locals, window = 0) {
  await requireCloudOwner(locals);
  const currentWindow = Math.max(0, Math.min(100000, Math.floor(window) || 0));
  const rows: Inquiry[] = []; let total = 0;
  for (let page = 1 + currentWindow * 40; page <= (currentWindow + 1) * 40; page++) {
    const result = await listCloudInquiries(locals, page); total = result.total; rows.push(...result.inquiries);
    if (currentWindow * 1000 + rows.length >= total || result.inquiries.length < INQUIRY_PAGE_SIZE) break;
  }
  return { inquiries: rows, total, limited: total > 1000, window: currentWindow, hasNextWindow: total > currentWindow * 1000 + rows.length };
}
export async function cloudStudioMetrics(locals: App.Locals) {
  await requireCloudOwner(locals);
  const counts = await Promise.all(statuses.options.map(async status => {
    const { count, error } = await locals.supabase!.from('ikari_inquiries').select('id', { count: 'exact', head: true }).is('deletedAt', null).eq('status', status);
    if (error) throw new Error('Não foi possível contar os pedidos.'); return [status, count || 0] as const;
  }));
  const revenue=await locals.supabase!.rpc('ikari_studio_revenue');if(revenue.error)throw new Error('Não foi possível calcular os orçamentos.');
  return { total: counts.reduce((sum, [, count]) => sum + count, 0), ...Object.fromEntries(counts),revenueCents:Number(revenue.data)||0 } as { total: number; new: number;review:number; in_progress: number; converted: number; completed: number; archived: number;revenueCents:number };
}
export async function saveCloudInquiryStudio(locals: App.Locals, id: string, input: unknown) {
  await requireCloudOwner(locals); z.uuid().parse(id); const value = studioUpdateSchema.parse(input);
  const client = locals.supabase!;
  const current = await client.from('ikari_inquiries').select('requestKey,payload').eq('id', id).is('deletedAt', null).maybeSingle();
  if (current.error || !current.data) throw new Error('Pedido não encontrado.');
  const {status,priority,...payloadFields}=value;
  const payload = encryptInquiry({ ...decryptInquiry(current.data.payload, current.data.requestKey), ...payloadFields }, current.data.requestKey);
  const result = await client.from('ikari_inquiries').update({ payload, priority, status,quoteCents:value.quoteCents, updatedAt: new Date().toISOString() }).eq('id', id).is('deletedAt', null).select('id').maybeSingle();
  if (result.error || !result.data) throw new Error('Não foi possível salvar as notas.');
}
export async function importCloudInquiries(locals:App.Locals,input:unknown,dryRun=true){await requireCloudOwner(locals);const backup=inquiryBackupSchema.parse(input);const rows=backup.inquiries.map(row=>({id:row.id,requestKey:row.id,payload:encryptInquiry({name:row.name,email:row.email,service:row.service,brief:row.brief,referenceId:row.referenceId,notes:row.notes,quoteCents:row.quoteCents,dueDate:row.dueDate,checklist:row.checklist},row.id),status:row.status,priority:row.priority,quoteCents:row.quoteCents,createdAt:row.createdAt,updatedAt:row.updatedAt}));const result=await locals.supabase!.rpc('ikari_studio_import',{records:rows,dry_run:dryRun});if(result.error)throw new Error('O backup não pôde ser importado. Nenhuma ficha existente foi alterada.');return z.object({added:z.number(),skipped:z.number(),dryRun:z.boolean()}).parse(result.data);}
export async function createManualCloudInquiry(locals: App.Locals, input: unknown, requestKey: string) {
  await requireCloudOwner(locals); const value = manualInquirySchema.parse(input); z.uuid().parse(requestKey);
  const client = getCloudServiceClient();
  const existing = await client.from('ikari_inquiries').select('id').eq('requestKey', requestKey).maybeSingle();
  if (existing.error) throw new Error('Não foi possível confirmar o pedido.');
  if (existing.data) return { id: existing.data.id };
  const result = await client.from('ikari_inquiries').insert({ requestKey, payload: encryptInquiry(value, requestKey), status: 'new', priority: 'normal' }).select('id').single();
  if(result.error?.code === '23505') { const retry = await client.from('ikari_inquiries').select('id').eq('requestKey',requestKey).maybeSingle(); if(!retry.error && retry.data) return {id:retry.data.id}; }
  if (result.error || !result.data) throw new Error('Não foi possível criar a ficha.'); return { id: result.data.id };
}
