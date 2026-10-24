<script lang="ts">
  import {onMount} from 'svelte';
  export let accent='#344ccd';
  let host:HTMLDivElement;
  let cut:HTMLDivElement;
  let photo:HTMLImageElement;
  let opening=false;
  let finish=()=>{};

  onMount(()=>{
    let disposed=false,visible=true;
    let tween:ReturnType<typeof import('gsap').gsap.timeline>|undefined;
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    const connection=(navigator as Navigator&{connection?:EventTarget&{saveData?:boolean}}).connection;
    const eligible=()=>!preference.matches&&!connection?.saveData&&!document.hidden;
    const clear=()=>{opening=false;for(const node of [cut,photo]){node.style.removeProperty('transform');node.style.removeProperty('will-change');}};
    finish=()=>{tween?.progress(1);tween?.kill();tween=undefined;clear();};
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(!visible)finish();},{threshold:0});observer.observe(host);
    const visibility=()=>{if(document.hidden)finish();};document.addEventListener('visibilitychange',visibility);
    const change=()=>{if(!eligible())finish();};preference.addEventListener('change',change);
    connection?.addEventListener('change',change);
    const resize=()=>finish();window.addEventListener('resize',resize,{passive:true});
    if(eligible()){
      opening=true;
      void import('gsap').then(({gsap})=>{
        if(disposed||!opening||!eligible()||!visible){finish();return;}
        const final=getComputedStyle(cut);
        const width=parseFloat(final.width),left=parseFloat(final.left);
        if(!width){finish();return;}
        cut.style.willChange='transform';photo.style.willChange='transform';
        tween=gsap.timeline({onComplete:()=>{tween=undefined;clear();}});
        tween.fromTo(cut,{scaleX:host.clientWidth/width,xPercent:-100*left/width},{scaleX:1,xPercent:0,duration:1.05,ease:'power3.inOut'},0)
          .fromTo(photo,{scale:1.045},{scale:1,duration:1.15,ease:'power3.out'},0);
      }).catch(()=>finish());
    }
    return()=>{disposed=true;finish();observer.disconnect();document.removeEventListener('visibilitychange',visibility);preference.removeEventListener('change',change);connection?.removeEventListener('change',change);window.removeEventListener('resize',resize);};
  });
</script>

<div bind:this={host} class="hero-stage" role="group" aria-label="Sala de montagem" style={`--cut-accent:${accent}`} data-opening={opening}>
  <picture>
    <img bind:this={photo} src="/demo/studio.webp" srcset="/demo/studio-small.webp 640w, /demo/studio-medium.webp 1024w, /demo/studio.webp 1536w" sizes="90vw" alt="Estação de edição com monitor de referência, mãos e maquete de cenário. Imagem demonstrativa gerada." width="1536" height="864" fetchpriority="high" />
  </picture>
  <div bind:this={cut} class="cut-plane" aria-hidden="true"></div>
  <span class="stage-label" aria-hidden="true">Ideias<br/>em movimento</span>
  <span class="stage-footnote">Imagem demonstrativa</span>
  {#if opening}<button class="skip-opening" onclick={()=>finish()}>Pular abertura</button>{/if}
</div>

<style>
.hero-stage{position:relative;isolation:isolate;aspect-ratio:2.4;overflow:hidden;background:#202323;touch-action:pan-y}
picture{display:block;height:100%;width:100%}img{width:100%;height:100%;object-fit:cover;object-position:center 57%;display:block}
.cut-plane{position:absolute;left:27%;top:16%;width:14%;height:70%;background:var(--cut-accent);opacity:.78;transform-origin:left center;pointer-events:none}
.stage-label{position:absolute;top:28px;left:28px;color:#fff;font:12px/1.7 ui-monospace,monospace;letter-spacing:.12em;text-shadow:0 1px 6px #000}
.stage-footnote{position:absolute;bottom:18px;right:22px;color:#fff;font-size:12px;text-shadow:0 1px 6px #000;background:#202323a6;padding:5px 8px}
.skip-opening{position:absolute;right:22px;top:20px;z-index:2;min-height:44px;padding:10px 15px;background:#f1efe7;color:#202323;border:1px solid #f1efe7;font-size:12px}
.skip-opening:focus-visible{outline:3px solid #fff;outline-offset:4px}
@media(max-width:700px){.hero-stage{aspect-ratio:4/3}img{object-position:58% center}.stage-label{top:18px;left:18px;font-size:12px}.cut-plane{left:17%;width:20%;height:64%;top:18%}.stage-footnote{bottom:12px;right:12px;font-size:12px}.skip-opening{right:12px;top:12px;font-size:12px;padding:8px 10px}}
@media(prefers-reduced-motion:reduce){.cut-plane{transform:none}.skip-opening{display:none}}
</style>
