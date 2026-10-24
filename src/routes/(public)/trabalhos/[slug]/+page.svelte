<script lang="ts">
import {coverSources} from '$lib/images';
import {releaseTitle} from '$lib/commissions';
import type { PageData } from './$types';
import Icon from '$lib/components/Icon.svelte';
import {chapterMotion} from '$lib/actions/chapter-motion';
import CommissionPlayer from '$lib/components/CommissionPlayer.svelte';
export let data: PageData;
let playing = false;
$: category = data.categories.find((item) => item.id === data.project.categoryId)?.name || 'Audiovisual';
$: demonstration = /EXEMPLO DEMONSTRATIVO/i.test(data.project.description);
$: cover = data.project.coverUrl || '/demo/ritmo.webp';
$: sourceSet = coverSources(cover);
let previousProject = data.project.id;
$: if (data.project.id !== previousProject) { playing = false; previousProject = data.project.id; }
</script>
<svelte:head><title>{data.project.title} — {data.settings.brandName}</title><meta name="description" content={data.project.summary}/></svelte:head>
<div class="v04-wrap" class:work-chapter={data.presentation.theme==='ikari'} style={`--work-accent:${data.workAccent}`} use:chapterMotion={data.presentation.theme==='ikari'?data.project.id:false}>
  <header class="v04-page-heading v04-detail-heading"><a class="v04-back-link v04-meta" href={data.presentation.theme==='ikari'?data.returnTo:'/trabalhos'}><span aria-hidden="true">←</span> {data.presentation.theme==='ikari'?'Voltar ao Índice':'Voltar aos trabalhos'}</a>{#if data.presentation.theme==='ikari'}<span class="work-number" aria-label={`Obra ${data.ordinal}`}>{String(data.ordinal).padStart(2,'0')} / EM CENA</span>{/if}<h1 data-chapter-title>{releaseTitle(data.project.title).track}</h1>{#if releaseTitle(data.project.title).artist}<p class="release-artist" data-chapter-piece>{releaseTitle(data.project.title).artist}</p>{/if}<div class="v04-detail-tags" data-chapter-piece>{#if demonstration}<span class="v04-demo-tag">Modelo demonstrativo</span>{/if}<span>{category}</span></div></header>
  <div class="work-viewfinder" data-chapter-piece><div class="viewfinder-rule" data-chapter-line></div>
  {#if data.excerpt}<CommissionPlayer src={data.excerpt.src} poster={cover} title={data.excerpt.track||data.project.title} credit={`Animação 2D: Ikari · Trecho publicado de ${Math.round(data.excerpt.duration)} s`} sourceUrl={data.project.sourceUrl}/>
  <div class="v04-player-links"><p>Somente a participação publicada por Ikari. Música: {data.excerpt.artist||'artista creditado na publicação'}.</p><div class="release-links">{#if data.excerpt.spotifyUrl}<a class="v04-inline-link" href={data.excerpt.spotifyUrl} target="_blank" rel="noopener noreferrer">Ouvir no Spotify <Icon name="diagonal" size={16}/></a>{/if}{#if data.video}<a class="v04-inline-link" href={data.video.watchUrl} target="_blank" rel="noopener noreferrer">Lançamento completo <Icon name="diagonal" size={16}/></a>{/if}</div></div>
  {:else}<div class="v04-player" class:v04-player-active={playing}>
    {#if playing && data.video}<iframe src={`${data.video.embedUrl}?autoplay=1`} title={`Vídeo de ${data.project.title}`} allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    {:else}<img src={cover} srcset={sourceSet} sizes="(max-width:760px) 90vw, (min-width:1600px) 1480px, 94vw" alt={data.project.coverAlt || data.project.title} width="1200" height="675" fetchpriority="high"/>{#if data.video}<button class="v04-play-button" onclick={() => { playing = true; }} aria-label="Reproduzir vídeo"><Icon name="play" size={28}/><span class="sr-only">Reproduzir vídeo</span></button>{/if}{/if}
  </div>
  {#if data.video}<div class="v04-player-links"><a class="v04-inline-link" href={data.video.watchUrl} target="_blank" rel="noopener noreferrer">Abrir vídeo <Icon size={16}/></a><p>O player externo é carregado somente ao reproduzir. Você também pode assistir diretamente no provedor.</p></div>{:else if !data.project.sourceUrl}<p class="v04-no-video">Prévia visual. Este trabalho ainda não tem um vídeo disponível.</p>{/if}
  {/if}
  </div>
  {#if data.project.sourceUrl}<div class="v04-original-source"><a class="v04-inline-link" href={data.project.sourceUrl} target="_blank" rel="noopener noreferrer">Ver publicação original <Icon name="diagonal" size={18}/></a><p>Confira o trecho e os créditos na fonte publicada.</p></div>{/if}
  <section class="v04-detail-context" aria-labelledby="context-heading"><div><h2 id="context-heading" class="v04-meta">Sobre o projeto</h2><p class="v04-detail-summary">{data.project.summary}</p>{#if data.excerpt}<details class="release-credits"><summary>Ficha técnica e créditos</summary><p class="v04-project-description">{data.project.description}</p></details>{:else}<p class="v04-project-description">{data.project.description}</p>{/if}</div><dl><div><dt class="v04-meta">Categoria</dt><dd>{category}</dd></div>{#if demonstration}<div><dt class="v04-meta">Apresentação</dt><dd>Exemplo demonstrativo</dd></div>{/if}</dl></section>
  <section class="v04-detail-cta"><h2>Vamos criar o próximo?</h2><a class="v04-button" href={`/contato?referencia=${encodeURIComponent(data.project.id)}`}>Iniciar projeto <Icon size={18}/></a></section>
</div>
<style>.release-artist{font-size:clamp(20px,2vw,30px);margin-top:18px;line-height:1.3;color:var(--muted)}.release-links{display:flex;flex-wrap:wrap;gap:15px 25px}.release-links a{min-height:44px}.release-credits{border-top:1px solid var(--line);margin-top:24px}.release-credits summary{cursor:pointer;min-height:44px;padding-block:14px;font-size:14px}.release-credits[open] summary{margin-bottom:15px}.release-credits summary:focus-visible{outline:3px solid #355114;outline-offset:5px}</style>
