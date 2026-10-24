<script lang="ts">
import { onMount } from 'svelte';
import Icon from './Icon.svelte';
let host:HTMLDivElement;let canvas:HTMLCanvasElement;let enhanced=false;let light=true;let exploded=false;let intro=false;
let scene:ReturnType<typeof import('./frame-scene').createFrameScene>|undefined;
let activate:()=>Promise<void>=async()=>{};
let skipOpening=()=>{intro=false;};
function reduce(){scene?.dispose();scene=undefined;enhanced=false;light=true;localStorage.setItem('frame-light','true');}
function toggle(){exploded=!exploded;scene?.toggle(exploded);}
onMount(()=>{
let gone=false,loading=false,timer:ReturnType<typeof setTimeout>|undefined;let motionCleanup=()=>{};const motion=matchMedia('(prefers-reduced-motion: reduce)');const saved=localStorage.getItem('frame-light')==='true';light=motion.matches||saved;
activate=async()=>{if(gone||motion.matches||loading||scene)return;loading=true;try{const module=await import('./frame-scene');if(gone)return;scene=module.createFrameScene(canvas,reduce);enhanced=true;light=false;localStorage.setItem('frame-light','false');}catch{enhanced=false;light=true;}finally{loading=false;}};
const observation=new IntersectionObserver((entries)=>{scene?.setVisible(entries[0].isIntersecting);if(entries[0].isIntersecting&&!scene&&!light)void activate();},{rootMargin:'100px'});observation.observe(host);
if(!light){timer=setTimeout(()=>{if(!gone)void activate();},600);}
if(!motion.matches){intro=true;void import('gsap').then(({gsap})=>{if(gone||!intro)return;const tween=gsap.fromTo(host.querySelector('.fallback-planes'),{rotate:-15,scale:.8},{rotate:0,scale:1,duration:1.2,ease:'power3.out',onComplete:()=>intro=false});motionCleanup=()=>tween.kill();skipOpening=()=>{tween.progress(1);tween.kill();intro=false;};});}
const change=()=>{if(motion.matches)reduce();};motion.addEventListener('change',change);
return()=>{gone=true;clearTimeout(timer);observation.disconnect();scene?.dispose();motion.removeEventListener('change',change);motionCleanup();};
});
</script>
<div bind:this={host} class="object-stage" role="group" aria-label="Objeto interativo de planos de imagem" class:exploded onpointermove={(event)=>{if(event.pointerType==='mouse'){const r=host.getBoundingClientRect();scene?.move((event.clientX-r.left)/r.width-.5,(event.clientY-r.top)/r.height-.5);}}}>
<div class="ground-shadow" aria-hidden="true"></div>
<div class="fallback-planes" class:hidden={enhanced} aria-hidden="true"><div class="plane-stack">{#each Array(7) as _,i}<div class="plane" class:orange={i===3} style={`--i:${i}`}></div>{/each}</div><div class="orb"></div></div>
<canvas bind:this={canvas} aria-hidden="true" class:visible={enhanced}></canvas>
<span class="object-caption" aria-hidden="true">Ideias em camadas.</span>
<div class="object-controls"><button onclick={toggle} aria-pressed={exploded} title="Mudar a composição do objeto"><Icon name="layers" size={14}/>{exploded?'Reunir planos':'Separar planos'}</button><button onclick={()=>enhanced?reduce():activate()} aria-pressed={light} disabled={!enhanced&&typeof window!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches}>{enhanced?'Modo leve':'Explorar em 3D'}</button></div>
{#if intro}<button class="skip-intro" onclick={()=>skipOpening()}>Pular abertura</button>{/if}
</div>
<style>
.object-stage{width:100%;height:500px;position:relative;isolation:isolate;touch-action:pan-y}.object-stage canvas{position:absolute;width:100%;height:100%;inset:0;opacity:0;pointer-events:none;transition:opacity .3s}.object-stage canvas.visible{opacity:1}.fallback-planes{position:absolute;inset:0;transition:opacity .2s;pointer-events:none}.fallback-planes.hidden{opacity:0}.plane-stack{width:240px;height:285px;position:absolute;left:50%;top:45%;transform:translate(-50%,-50%) rotate(-24deg);perspective:700px;transform-style:preserve-3d}.plane{width:220px;height:260px;border:23px solid #bfb0e9;border-radius:20px;position:absolute;left:calc(var(--i)*10px - 35px);top:calc(var(--i)*8px - 24px);transform:rotateY(-25deg) rotateX(13deg) translateZ(calc(var(--i)*12px));box-shadow:inset 3px 2px 3px #e1d7ff,4px 6px 4px #8d80b1;transition:left .7s cubic-bezier(.2,.7,.2,1),top .7s cubic-bezier(.2,.7,.2,1)}.plane.orange{border-color:#ed542d;box-shadow:inset 3px 2px 3px #ffae8d,4px 6px 4px #ad3e25}.exploded .plane{left:calc(var(--i)*25px - 80px);top:calc(var(--i)*12px - 35px)}.orb{position:absolute;left:70%;top:70%;width:69px;height:69px;border-radius:50%;background:radial-gradient(circle at 28% 22%,#ffaa7e,#ee542b 40%,#ad371d);box-shadow:10px 17px 25px #37312620}.ground-shadow{position:absolute;left:28%;top:75%;width:52%;height:12%;background:radial-gradient(ellipse,#54504535,transparent 70%);transform:rotate(-12deg);z-index:-1}.object-caption{position:absolute;right:25px;top:25px;font-size:10px;color:var(--muted);writing-mode:vertical-rl;letter-spacing:.1em}.object-controls{position:absolute;bottom:0;right:18px;display:flex;gap:14px;font-size:9px;z-index:2}.object-controls button{background:none;border:0;border-bottom:1px solid #b7b7ae;padding:8px 0;color:var(--muted);font-size:9px;display:inline-flex;align-items:center;gap:6px;min-height:35px}.skip-intro{position:absolute;bottom:42px;right:18px;background:none;border:0;font-size:9px;color:var(--muted);z-index:3}.object-controls button:hover{color:var(--ink)}@media(max-width:1100px){.object-stage{height:420px}}@media(max-width:760px){.object-stage{height:330px}.plane-stack{transform:translate(-50%,-50%) rotate(-24deg) scale(.76)}.orb{width:51px;height:51px}.object-caption{right:23px;top:55px}.object-controls{right:30px;bottom:0;gap:16px}.object-controls button{font-size:9px}.ground-shadow{top:77%}}@media(prefers-reduced-motion:reduce){.plane,.fallback-planes{transition:none}}
</style>
