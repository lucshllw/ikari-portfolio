<script lang="ts">
import {onMount} from 'svelte';
import {afterNavigate} from '$app/navigation';
let host:HTMLDivElement,cursor:HTMLDivElement,ring:HTMLDivElement,thread:SVGPolylineElement;
let visible=false,watch=false;
afterNavigate(()=>{visible=false;watch=false;if(typeof document!=='undefined')document.documentElement.classList.remove('sakuga-pointer');});
onMount(()=>{
 let disposed=false;let cleanup=()=>{};
 void import('gsap').then(({gsap})=>{if(disposed)return;const mm=gsap.matchMedia();mm.add('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)',()=>{
  if((navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData)return;
  const x=gsap.quickTo(ring,'x',{duration:.28,ease:'power3.out'}),y=gsap.quickTo(ring,'y',{duration:.28,ease:'power3.out'});let points:{x:number;y:number}[]=[];let timer:ReturnType<typeof setTimeout>;
  function hide(){visible=false;document.documentElement.classList.remove('sakuga-pointer');points=[];thread?.setAttribute('points','');clearTimeout(timer);}
  function move(e:PointerEvent){const target=e.target as Element;const editable=target.closest('input,textarea,select,[contenteditable],iframe');if(document.hidden||document.documentElement.dataset.ikariTransition||editable||e.pointerType!=='mouse'){hide();return;}if(host.showPopover&&!host.matches(':popover-open')){try{host.showPopover();}catch{}}visible=true;watch=!!target.closest('.commission-player button.start,.commission-player .play,.scene-play');document.documentElement.classList.add('sakuga-pointer');cursor.style.transform=`translate(${e.clientX}px,${e.clientY}px)`;x(e.clientX);y(e.clientY);points.push({x:e.clientX,y:e.clientY});if(points.length>6)points.shift();thread.setAttribute('points',points.map(p=>`${p.x},${p.y}`).join(' '));clearTimeout(timer);timer=setTimeout(()=>{points=[];thread.setAttribute('points','');},100);}
  window.addEventListener('ikari:scene-cover',hide);window.addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',hide);window.addEventListener('blur',hide);document.addEventListener('visibilitychange',hide);
  return()=>{hide();window.removeEventListener('ikari:scene-cover',hide);x.tween.kill();y.tween.kill();window.removeEventListener('pointermove',move);document.removeEventListener('pointerleave',hide);window.removeEventListener('blur',hide);document.removeEventListener('visibilitychange',hide);};
 });cleanup=()=>mm.revert();}).catch(()=>{});
 return()=>{disposed=true;cleanup();};
});
</script>
<div bind:this={host} popover="manual" class="sakuga-cursor" class:visible aria-hidden="true"><svg class="cursor-thread"><polyline bind:this={thread} fill="none" stroke="#e62e2d" stroke-width="2" stroke-linecap="round"/></svg><div bind:this={cursor} class="cursor-dot"></div><div bind:this={ring} class="cursor-ring" class:watch><span></span>{#if watch}<b>ASSISTIR CENA ▶</b>{/if}</div></div>
<style>
.sakuga-cursor{display:none;position:fixed;inset:0;pointer-events:none;z-index:2147483647;width:100vw;height:100vh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;color:inherit;overflow:hidden}.sakuga-cursor.visible{display:block}.cursor-dot{position:absolute;top:0;left:0;width:6px;height:6px;margin:-3px;background:#b8ff01;border:1px solid #111315;border-radius:50%}.cursor-ring{position:absolute;top:0;left:0;width:32px;height:32px;margin:-16px;border:1px solid #ff6b4a;border-radius:50%;transition:width .18s,height .18s,margin .18s,background .18s}.cursor-ring:before,.cursor-ring:after{content:'';position:absolute;background:#ff6b4a}.cursor-ring:before{height:1px;width:8px;left:-4px;top:50%}.cursor-ring:after{height:8px;width:1px;top:-4px;left:50%}.cursor-ring.watch{width:94px;height:94px;margin:-47px;background:#111315e8;border-color:#b8ff01}.cursor-ring b{position:absolute;inset:0;display:grid;place-content:center;text-align:center;color:#b8ff01;font:10px/1.5 var(--mono);padding:13px}.cursor-thread{position:absolute;inset:0;width:100%;height:100%;opacity:.75}@media(pointer:coarse),(prefers-reduced-motion:reduce){.sakuga-cursor{display:none!important}}
</style>
