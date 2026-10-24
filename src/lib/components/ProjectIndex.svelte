<script lang="ts">
import {onionSkin} from '$lib/actions/onion-skin';
import {coverSources} from '$lib/images';
import {releaseTitle} from '$lib/commissions';
  import {onMount} from 'svelte';
  import {page} from '$app/stores';
  import {chapterMotion} from '$lib/actions/chapter-motion';
  import type {Project,Category} from '$lib/domain/types';
  import Icon from './Icon.svelte';
  export let projects:Project[]=[];
  export let categories:Category[]=[];
  export let archive=false;
  let selected='';
  let opened='';
  let enhanced=false;
  let saveData=false;
  $: if(!projects.some(project=>project.slug===selected)) selected=projects[0]?.slug||'';
  $: if(!projects.some(project=>project.slug===opened)) opened='';
  $: preview=projects.find(project=>project.slug===selected);
  const cover=(project:Project)=>project.coverUrl||'/demo/ritmo.webp';
  const sources=(project:Project)=>coverSources(cover(project));
  const category=(project:Project)=>categories.find(item=>item.id===project.categoryId)?.name||'Audiovisual';
  const demo=(project:Project)=>/EXEMPLO DEMONSTRATIVO/i.test(project.description);
  function toggle(slug:string){selected=slug;opened=opened===slug?'':slug;}
  const destination=(project:Project)=>`/trabalhos/${project.slug}${archive?'?arquivo='+encodeURIComponent($page.url.pathname+$page.url.search+'#cena-'+project.slug):''}`;
  onMount(()=>{enhanced=true;saveData=!!(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData;});
</script>

<svelte:window onkeydown={event=>{if(event.key==='Escape')opened='';}}/>
<div class="project-index" class:enhanced class:archive class:save-data={saveData}>
  <ol aria-label="Coleção de trabalhos" class="project-rows">
    {#each projects as project,i (project.slug)}
      <li id={`cena-${project.slug}`} class:chosen={selected===project.slug} use:chapterMotion={archive}>
        <div class="project-row" data-chapter-piece>
          <span class="row-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span>
          <a class="row-link" href={destination(project)} onfocus={()=>selected=project.slug} onpointerenter={event=>{if(event.pointerType==='mouse')selected=project.slug;}}>
            <img class="row-thumb" src={cover(project)} srcset={sources(project)} sizes="128px" alt="" width="128" height="72" loading={i<4?'eager':'lazy'} fetchpriority={i<4?'high':'auto'} decoding="async"/>
            <div class="row-content"><span class="mobile-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><h3 class="row-title">{releaseTitle(project.title).track}</h3>{#if releaseTitle(project.title).artist}<span class="row-artist">{releaseTitle(project.title).artist}</span>{/if}<span class="row-category">{category(project)}{#if demo(project)}<span class="row-demo">Modelo demonstrativo</span>{/if}</span></div>
            <span class="row-open"><span>Ver projeto</span><Icon name="diagonal" size={22}/></span>
          </a>
          <button class="preview-toggle" onclick={()=>toggle(project.slug)} aria-controls={`preview-${project.slug}`} aria-expanded={opened===project.slug} aria-label={`${opened===project.slug?'Fechar':'Ampliar'} prévia de ${project.title}`}><Icon name={opened===project.slug?'close':'image'} size={20}/><span>{opened===project.slug?'Fechar prévia':'Ampliar prévia'}</span></button>
        </div>
        <div id={`preview-${project.slug}`} class="mobile-preview" hidden={opened!==project.slug}>
          {#if opened===project.slug}<img src={cover(project)} srcset={sources(project)} sizes="90vw" alt={project.coverAlt||project.title} width="1536" height="864"/>{/if}
        </div>
      </li>
    {/each}
  </ol>
  {#if preview}
    <figure class="collection-preview" aria-label="Prévia do trabalho selecionado">
      {#key preview.slug}<div class="preview-image" use:onionSkin><img loading="eager" fetchpriority="high" decoding="async" src={cover(preview)} srcset={sources(preview)} sizes="(min-width:1024px) 45vw, 1px" alt={preview.coverAlt||preview.title} width="1536" height="864"/></div>{/key}
      <figcaption><div><span class="preview-category">{category(preview)}</span><span class="preview-title">{releaseTitle(preview.title).track}</span>{#if releaseTitle(preview.title).artist}<span class="preview-artist">{releaseTitle(preview.title).artist}</span>{/if}{#if demo(preview)}<p class="preview-disclosure">Imagem e projeto demonstrativos.</p>{/if}</div><a href={destination(preview)} aria-label={`Ver projeto ${preview.title}`}><Icon name="diagonal" size={24}/></a></figcaption>
    </figure>
  {/if}
</div>

<style>
.mobile-number{display:none}
.project-index{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:clamp(24px,4vw,64px);padding-bottom:70px;align-items:start}
.project-rows{padding:0;margin:0;list-style:none;min-width:0}.project-rows li{border-bottom:1px solid var(--line)}.project-row{position:relative;display:flex;gap:15px;align-items:center;padding:25px 0}.row-number{font:12px ui-monospace,monospace;color:var(--muted);align-self:start;padding-top:5px}.row-link{display:flex;align-items:center;gap:20px;flex:1;min-width:0;min-height:72px}.row-thumb{width:96px;height:64px;object-fit:contain;flex-shrink:0}.row-content{min-width:0;flex:1}.row-title{display:block;font-family:var(--display);font-size:clamp(25px,2.4vw,37px);line-height:1.1;font-weight:600;letter-spacing:-.055em}.row-category{display:block;font-size:14px;line-height:1.7;color:var(--muted);margin-top:10px}.row-demo{display:block;font-size:12px}.row-open{margin-left:auto;flex-shrink:0}.row-open>span{display:none}.row-link:hover .row-title,.row-link:focus-visible .row-title{color:var(--accent)}.chosen .row-number{color:var(--accent)}.preview-toggle{display:none}
.collection-preview{margin:0;position:sticky;top:28px;min-width:0;padding-top:25px}.preview-image{aspect-ratio:4/3;overflow:hidden;background:var(--ink);animation:preview-in .24s ease-out}.preview-image img{width:100%;height:100%;object-fit:cover;display:block}.collection-preview figcaption{display:flex;justify-content:space-between;gap:20px;align-items:center;padding:22px 0;border-bottom:1px solid var(--line)}.preview-category{display:block;font-size:12px;color:var(--muted);margin-bottom:10px}.preview-title{display:block;font:600 clamp(30px,3vw,46px)/1.1 var(--display);letter-spacing:-.055em}.collection-preview a{min-width:44px;min-height:44px;display:grid;place-items:center;color:var(--accent)}.preview-disclosure{font-size:12px;color:var(--muted);line-height:1.7;margin-top:12px}.mobile-preview img{width:100%;height:auto;display:block;aspect-ratio:16/9;object-fit:cover}.mobile-preview{margin:0 0 20px}
@keyframes preview-in{from{opacity:.4;transform:scale(1.015)}to{opacity:1;transform:scale(1)}}
@media(max-width:1023px){.project-index{grid-template-columns:minmax(0,1fr);padding-bottom:45px}.collection-preview{display:none}.project-row{flex-wrap:wrap;gap:10px;padding-block:22px}.row-link{gap:15px}.row-thumb{width:80px;height:56px}.row-title{font-size:28px}.row-number{display:none}.enhanced .preview-toggle{display:flex;align-items:center;gap:10px;min-height:44px;padding:8px 0;border:0;background:transparent;color:var(--accent);font-size:14px;margin-left:95px}.row-open{align-self:start;padding-top:3px}.row-category{font-size:14px;margin-top:9px}.row-link{min-height:56px}}
@media(max-width:359px){.row-thumb{width:62px;height:48px}.row-link{gap:12px}.row-title{font-size:25px}.enhanced .preview-toggle{margin-left:74px}}
@media(prefers-reduced-motion:reduce){.preview-image{animation:none}}.save-data .preview-image{animation:none}
.row-artist,.preview-artist{display:block;font-size:14px;line-height:1.6;margin-top:8px;color:var(--muted)}
.archive .project-rows li{scroll-margin-top:110px}.archive .project-row{padding-inline:10px;isolation:isolate}.archive .project-row:before{content:'';position:absolute;inset:0;background:#b8ff01;transform:scaleX(0);transform-origin:left;transition:transform .2s ease;z-index:-1}.archive .chosen .project-row:before,.archive .project-row:focus-within:before{transform:scaleX(1)}.archive .row-link:hover .row-title,.archive .row-link:focus-visible .row-title,.archive .chosen .row-number{color:#101d30}.archive .row-open{transition:transform .18s}.archive .row-link:hover .row-open,.archive .row-link:focus-visible .row-open{transform:translate(3px,-3px)}.archive .collection-preview{background:#101d30;padding:18px;top:105px;color:#f8f3e8;transform:rotate(1deg);box-shadow:8px 8px 0 #b8ff01}.archive .preview-image{aspect-ratio:1;background:#f8f3e8}.archive .preview-image img{object-fit:contain}.archive .preview-title{font-size:clamp(28px,3vw,46px)}.archive .preview-category,.archive .preview-artist{color:#f8f3e8c9}.archive .collection-preview a{color:#b8ff01}.archive .row-thumb{width:62px;height:62px}.archive .row-title{font-size:clamp(23px,2.2vw,35px)}.archive .row-category{margin-top:5px}.archive .row-artist{margin-top:4px}.archive .preview-toggle{color:#101d30}.archive .mobile-preview img{object-fit:contain;background:#101d30;aspect-ratio:1;max-height:440px}@media(max-width:1023px){.archive .project-row{padding:15px 8px}.archive .preview-toggle{margin-left:77px}.archive .row-title{font-size:25px}}@media(prefers-reduced-motion:reduce){.archive .project-row:before,.archive .row-open{transition:none}}
@media(max-width:768px){
  .project-row,.archive .project-row{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;padding:18px 8px}
  .row-link{display:grid;grid-template-columns:56px minmax(0,1fr) 24px;gap:12px;width:100%;min-width:0;align-items:start}
  .row-thumb,.archive .row-thumb{width:56px;height:56px;object-fit:contain}
  .row-content{min-width:0;width:100%}
  .mobile-number{display:block;font:500 12px/1.2 var(--mono,monospace);margin-bottom:6px;color:var(--muted)}
  .row-title,.archive .row-title{font-size:clamp(18px,4.8vw,20px);line-height:1.2;letter-spacing:-.035em;white-space:normal;word-break:keep-all;overflow-wrap:normal;hyphens:none}
  .row-artist,.row-category{word-break:normal;overflow-wrap:break-word;font-size:13px;line-height:1.45}
  .row-open{margin:0;padding:0;min-width:24px;display:grid;place-items:start center}
  .enhanced .preview-toggle,.archive.enhanced .preview-toggle{justify-self:start;margin:0 0 0 68px;min-height:44px;max-width:calc(100% - 68px);padding:9px 12px;border:1px solid currentColor;border-radius:99px;gap:7px;font-size:13px;line-height:1.3;text-align:left}
}
</style>
