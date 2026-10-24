<script lang="ts">
import { fanzineMotion } from '$lib/actions/fanzine-motion';
import { chapterMotion } from '$lib/actions/chapter-motion';
import { coverSources } from '$lib/images';
import { releaseTitle } from '$lib/commissions';
import type { Project, Category } from '$lib/domain/types';
import Icon from './Icon.svelte';
export let projects: Project[] = [];
export let categories: Category[] = [];
$: featured = projects.filter(project => project.featured).slice(0, 4);
function category(project: Project) { return categories.find(item => item.id === project.categoryId)?.name || 'Comissão'; }
</script>

<section id="selecionados" class="ikari-showcase" data-fanzine-total={featured.length} style={`--showcase-count:${Math.max(1,featured.length)}`} use:fanzineMotion={'showcase'} aria-labelledby="showcase-heading">
  {#each featured as project,i}<div data-showcase-anchor={`faixa${i+1}`} class="showcase-sentinel" style={`top:${i / Math.max(1, featured.length) * 100}%`} aria-hidden="true"></div>{/each}
  <div class="showcase-stage" data-showcase-stage>
    <header class="showcase-heading" use:chapterMotion><h2 id="showcase-heading" data-chapter-title>Som que vira cena.</h2><p>Comissões selecionadas.<br/>Role para trocar de faixa.</p><a href="/indice">Índice completo <Icon name="diagonal" size={20}/></a></header>
    <nav class="showcase-chapters" aria-label="Faixas selecionadas">{#each featured as project,i}<a href={`#faixa${i+1}`} data-showcase-chapter={i} aria-label={`Faixa ${i+1}: ${releaseTitle(project.title).track}`}><span>{String(i+1).padStart(2,'0')}</span><span class="chapter-track">{releaseTitle(project.title).track}</span></a>{/each}<span class="chapter-count" data-fanzine-count>01 / {String(featured.length).padStart(2,'0')}</span></nav>
    <div class="showcase-scenes">
      <div class="showcase-wipes" aria-hidden="true">{#each featured as project,i}<span class={`showcase-wipe color-${i}`} data-showcase-wipe></span>{/each}<span class="showcase-exit-ink" data-showcase-exit></span></div>
      <div class="showcase-objects" aria-hidden="true"><span class="showcase-kanji" data-showcase-object>共鳴</span><span class="showcase-vertical">音と映像</span><svg class="showcase-vinyl" data-showcase-vinyl viewBox="0 0 300 300"><g class="vinyl-spin"><circle cx="150" cy="150" r="145" fill="#111315" stroke="#f8f3e8" stroke-width="3"/>{#each [130,118,106,94,82] as radius}<circle cx="150" cy="150" r={radius} fill="none" stroke="#f8f3e8" stroke-opacity=".3" stroke-width="2"/>{/each}<circle cx="150" cy="150" r="48" fill="#b8ff01"/><path d="M150 118 L159 142 L183 150 L159 158 L150 182 L141 158 L117 150 L141 142Z" fill="#fa7155"/><circle cx="150" cy="150" r="5" fill="#111315"/></g></svg><svg class="showcase-waves" viewBox="0 0 600 200" preserveAspectRatio="none">{#each Array(16) as _,i}<rect data-showcase-wave x={i*38} y={30+(i%3)*18} width="12" height={140-(i%3)*36} rx="6" fill="#111315"/>{/each}</svg><span class="ink-blot blot-one" data-showcase-ink></span><span class="ink-blot blot-two" data-showcase-ink></span><span class="paper-plane" data-showcase-object></span><span class="zine-star star-one" data-showcase-object>★</span><span class="zine-star star-two" data-showcase-object>✦</span><div class="paper-box box-one" data-showcase-object><span></span><i></i><b></b></div><div class="paper-box box-two" data-showcase-object><span></span><i></i><b></b></div><div class="paper-box box-three" data-showcase-object><span></span><i></i><b></b></div><span class="zine-strip" data-showcase-object>Música em movimento</span><span class="exit-star exit-star-one" data-showcase-exit-star>★</span><span class="exit-star exit-star-two" data-showcase-exit-star>✦</span></div>
      {#each featured as project,i (project.id)}
        <article id={`faixa${i+1}`} class={`showcase-panel color-${i}`} data-showcase-panel>
          <div class="showcase-copy"><p class="scene-category">{category(project)}</p><p class="scene-number" aria-hidden="true">{String(i+1).padStart(2,'0')}</p><h3>{releaseTitle(project.title).track}</h3>{#if releaseTitle(project.title).artist}<p class="scene-artist">{releaseTitle(project.title).artist}</p>{/if}<a class="scene-play" href={`/trabalhos/${project.slug}`}>Assistir ao trecho <Icon name="play" size={19}/></a></div>
          <div class="showcase-art" data-showcase-cover><div class="release-paper"><div class="release-cover"><img src={project.coverUrl} srcset={coverSources(project.coverUrl)} alt={project.coverAlt || project.title} sizes="(max-width:640px) 82vw, (max-width:1023px) 40vw, 43vw" width="640" height="640" loading="eager" decoding="async"/></div><p>{releaseTitle(project.title).artist || category(project)}</p></div></div>
        </article>
      {:else}<p class="showcase-empty">Os próximos selecionados aparecem aqui.</p>{/each}
    </div>
    <footer class="showcase-bottom"><p>Capas e músicas dos respectivos artistas. Créditos em cada projeto.</p><a href="/indice">Todas as comissões <Icon name="diagonal" size={20}/></a><span class="selection-progress" aria-hidden="true"><span data-fanzine-color></span></span></footer>
  </div>
</section>

<style>
.ikari-showcase{position:relative;background:#111719;color:#f4eeda;margin-bottom:36px}.showcase-stage{padding:clamp(30px,4vw,58px) clamp(20px,3.4vw,52px) 28px}.showcase-sentinel,.showcase-wipes,.showcase-objects{display:none}
.showcase-heading{display:flex;align-items:end;gap:30px;margin-bottom:24px}.showcase-heading h2{font:750 clamp(35px,4.5vw,68px)/1.02 var(--display);letter-spacing:-.055em;max-width:9ch}.showcase-heading>p{font-size:16px;line-height:1.55}.showcase-heading>a{margin-left:auto;white-space:nowrap;color:#c8ff00}.showcase-heading>a,.showcase-bottom>a{display:inline-flex;align-items:center;gap:16px;font-size:14px;font-weight:650;min-height:44px}
.showcase-chapters{display:flex;align-items:center;gap:8px;border-block:1px solid #5a6059;padding-block:11px;margin-bottom:25px}.showcase-chapters>a{display:flex;align-items:center;gap:9px;border:1px solid #5a6059;padding:7px 12px;min-height:44px;font-size:14px}.showcase-chapters>a>span:first-child{font-size:18px;font-weight:750;font-variant-numeric:tabular-nums}.chapter-count{margin-left:auto;white-space:nowrap;font-size:14px}.chapter-track{max-width:14ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.showcase-scenes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;position:relative}.showcase-panel{min-width:0;padding:25px;display:flex;flex-direction:column-reverse;gap:24px;color:#111719}.color-0{background:#fa7155}.color-1{background:#c8ff00}.color-2{background:#54d9d8}.color-3{background:#f4eeda}
.showcase-copy{min-width:0}.scene-category{font-size:14px;font-weight:600;line-height:1.5}.scene-number{font-family:var(--display);font-size:clamp(40px,5vw,70px);font-weight:750;line-height:1;margin:12px 0}.showcase-copy h3{font-family:var(--display);font-size:clamp(28px,3vw,46px);font-weight:750;line-height:1.06;letter-spacing:-.05em;overflow-wrap:anywhere}.scene-artist{font-size:18px;line-height:1.5;margin-top:12px}.scene-play{display:inline-flex;align-items:center;gap:30px;min-height:48px;margin-top:22px;padding:12px 19px;border:2px solid #111719;background:#111719;color:#f4eeda;font-size:16px;font-weight:650}
.showcase-art{min-width:0;padding:8px}.release-paper{padding:12px 12px 0;background:#f4eeda;border:2px solid #111719;box-shadow:8px 8px 0 #111719}.release-paper>p{font-size:14px;line-height:1.5;min-height:42px;display:flex;align-items:center;color:#111719}.release-cover{aspect-ratio:1;background:#111719;overflow:hidden}.release-cover img{height:100%;width:100%;display:block;object-fit:contain}
.showcase-bottom{display:flex;align-items:center;justify-content:space-between;gap:25px;margin-top:25px;padding-top:18px;border-top:1px solid #5a6059;position:relative}.showcase-bottom>p{font-size:12px;line-height:1.6;max-width:430px}.showcase-bottom>a{color:#c8ff00}.selection-progress{position:absolute;top:-1px;left:0;width:100%;height:3px;background:#5a6059}.selection-progress>span{height:100%;display:block;transform-origin:left;background:#c8ff00}
.ikari-showcase :global(:focus-visible){outline:3px solid #111719;outline-offset:5px}.showcase-chapters>a:focus-visible,.showcase-heading>a:focus-visible,.showcase-bottom>a:focus-visible{outline-color:#c8ff00}
@media(min-width:0px){
.ikari-showcase:global([data-showcase-enhanced='true']){height:calc(var(--showcase-count) * 100svh)}
:global([data-showcase-enhanced='true']) .showcase-stage{position:sticky;top:0;height:100svh;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;padding-block:22px 18px;overflow:clip}
:global([data-showcase-enhanced='true']) .showcase-heading{margin-bottom:14px;align-items:center}:global([data-showcase-enhanced='true']) .showcase-heading h2{font-size:clamp(30px,3vw,48px);max-width:none}:global([data-showcase-enhanced='true']) .showcase-heading>p{margin-left:auto;font-size:14px}:global([data-showcase-enhanced='true']) .showcase-heading>a{margin-left:12px}
:global([data-showcase-enhanced='true']) .showcase-chapters{margin-bottom:16px;padding-block:7px}:global([data-showcase-enhanced='true']) .showcase-chapters>a:global([aria-current='step']){color:#111719;background:#c8ff00;border-color:#c8ff00}
:global([data-showcase-enhanced='true']) .showcase-sentinel{display:block;position:absolute;left:0;width:1px;height:1px;scroll-margin-top:0}
:global([data-showcase-enhanced='true']) .showcase-scenes{display:block;isolation:isolate;overflow:clip;min-height:0}
:global([data-showcase-enhanced='true']) .showcase-wipes{display:block;position:absolute;inset:0;z-index:0;overflow:hidden}.showcase-wipe{position:absolute;inset:-2px;display:block}.showcase-wipe:not(:first-child){transform:translateY(100%)}
.showcase-exit-ink{display:block;position:absolute;inset:-7%;background:#c8ff00;transform:translateY(115%);clip-path:polygon(0 9%,14% 14%,28% 5%,47% 13%,63% 0,78% 10%,100% 3%,100% 100%,0 100%)}
:global([data-showcase-enhanced='true']) .showcase-panel{position:absolute;inset:0;z-index:3;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center;gap:4%;padding:clamp(20px,3vw,44px);background:transparent}
:global([data-showcase-enhanced='true']) .showcase-copy{align-self:center;position:relative;z-index:3;padding-right:10px}:global([data-showcase-enhanced='true']) .scene-number{font-size:clamp(55px,7vw,108px);margin:10px 0 14px;letter-spacing:-.06em}:global([data-showcase-enhanced='true']) .showcase-copy h3{font-size:clamp(32px,4.3vw,66px)}:global([data-showcase-enhanced='true']) .scene-play{margin-top:22px}
:global([data-showcase-enhanced='true']) .showcase-art{justify-self:center;width:min(100%,50svh);padding:0 18px 16px 0;position:relative;z-index:2}:global([data-showcase-enhanced='true']) .release-paper{transform:rotate(-3deg)}
:global([data-showcase-enhanced='true']) .showcase-bottom{margin-top:16px;padding-top:11px;min-height:44px}
:global([data-showcase-enhanced='true']) .showcase-objects{display:block;position:absolute;inset:0;pointer-events:none;z-index:1;overflow:clip;perspective:800px}.zine-star{position:absolute;line-height:1;color:#c8ff00;-webkit-text-stroke:2px #111719;filter:drop-shadow(4px 4px 0 #f4eeda)}.star-one{font-size:clamp(80px,10vw,155px);right:41%;top:8%}.star-two{font-size:95px;right:3%;bottom:3%}
.ink-blot{position:absolute;background:#c8ff00;opacity:.7;pointer-events:none}.blot-one{width:30%;height:39%;right:-7%;top:-9%;border-radius:39% 61% 60% 40% / 45% 30% 70% 55%;transform:rotate(-18deg)}.blot-two{width:21%;height:20%;left:-7%;bottom:-11%;border-radius:70% 30% 25% 75% / 30% 55% 45% 70%;transform:rotate(14deg)}
.paper-plane{position:absolute;right:5%;top:24%;width:26%;height:37%;background:#f4eeda;border:2px solid #111719;transform:rotateY(-25deg) rotateZ(12deg);box-shadow:14px 13px 0 #111719;opacity:.7}
.exit-star{position:absolute;line-height:1;color:#111719;-webkit-text-stroke:2px #f4eeda;font-size:clamp(90px,13vw,190px);transform:scale(.01);opacity:0}.exit-star-one{left:-3%;bottom:-3%}.exit-star-two{right:2%;top:-4%;font-size:clamp(110px,16vw,230px)}
.paper-box{position:absolute;width:62px;height:62px;transform-style:preserve-3d;transform:rotateX(-15deg) rotateY(-30deg) rotateZ(-12deg)}.paper-box span,.paper-box i,.paper-box b{display:block;position:absolute;inset:0;border:2px solid #111719;background:#f4eeda}.paper-box i{transform:rotateY(90deg) translateZ(var(--cube-depth,31px));background:#fa7155}.paper-box b{transform:rotateX(90deg) translateZ(var(--cube-depth,31px));background:#c8ff00}.paper-box span{transform:translateZ(var(--cube-depth,31px))}.box-one{right:47%;bottom:8%}.box-two{right:3%;top:5%;width:48px;height:48px}.box-three{left:2%;top:7%;width:40px;height:40px;opacity:.4}
.zine-strip{position:absolute;right:19%;bottom:2%;padding:7px 20px;background:#111719;color:#f4eeda;border:2px solid #f4eeda;transform:rotate(-6deg);font-size:14px;font-weight:650}
}
@media(max-width:1023px){.showcase-heading{flex-wrap:wrap;gap:18px}.showcase-heading>a{margin-left:0}.chapter-track{display:none}.showcase-panel{padding:20px}.showcase-chapters{flex-wrap:wrap}.showcase-heading h2{max-width:none;font-size:46px}}
@media(max-width:640px){.ikari-showcase{margin-bottom:24px}.showcase-stage{padding:32px 18px 25px}.showcase-scenes{grid-template-columns:minmax(0,1fr);gap:25px}.showcase-heading h2{font-size:clamp(39px,11vw,56px)}.showcase-heading>p{width:100%}.scene-number{font-size:52px}.showcase-copy h3{font-size:34px}.showcase-bottom{align-items:start;flex-direction:column;gap:12px}.chapter-count{font-size:14px}}

.ikari-showcase{margin-bottom:0;background:#ff6b4a;color:#111315}.showcase-heading h2{font-family:'Anton',sans-serif;font-weight:400;font-size:clamp(55px,7vw,112px);letter-spacing:-.03em}.showcase-heading>a,.showcase-bottom>a{color:#111315}.showcase-chapters{border-color:#11131560}.showcase-chapters>a{border-color:#11131580}.scene-number{font-family:'Anton',sans-serif;font-size:clamp(90px,12vw,180px);color:transparent;-webkit-text-stroke:2px #111315}.showcase-copy h3{font-family:'Syne Variable',sans-serif;font-size:clamp(36px,4.2vw,68px);font-weight:800}.release-paper{transform:rotate(-2deg)}.showcase-bottom{border-color:#11131560}.showcase-kanji{position:absolute;left:2%;top:-5%;font:400 clamp(12rem,26vw,28rem)/1 var(--jp);color:transparent;-webkit-text-stroke:2px #11131518;pointer-events:none}.showcase-vertical{position:absolute;right:2%;top:20%;font:900 22px var(--jp);writing-mode:vertical-rl;opacity:.25}.showcase-vinyl{position:absolute;right:-3%;top:9%;height:85%;width:auto;max-width:57%;opacity:.85;transform-origin:center}.showcase-waves{position:absolute;left:0;bottom:0;width:55%;height:35%;opacity:.07}.showcase-chapters>a:focus-visible,.showcase-heading>a:focus-visible,.showcase-bottom>a:focus-visible{outline-color:#111315}
@media(min-width:1024px){:global([data-showcase-enhanced='true']) .showcase-heading h2{font-size:clamp(55px,7vw,106px);line-height:.95;max-width:11ch}:global([data-showcase-enhanced='true']) .showcase-stage{padding:38px 5vw 28px}:global([data-showcase-enhanced='true']) .showcase-heading>p{max-width:20ch}:global([data-showcase-enhanced='true']) .showcase-heading>a{white-space:normal}:global([data-showcase-enhanced='true']) .showcase-scenes{overflow:clip}:global([data-showcase-enhanced='true']) .showcase-wipes{clip-path:circle(110% at 50% 50%)}:global([data-showcase-enhanced='true']) .scene-number{font-size:clamp(75px,10vw,140px)}:global([data-showcase-enhanced='true']) .showcase-copy h3{font-size:clamp(38px,4.5vw,64px)}}
@media(max-height:800px) and (min-width:1024px){:global([data-showcase-enhanced='true']) .showcase-heading h2{font-size:55px;max-width:none}:global([data-showcase-enhanced='true']) .showcase-stage{padding-block:18px}:global([data-showcase-enhanced='true']) .scene-number{font-size:65px}:global([data-showcase-enhanced='true']) .showcase-copy h3{font-size:38px}}
@media(max-width:640px){.showcase-heading h2{font-size:clamp(50px,14vw,76px)}.showcase-panel{border:2px solid #111315;box-shadow:6px 7px 0 #111315}.showcase-panel:nth-of-type(even){transform:rotate(1deg)}.showcase-panel:nth-of-type(odd){transform:rotate(-1deg)}.scene-number{font-size:75px}.showcase-copy h3{font-size:38px}}

:global([data-showcase-enhanced='true']) .showcase-stage{transition:background-color .24s ease}
:global([data-showcase-active='0']) .showcase-stage{background:#ff6b4a}
:global([data-showcase-active='1']) .showcase-stage{background:#b8ff01}
:global([data-showcase-active='2']) .showcase-stage{background:#54d9d8}
:global([data-showcase-active='3']) .showcase-stage{background:#f4eeda}
/* The mobile scene is a short native sticky stage, not four stacked posters.
   Without JS or under reduced motion, the accessible editorial grid remains. */
:global([data-showcase-enhanced='true'][data-motion-active='true']) .vinyl-spin{animation:vinyl-turn 12s linear infinite;transform-origin:150px 150px}
@keyframes vinyl-turn{to{transform:rotate(360deg)}}
@media(max-width:1023px){
 .ikari-showcase:global([data-showcase-enhanced='true']){height:calc(var(--showcase-count) * 82svh + 18svh)}
 :global([data-showcase-enhanced='true']) .showcase-stage{height:100svh;max-height:100svh;min-height:620px;padding:78px 16px 16px;gap:10px}
 :global([data-showcase-enhanced='true']) .showcase-heading{gap:8px;margin:0;display:flex;align-items:center}
 :global([data-showcase-enhanced='true']) .showcase-heading h2{font-size:clamp(35px,9.6vw,60px);line-height:.98;max-width:10ch;min-width:0;flex:1}
 :global([data-showcase-enhanced='true']) .showcase-heading>p{display:none}
 :global([data-showcase-enhanced='true']) .showcase-heading>a{margin-left:auto;max-width:8ch;font-size:14px;gap:5px;white-space:normal;flex:0 0 76px}
 :global([data-showcase-enhanced='true']) .showcase-chapters{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;min-width:0;margin:0;padding:6px 0;gap:7px;position:relative;scroll-behavior:smooth}
 :global([data-showcase-enhanced='true']) .showcase-chapters>a{flex:none;min-height:44px;padding:5px 9px;gap:6px;font-size:14px}
 :global([data-showcase-enhanced='true']) .chapter-track{display:block;max-width:11ch}
 :global([data-showcase-enhanced='true']) .chapter-count{position:sticky;right:0;background:#111315;color:#f3efe6;padding:10px 8px;box-shadow:-8px 0 8px #11131520}
 :global([data-showcase-enhanced='true']) .showcase-scenes{min-height:0;height:100%;border:2px solid #111315;touch-action:pan-y}
 :global([data-showcase-enhanced='true']) .showcase-panel{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;gap:4px;padding:14px 20px 20px;border:0;box-shadow:none;transform:none!important;align-items:center}
 :global([data-showcase-enhanced='true']) .showcase-art{grid-row:1;align-self:center;width:min(62vw,31svh,285px);padding:0;justify-self:center}
 :global([data-showcase-enhanced='true']) .release-paper{padding:8px 8px 0;box-shadow:5px 5px 0 #111315}
 :global([data-showcase-enhanced='true']) .release-paper>p{min-height:29px;font-size:12px;line-height:1.3}
 :global([data-showcase-enhanced='true']) .release-cover img{opacity:1;visibility:visible}
 :global([data-showcase-enhanced='true']) .showcase-copy{grid-row:2;padding:0;align-self:end;width:100%;position:relative}
 :global([data-showcase-enhanced='true']) .scene-category{font-size:14px;margin-bottom:4px}
 :global([data-showcase-enhanced='true']) .scene-number{position:absolute;right:-4px;bottom:44px;font-size:90px;opacity:.2;margin:0;z-index:-1}
 :global([data-showcase-enhanced='true']) .showcase-copy h3{font-size:clamp(28px,8.5vw,42px);line-height:1;max-width:95%;overflow-wrap:normal}
 :global([data-showcase-enhanced='true']) .scene-artist{font-size:16px;margin-top:4px;line-height:1.2}
 :global([data-showcase-enhanced='true']) .scene-play{min-height:44px;padding:8px 12px;font-size:14px;gap:18px;margin-top:10px}
 :global([data-showcase-enhanced='true']) .showcase-bottom{flex-direction:row;align-items:center;gap:8px;margin:0;padding:8px 0 0;min-height:44px}
 :global([data-showcase-enhanced='true']) .showcase-bottom>p{max-width:60%;font-size:12px;line-height:1.3}
 :global([data-showcase-enhanced='true']) .showcase-bottom>a{font-size:13px;gap:4px;max-width:12ch}
 :global([data-showcase-enhanced='true']) .showcase-vinyl{height:auto;width:65%;max-width:65%;top:8%;right:-9%;opacity:1}
 :global([data-showcase-enhanced='true']) .showcase-kanji{font-size:55vw;top:0;left:-14%;-webkit-text-stroke:2px #11131535}
 :global([data-showcase-enhanced='true']) .showcase-waves{width:100%;height:30%;bottom:12%;opacity:.12}
 :global([data-showcase-enhanced='true']) .star-one{font-size:68px;left:1%;right:auto;top:3%}
 :global([data-showcase-enhanced='true']) .star-two{font-size:60px;right:2%;bottom:18%}
 :global([data-showcase-enhanced='true']) .box-one{--cube-depth:17.5px;width:35px;height:35px;left:7%;bottom:32%;right:auto}
 :global([data-showcase-enhanced='true']) .box-two{--cube-depth:15px;width:30px;height:30px;right:12%;top:4%}
 :global([data-showcase-enhanced='true']) .box-three,:global([data-showcase-enhanced='true']) .zine-strip{display:none}
 :global([data-showcase-enhanced='true']) .showcase-vertical{right:4%;font-size:18px;top:35%}
}
@media(max-height:720px) and (max-width:1023px){
 :global([data-showcase-enhanced='true']) .showcase-stage{min-height:0;padding-top:65px;gap:6px}
 :global([data-showcase-enhanced='true']) .showcase-heading h2{font-size:32px}
 :global([data-showcase-enhanced='true']) .showcase-art{width:min(48vw,24svh)}
 :global([data-showcase-enhanced='true']) .scene-category{display:none}
 :global([data-showcase-enhanced='true']) .showcase-copy h3{font-size:29px}
}
</style>
