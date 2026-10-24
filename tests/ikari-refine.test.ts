import {describe,it,expect}from'vitest';import {mkdtempSync,rmSync}from'node:fs';import {tmpdir}from'node:os';import {join,resolve,dirname,basename}from'node:path';import {execFileSync}from'node:child_process';import Database from'better-sqlite3';
describe('Ikari official release refinement',()=>{
 it('keeps project UUIDs and original media, applies artist covers once and preserves later owner changes',()=>{
 const folder=mkdtempSync(join(tmpdir(),'frame-ikari-refine-'));const env={...process.env,DATA_DIR:folder,FRAME_THEME:'ikari',BETTER_AUTH_SECRET:'isolated-refinement-secret-at-least-32-characters'};
 const run=(file:string)=>execFileSync(process.execPath,['--import','tsx',file],{env,encoding:'utf8'});
 try{
 run('scripts/ikari-seed.ts');const before=new Database(join(folder,'frame.sqlite'));const ids=before.prepare('SELECT id FROM projects ORDER BY id').all();const oldMedia=before.prepare('SELECT id FROM media ORDER BY id').all();before.close();
 expect(run('scripts/ikari-refine.ts')).toContain('"updated":23');const db=new Database(join(folder,'frame.sqlite'));
 expect(db.prepare('SELECT id FROM projects ORDER BY id').all()).toEqual(ids);expect(db.prepare('SELECT id FROM owner').all()).toHaveLength(0);expect(db.prepare('SELECT id FROM media').all()).toHaveLength(46);
 for(const row of oldMedia as Array<{id:string}>){expect(db.prepare('SELECT id FROM media WHERE id=?').get(row.id)).toBeTruthy();}
 const rows=db.prepare('SELECT title,featured,coverMediaId FROM projects ORDER BY sortOrder').all() as Array<{title:string;featured:number;coverMediaId:string}>;expect(rows[0].title).toBe('5 MINUTOS — ÉoDan');expect(rows.filter(row=>row.featured)).toHaveLength(4);expect(rows.every(row=>row.title.includes(' — '))).toBe(true);
 expect(db.prepare("SELECT p.id FROM projects p JOIN categories c ON p.categoryId=c.id WHERE c.slug='direcao-visual'").all()).toHaveLength(4);
 const first=(ids[0]as{id:string}).id;db.prepare('UPDATE projects SET title=? WHERE id=?').run('Personalizado pelo editor',first);db.close();expect(run('scripts/ikari-refine.ts')).toContain('"updated":0');const fresh=new Database(join(folder,'frame.sqlite'));expect((fresh.prepare('SELECT title FROM projects WHERE id=?').get(first)as{title:string}).title).toBe('Personalizado pelo editor');expect(fresh.prepare('SELECT id FROM media').all()).toHaveLength(46);fresh.close();
 }finally{const target=resolve(folder);if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('frame-ikari-refine-'))throw new Error('Invalid cleanup target');rmSync(target,{recursive:true,force:true});}
 },30000);
});
