<script lang="ts">
import {onMount} from 'svelte';
let host:HTMLElement,active=false,frame=1;
let finish=()=>{};
onMount(()=>{
 const reduce=matchMedia('(prefers-reduced-motion:reduce)');
 const connection=(navigator as Navigator & {connection?:{saveData?:boolean}}).connection;
 let disposed=false,ctx:ReturnType<typeof import('gsap').gsap.context>|undefined;
 let timer=0;
 function stop(){active=false;ctx?.revert();ctx=undefined;clearTimeout(timer);}
 finish=stop;
 let seen=false;try{seen=sessionStorage.getItem('ikari-opening-v09')==='seen';sessionStorage.setItem('ikari-opening-v09','seen');}catch{}
 if(seen||reduce.matches||connection?.saveData)return;
 active=true;timer=window.setTimeout(stop,1800);
 void Promise.all([import('gsap'),import('gsap/DrawSVGPlugin')]).then(([{gsap},{DrawSVGPlugin}])=>{
  if(disposed||!active)return;gsap.registerPlugin(DrawSVGPlugin);
  ctx=gsap.context(()=>{
   const clock={value:1};const tl=gsap.timeline({onComplete:stop});
   tl.fromTo(host.querySelector('path'),{drawSVG:'0%'},{drawSVG:'100%',duration:.75},0)
    .to(clock,{value:24,duration:.9,ease:'none',onUpdate:()=>{frame=Math.round(clock.value);}},0)
    .to(host,{clipPath:'polygon(0 0,100% 0,100% 0,0 0)',duration:.4,ease:'power3.inOut'},1.05);
  },host);
 }).catch(stop);
 const changed=()=>{if(reduce.matches)stop();};reduce.addEventListener('change',changed);
 return()=>{disposed=true;stop();reduce.removeEventListener('change',changed);};
});
</script>
<div class="opening" class:active bind:this={host} aria-hidden={!active}>
 <svg class="opening-line" viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true"><path d="M40 80 L1120 40 L1160 620 L60 660 Z" fill="none" stroke="#e62e2d" stroke-width="5"/></svg>
 <div class="opening-art" aria-hidden="true"><img src={frame<9?'/ikari/avatar.webp':frame<17?'/ikari/hero-aya-small-v09.webp':'/ikari/banner-mural-v09.webp'} alt="" width="300" height="300"/></div>
 <p>IKARI / FRAME {String(frame).padStart(2,'0')}<span>ANIMAÇÃO 2D — 24 FPS</span></p>
 <button onclick={()=>finish()} tabindex={active?0:-1}>Pular abertura ↗</button>
</div>
<style>
.opening{display:none;position:fixed;inset:0;z-index:70;background:#111315;color:#f8f3e8;pointer-events:none;align-content:center;justify-items:center;gap:25px}.opening.active{display:grid}.opening-line{position:absolute;inset:8%;height:84%;width:84%}.opening-art{width:clamp(150px,30vw,300px);aspect-ratio:1;position:relative;transform:rotate(-4deg);border:8px solid #f8f3e8;box-shadow:9px 9px 0 #e62e2d;overflow:hidden}.opening-art img{width:100%;height:100%;object-fit:cover}.opening p{position:relative;font:500 clamp(20px,4vw,45px) var(--mono);text-align:center}.opening p span{display:block;font-size:13px;color:#c8ff00;margin-top:12px}.opening button{position:absolute;bottom:35px;right:35px;pointer-events:auto;min-height:44px;padding:12px 18px;border:1px solid #c8ff00;color:#c8ff00;background:#111315;font-size:14px}.opening button:focus-visible{outline:3px solid #fa7155;outline-offset:4px}@media(prefers-reduced-motion:reduce){.opening.active{display:none}}
</style>
