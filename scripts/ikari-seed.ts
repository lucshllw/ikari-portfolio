import {readFileSync,existsSync,mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import sharp from 'sharp';
if(!process.env.DATA_DIR||process.env.FRAME_THEME!=='ikari')throw new Error('Defina DATA_DIR de uma instalação independente e FRAME_THEME=ikari.');
const {sqlite,recordAudit}=await import('../src/lib/server/db');
const {dataDir}=await import('../src/lib/server/config');
const catalog=JSON.parse(readFileSync(new URL('../docs/ikari/comissoes.json',import.meta.url),'utf8'));
const imported=new Map<string,{id:string;filename:string;bytes:Buffer;width:number;height:number}>();
const written:string[]=[];
for(const entry of catalog.entries){const bytes=readFileSync(new URL('../static'+entry.coverUrl,import.meta.url));const meta=await sharp(bytes,{limitInputPixels:24000000}).metadata();if(meta.format!=='webp'||!meta.width||!meta.height)throw new Error('Capa inválida.');await sharp(bytes).raw().toBuffer();const id=randomUUID();imported.set(entry.id,{id,filename:id+'.webp',bytes,width:meta.width,height:meta.height});}
try{
 const result=sqlite.transaction(()=>{
  if(sqlite.prepare("SELECT id FROM audit WHERE action='profile.ikari.seed'").get())return {added:0,status:'Já preparado; edições preservadas.'};
  if(sqlite.prepare('SELECT id FROM projects LIMIT 1').get()||sqlite.prepare('SELECT id FROM owner LIMIT 1').get()||sqlite.prepare('SELECT id FROM site_settings LIMIT 1').get())throw new Error('A preparação Ikari exige instalação vazia. Dados existentes foram preservados.');
  const categories=[{id:randomUUID(),name:'Animação 2D',slug:'animacao-2d'},{id:randomUUID(),name:'Direção visual',slug:'direcao-visual'}];
  categories.forEach((category,index)=>sqlite.prepare('INSERT INTO categories VALUES (?,?,?,?)').run(category.id,category.name,category.slug,index));
  const settings={brandName:'IKARI',headline:'Animação 2D.\nCena por cena.',subheadline:'Edição, animação 2D e direção visual para narrativas da cena geek.',about:'Entre desenhos, ritmo e composição, cada cena pede um olhar. Este portfólio reúne comissões publicadas por Ikari, com créditos e fontes para identificar a participação em cada projeto.',email:'',instagramUrl:'https://x.com/ikarikjkk',accentColor:'#c1f82f',servicesText:'Animação 2D\nEdição\nDireção visual',availability:'Converse sobre a ideia, os formatos e o prazo do seu projeto.'};
  sqlite.prepare('INSERT INTO site_settings VALUES (1,?)').run(JSON.stringify(settings));
  const now=new Date().toISOString();
  for(const directory of ['media','originals'])mkdirSync(join(dataDir,directory),{recursive:true});
  for(const [index,entry]of catalog.entries.entries()){
   if(!existsSync(new URL('../static'+entry.coverUrl,import.meta.url)))throw new Error('Capa ausente para '+entry.id);
   const date=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(new Date(entry.publishedAt));
   const direction=entry.credit==='Direção visual e edição em equipe.';
   const media=imported.get(entry.id)!;
   const alt=`Frame da comissão ${entry.title}, publicado no perfil de Ikari.`;
   for(const directory of ['media','originals']){const file=join(dataDir,directory,media.filename);writeFileSync(file,media.bytes,{flag:'wx'});written.push(file);}
   sqlite.prepare('INSERT INTO media (id,filename,mime,size,width,height,alt,createdAt,checksum) VALUES (?,?,?,?,?,?,?,?,?)').run(media.id,media.filename,'image/webp',media.bytes.length,media.width,media.height,alt,now,createHash('sha256').update(media.bytes).digest('hex'));
   const description=`${entry.credit}\n\nComissão para ${entry.client}. Trecho publicado por @ikarikjkk em ${date}.\n\n${entry.videoUrl?'O vídeo completo é uma colaboração; os créditos gerais permanecem na fonte oficial.':'O vídeo do trecho está disponível na publicação original do X.'}\nPersonagens, ilustrações, música e demais contribuições pertencem aos respectivos autores. Esta prévia de portfólio não atribui a Ikari a autoria integral desses materiais.`;
   sqlite.prepare('INSERT INTO projects (id,slug,title,summary,description,categoryId,coverMediaId,coverUrl,coverAlt,videoUrl,sourceUrl,featured,sortOrder,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),'ikari-'+entry.id,entry.title,`Comissão para ${entry.client}. ${entry.credit}`,description,categories[direction?1:0].id,media.id,'/media/'+media.id,alt,entry.videoUrl,entry.sourceUrl,Number(index<4),index,'published',now,now);
  }
  recordAudit('system:profile','profile.ikari.seed','public-commissions');return {added:catalog.entries.length,status:'Instalação independente preparada, sem proprietário.'};
 }).immediate();
 console.log(JSON.stringify({...result,dataDir}));
}catch(error){for(const file of written)if(existsSync(file))unlinkSync(file);throw error;}finally{sqlite.close();}
