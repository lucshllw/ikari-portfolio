import {readFileSync,writeFileSync,existsSync,mkdirSync,unlinkSync,renameSync} from 'node:fs';
import {join,resolve} from 'node:path';import {randomUUID,createHash} from 'node:crypto';import sharp from 'sharp';
import {excerptManifestSchema} from '../src/lib/server/excerpts';
if(!process.env.DATA_DIR||process.env.FRAME_THEME!=='ikari')throw new Error('Defina DATA_DIR independente e FRAME_THEME=ikari.');
const old=JSON.parse(readFileSync(new URL('../docs/ikari/comissoes.json',import.meta.url),'utf8'));
const launches=JSON.parse(readFileSync(new URL('../docs/ikari-v06/lancamentos.json',import.meta.url),'utf8'));
const manifest=excerptManifestSchema.parse(JSON.parse(readFileSync(new URL('../docs/ikari-v06/excerpts-manifest.json',import.meta.url),'utf8')));
const sourceDir=process.env.IKARI_EXCERPT_SOURCE_DIR?resolve(process.env.IKARI_EXCERPT_SOURCE_DIR):undefined;
const {sqlite,dataDir,recordAudit}=await import('../src/lib/server/db');
const written:string[]=[];
const hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
try{
 if(!sqlite.prepare("SELECT id FROM audit WHERE action='profile.ikari.seed'").get())throw new Error('Esta instalação não foi preparada como Ikari.');
 const clips=sourceDir?manifest.entries.map(e=>{const bytes=readFileSync(join(sourceDir,e.filename));if(bytes.length!==e.size||hash(bytes)!==e.sha256)throw new Error('Trecho divergente '+e.postId);return {entry:e,bytes};}):[];
 const covers=await Promise.all(launches.entries.map(async(l:any)=>{const bytes=readFileSync(new URL('../static'+l.coverUrl,import.meta.url));if(hash(bytes)!==l.sha256)throw new Error('Capa divergente');const metadata=await sharp(bytes,{limitInputPixels:24000000}).metadata();if(!metadata.width||!metadata.height||metadata.format!=='webp')throw new Error('Capa inválida');return{launch:l,bytes,width:metadata.width,height:metadata.height};}));
 for(const folder of ['media','originals','excerpts'])mkdirSync(join(dataDir,folder),{recursive:true});
 const prepared=sqlite.transaction(()=>{
  if(sqlite.prepare("SELECT id FROM audit WHERE action='profile.ikari.v06'").get())return {updated:0,status:'Refinamento já aplicado; edições preservadas.'};
  let updated=0;const direction=sqlite.prepare("SELECT id FROM categories WHERE slug='direcao-visual'").get() as {id:string}|undefined;
  const ordering=['2096986928247697759','2091272903408996672','2106536487978209566','2104324320495387101'];
  const now=new Date().toISOString();
  for(const {launch:l,bytes,width,height}of covers){
   const original=old.entries.find((e:any)=>e.id===l.postId);const p=sqlite.prepare('SELECT * FROM projects WHERE sourceUrl=?').get(original.sourceUrl) as any;if(!p||p.title!==original.title)continue;
   const id=randomUUID(),filename=id+'.webp',alt=`Capa oficial de ${l.track}, de ${l.artist}. Fonte: ${l.coverProvider}.`;
   for(const folder of ['media','originals']){const file=join(dataDir,folder,filename);writeFileSync(file,bytes,{flag:'wx'});written.push(file);}
   sqlite.prepare('INSERT INTO media (id,filename,mime,size,width,height,alt,createdAt,checksum) VALUES (?,?,?,?,?,?,?,?,?)').run(id,filename,'image/webp',bytes.length,width,height,alt,now,hash(bytes));
   const directed=l.officialCredits.some((line:string)=>/Direção Visual:\s*@ikarikjkk/i.test(line));
   const contribution=directed?'Direção visual e edição em equipe.':'Animação 2D no trecho publicado. Edição em equipe.';
   const selected=ordering.indexOf(l.postId);
   const description=`Música: ${l.track}. Artista${l.artist.includes(' · ')?'s':''}: ${l.artist}.\n${contribution}\n\nEste player apresenta somente o trecho da comissão publicado por Ikari. O lançamento completo reúne outros profissionais.\n\nCréditos oficiais relevantes:\n${l.officialCredits.join('\n')}\n\nCapa de apresentação: ${l.coverProvider}. Música, ilustrações e capa pertencem aos artistas e respectivos autores. Fonte do trecho: ${original.sourceUrl}.`;
   sqlite.prepare('UPDATE projects SET title=?,summary=?,description=?,categoryId=?,coverMediaId=?,coverUrl=?,coverAlt=?,videoUrl=?,featured=?,sortOrder=?,updatedAt=? WHERE id=?').run(l.track+' — '+l.artist,l.artist+' · '+contribution,description,directed&&direction?direction.id:p.categoryId,id,'/media/'+id,alt,l.youtubeUrl,Number(selected>=0),selected>=0?selected:old.entries.findIndex((e:any)=>e.id===l.postId)+4,now,p.id);updated++;
  }
  recordAudit('system:profile','profile.ikari.v06','official-releases');return {updated,status:'Capas oficiais e créditos refinados.'};
 }).immediate();
 if(clips.length){for(const {entry,bytes}of clips){const target=join(dataDir,'excerpts',entry.filename);if(existsSync(target)){if(hash(readFileSync(target))!==entry.sha256)throw new Error('Trecho existente divergente, preservado.');}else writeFileSync(target,bytes,{flag:'wx'});}const temp=join(dataDir,'excerpts',randomUUID()+'.tmp');writeFileSync(temp,JSON.stringify(manifest));renameSync(temp,join(dataDir,'excerpts','manifest.json'));}
 console.log(JSON.stringify({...prepared,excerptsInstalled:clips.length,dataDir}));
}catch(error){for(const file of written)if(existsSync(file)&&!sqlite.prepare('SELECT id FROM media WHERE filename=?').get(file.split(/[\\/]/).at(-1)!))unlinkSync(file);throw error;}finally{sqlite.close();}
