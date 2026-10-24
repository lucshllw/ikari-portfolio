import {describe,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,rmSync,readdirSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve,dirname,basename} from 'node:path';import {execFileSync} from 'node:child_process';import Database from 'better-sqlite3';
describe('independent Ikari installation',()=>{
 it('imports only sourced commissions, uses real library covers and preserves owner edits on rerun',()=>{
  const directory=mkdtempSync(join(tmpdir(),'frame-ikari-test-'));
  const env={...process.env,DATA_DIR:directory,FRAME_THEME:'ikari',BETTER_AUTH_SECRET:'isolated-ikari-secret-at-least-32-characters'};
  try{
   const run=()=>execFileSync(process.execPath,['--import','tsx','scripts/ikari-seed.ts'],{env,encoding:'utf8'});
   expect(run()).toContain('"added":23');
   const db=new Database(join(directory,'frame.sqlite'));
   const rows=db.prepare('SELECT * FROM projects ORDER BY sortOrder').all() as Array<{id:string;sourceUrl:string;coverMediaId:string;coverUrl:string;title:string}>;
   const source=JSON.parse(readFileSync('docs/ikari/comissoes.json','utf8'));
   expect(rows.map(row=>row.sourceUrl)).toEqual(source.entries.map((entry:{sourceUrl:string})=>entry.sourceUrl));
   expect(new Set(rows.map(row=>row.sourceUrl)).size).toBe(23);
   expect(db.prepare('SELECT id FROM owner').all()).toHaveLength(0);
   expect(db.prepare('SELECT id FROM media').all()).toHaveLength(23);
   for(const row of rows){expect(row.coverUrl).toBe('/media/'+row.coverMediaId);expect(statSync(join(directory,'media',row.coverMediaId+'.webp')).size).toBeGreaterThan(0);}
   const setting=db.prepare('SELECT value FROM site_settings').get() as {value:string};expect(JSON.parse(setting.value).brandName).toBe('IKARI');
   db.prepare('UPDATE projects SET title=? WHERE id=?').run('Título personalizado',rows[0].id);db.close();
   expect(run()).toContain('"added":0');
   const reloaded=new Database(join(directory,'frame.sqlite'));expect((reloaded.prepare('SELECT title FROM projects WHERE id=?').get(rows[0].id) as {title:string}).title).toBe('Título personalizado');reloaded.close();
   expect(readdirSync(join(directory,'media'))).toHaveLength(23);
  }finally{const target=resolve(directory);if(dirname(target)!==resolve(tmpdir())||!basename(target).startsWith('frame-ikari-test-'))throw new Error('Cleanup path outside intended temporary workspace');rmSync(target,{recursive:true,force:true});}
 },30000);
});
