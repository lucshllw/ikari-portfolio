import sharp from 'sharp';
import {resolve} from 'node:path';
import { CLOUD_BUILD, isCloud } from './storage-mode';
const cache=new Map<string,string>();
const palette=[{hex:'#b8ff01',rgb:[184,255,1]},{hex:'#fa7155',rgb:[250,113,85]},{hex:'#49d8cd',rgb:[73,216,205]},{hex:'#f8f3e8',rgb:[248,243,232]}];
/** Local static covers only. Artwork itself is never recolored. */
export async function projectAccent(cover:string){
  if(cache.has(cover))return cache.get(cover)!;
  if((CLOUD_BUILD || isCloud())){
    let accent='#b8ff01';
    const id=/^\/media\/([a-f0-9-]{36})$/.exec(cover)?.[1];
    if(id)try{const file=await(await import('./cloud/catalog')).getMediaFile(id);if(file){const {dominant}=await sharp(file.bytes,{limitInputPixels:24_000_000}).resize(32,32,{fit:'inside'}).stats();const rgb=[dominant.r,dominant.g,dominant.b];accent=[...palette].sort((a,b)=>a.rgb.reduce((n,v,i)=>n+(v-rgb[i])**2,0)-b.rgb.reduce((n,v,i)=>n+(v-rgb[i])**2,0))[0].hex;}}catch{/* same controlled fallback as the local installation */}
    if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(cover,accent);return accent;
  }
  let path:string|undefined;
  if(/^\/demo\/[a-zA-Z0-9_-]+\.(webp|png|jpg)$/.test(cover))path=resolve('static'+cover);
  const mediaId=/^\/media\/([a-f0-9-]{36})$/.exec(cover)?.[1];
  if(mediaId){const {sqlite,dataDir}=await import('./db');const media=sqlite.prepare('SELECT filename FROM media WHERE id=?').get(mediaId) as {filename:string}|undefined;if(media&&/^[a-zA-Z0-9_-]+\.webp$/.test(media.filename))path=resolve(dataDir,'media',media.filename);}
  if(!path)return '#b8ff01';
  let accent='#b8ff01';
  try{const {dominant}=await sharp(path,{limitInputPixels:24_000_000}).resize(32,32,{fit:'inside'}).stats();const rgb=[dominant.r,dominant.g,dominant.b];accent=[...palette].sort((a,b)=>a.rgb.reduce((n,v,i)=>n+(v-rgb[i])**2,0)-b.rgb.reduce((n,v,i)=>n+(v-rgb[i])**2,0))[0].hex;}catch{/* established lime fallback */}
  if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(cover,accent);return accent;
}
export function archiveReturn(raw:string|null){
  if(!raw||!raw.startsWith('/indice'))return '/indice';
  try{const url=new URL(raw,'http://local');if(url.origin!=='http://local'||url.pathname!=='/indice')return '/indice';const category=url.searchParams.get('categoria');return '/indice'+(category&&/^[a-z0-9-]{1,120}$/.test(category)?'?categoria='+category:'')+(/^#cena-[a-z0-9-]{1,120}$/.test(url.hash)?url.hash:'');}catch{return '/indice';}
}
