<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { clapboardMotion } from '$lib/actions/ikari-mobile-motion';
  import { chapterMotion } from '$lib/actions/chapter-motion';
  import { ikariChannelUrl, ikariChannelVideos } from '$lib/ikari-channel';
  import { ikariEnvironment } from '$lib/actions/ikari-environment';
</script>

<section class="ikari-behind" aria-labelledby="ikari-behind-title" use:ikariEnvironment>
  <div class="behind-atmosphere" aria-hidden="true"><span class="behind-kanji" data-environment-layer>編集</span><span class="behind-seal">捜査線</span><div class="behind-focus"></div><span class="blue-spark spark-a" data-environment-spark>✦</span><span class="blue-spark spark-b" data-environment-spark>✦</span><span class="blue-spark spark-c" data-environment-spark>✦</span></div>

  <div class="ikari-behind-banner" use:clapboardMotion aria-hidden="true">
    <div class="behind-mural-frame"><img src="/ikari/banner-mural-v09.webp" srcset="/ikari/banner-mural-small-v09.webp 640w, /ikari/banner-mural-v09.webp 1280w" sizes="100vw" alt="" width="1280" height="720" loading="eager" data-clapboard-image/><svg class="clapboard-wires" viewBox="0 0 1280 720" preserveAspectRatio="xMidYMid slice"><path data-clapboard-wire d="M670 80 Q750 190 819 149 Q930 215 979 149 Q980 360 1040 398 Q1080 460 870 332 Q780 230 745 260" fill="none" stroke="#e62e2d" stroke-width="4"/></svg></div>
    <div class="clapboard-blade blade-top" data-clapboard-top><span>SCENE 04 // BASTIDORES DA EDIÇÃO</span></div>
    <div class="clapboard-blade blade-bottom" data-clapboard-bottom><span>編集 // 24 FPS</span></div>
  </div>
  <div class="ikari-behind-inner" use:chapterMotion>
    <header class="ikari-behind-heading" data-environment-pop>
      <div><p>Bastidores no canal</p><h2 id="ikari-behind-title" data-environment-heading data-chapter-title>Dentro<br/>da edição.</h2></div>
      <div class="ikari-behind-intro"><p>O processo também faz parte do projeto. Ikari abre a edição e conta o que aconteceu entre a ideia e o vídeo.</p><a href={ikariChannelUrl} target="_blank" rel="noopener noreferrer">Explorar o canal <Icon name="diagonal" size={20}/></a></div>
    </header>
    <div class="wire-stage"><svg class="investigation-wires" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden="true"><path data-environment-draw data-elastic-string d="M40,60 Q240,330 420,200 T820,300 T1160,460" fill="none" stroke="#e62e2d" stroke-width="5"/><path data-environment-draw d="M180 20 C70 250 580 0 600 250 S1150 100 1040 550" fill="none" stroke="#e62e2d" stroke-width="3"/></svg><div class="ikari-channel-grid">
      {#each ikariChannelVideos as video}
        <article class="ikari-channel-card" data-environment-pop><span class="wall-pin" aria-hidden="true"></span>
          <a href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`Assistir no YouTube: ${video.title}`}>
            <div class="ikari-channel-cover"><img src={video.cover} alt="" width="1280" height="720" loading="lazy"/><span class="channel-play" aria-hidden="true"><Icon name="play" size={27}/></span><span class="channel-duration" aria-label={`Duração ${video.duration}`}>{video.duration}</span></div>
            <div class="ikari-channel-caption"><p>{video.subject}</p><h3>{video.title}</h3><span class="channel-watch">Assistir no YouTube <Icon name="diagonal" size={18}/></span></div>
          </a>
        </article>
      {/each}
    </div></div>
  </div>
</section>

