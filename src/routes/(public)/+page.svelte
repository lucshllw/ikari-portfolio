<script lang="ts">
import type { PageData } from './$types';
import Icon from '$lib/components/Icon.svelte';
import WorkCard from '$lib/components/WorkCard.svelte';
import HeroStage from '$lib/components/HeroStage.svelte';
import FrameStudy from '$lib/components/FrameStudy.svelte';
import IkariHero from '$lib/components/IkariHero.svelte';
import IkariShowcase from '$lib/components/IkariShowcase.svelte';
import IkariAbout from '$lib/components/IkariAbout.svelte';
import IkariBehindScenes from '$lib/components/IkariBehindScenes.svelte';
import IkariContactFinal from '$lib/components/IkariContactFinal.svelte';

export let data: PageData;
</script>
<svelte:head><title>{data.settings.brandName} — Edição e narrativas em movimento</title></svelte:head>

<div class="v04-wrap" class:ikari-home={data.presentation.theme==='ikari'}>
  {#if data.presentation.theme === 'ikari'}<IkariHero settings={data.settings} projects={data.projects}/>{:else}<section class="v04-hero" aria-labelledby="hero-title">
    <h1 id="hero-title">{data.settings.headline}</h1>
    <div class="v04-hero-copy"><p>{data.settings.subheadline}</p><span class="v04-meta">{data.settings.servicesText.split('\n').filter(Boolean).slice(0, 3).join(' / ')}</span></div>
    <div class="v04-hero-actions"><a class="v04-button" href="/trabalhos">Ver trabalhos <Icon size={17}/></a><a class="v04-button v04-button-outline" href="/contato">Iniciar projeto <Icon size={17}/></a></div>
    <div class="v04-hero-stage"><HeroStage accent={data.settings.accentColor || '#344CCD'}/></div>
  </section>{/if}
  {#if data.presentation.theme !== 'ikari'}<section id="trabalhos" class="v04-selected" aria-labelledby="selected-heading">
    <div class="v04-section-line"><span class="v04-meta" aria-hidden="true">02</span><span class="v04-section-rule" aria-hidden="true"></span><h2 id="selected-heading">{data.presentation.theme==='ikari'?'Comissões selecionadas':'Trabalhos selecionados'}</h2></div>
    <div class="v04-work-grid">{#each data.projects.slice(0, 4) as project, i}<WorkCard {project} categories={data.categories} eager={i < 2}/>{:else}<div class="v04-empty"><h3>O próximo trabalho começa aqui.</h3><p>Esta coleção ainda não tem projetos publicados.</p></div>{/each}</div>
    <div class="v04-collection-link"><a class="v04-inline-link" href="/trabalhos">Ver todos os trabalhos <Icon size={18}/></a></div>
  </section>{:else}
    <nav class="ikari-chapters" aria-label="Explorar o portfólio"><a href="#selecionados">01 / Comissões</a><a href="#sobre">02 / Sobre</a><a href="#bastidores">03 / Bastidores</a><a href="/indice">Índice <Icon name="diagonal" size={18}/></a></nav>
    <IkariShowcase projects={data.projects.filter(project=>project.featured)} categories={data.categories}/>
    <div id="sobre"><IkariAbout about={data.settings.about}/></div>
    <div id="bastidores"><IkariBehindScenes/></div>
  {/if}
  {#if data.presentation.theme !== 'ikari'}
  <section id="processo" class="v04-process" aria-labelledby="process-heading">
    <div class="v04-section-line"><span class="v04-meta" aria-hidden="true">03</span><span class="v04-section-rule" aria-hidden="true"></span><span class="v04-meta">Processo</span></div>
    {#if data.presentation.theme!=='ikari'||data.projects.length}<div class="v05-study-chapter"><FrameStudy accent={data.settings.accentColor || '#344CCD'} photo={data.presentation.theme==='ikari'?data.projects[0]?.coverUrl:undefined} photoAlt={data.presentation.theme==='ikari'?data.projects[0]?.coverAlt:undefined} disclosure={data.presentation.theme==='ikari'?'Frame da comissão publicada no perfil de Ikari.':'Imagem demonstrativa gerada.'}/></div>{/if}
    <div class="v04-process-grid"><div class="v04-process-intro"><h2 id="process-heading">O processo também<br/>conta histórias.</h2><p>{data.settings.about}</p><span class="v04-meta">Da primeira ideia ao último corte.</span></div>
      <ol class="v04-process-steps"><li><span class="v04-meta" aria-hidden="true">01</span><div><h3>Intenção</h3><p>Entender a história, o público e o que cada imagem precisa dizer. Reunir contexto antes de começar a montagem.</p></div></li><li><span class="v04-meta" aria-hidden="true">02</span><div><h3>Construção</h3><p>Encontrar o ritmo entre imagem, movimento e som. Montar, experimentar e desenvolver uma linguagem para a ideia.</p></div></li><li><span class="v04-meta" aria-hidden="true">03</span><div><h3>Refinamento</h3><p>Revisar os detalhes e preparar a entrega para os formatos em que ela será vista.</p></div></li></ol>
    </div>
  </section>
  {/if}
  {#if data.presentation.theme==='ikari'}<IkariContactFinal/>{:else}<section class="v04-contact-band" class:ikari-contact-band={data.presentation.theme==='ikari'} aria-labelledby="next-heading"><div>{#if data.presentation.theme==='ikari'}<img class="ikari-contact-avatar" src="/ikari/avatar.webp" width="80" height="80" alt="Avatar de Ikari" loading="lazy"/>{/if}<span class="v04-meta">O próximo plano</span><h2 id="next-heading">Vamos criar<br/>o próximo?</h2></div><a class="v04-button" href="/contato">Iniciar projeto <Icon size={20}/></a></section>{/if}
</div>
<style>
 .ikari-home{max-width:1780px}.ikari-chapters{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;padding:24px clamp(20px,3vw,48px);border-block:2px solid #111719;background:#fa7155;font-size:15px;font-weight:650}.ikari-chapters a{display:inline-flex;align-items:center;gap:15px;min-height:44px}.ikari-chapters a:hover{background:#111719;color:#f4eeda}.ikari-chapters a:focus-visible{outline:3px solid #111719;outline-offset:4px}.ikari-contact-avatar{display:block;width:80px;height:80px;border:3px solid #111719;transform:rotate(-6deg);margin-bottom:25px}.ikari-contact-band{margin-block:0!important;background:#fa7155!important;color:#111719!important;border-top:0;padding:clamp(32px,5vw,80px)!important}.ikari-contact-band .v04-button{background:#111719;color:#f4eeda;border-color:#111719}.ikari-contact-band .v04-button:hover{background:#c8ff00;color:#111719}.ikari-contact-band h2{font-size:clamp(52px,7vw,108px)}
 @media(max-width:760px){.ikari-chapters{gap:8px;font-size:14px;padding:15px 20px}.ikari-chapters a{flex-basis:calc(50% - 8px)}.ikari-contact-band h2{font-size:clamp(43px,12vw,65px)}}
</style>
