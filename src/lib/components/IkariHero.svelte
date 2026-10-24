<script lang="ts">
import {onionSkin} from '$lib/actions/onion-skin';
import {chromaticLetters} from '$lib/actions/chromatic-letters';
import { chapterMotion, suspendedArtwork } from '$lib/actions/chapter-motion';
import { fanzineMotion } from '$lib/actions/fanzine-motion';
import {studioPointer,studioAmbient} from '$lib/actions/studio-motion';
import Icon from './Icon.svelte';
import { mobileHeroMotion } from '$lib/actions/ikari-mobile-motion';
import type { Project, PublicSiteSettings } from '$lib/domain/types';
export let settings: PublicSiteSettings;
export let projects: Project[] = [];
let host: HTMLElement;
</script>

<section bind:this={host} use:fanzineMotion={'hero'} use:chapterMotion use:mobileHeroMotion class="ikari-hero" data-release-count={projects.length} aria-labelledby="ikari-heading">
  <div class="fanzine-stage" data-fanzine-stage>
    <div class="hero-background" aria-hidden="true">
      <span class="background-word background-word-ikari" data-hero-background>怒り</span>
      <span class="background-word background-word-animation" data-hero-background>弐拾四フレーム</span>
      <div class="background-plane plane-coral" data-hero-background></div>
      <div class="background-plane plane-cream" data-hero-background></div>
      <div class="background-plane plane-grid" data-hero-background></div>
      <span class="background-star background-star-coral" data-hero-background>★</span>
      <span class="background-star background-star-cyan" data-hero-background>✦</span>
    </div>
    <div class="hero-register"><span>PORTFÓLIO / ANIMAÇÃO 2D</span><span aria-hidden="true">VOL. 01 — IKARI</span></div>
    <div class="hero-copy" data-fanzine-copy>
      <div class="hero-name" use:chromaticLetters data-fanzine-title aria-hidden="true"><span class="hero-name-line" data-fanzine-intro>{#each Array.from(settings.brandName) as letter, i}<span class="hero-letter" data-hero-letter data-letter-index={i}><span data-hero-ink><span data-hero-wave>{letter === ' ' ? '\u00a0' : letter}</span></span></span>{/each}</span></div>
      <div class="hero-intention" data-fanzine-intro>
        <h1 id="ikari-heading">{#each settings.headline.split('\n') as line,i}<span data-chapter-title>{line}{i===0?' ':''}</span>{/each}</h1>
        <p>{settings.subheadline}</p>
        <div class="hero-links"><a class="hero-selected" href="/indice">Explorar o Índice <Icon name="diagonal" size={22}/></a><a class="hero-contact" href="/contato">Vamos criar? <Icon size={20}/></a></div>
      </div>
    </div>
    <div class="art-scene" aria-hidden="true" use:suspendedArtwork>
      <div class="art-poster" use:onionSkin data-fanzine-art>
        <div class="art-pointer" data-art-pointer><div class="art-float" data-art-float><img class="art-still" src="/ikari/hero-aya-v09.webp" srcset="/ikari/hero-aya-small-v09.webp 480w, /ikari/hero-aya-v09.webp 736w" sizes="(max-width:640px) 86vw, 46vw" alt="" width="736" height="981" loading="eager" fetchpriority="high"/></div></div>
      </div>
    </div>
    <div class="hero-mural" data-hero-mural aria-hidden="true" use:studioPointer={'tilt'} use:studioAmbient><div class="mural-perspective" data-pointer-surface><img src="/ikari/banner-mural-v09.webp" srcset="/ikari/banner-mural-small-v09.webp 640w, /ikari/banner-mural-v09.webp 1280w" sizes="100vw" width="1280" height="720" alt="" loading="eager" data-hero-mural-art/>
      <svg class="mural-layers" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice"><defs><filter id="mural-soft-light"><feGaussianBlur stdDeviation="9"/></filter></defs><g fill="none" stroke="#ed403b" stroke-width="3"><path data-mural-wire d="M670 80 Q750 190 819 149 Q930 215 979 149 Q980 360 1040 398 Q1080 460 870 332 Q780 230 745 260"/><path data-mural-wire d="M1200 20 Q1120 200 1200 280 Q1090 400 1040 398 Q780 370 735 426"/></g><g class="mural-aura" data-studio-glow><ellipse cx="295" cy="320" rx="52" ry="75" fill="#00e8e8" opacity=".45" filter="url(#mural-soft-light)"/><path d="M265 345 Q220 290 287 240 Q253 300 321 283 Q356 343 290 365" fill="none" stroke="#a2ffff" stroke-width="2" opacity=".65"/></g><g fill="#76ffff">{#each [[265,230],[335,273],[240,355],[315,390],[290,210]] as [cx,cy]}<circle {cx} {cy} r="3" data-studio-float/>{/each}</g></svg>
      <span class="mural-evidence evidence-one" data-mural-tag><i></i>EVIDÊNCIA 01 <small>24 FPS / SAKUGA</small></span><span class="mural-evidence evidence-two" data-mural-tag><i></i>EVIDÊNCIA 02 <small>CORTE DE IMPACTO</small></span><span class="mural-evidence evidence-three" data-mural-tag><i></i>EVIDÊNCIA 03 <small>DIREÇÃO VISUAL</small></span><span class="mural-seal">編集 / IKARI</span></div></div>
    <svg class="hero-red-thread" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true"><path data-hero-thread d="M-20 720 L750 -20 M740 0 Q640 180 920 400 T500 820" fill="none" stroke="#e62e2d" stroke-width="8"/></svg>
    <div class="hero-footer"><span class="scroll-cue">Role para mudar a cena <span aria-hidden="true">↓</span></span><a href="/sobre">O universo de Ikari <Icon name="diagonal" size={18}/></a></div>

  </div>
</section>

<style>
.ikari-hero{--lime:#c8ff00;--hero-ink:#111719;--cream:#f4eeda;position:relative;margin-top:24px;height:auto;color:var(--hero-ink);background:var(--lime)}
.fanzine-stage{position:sticky;top:0;min-height:100svh;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,1fr);grid-template-rows:auto 1fr auto;padding:28px clamp(24px,3.5vw,54px);gap:22px;overflow:hidden;isolation:isolate}
.hero-background{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;perspective:900px}.background-word{position:absolute;font-family:var(--jp);font-weight:900;letter-spacing:0;line-height:1;white-space:nowrap;color:transparent;-webkit-text-stroke:2px var(--hero-ink);opacity:.12}.background-word-ikari{top:4%;right:-6%;font-size:clamp(130px,23vw,360px);transform:rotate(8deg)}.background-word-animation{bottom:14%;left:-3%;font-size:clamp(55px,8vw,120px);transform:rotate(-8deg);opacity:.055}.background-plane{position:absolute;pointer-events:none}.plane-coral{background:#fa7155;top:16%;right:-5%;height:67%;width:45%;transform:rotate(6deg)}.plane-cream{background:var(--cream);width:32%;height:42%;top:11%;right:4%;transform:perspective(850px) rotateY(-28deg) rotateZ(-7deg)}.plane-grid{width:60%;height:45%;right:-18%;bottom:-11%;border:2px solid var(--hero-ink);background:repeating-linear-gradient(0deg,transparent 0 35px,rgb(17 23 25 / .2) 35px 36px),repeating-linear-gradient(90deg,transparent 0 35px,rgb(17 23 25 / .2) 35px 36px);transform:perspective(700px) rotateX(58deg) rotateZ(-15deg);opacity:.45}.background-star{position:absolute;font:750 clamp(65px,7.5vw,120px)/1 Arial,sans-serif;-webkit-text-stroke:2px var(--cream);text-shadow:2px 3px 0 var(--hero-ink)}.background-star-coral{right:1%;top:8%;color:#fa7155;transform:rotate(12deg)}.background-star-cyan{left:45%;bottom:18%;color:#4ce3df;transform:rotate(-8deg)}
.hero-register{position:relative;z-index:3;grid-column:1/-1;display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid rgb(17 23 25 / .38);padding-bottom:16px;font:600 14px/1.4 var(--font);letter-spacing:.04em}
.hero-copy{position:relative;z-index:3;align-self:center;min-width:0;padding-block:20px 55px}
.hero-name{font:850 clamp(105px,17vw,265px)/.78 var(--display);letter-spacing:-.085em;text-transform:uppercase;padding-block:10px 26px;overflow-wrap:anywhere}.hero-name-line{display:block;white-space:nowrap}.hero-letter{display:inline-block;vertical-align:baseline}
.hero-intention{margin-top:8px}.hero-intention h1{font:750 clamp(32px,3.4vw,58px)/1.04 var(--display);letter-spacing:-.05em;white-space:pre-line;max-width:560px;color:var(--hero-ink)}.hero-intention p{font-size:16px;line-height:1.6;max-width:410px;margin-top:20px;font-weight:500}
.hero-links{display:flex;flex-wrap:wrap;align-items:center;gap:22px;margin-top:26px}.hero-selected,.hero-contact{display:inline-flex;align-items:center;gap:20px;min-height:48px;font-size:14px;font-weight:650}.hero-selected{padding:12px 18px;border:1.5px solid var(--hero-ink);background:var(--hero-ink);color:var(--cream)}.hero-selected:hover{background:var(--cream);color:var(--hero-ink)}.hero-contact:hover{text-decoration:underline;text-underline-offset:5px}
.art-scene{position:relative;align-self:stretch;min-height:600px;z-index:1;display:flex;align-items:center;justify-content:center;padding:18px 0 30px;min-width:0}.art-poster{position:relative;width:100%;height:clamp(480px,76svh,920px);background:var(--lime)}.art-still{width:100%;height:100%;object-fit:contain;object-position:center;display:block}
.hero-footer{grid-column:1/-1;position:relative;z-index:3;display:flex;justify-content:space-between;align-items:center;gap:18px;border-top:1px solid rgb(17 23 25 / .38);padding-top:14px;font-size:14px}.hero-footer>a{display:inline-flex;align-items:center;gap:12px;min-height:44px}.hero-footer>a:hover{text-decoration:underline;text-underline-offset:5px}.scroll-cue{display:flex;align-items:center;gap:14px;font-weight:550}.scroll-cue>span{font-size:26px}

.ikari-hero :global(:focus-visible){outline:3px solid var(--hero-ink);outline-offset:5px}.ikari-hero:global([data-motion=static]){height:auto}.ikari-hero:global([data-motion=static]) .fanzine-stage{position:relative}
@media(min-width:1024px) and (max-height:800px){.fanzine-stage{gap:14px;padding-block:20px}.art-scene{min-height:480px}.art-poster{height:70svh}.hero-name{font-size:clamp(100px,15.4vw,230px);padding-bottom:20px}.hero-copy{padding-bottom:30px}.hero-intention h1{font-size:clamp(30px,3vw,48px)}.hero-intention p{margin-top:16px}.hero-links{margin-top:22px}}
@media(max-width:1023px){.ikari-hero{height:auto}.fanzine-stage{position:relative;min-height:0;grid-template-columns:minmax(0,1fr) minmax(0,.9fr);padding:24px;gap:18px}.hero-copy{padding-block:25px 35px}.hero-name{font-size:clamp(90px,16vw,165px)}.hero-intention h1{font-size:clamp(30px,4.5vw,46px)}.art-scene{min-height:440px}.art-poster{height:510px}.hero-register{font-size:14px}.hero-links{gap:12px}.hero-contact{width:100%}.scroll-cue{display:none}.background-word-animation{font-size:8vw}}
@media(max-width:640px){.ikari-hero{margin-top:18px}.fanzine-stage{display:flex;flex-direction:column;gap:0;padding:20px 18px}.hero-register{padding-bottom:13px;font-size:14px;letter-spacing:0}.hero-register>span:last-child{display:none}.hero-copy{width:100%;padding:32px 0 22px}.hero-name{font-size:clamp(105px,26vw,166px);line-height:.78;padding-bottom:26px}.hero-intention h1{font-size:clamp(33px,9.2vw,48px);max-width:480px}.hero-intention p{font-size:16px;line-height:1.6;max-width:440px;margin-top:18px}.hero-links{margin-top:22px;gap:16px}.hero-contact{width:auto}.hero-selected{padding-inline:16px;gap:12px}.art-scene{width:100%;min-height:0;padding:15px 8px 28px}.art-poster{height:auto;aspect-ratio:736/981;max-height:600px}.hero-footer{width:100%;padding-top:10px}.hero-footer>a{font-size:14px}.plane-coral{width:85%;height:45%;top:auto;bottom:8%;right:-5%}.plane-cream{width:63%;height:32%;top:auto;bottom:16%;right:15%}.plane-grid{width:100%;height:20%;bottom:-4%;right:-18%}.background-word-ikari{top:2%;font-size:45vw;right:-8%;opacity:.05}.background-word-animation{bottom:7%;left:-2%;font-size:14vw;opacity:.08}.background-star-coral{right:0;top:auto;bottom:45%;font-size:75px}.background-star-cyan{left:2%;bottom:15%;font-size:66px}}
@media(prefers-reduced-motion:reduce){.ikari-hero{height:auto}.fanzine-stage{position:relative}.hero-selected{transition:none}}

.fanzine-stage{background:#b8ff01}.hero-background{background-image:radial-gradient(#11131516 .8px,transparent .8px);background-size:7px 7px}.hero-red-thread{position:absolute;inset:0;width:100%;height:100%;z-index:6;pointer-events:none;display:none}.hero-mural{grid-column:1/-1;position:relative;width:100%;height:65vw;max-height:760px;overflow:hidden}.hero-mural img{height:100%;width:100%;object-fit:cover}.mural-seal{position:absolute;right:4%;bottom:5%;color:#c8ff00;font:400 18px var(--jp);background:#111315;padding:10px 16px;transform:rotate(-3deg)}
@media(min-width:1024px){.ikari-hero:global([data-motion=enhanced]) .hero-mural{position:absolute;inset:0;height:100%;max-height:none;z-index:4;clip-path:polygon(100% 0,100% 0,100% 0,100% 0)}.ikari-hero:global([data-motion=enhanced]) .hero-red-thread{display:block}.fanzine-stage{height:100svh;min-height:760px}.art-scene{min-height:0}.art-poster{height:min(75svh,820px)}.hero-name{font-family:'Anton',sans-serif;letter-spacing:-.03em;line-height:.9;font-weight:400;font-size:clamp(130px,19vw,330px)}.hero-copy{padding-bottom:0}.background-word-ikari{font-size:clamp(12rem,26vw,28rem)}}
@media(max-width:1023px){.ikari-hero{height:auto}.hero-mural{margin-top:25px;height:60vw;min-height:260px;flex:none}.hero-mural img{object-position:35% center}.hero-register{font-family:var(--mono);font-size:13px}.fanzine-stage{min-height:0}}
@media(prefers-reduced-motion:reduce){.fanzine-stage{height:auto;min-height:0}.hero-mural{position:relative!important;height:55vw!important;min-height:280px;clip-path:none!important}.hero-red-thread{display:none!important}}
.ikari-hero:not(:global([data-motion=enhanced])) .fanzine-stage{position:relative;height:auto;min-height:0}
@media(min-width:1024px){.ikari-hero:global([data-motion=enhanced]){height:270svh}.ikari-hero:global([data-motion=enhanced]) .fanzine-stage{height:100svh;min-height:680px}}
.hero-intention h1>span{display:block}
@media(min-width:1024px){.ikari-hero:global([data-motion=enhanced]) .hero-mural{left:-4vw;right:-4vw;width:calc(100% + 8vw)}}
.art-pointer,.art-float{width:100%;height:100%}.hero-intention h1>span{font-family:inherit;font-style:normal;font-weight:inherit;font-size:1em;letter-spacing:inherit}

.ikari-hero{--hero-ink:#f3efe6;--lime:#b8ff01;background:#0e1013;margin-top:0;color:#f3efe6}.fanzine-stage{background:#0e1013}.hero-background{background-image:radial-gradient(#f3efe61a .8px,transparent .8px);background-size:9px 9px}.hero-background:before{content:'';position:absolute;right:0;top:0;width:63%;height:100%;background:#f3efe6;clip-path:polygon(37% 0,100% 0,100% 100%,0 100%)}.hero-name{color:#f3efe6}.hero-register{border-color:#f3efe655}.hero-register>span:last-child{color:#111315}.hero-intention h1{color:#f3efe6}.hero-intention p{color:#d6d7cf}.hero-footer{border-color:#f3efe655}.hero-footer>a{background:#111315;color:#f3efe6;padding:6px 14px}.hero-selected{background:#b8ff01;color:#111315;border-color:#b8ff01;box-shadow:4px 4px 0 #ff6b4a}.hero-selected:hover{background:#f3efe6}.hero-contact{color:#f3efe6}.art-poster{background:#b8ff01;border:2px solid #111315;box-shadow:9px 9px 0 #ff6b4a;rotate:2deg}.art-scene{padding:25px 10px 30px 25px}.background-word{color:transparent;-webkit-text-stroke:2px #ff6b4a;opacity:.18}.background-word-animation{-webkit-text-stroke:1px #f3efe6;opacity:.12;z-index:1}.background-star-cyan{left:42%}.plane-grid{border-color:#111315}.hero-mural{perspective:1200px}.mural-perspective{position:absolute;inset:0;transform-origin:center;isolation:isolate}.mural-perspective>img{display:block;width:100%;height:100%;object-fit:cover}.mural-layers{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.mural-evidence{position:absolute;display:block;z-index:2;background:#111315ed;color:#f3efe6;border-left:3px solid #e62e2d;padding:10px 13px;font:500 12px/1.5 var(--mono);box-shadow:4px 4px 0 #0003}.mural-evidence small{display:block;font:inherit;color:#b8ff01}.mural-evidence i{position:absolute;left:-30px;top:22px;width:30px;height:1px;background:#e62e2d}.evidence-one{right:16%;top:27%}.evidence-two{right:3%;top:48%}.evidence-three{right:19%;bottom:15%}.ikari-hero :global(:focus-visible){outline-color:#ff6b4a}.mural-seal{z-index:3}
@media(max-width:1023px){.hero-background:before{width:100%;height:65%;top:auto;bottom:0;clip-path:polygon(100% 4%,100% 100%,0 100%,0 25%)}.hero-copy{padding-bottom:20px}.hero-register>span:last-child{color:#b8ff01}.hero-footer{background:#111315;padding:15px;color:#f3efe6}.hero-footer>a{padding:0}.art-poster{max-width:520px}.art-scene{padding:20px 10px 25px 0}.mural-evidence{font-size:12px;padding:6px 8px}.evidence-one{right:12%;top:12%}.evidence-two{right:1%;top:43%}.evidence-three{right:8%;bottom:10%}.mural-evidence i{width:15px;left:-15px}.hero-mural{min-height:320px}.mural-perspective>img{object-position:center}.hero-footer>a{max-width:45%;font-size:13px}}
@media(prefers-reduced-motion:reduce){.hero-mural{min-height:320px}.mural-evidence{opacity:1!important;visibility:visible!important}}
@media(max-width:1023px){.hero-name{font-family:'Anton',sans-serif;font-weight:400;font-size:clamp(105px,30vw,225px);letter-spacing:-.025em;line-height:.95}}

.hero-letter>[data-hero-ink]{display:inline-block}
.hero-letter [data-hero-wave]{display:inline-block}
/* Give Syne descenders their own breathing room inside chapter masks. */
.hero-intention h1>span{line-height:1.2;padding-bottom:.18em;margin-bottom:-.12em}
@media(max-width:1023px){
 .hero-mural{height:auto;aspect-ratio:4/4.5;min-height:360px;max-height:650px;margin-top:20px}
 .mural-perspective>img{object-position:32% center}
 .mural-layers{width:100%;height:100%;object-position:32% center}
 .mural-evidence{display:none}
 .evidence-one{display:block;right:10px;top:14px;font-size:12px;padding:8px;max-width:155px}
 .mural-seal{left:10px;right:10px;bottom:10px;font-size:14px;transform:none;text-align:right;padding:10px 12px;border-top:1px solid #b8ff0160}
 .hero-footer>a{max-width:none}
 .hero-name{padding-block:12px 28px;overflow:visible}
 .background-word-ikari{opacity:.14}
}
@media(max-width:640px){.hero-intention h1{font-size:clamp(28px,8.2vw,34px);line-height:1.25}.hero-intention h1>span{white-space:nowrap;line-height:1.25;padding-block:.08em .22em;overflow:visible}}
@media(max-width:360px){.hero-intention h1{font-size:26px}}
@media(prefers-reduced-motion:reduce){.hero-mural{clip-path:none!important}}
</style>
