<script lang="ts">
import type { PageData } from './$types';
import ProjectIndex from '$lib/components/ProjectIndex.svelte';
export let data: PageData;
const pageUrl=(page:number)=>`/trabalhos?${new URLSearchParams({...(data.selected?{categoria:data.selected}:{}),pagina:String(page)})}`;
</script>
<svelte:head><title>Trabalhos — {data.settings.brandName}</title></svelte:head>
<div class="v04-wrap">
  <header class="v04-page-heading v04-collection-heading"><div><span class="v04-meta">Portfólio audiovisual</span><h1>{data.presentation.theme==='ikari'?'Comissões':'Trabalhos'}</h1><p>{data.presentation.theme==='ikari'?'Animação, montagem e direção visual.':'Narrativas em movimento.'}</p></div><span class="v04-meta v04-heading-note">{#if data.presentation.theme==='ikari'}Trechos publicados.<br/>Créditos em cada projeto.{:else}Imagens que permanecem.<br/>Novos olhares.{/if}</span></header>
  <nav class="v04-filters" aria-label="Filtrar trabalhos"><a class:selected={!data.selected} aria-current={!data.selected ? 'page' : undefined} href="/trabalhos">Todos</a>{#each data.categories as category}<a class:selected={data.selected === category.slug} aria-current={data.selected === category.slug ? 'page' : undefined} href={`/trabalhos?categoria=${category.slug}`}>{category.name}</a>{/each}</nav>
  {#if data.projects.length}<ProjectIndex projects={data.projects} categories={data.categories}/>{:else}<div class="v04-empty"><h2>Nenhum trabalho nesta seleção.</h2><p>Explore outra categoria ou volte à coleção completa.</p><a class="v04-inline-link" href="/trabalhos">Ver toda a coleção</a></div>{/if}
  {#if data.pagination.totalPages>1}<nav class="collection-pages" aria-label="Páginas da coleção"><span>{data.pagination.total} trabalhos · página {data.pagination.page} de {data.pagination.totalPages}</span><div>{#if data.pagination.page>1}<a href={pageUrl(data.pagination.page-1)}>Anterior</a>{/if}{#if data.pagination.page<data.pagination.totalPages}<a href={pageUrl(data.pagination.page+1)}>Próxima</a>{/if}</div></nav>{/if}
</div>
<style>.collection-pages{display:flex;justify-content:space-between;gap:20px;align-items:center;border-top:1px solid var(--line);padding-block:20px 50px;font-size:14px;flex-wrap:wrap}.collection-pages div{display:flex;gap:20px}.collection-pages a{display:inline-flex;align-items:center;min-height:44px;border-bottom:1px solid currentColor}</style>
