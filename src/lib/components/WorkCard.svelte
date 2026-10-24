<script lang="ts">
import {coverSources} from '$lib/images';
import type { Project, Category } from '$lib/domain/types';
import Icon from './Icon.svelte';
export let project: Project;
export let categories: Category[] = [];
export let eager = false;
export let variant: 'grid' | 'index' = 'grid';
export let index = 0;
$: category = categories.find((item) => item.id === project.categoryId)?.name || 'Audiovisual';
$: demonstration = /EXEMPLO DEMONSTRATIVO/i.test(project.description);
$: cover = project.coverUrl || '/demo/ritmo.webp';
$: sourceSet = coverSources(cover);
</script>
<a class="v04-work-card" class:v04-work-index={variant === 'index'} href={`/trabalhos/${project.slug}`}>
  <div class="v04-work-image"><img src={cover} srcset={sourceSet} sizes={variant === 'index' ? '(max-width:760px) 90vw, 50vw' : '(max-width:760px) 90vw, 44vw'} alt={project.coverAlt || project.title} width="1200" height="675" loading={eager ? 'eager' : 'lazy'} decoding="async"/></div>
  <div class="v04-work-caption">
    {#if variant === 'index'}<div class="v04-index-number"><span class="v04-meta" aria-hidden="true">{String(index).padStart(2, '0')}</span><span aria-hidden="true"></span></div>{/if}
    <h3>{project.title}</h3>
    <div class="v04-work-meta"><span class="v04-meta">{category}</span><span class="v04-work-action"><span>Ver projeto</span><Icon size={17}/></span></div>
    {#if demonstration}<span class="v04-demo-caption">Modelo demonstrativo</span>{/if}
  </div>
</a>
