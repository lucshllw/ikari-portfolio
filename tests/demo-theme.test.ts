import {it,expect} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const directory=mkdtempSync(join(tmpdir(),'frame-theme-'));
process.env.DATA_DIR=directory;
process.env.BETTER_AUTH_SECRET='test-only-demo-theme-at-least-thirty-two-characters';
process.env.ORIGIN='http://localhost:4173';
it('refreshes untouched legacy demo fields, preserves edits/deletions and is idempotent',async()=>{
  const {sqlite}=await import('../src/lib/server/db');
  try{
    const {seedDemo}=await import('../src/lib/server/seed');
    seedDemo();
    // Recreate exact legacy fixtures, as found before this redesign.
    const description='EXEMPLO DEMONSTRATIVO — Projeto fictício para apresentar as possibilidades deste modelo. A imagem é um estudo visual original. Substitua este conteúdo pelos seus próprios trabalhos e créditos.';
    sqlite.prepare('UPDATE projects SET title=?,summary=?,description=?,coverAlt=? WHERE slug=?').run('Intervalo','Ritmo, pausa e contraste em um estudo de montagem.',description,'Estudo visual abstrato para Intervalo, exemplo demonstrativo','intervalo-demo');
    sqlite.prepare('UPDATE projects SET title=? WHERE slug=?').run('Nome escolhido pelo editor','materia-demo');
    sqlite.prepare('DELETE FROM projects WHERE slug=?').run('sinal-demo');
    sqlite.prepare('UPDATE site_settings SET value=? WHERE id=1').run(JSON.stringify({brandName:'FRAME',headline:'Seu olhar.\nOutro ritmo.',subheadline:'Edição e motion design para transformar boas ideias em imagens que ficam.',accentColor:'#d14421',email:'',instagramUrl:'',about:'Texto escolhido',servicesText:'Edição de vídeo\nMotion design\nConteúdo digital',availability:'Vamos conversar sobre o próximo projeto.'}));
    const {refreshDemoTheme}=await import('../src/lib/server/demo-theme');
    const first=refreshDemoTheme();
    expect(first.projects).toBe(1);
    expect(sqlite.prepare('SELECT title FROM projects WHERE slug=?').get('intervalo-demo')).toMatchObject({title:'Entre planos'});
    expect(sqlite.prepare('SELECT title FROM projects WHERE slug=?').get('materia-demo')).toMatchObject({title:'Nome escolhido pelo editor'});
    expect(sqlite.prepare('SELECT count(*) AS n FROM projects').get()).toMatchObject({n:3});
    const settings=JSON.parse((sqlite.prepare('SELECT value FROM site_settings WHERE id=1').get() as {value:string}).value);
    expect(settings.headline).toBe('Cada corte,\numa intenção.');expect(settings.accentColor).toBe('#344ccd');expect(settings.about).toBe('Texto escolhido');
    expect(refreshDemoTheme()).toEqual({projects:0,settings:0});
  }finally{sqlite.close();rmSync(directory,{recursive:true,force:true,maxRetries:3});}
});
