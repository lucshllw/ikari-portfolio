<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { ikariEnvironment } from '$lib/actions/ikari-environment';
  import { chapterMotion } from '$lib/actions/chapter-motion';
  import IkariProcessPanel from './IkariProcessPanel.svelte';

  export let about: string;
  export let expanded = false;
</script>

<section class="ikari-about" class:expanded aria-labelledby="ikari-about-title" use:ikariEnvironment use:chapterMotion>
  <div class="about-ambient" aria-hidden="true"><span class="about-kanji" data-environment-layer>作画</span><div class="genga-grid" data-environment-layer></div><span class="genga-star" data-environment-spark>✦</span></div>
  <div class="about-tapes" aria-hidden="true"><div class="tape tape-a"><div data-environment-tape><span>ANIMAÇÃO 2D ★ CENA POR CENA ★ STORYBOARD ★ DIREÇÃO VISUAL ★ </span><span>ANIMAÇÃO 2D ★ CENA POR CENA ★ STORYBOARD ★ DIREÇÃO VISUAL ★ </span></div></div><div class="tape tape-b"><div data-environment-tape><span>作画 ★ 音楽 ★ 編集 ★ IKARI ★ 作画 ★ 音楽 ★ 編集 ★ </span><span>作画 ★ 音楽 ★ 編集 ★ IKARI ★ 作画 ★ 音楽 ★ 編集 ★ </span></div></div></div>
  <div class="ikari-about-portrait" data-chapter-piece>
    <div class="portrait-paper"><span class="portrait-tape" aria-hidden="true"></span><div class="portrait-inner">
      <img src="/ikari/avatar.webp" alt="Avatar ilustrado usado por Ikari, com cabelo coral e fundo verde" width="400" height="400" loading="lazy"/>
      <span class="portrait-caption">Ikari</span></div>
    </div>
    <p class="portrait-note">Animação 2D & edição</p>
  </div>
  <div class="ikari-about-copy">
    {#if expanded}<h1 id="ikari-about-title" data-chapter-title>Sobre Ikari.</h1>{:else}<h2 id="ikari-about-title" data-chapter-title>Sobre Ikari.</h2>{/if}
    <p class="ikari-about-bio" data-chapter-piece>{about}</p>
    {#if expanded}
      <div class="ikari-practice">
        <h2>Entre a música<br/>e o movimento.</h2>
        <p>O portfólio reúne comissões musicais com edição, animação 2D e contribuições feitas em equipe. Em cada trabalho, a ficha técnica apresenta as participações e a publicação de origem.</p>
        <a href="/indice" class="about-link">Explorar as comissões <Icon name="diagonal" size={20}/></a>
      </div>
      <a href="/links" class="about-link">Conexões & bastidores <Icon name="diagonal" size={20}/></a>

    {:else}
      <a href="/sobre" class="about-link">Conhecer mais <Icon name="diagonal" size={20}/></a>
    {/if}
    <IkariProcessPanel/>
  </div>
</section>

<style>
  .ikari-about{display:grid;grid-template-columns:minmax(190px,.7fr) minmax(0,1.3fr);align-items:center;gap:clamp(28px,5vw,86px);padding:clamp(40px,7vw,100px) clamp(22px,4vw,60px);background:#f8f3e8;color:#111719;position:relative;isolation:isolate}
  .ikari-about:before{content:'';position:absolute;inset:0 auto 0 0;width:9px;background:#fa7155}
  .ikari-about-portrait{min-width:0;max-width:330px;width:100%;justify-self:center;padding:14px 14px 0}
  .portrait-paper{position:relative;padding:12px 12px 43px;background:#c8ff00;transform:rotate(-5deg);box-shadow:11px 12px 0 #111719}
  .portrait-paper img{display:block;width:100%;height:auto;aspect-ratio:1;object-fit:cover;border:2px solid #111719}
  .portrait-caption{position:absolute;left:16px;bottom:8px;font-family:var(--display);font-weight:750;font-size:23px;letter-spacing:-.04em}
  .portrait-note{font-size:14px;margin:32px 0 0;text-align:center}
  .ikari-about-copy{min-width:0}.ikari-about-copy h1,.ikari-about-copy h2{font-size:clamp(36px,4.5vw,68px);line-height:1.05;margin:0 0 25px}
  .ikari-about-bio{font-size:clamp(16px,1.5vw,20px);line-height:1.7;max-width:60ch;white-space:pre-line;overflow-wrap:anywhere}
  .about-link{display:inline-flex;align-items:center;gap:22px;margin-top:24px;min-height:46px;font-size:16px;font-weight:650;border-bottom:2px solid #111719}
  .about-link:hover{color:#91452f}.ikari-about a:focus-visible{outline:3px solid #111719;outline-offset:5px}
  .expanded{align-items:start;padding-block:clamp(45px,7vw,100px);grid-template-columns:minmax(230px,.9fr) minmax(0,1.1fr)}
  .expanded .ikari-about-portrait{max-width:460px;margin-top:20px}.expanded .ikari-about-copy h1{font-size:clamp(48px,6.5vw,98px)}
  .ikari-practice{border-top:2px solid #111719;padding-top:30px;margin-top:40px}.ikari-practice h2{font-size:clamp(29px,3vw,44px);margin-bottom:20px}
  .ikari-practice p{font-size:16px;line-height:1.8;max-width:60ch}
  
  @media(max-width:760px){.ikari-about,.expanded{grid-template-columns:minmax(0,1fr);gap:38px;padding:45px 24px}.ikari-about-portrait,.expanded .ikari-about-portrait{max-width:260px;margin-top:0}.ikari-about-copy h2{font-size:42px}.expanded .ikari-about-copy h1{font-size:clamp(44px,12vw,70px)}.ikari-about-copy{text-align:left}.ikari-about-bio{font-size:16px}.ikari-practice{margin-top:30px}}

 .ikari-about{overflow:clip;padding-top:180px;padding-bottom:110px;clip-path:polygon(0 1.5%,100% 0,100% 100%,0 98%);margin-top:-24px}.ikari-about-portrait,.ikari-about-copy{position:relative;z-index:2}.ikari-about-copy h1,.ikari-about-copy>h2{font-family:'Syne Variable',sans-serif;font-weight:800;font-size:clamp(55px,7vw,112px);letter-spacing:-.06em}.ikari-about:before{display:none}.about-ambient{position:absolute;inset:0;z-index:0;pointer-events:none}.about-kanji{position:absolute;right:-4%;top:15%;font:400 clamp(12rem,26vw,28rem) var(--jp);color:transparent;-webkit-text-stroke:2px #11131515;writing-mode:vertical-rl}.genga-grid{position:absolute;inset:-10%;background:repeating-linear-gradient(0deg,transparent 0 64px,#3899c315 65px 66px),repeating-linear-gradient(90deg,transparent 0 64px,#e62e2d0c 65px 66px);transform:rotate(-7deg);border-radius:50%;border:2px solid #3899c325}.genga-star{position:absolute;left:2%;bottom:7%;font:400 180px/1 Arial;color:#b8ff0170}.about-tapes{position:absolute;top:25px;left:-5%;width:110%;height:120px;z-index:3;pointer-events:none}.tape{position:absolute;width:100%;overflow:hidden;border-block:2px solid #111315;padding:12px 0;font:600 17px/1.4 var(--mono);white-space:nowrap}.tape>div{display:flex;width:max-content}.tape>div>span{display:block;padding-right:2ch}.tape-a{background:#111315;color:#b8ff01;transform:rotate(-3deg);top:10px}.tape-b{background:#b8ff01;color:#111315;transform:rotate(2deg);top:50px;font-family:var(--jp)}.portrait-paper{border:2px solid #111315}.portrait-paper:before{content:'';position:absolute;inset:-15px;border:2px dashed #e62e2d44;transform:rotate(4deg);pointer-events:none}.portrait-note{font-family:var(--mono);font-size:13px}
 @media(max-width:760px){.ikari-about{padding-top:165px;padding-bottom:80px}.tape{font-size:14px}.ikari-about-copy h1,.ikari-about-copy>h2{font-size:clamp(50px,12vw,80px)}.about-kanji{font-size:250px;top:45%;opacity:.6}}
.portrait-tape{position:absolute;top:-13px;left:25%;width:48%;height:32px;background:#49d8cde6;transform:rotate(4deg);z-index:3;clip-path:polygon(3% 0,100% 5%,97% 100%,0 90%)}.expanded .portrait-paper{transform:rotate(-4deg)}
</style>
