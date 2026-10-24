<script lang="ts">
import {onMount} from 'svelte';
import Icon from './Icon.svelte';
let burst:HTMLSpanElement,spirit:HTMLDivElement,opened=false,spark=0;
onMount(()=>{
 let animation:Animation|undefined;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 function click(event:MouseEvent){const target=(event.target as Element)?.closest('button,.scene-play,.hero-selected,.v04-button');if(!target||reduced.matches)return;const box=target.getBoundingClientRect();const x=event.detail?event.clientX:box.left+box.width/2,y=event.detail?event.clientY:box.top+box.height/2;burst.style.left=x+'px';burst.style.top=y+'px';animation?.cancel();animation=burst.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.5) rotate(-8deg)'},{opacity:.8,offset:.25,transform:'translate(-50%,-50%) scale(1) rotate(0deg)'},{opacity:0,transform:'translate(-50%,-50%) scale(1.4) rotate(7deg)'}],{duration:180,easing:'ease-out'});}
 const visibility=()=>spirit.style.animationPlayState=document.hidden||reduced.matches?'paused':'running';
 document.addEventListener('click',click);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',visibility);visibility();
 return()=>{animation?.cancel();document.removeEventListener('click',click);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',visibility);};
});
</script>
<span bind:this={burst} class="impact-frame" aria-hidden="true"></span>
<div class="spirit-guide" bind:this={spirit}>
 {#if opened}<div class="spirit-note"><span>Uma ideia pedindo ação?</span><a href="/contato">Vamos criar uma cena <Icon name="diagonal" size={15}/></a></div>{/if}
 <button class="spirit-button" type="button" aria-label="Espírito da Ikari: abrir convite para criar uma cena" aria-expanded={opened} onclick={()=>{opened=!opened;spark++;}}><span class="spirit-art" aria-hidden="true"></span>{#key spark}{#if spark}<span class="spirit-sparks" aria-hidden="true">✦</span>{/if}{/key}</button>
</div>
<style>
.impact-frame{position:fixed;width:80px;height:65px;z-index:2147483646;opacity:0;pointer-events:none;border:3px solid #b8ff01;clip-path:polygon(0 0,42% 16%,53% 0,66% 20%,100% 6%,82% 49%,100% 90%,62% 78%,47% 100%,34% 79%,0 100%,16% 50%);background:repeating-conic-gradient(#ff6b4a 0 4deg,transparent 4deg 33deg)}
.spirit-guide{position:fixed;right:18px;bottom:68px;z-index:36;animation:spirit-float 4s ease-in-out infinite;display:flex;align-items:center;gap:12px;pointer-events:none}.spirit-button{position:relative;width:66px;height:85px;border:0;background:transparent;padding:0;pointer-events:auto}.spirit-art{display:block;width:66px;height:85px;background:url('/ikari/banner-mural-small-v09.webp') -98px -80px/512px 288px;clip-path:polygon(60% 2%,78% 3%,65% 12%,59% 22%,65% 32%,64% 39%,76% 54%,77% 71%,69% 84%,51% 93%,27% 94%,10% 86%,5% 74%,11% 62%,9% 52%,15% 38%,28% 32%,38% 30%,45% 16%)}.spirit-button:focus-visible{outline:3px solid #00f0ff;outline-offset:4px}.spirit-note{max-width:210px;background:#111820;border:1px solid #00f0ff;color:#f3efe6;padding:14px;font:12px/1.6 var(--mono);pointer-events:auto}.spirit-note span{display:block}.spirit-note a{display:flex;align-items:center;gap:8px;min-height:44px;color:#b8ff01}.spirit-sparks{position:absolute;inset:0;color:#00f0ff;font-size:30px;pointer-events:none;animation:spark .5s ease-out both}@keyframes spirit-float{50%{transform:translate3d(0,-6px,0) rotate(2deg)}}@keyframes spark{from{opacity:1;transform:translate3d(0,0,0) scale(.7)}to{opacity:0;transform:translate3d(-28px,-30px,0) scale(1.4)}}@media(max-width:640px){.spirit-guide{right:10px;bottom:116px}.spirit-button{width:53px;transform:scale(.8);transform-origin:right center}.spirit-note{max-width:190px}}@media(prefers-reduced-motion:reduce){.spirit-guide,.spirit-sparks{animation:none}.spirit-sparks{display:none}}
</style>
