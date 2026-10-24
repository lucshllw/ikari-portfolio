import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { sqlite, recordAudit } from './db';
import { assertOwner } from './auth';
import { consumeRateLimit } from './security';
import type { InquiryInput, Inquiry, InquiryStatus } from '../domain/types';
import { manualInquirySchema, studioUpdateSchema, inquiryStatuses, inquiryBackupSchema } from './inquiry-studio';
import { studioQuerySchema } from './inquiry-studio';
export function createInquiry(input: InquiryInput, requestKey: string): { id: string; created: boolean } {
  const value = z.object({ name: z.string().trim().min(2).max(120), email: z.email().max(254), service: z.string().trim().min(1).max(120), brief: z.string().trim().min(10).max(4000) }).parse(input);
  z.uuid().parse(requestKey);
  return sqlite.transaction(() => {
    const existing = sqlite.prepare('SELECT id FROM inquiries WHERE requestKey=?').get(requestKey) as { id: string } | undefined;
    if (existing) return { id: existing.id, created: false };
    consumeRateLimit('inquiry:aggregate', 60, 60_000);
    const id = randomUUID(), now = new Date().toISOString();
    sqlite.prepare('INSERT INTO inquiries VALUES (?,?,?,?,?,?,?,?,?)').run(id, requestKey, value.name, value.email, value.service, value.brief, 'new', now, now);
    return { id, created: true };
  }).immediate();
}
const studioSelect="SELECT i.id,i.name,i.email,i.service,i.brief,i.status,i.createdAt,i.updatedAt,COALESCE(s.priority,'normal') AS priority,COALESCE(s.notes,'') AS notes,COALESCE(s.referenceId,'') AS referenceId,COALESCE(s.quoteCents,0) AS quoteCents,COALESCE(s.dueDate,'') AS dueDate,COALESCE(s.checklist,'{}') AS checklist,s.deletedAt FROM inquiries i LEFT JOIN inquiry_studio s ON s.inquiryId=i.id";
const decodeLocal=(rows:unknown[])=>rows.map(row=>{const value=row as Omit<Inquiry,'checklist'> & {checklist:string};return {...value,checklist:{rough:false,cleanup:false,edit:false,render:false,...JSON.parse(value.checklist)}} as Inquiry;});
export function listInquiries(actorId: string): Inquiry[] { assertOwner(actorId); return decodeLocal(sqlite.prepare(studioSelect+' WHERE s.deletedAt IS NULL ORDER BY i.createdAt DESC,i.id DESC LIMIT 1000').all()); }
export function localStudioMetrics(actorId: string) {
  assertOwner(actorId);
  const counts = sqlite.prepare('SELECT i.status,COUNT(*) n FROM inquiries i LEFT JOIN inquiry_studio s ON s.inquiryId=i.id WHERE s.deletedAt IS NULL GROUP BY i.status').all() as {status: InquiryStatus;n:number}[];
  const result = {total:0,new:0,review:0,in_progress:0,converted:0,completed:0,archived:0,revenueCents:0};
  result.revenueCents=(sqlite.prepare("SELECT COALESCE(SUM(s.quoteCents),0) n FROM inquiries i LEFT JOIN inquiry_studio s ON s.inquiryId=i.id WHERE s.deletedAt IS NULL AND i.status='completed'").get() as {n:number}).n;
  for(const row of counts){result[row.status]=row.n;result.total+=row.n;} return result;
}
export function localStudioArchive(actorId: string) { const inquiries=listInquiries(actorId),metrics=localStudioMetrics(actorId); return {inquiries,total:metrics.total,limited:metrics.total>inquiries.length}; }
export function localStudioPage(actorId: string, page = 1, status = '', search = '', service = '',priority='') {
  assertOwner(actorId); const query = studioQuerySchema.parse({search,service,priority});if(status)inquiryStatuses.parse(status);
  const clauses = ['s.deletedAt IS NULL'], params: string[] = [];
  if(status){clauses.push('i.status=?');params.push(status);}if(query.service){clauses.push('i.service=?');params.push(query.service);}
  if(query.priority){clauses.push("COALESCE(s.priority,'normal')=?");params.push(query.priority);}
  if(query.search){clauses.push("instr(lower(i.name||' '||i.email||' '||i.service||' '||i.brief),lower(?))>0");params.push(query.search);}
  const where=clauses.join(' AND '), current=Math.max(1,Math.min(100000,Math.floor(page)||1));
  const total=(sqlite.prepare('SELECT COUNT(*) n FROM inquiries i LEFT JOIN inquiry_studio s ON s.inquiryId=i.id WHERE '+where).get(...params) as {n:number}).n;
  const rows=decodeLocal(sqlite.prepare(studioSelect+' WHERE '+where+' ORDER BY i.createdAt DESC,i.id DESC LIMIT 25 OFFSET ?').all(...params,(current-1)*25));
  const services=(sqlite.prepare('SELECT DISTINCT i.service FROM inquiries i LEFT JOIN inquiry_studio s ON s.inquiryId=i.id WHERE s.deletedAt IS NULL ORDER BY i.service').all() as {service:string}[]).map(row=>row.service);
  return {inquiries:rows,total,page:current,pageSize:25,status,services};
}
export function updateInquiryStatus(id: string, status: InquiryStatus, actorId: string) {
  assertOwner(actorId); inquiryStatuses.parse(status);
  sqlite.transaction(() => { if (!sqlite.prepare('UPDATE inquiries SET status=?,updatedAt=? WHERE id=?').run(status, new Date().toISOString(), id).changes) throw new Error('Pedido não encontrado.'); recordAudit(actorId, 'inquiry.status', id); })();
}
export function saveInquiryStudio(id: string, input: unknown, actorId: string) {
  assertOwner(actorId); z.uuid().parse(id); const value = studioUpdateSchema.parse(input);
  sqlite.transaction(() => {
    if (!sqlite.prepare('SELECT id FROM inquiries WHERE id=? AND NOT EXISTS (SELECT 1 FROM inquiry_studio WHERE inquiryId=? AND deletedAt IS NOT NULL)').get(id, id)) throw new Error('Pedido não encontrado.');
    sqlite.prepare('UPDATE inquiries SET status=?,updatedAt=? WHERE id=?').run(value.status, new Date().toISOString(), id);
    if(value.name!==undefined)sqlite.prepare('UPDATE inquiries SET name=?,email=?,service=?,brief=? WHERE id=?').run(value.name,value.email,value.service,value.brief,id);
    sqlite.prepare('INSERT INTO inquiry_studio (inquiryId,priority,notes,referenceId,quoteCents,dueDate,checklist) VALUES (?,?,?,?,?,?,?) ON CONFLICT(inquiryId) DO UPDATE SET priority=excluded.priority,notes=excluded.notes,referenceId=CASE WHEN ? THEN excluded.referenceId ELSE inquiry_studio.referenceId END,quoteCents=excluded.quoteCents,dueDate=excluded.dueDate,checklist=excluded.checklist').run(id,value.priority,value.notes,value.referenceId||'',value.quoteCents,value.dueDate,JSON.stringify(value.checklist),value.referenceId!==undefined?1:0);
    recordAudit(actorId, 'inquiry.studio', id);
  })();
}
export function importLocalInquiries(input:unknown,actorId:string,dryRun=true){assertOwner(actorId);const backup=inquiryBackupSchema.parse(input);return sqlite.transaction(()=>{let added=0,skipped=0;for(const row of backup.inquiries){if(sqlite.prepare('SELECT id FROM inquiries WHERE id=? OR requestKey=?').get(row.id,row.id)){skipped++;continue;}added++;if(dryRun)continue;sqlite.prepare('INSERT INTO inquiries VALUES(?,?,?,?,?,?,?,?,?)').run(row.id,row.id,row.name,row.email,row.service,row.brief,row.status,row.createdAt,row.updatedAt);sqlite.prepare('INSERT INTO inquiry_studio(inquiryId,priority,notes,referenceId,quoteCents,dueDate,checklist) VALUES(?,?,?,?,?,?,?)').run(row.id,row.priority,row.notes,row.referenceId,row.quoteCents,row.dueDate,JSON.stringify(row.checklist));}if(!dryRun)recordAudit(actorId,'inquiry.import',String(added));return {added,skipped,dryRun};})();}
export function createManualInquiry(input: unknown, requestKey: string, actorId: string) {
  assertOwner(actorId); const value = manualInquirySchema.parse(input); z.uuid().parse(requestKey);
  return sqlite.transaction(() => {
    const result = createInquiry(value, requestKey);
    sqlite.prepare('INSERT OR IGNORE INTO inquiry_studio (inquiryId,referenceId) VALUES (?,?)').run(result.id, value.referenceId);
    recordAudit(actorId, 'inquiry.manual', result.id); return result;
  })();
}
export function deleteInquiry(id: string, actorId: string) {
  assertOwner(actorId); z.uuid().parse(id);
  sqlite.transaction(() => {
    if (!sqlite.prepare('SELECT id FROM inquiries WHERE id=?').get(id)) throw new Error('Pedido não encontrado.');
    sqlite.prepare('INSERT INTO inquiry_studio (inquiryId,deletedAt) VALUES (?,?) ON CONFLICT(inquiryId) DO UPDATE SET deletedAt=excluded.deletedAt').run(id, new Date().toISOString());
    recordAudit(actorId, 'inquiry.soft-delete', id);
  })();
}
