import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { inquiriesCsv, studioUpdateSchema, studioQuerySchema, inquiryMetrics,inquiriesBackup } from '../src/lib/server/inquiry-studio';
const directory = mkdtempSync(join(tmpdir(), 'ikari-studio-v13-'));
process.env.DATA_DIR = directory;
process.env.ORIGIN = 'http://localhost:4173';
process.env.BETTER_AUTH_SECRET = 'studio-os-test-only-secret-at-least-thirty-two-characters';
let storage: typeof import('../src/lib/server/db');
let inquiries: typeof import('../src/lib/server/inquiries');
let owner: string;
const legacyId = randomUUID(), legacyKey = randomUUID(), installationId = randomUUID();
const input = {name:'Pessoa de teste',email:'person@example.test',service:'Animação 2D',brief:'Briefing sintético de teste, sem dados reais.',referenceId:''};
beforeAll(async()=>{
 const legacy = new Database(join(directory,'frame.sqlite'));
 legacy.exec(`CREATE TABLE inquiries (id TEXT PRIMARY KEY, requestKey TEXT NOT NULL UNIQUE, name TEXT NOT NULL,email TEXT NOT NULL,service TEXT NOT NULL,brief TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('new','in_progress','converted','archived')),createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL);
 CREATE TABLE installation(id INTEGER PRIMARY KEY,uuid TEXT NOT NULL,schemaVersion INTEGER NOT NULL); PRAGMA user_version=2;`);
 legacy.prepare('INSERT INTO installation VALUES (1,?,2)').run(installationId);
 legacy.prepare('INSERT INTO inquiries VALUES(?,?,?,?,?,?,?,?,?)').run(legacyId,legacyKey,input.name,input.email,input.service,input.brief,'converted','2026-10-15','2026-10-15');legacy.close();
 storage=await import('../src/lib/server/db');inquiries=await import('../src/lib/server/inquiries');
 owner=await(await import('../src/lib/server/auth')).provisionOwner('studio-owner@example.test','SyntheticOwnerPassword123!');
},60_000);
afterAll(()=>{storage?.sqlite.close();rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});});
describe('Studio OS boundary and persistence',()=>{
 it('migrates v2 atomically without reclassifying converted or replacing installation UUID',()=>{
  expect(storage.sqlite.pragma('user_version',{simple:true})).toBe(3);expect(storage.sqlite.pragma('foreign_keys',{simple:true})).toBe(1);
  expect(storage.sqlite.prepare('SELECT uuid FROM installation').get()).toEqual({uuid:installationId});
  expect(inquiries.listInquiries(owner).find(i=>i.id===legacyId)?.status).toBe('converted');
  expect(storage.sqlite.pragma('foreign_key_check')).toEqual([]);
 });
 it('denies manual creation, notes, and deletion to non-owner before write',()=>{
  const count=storage.sqlite.prepare('SELECT COUNT(*) n FROM inquiries').get();
  expect(()=>inquiries.createManualInquiry(input,randomUUID(),'unknown')).toThrow();
  expect(()=>inquiries.saveInquiryStudio(legacyId,{status:'new',priority:'normal',notes:'Private'},'unknown')).toThrow();
  expect(()=>inquiries.deleteInquiry(legacyId,'unknown')).toThrow();expect(storage.sqlite.prepare('SELECT COUNT(*) n FROM inquiries').get()).toEqual(count);
 });
 it('persists internal notes, priority and a distinct completed status',()=>{
  inquiries.saveInquiryStudio(legacyId,{status:'completed',priority:'urgent',notes:'  Orçamento: notas sintéticas.  '},owner);
  expect(inquiries.listInquiries(owner).find(i=>i.id===legacyId)).toMatchObject({status:'completed',priority:'urgent',notes:'Orçamento: notas sintéticas.'});
  expect(inquiryMetrics(inquiries.listInquiries(owner))).toMatchObject({completed:1,converted:0});
 });
 it('manual retry is idempotent and soft-delete preserves original and metadata',()=>{
  const key=randomUUID(),first=inquiries.createManualInquiry(input,key,owner),again=inquiries.createManualInquiry(input,key,owner);expect(first.id).toEqual(again.id);expect(first.created).toBe(true);expect(again.created).toBe(false);
  inquiries.saveInquiryStudio(first.id,{status:'in_progress',priority:'planning',notes:'Não perder esta nota.'},owner);inquiries.deleteInquiry(first.id,owner);
  expect(inquiries.listInquiries(owner).find(i=>i.id===first.id)).toBeUndefined();
  expect(storage.sqlite.prepare('SELECT brief FROM inquiries WHERE id=?').get(first.id)).toEqual({brief:input.brief});
  expect(storage.sqlite.prepare('SELECT notes,deletedAt FROM inquiry_studio WHERE inquiryId=?').get(first.id)).toMatchObject({notes:'Não perder esta nota.',deletedAt:expect.any(String)});
  expect(()=>inquiries.saveInquiryStudio(first.id,{status:'new',priority:'normal',notes:''},owner)).toThrow();
 });
  it('bounds notes, queries and discriminants',()=>{
  expect(()=>studioUpdateSchema.parse({status:'completed',priority:'urgent',notes:'x'.repeat(4001)})).toThrow();
  expect(()=>studioQuerySchema.parse({search:'x'.repeat(121)})).toThrow();
  expect(()=>inquiries.saveInquiryStudio(legacyId,{status:'bad',priority:'normal',notes:''},owner)).toThrow();
  });
  it('roundtrips maximum Japanese briefing and notes within crypto and authenticated form limits',async()=>{
    const oldKey=process.env.INQUIRY_ENCRYPTION_KEY;process.env.INQUIRY_ENCRYPTION_KEY=Buffer.alloc(32,19).toString('base64');
    try { const {encryptInquiry,decryptInquiry}=await import('../src/lib/server/cloud/inquiry-crypto');const body={name:'界'.repeat(120),email:'test@example.test',service:'界'.repeat(120),brief:'界'.repeat(4000),notes:'界'.repeat(4000)};const key=randomUUID(),encrypted=encryptInquiry(body,key);expect(encrypted.length).toBeLessThanOrEqual(44000);expect(decryptInquiry(encrypted,key)).toEqual(body);expect(new TextEncoder().encode(new URLSearchParams(body).toString()).length).toBeLessThan(131072); }
    finally { if(oldKey===undefined)delete process.env.INQUIRY_ENCRYPTION_KEY;else process.env.INQUIRY_ENCRYPTION_KEY=oldKey; }
  });
  it('persists review, full edit, quote, due date, checklist and imports without overwriting',()=>{
    inquiries.saveInquiryStudio(legacyId,{status:'review',priority:'normal',notes:'Direção atualizada',name:'Nome corrigido',email:'edited@example.test',service:'Edição',brief:'Briefing alterado pelo proprietário.',referenceId:'',quoteCents:150000,dueDate:'2026-11-20',checklist:{rough:true,cleanup:false,edit:false,render:false}},owner);
    const current=inquiries.listInquiries(owner).find(row=>row.id===legacyId)!;expect(current).toMatchObject({name:'Nome corrigido',status:'review',quoteCents:150000,dueDate:'2026-11-20',checklist:{rough:true}});
    const backup=inquiriesBackup([current]);backup.inquiries[0].id=randomUUID();expect(inquiries.importLocalInquiries(backup,owner,true)).toMatchObject({added:1,dryRun:true});expect(inquiries.listInquiries(owner).some(row=>row.id===backup.inquiries[0].id)).toBe(false);
    expect(inquiries.importLocalInquiries(backup,owner,false)).toMatchObject({added:1});backup.inquiries[0].name='Should not overwrite';expect(inquiries.importLocalInquiries(backup,owner,false)).toMatchObject({added:0,skipped:1});expect(inquiries.listInquiries(owner).find(row=>row.id===backup.inquiries[0].id)?.name).toBe('Nome corrigido');
    const malformed=structuredClone(backup);malformed.inquiries[0].dueDate='2026-02-31';expect(()=>inquiries.importLocalInquiries(malformed,owner,false)).toThrow();
  });
  it('keeps all local records reachable beyond the search/export safety window',()=>{
    storage.sqlite.transaction(()=>{const insert=storage.sqlite.prepare('INSERT INTO inquiries VALUES(?,?,?,?,?,?,?,?,?)');for(let index=0;index<1001;index++)insert.run(randomUUID(),randomUUID(),'Volume test '+index,'volume@example.test','Volume','Synthetic record for pagination.','new','2026-10-15','2026-10-15');})();
    expect(inquiries.localStudioArchive(owner).limited).toBe(true);expect(inquiries.localStudioMetrics(owner).total).toBeGreaterThan(1000);
    const result=inquiries.localStudioPage(owner,41,'','','Volume');expect(result.total).toBe(1001);expect(result.inquiries).toHaveLength(1);
    expect(inquiries.localStudioPage(owner,1,'','Volume test 1000','Volume').total).toBe(1);
  });
 it('neutralizes formula injection and escapes quotes/newlines in CSV',()=>{
  const row={...input,id:randomUUID(),name:' =HYPERLINK("https://example.test")',service:'@danger',brief:'Text; "quoted"\nsecond line',status:'new' as const,createdAt:'2026-10-15',updatedAt:'2026-10-15',notes:'\t+CMD'};
  const csv=inquiriesCsv([row]);expect(csv).toContain('"\' =HYPERLINK(""https://example.test"")"');expect(csv).toContain('"\'@danger"');expect(csv).toContain('"\'\t+CMD"');expect(csv).toContain('Text; ""quoted""\nsecond line');
 });
});


