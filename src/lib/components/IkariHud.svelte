<script lang="ts">
import {onMount} from 'svelte';

let host:HTMLElement;
let frames='0000',coords='X 0000 / Y 0000';
onMount(()=>{
 let raf=0,disposed=false;
 function render(){raf=0;if(disposed||document.hidden)return;const max=Math.max(1,document.documentElement.scrollHeight-innerHeight);frames=String(Math.round(scrollY/max*2400)).padStart(4,'0');host.style.setProperty('--grain-shift',`${Math.round(scrollY%9)-4}px`);}
 function schedule(){if(!raf)raf=requestAnimationFrame(render);}
 function pointer(e:PointerEvent){if(e.pointerType==='mouse')coords=`X ${String(Math.round(e.clientX)).padStart(4,'0')} / Y ${String(Math.round(e.clientY)).padStart(4,'0')}`;}
 window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);window.addEventListener('pointermove',pointer,{passive:true});render();
 return()=>{disposed=true;cancelAnimationFrame(raf);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);window.removeEventListener('pointermove',pointer);};
});
</script>
<div class="ikari-hud" bind:this={host}><span class="hud-corner tl" aria-hidden="true"><span class="record-light" aria-hidden="true"></span> REC / 24 FPS</span><span class="hud-corner tr" aria-hidden="true">FRAME: {frames}</span><span class="hud-corner bl" aria-hidden="true">{coords}</span><span class="hud-corner br" aria-hidden="true">IKARI / ANIMAÇÃO 2D</span><div class="film-grain" aria-hidden="true"></div></div>

<style>
.ikari-hud{position:fixed;inset:12px;z-index:35;pointer-events:none;color:#c8ff00}.hud-corner{position:absolute;font:500 13px/1.55 var(--mono);padding:9px;letter-spacing:.03em;background:#111315e8}.tl{top:0;left:0;border-top:2px solid;border-left:2px solid}.tr{top:0;right:0;border-top:2px solid;border-right:2px solid}.bl{bottom:0;left:0;border-bottom:2px solid;border-left:2px solid}.br{bottom:0;right:0;border-bottom:2px solid;border-right:2px solid}.film-grain{position:absolute;inset:-12px;opacity:.035;background-image:url('/ikari/grain.png');transform:translate(var(--grain-shift,0px));box-shadow:inset 0 0 10vw #11131522;z-index:-1}@media(max-width:900px){.bl,.br{display:none}.ikari-hud{inset:5px}.hud-corner{font-size:13px;padding:4px}.tl{display:none}.tr{top:auto;bottom:2px;background:#111315;color:#f8f3e8}.film-grain{opacity:.025}}@media(prefers-reduced-motion:reduce){.film-grain{transform:none}}
@media(max-width:900px){.ikari-hud .tr{display:none}}
.ikari-hud .tl{pointer-events:none;min-height:44px;display:flex;align-items:center;gap:6px;text-decoration:none}.record-light{width:7px;height:7px;border-radius:50%;background:#ff6b4a}@media(max-width:900px){.ikari-hud .tl{top:auto;bottom:10px;left:8px;min-height:44px;padding:9px 12px;border:1px solid #b8ff0155;border-radius:3px;font-size:12px}}
</style>
