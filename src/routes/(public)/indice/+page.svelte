<script lang="ts">
import type {PageData} from './$types';
import ProjectIndex from '$lib/components/ProjectIndex.svelte';
import Icon from '$lib/components/Icon.svelte';
import {chapterMotion} from '$lib/actions/chapter-motion';
export let data:PageData;
</script>
<svelte:head><title>Índice completo — {data.settings.brandName}</title><meta name="description" content="O arquivo de comissões: artistas, músicas, créditos e os trechos de participação de Ikari."/></svelte:head>
<div class="archive-chapter" use:chapterMotion={data.presentation.theme==='ikari'}>
 <header class="archive-heading"><div><span class="v04-meta">Arquivo público / {String(data.total).padStart(2,'0')} obras</span><h1 data-chapter-title>Índice.</h1><p class="index-intention" data-chapter-piece>Artistas, músicas e a minha parte em cada cena.</p></div><span class="archive-mark" aria-hidden="true">編集<span>IKARI / CENAS & COMISSÕES</span></span><div class="archive-rule" data-chapter-line></div></header>
 <div class="archive-body">
  <nav class="archive-filters" aria-label="Filtrar projetos por categoria" data-chapter-piece><a href="/indice" aria-current={!data.selected?'page':undefined}>Todos <span>{data.total}</span></a>{#each data.categories as category}<a href={`/indice?categoria=${category.slug}`} aria-current={data.selected===category.slug?'page':undefined}>{category.name}<span>{category.count}</span></a>{/each}</nav>
  <p class="archive-count" aria-live="polite">{data.projects.length} {data.projects.length===1?'obra no arquivo':'obras no arquivo'}{data.selected?' nesta categoria':''}</p>
  {#if data.projects.length}<ProjectIndex projects={data.projects} categories={data.categories} archive/>{:else}<div class="v04-empty"><p>Nenhuma obra nesta categoria.</p><a href="/indice">Ver todo o arquivo</a></div>{/if}
  <div class="index-all"><a class="v04-inline-link" href="/contato">Uma ideia para a próxima cena? <Icon name="diagonal" size={20}/></a></div>
 </div>
</div>
<style>.index-intention{font-size:18px;line-height:1.65;margin-top:22px;max-width:540px;color:var(--muted)}.index-all{padding-bottom:50px;display:flex;justify-content:flex-end}@media(max-width:760px){.index-intention{font-size:16px;margin-top:15px}.index-all{justify-content:flex-start}}</style>