<style>
  .ikari-behind{position:relative;background:#111719;color:#f4eeda;isolation:isolate;overflow:clip;padding-bottom:clamp(40px,6vw,90px)}
  .ikari-behind-banner{height:clamp(95px,17vw,230px);overflow:hidden;border-block:3px solid #111719;background:#c8ff00}.ikari-behind-banner img{width:100%;height:100%;object-fit:cover;object-position:center}
  .ikari-behind-inner{padding:clamp(32px,5vw,70px) clamp(22px,4vw,60px) 0}.ikari-behind-heading{display:flex;align-items:end;justify-content:space-between;gap:40px;margin-bottom:42px}
  .ikari-behind-heading>div>p{font-size:16px;line-height:1.65}.ikari-behind-heading h2{font-size:clamp(46px,7.5vw,112px);line-height:.98;margin-top:15px;color:#fa7155}
  .ikari-behind-intro{max-width:350px;flex:1}.ikari-behind-intro a{display:inline-flex;align-items:center;gap:24px;min-height:44px;margin-top:18px;font-size:16px;border-bottom:2px solid #c8ff00}.ikari-behind a:focus-visible{outline:3px solid #c8ff00;outline-offset:6px}
  .ikari-channel-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;align-items:start}
  .ikari-channel-card{min-width:0;background:#f4eeda;color:#111719;border:8px solid #fa7155}.ikari-channel-card:nth-child(2){border-color:#c8ff00;margin-top:36px}.ikari-channel-card:nth-child(3){border-color:#6be4d3;margin-top:72px}
  .ikari-channel-card>a{display:block}.ikari-channel-cover{position:relative;aspect-ratio:16/9;overflow:hidden;background:#111719}.ikari-channel-cover img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .3s ease}
  .channel-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:58px;height:58px;border-radius:50%;background:#c8ff00;color:#111719;border:2px solid #111719}
  .channel-duration{position:absolute;bottom:9px;right:9px;padding:4px 7px;background:#111719;color:#f4eeda;font-size:14px;line-height:1.4}
  .ikari-channel-caption{padding:20px 16px}.ikari-channel-caption p{font-size:14px;line-height:1.5;margin-bottom:13px}.ikari-channel-caption h3{font-size:clamp(20px,2vw,28px);line-height:1.2;overflow-wrap:anywhere;margin:0;letter-spacing:-.025em}
  .channel-watch{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;line-height:1.5;margin-top:24px;font-weight:600}.ikari-channel-card a:hover img{transform:scale(1.035)}
  @media(max-width:1023px){.ikari-channel-grid{gap:18px}.ikari-channel-caption{padding:18px 12px}.ikari-channel-card{border-width:5px}.ikari-channel-caption h3{font-size:21px}}
  @media(max-width:760px){.ikari-behind-heading{display:block;margin-bottom:30px}.ikari-behind-heading h2{font-size:clamp(50px,13vw,80px)}.ikari-behind-intro{margin-top:24px;max-width:100%}.ikari-channel-grid{grid-template-columns:minmax(0,1fr);gap:25px}.ikari-channel-card:nth-child(2),.ikari-channel-card:nth-child(3){margin-top:0}.ikari-channel-caption h3{font-size:25px}.ikari-channel-caption{padding:20px}.ikari-behind-banner{height:110px}}
  @media(prefers-reduced-motion:reduce){.ikari-channel-cover img{transition:none}.ikari-channel-card a:hover img{transform:none}}

.ikari-behind{background:#0e1d30;padding-top:30px;clip-path:polygon(0 2%,100% 0,100% 100%,0 98%);margin-top:-30px;min-height:110svh}.ikari-behind-banner{height:clamp(100px,16vw,260px);clip-path:polygon(0 10%,100% 0,100% 85%,0 100%);transform:rotate(-2deg);opacity:.9}.ikari-behind-inner{position:relative;z-index:2}.ikari-behind-heading h2{font:400 clamp(60px,10vw,155px)/.94 'Anton',sans-serif;letter-spacing:-.035em}.behind-atmosphere{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,#0000 48%,#68bdca10 49% 50%,#0000 51%) 0 0/160px 76px,repeating-linear-gradient(0deg,#0000 0 73px,#0007 74px 76px);z-index:0}.behind-focus{position:absolute;inset:0;background:radial-gradient(circle at var(--light-x,65%) var(--light-y,40%),#52dce52a,transparent 35%)}.behind-kanji{position:absolute;right:-3%;top:19%;color:transparent;-webkit-text-stroke:2px #54d9d822;font:400 clamp(12rem,26vw,28rem)/1 var(--jp);writing-mode:vertical-rl}.behind-seal{position:absolute;top:8%;left:1%;font:900 24px var(--jp);writing-mode:vertical-rl;color:#c8ff0055}.blue-spark{position:absolute;color:#54d9d8;opacity:.5;font:400 65px/1 Arial}.spark-a{left:4%;top:35%}.spark-b{right:20%;top:70%;font-size:35px}.spark-c{left:45%;bottom:2%;font-size:50px}.wire-stage{position:relative;padding-top:50px}.investigation-wires{position:absolute;inset:0;width:100%;height:100%;overflow:visible;z-index:2;pointer-events:none}.investigation-wires path{pointer-events:stroke}.ikari-channel-card{position:relative;box-shadow:9px 10px 0 #0008;transform:rotate(-3deg);z-index:3}.ikari-channel-card:nth-child(2){transform:rotate(2deg)}.ikari-channel-card:nth-child(3){transform:rotate(-1deg)}.wall-pin{position:absolute;top:-16px;left:50%;height:25px;width:25px;border-radius:50%;background:#e62e2d;box-shadow:3px 4px 0 #0009;border:2px solid #111315;z-index:4}@media(max-width:760px){.ikari-behind-heading h2{font-size:clamp(65px,17vw,100px)}.investigation-wires{display:none}.ikari-channel-card:nth-child(2),.ikari-channel-card:nth-child(3){margin-top:25px}.ikari-channel-grid{padding-inline:6px}.wire-stage{padding-top:25px}.ikari-behind{padding-bottom:85px}}

.ikari-behind{clip-path:none;padding-top:0;margin-top:0}
.ikari-behind-banner{position:relative;height:clamp(430px,70svh,820px);min-height:430px;clip-path:none;transform:none;opacity:1;isolation:isolate;border-block:3px solid #111315;overflow:hidden;background:#0e1013}
.behind-mural-frame{position:absolute;inset:0;overflow:hidden}
.behind-mural-frame img{display:block;width:100%;height:100%;object-fit:cover;object-position:40% center}
.clapboard-wires{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.clapboard-blade{display:none;position:absolute;inset:-8% -8%;z-index:2;align-items:center;justify-content:center;background:repeating-linear-gradient(115deg,#111315 0 42px,#f3efe6 42px 84px);transform-origin:center;pointer-events:none}
:global([data-clapboard='active']) .clapboard-blade{display:flex}
.blade-top{clip-path:polygon(0 0,100% 0,100% 43%,0 60%)}
.blade-bottom{clip-path:polygon(0 60%,100% 43%,100% 100%,0 100%)}
.clapboard-blade>span{position:absolute;padding:12px 18px;background:#111315;color:#b8ff01;border:1px solid #b8ff01;font:500 14px/1.5 var(--mono);max-width:80%;text-align:center}
.blade-top>span{top:27%;transform:rotate(-4deg)}.blade-bottom>span{bottom:25%;color:#f3efe6;transform:rotate(-4deg)}
@media(max-width:760px){.ikari-behind-banner{height:68svh;min-height:400px;max-height:640px}.behind-mural-frame img{object-position:32% center}.clapboard-blade>span{font-size:13px;padding:10px}.blade-top>span{max-width:65%;top:22%}.blade-bottom>span{bottom:26%}}
@media(prefers-reduced-motion:reduce){.clapboard-blade{display:none!important}.behind-mural-frame img{transform:none!important}}
</style>
