<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { PickColor, PickViewer } from '$lib/actions/pick-viewer';
  let color: PickColor = 'coral';
  let canvas: HTMLCanvasElement;
  let viewer: PickViewer | undefined;
  let active = false;
  let loading = false;
  let rendered = false;
  let canExplore = false;
  let posterMissing = false;
  let zoom = 1;
  let disposed = false;
  let generation = 0;
  let status = 'Escolha uma cor para a palheta.';
  $: poster = color === 'coral' ? '/ikari/pick-coral.webp' : '/ikari/pick-lime.webp';
  function selectColor(next: PickColor) { color = next; viewer?.setColor(next); status = `Palheta ${next === 'coral' ? 'coral' : 'lima'} selecionada.`; }
  function close() {
    generation++; viewer?.destroy(); viewer = undefined;
    active = false; loading = false; rendered = false;
    zoom = 1;
    status = 'Palheta em imagem. As cores continuam disponíveis.';
  }
  async function explore() {
    if (!canExplore || loading || active || disposed) return;
    const version = ++generation;
    loading = true; active = true; rendered = false;
    status = 'Preparando a palheta para explorar.';
    await tick();
    try {
      const { createPickViewer } = await import('$lib/actions/pick-viewer');
      if (disposed || version !== generation) return;
      const result = await createPickViewer(canvas, color, {
        isCancelled: () => disposed || version !== generation,
        onLost: () => { close(); status = 'A palheta voltou ao modo imagem. Você ainda pode escolher as cores.'; },
        onRendered: () => { if (!disposed && version === generation) rendered = true; }
      });
      if (disposed || version !== generation) { result.destroy(); return; }
      viewer = result; loading = false;
      status = 'Palheta pronta. Arraste na horizontal ou use os controles de ângulo.';
      canvas.focus({ preventScroll: true });
    } catch {
      if (version !== generation || disposed) return;
      close(); status = 'A palheta está disponível em imagem neste dispositivo. Experimente as cores.';
    }
  }
  function rotate(horizontal: number, vertical = 0) { viewer?.rotate(horizontal, vertical); }
  function updateZoom() { viewer?.setZoom(zoom); }
  function reset() { zoom = 1; viewer?.reset(); status = 'Ângulo e aproximação redefinidos.'; }
  onMount(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    function reconcile() { canExplore = !reduced.matches && !connection?.saveData; if (!canExplore && active) close(); }
    reconcile();
    reduced.addEventListener('change', reconcile);
    connection?.addEventListener('change', reconcile);
    return () => { disposed = true; close(); reduced.removeEventListener('change', reconcile); connection?.removeEventListener('change', reconcile); };
  });
</script>

<section class="ikari-pick" data-pick-viewer data-pick-state={active ? loading ? 'loading' : 'active' : 'poster'} aria-labelledby="pick-heading">
  <div class="pick-copy"><span class="pick-chapter">OBJETO / IDENTIDADE</span><h2 id="pick-heading">O detalhe<br/>também tem <em>ritmo.</em></h2><p>Uma palheta, duas cores e outro ponto de vista. Um pequeno objeto do universo visual de Ikari, feito para você explorar.</p><p class="pick-identity">A música também aparece nos detalhes.</p></div>
  <div class="pick-experience"><div class="pick-stage" class:lime={color === 'lime'}>
    <div class="pick-fallback" class:covered={rendered && active} aria-hidden="true"><div class="fallback-object"><strong>IKARI</strong><span>★</span></div></div>
    <img class:missing={posterMissing} class:covered={rendered && active} src={poster} alt={`Palheta ${color === 'coral' ? 'coral' : 'verde lima'} com assinatura Ikari e estrela em tinta preta`} width="600" height="600" loading="lazy" onload={()=>posterMissing=false} onerror={()=>posterMissing=true}/>
    {#if active}<canvas bind:this={canvas} class:ready={rendered} tabindex="0" aria-label="Palheta interativa. Setas giram o objeto. Mais e menos ajustam a aproximação. Home redefine o ângulo."></canvas>{/if}
    <span class="pick-stage-label" aria-hidden="true">IKARI / {color === 'coral' ? 'CORAL' : 'LIMA'}</span>
  </div>
  <div class="pick-controls"><div class="color-controls" role="group" aria-label="Cor da palheta"><button class:selected={color === 'coral'} aria-pressed={color === 'coral'} onclick={()=>selectColor('coral')}><span class="swatch coral" aria-hidden="true"></span>Coral</button><button class:selected={color === 'lime'} aria-pressed={color === 'lime'} onclick={()=>selectColor('lime')}><span class="swatch lime" aria-hidden="true"></span>Lima</button></div>
    {#if !active}<button class="explore-button" onclick={explore} disabled={!canExplore}>Explorar em 3D <span aria-hidden="true">↗</span></button>{:else}<button class="close-button" onclick={close}>Fechar 3D <span aria-hidden="true">×</span></button>{/if}
  </div>
  {#if active && !loading}<div class="angle-controls"><div role="group" aria-label="Ângulo da palheta"><button onclick={()=>rotate(-15)}>Girar para esquerda</button><button onclick={()=>rotate(15)}>Girar para direita</button><button onclick={()=>rotate(0,-15)}>Inclinar para cima</button><button onclick={()=>rotate(0,15)}>Inclinar para baixo</button></div><div class="zoom-control"><label for="pick-zoom">Aproximação</label><input id="pick-zoom" type="range" min="0.85" max="1.25" step="0.05" bind:value={zoom} oninput={updateZoom}/><button onclick={reset}>Redefinir ângulo</button></div></div>{/if}
  <p class="pick-status" role="status" aria-live="polite">{status}</p>
  </div>
</section>

<style>
.ikari-pick{background:#f4eeda;color:#111719;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:clamp(30px,6vw,90px);padding:clamp(30px,4.6vw,72px);margin-block:30px 50px;border:1px solid #111719;align-items:center}.pick-chapter{font-size:14px;font-weight:650;letter-spacing:.06em;display:block;margin-bottom:24px}.pick-copy h2{font:750 clamp(42px,5vw,76px)/.99 var(--display);letter-spacing:-.055em}.pick-copy h2 em{font-style:normal;color:#b54430}.pick-copy>p{font-size:16px;line-height:1.7;max-width:400px;margin-top:28px}.pick-copy .pick-identity{font-size:14px;border-top:1px solid #9c9d86;padding-top:20px;margin-top:32px}.pick-experience{min-width:0}.pick-stage{position:relative;aspect-ratio:1;background:#e2e8db;overflow:hidden;isolation:isolate;border:1px solid #111719;max-width:600px;margin-inline:auto}.pick-stage img,.pick-stage canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}.pick-stage img.missing,.pick-stage img.covered,.pick-fallback.covered{visibility:hidden}.pick-stage canvas{opacity:0;touch-action:pan-y;z-index:2}.pick-stage canvas.ready{opacity:1}.pick-stage-label{position:absolute;left:18px;bottom:16px;font-size:14px;font-weight:650;z-index:3;pointer-events:none}.pick-fallback{height:100%;display:grid;place-items:center;position:absolute;inset:0;pointer-events:none}.fallback-object{height:65%;width:61%;clip-path:polygon(5% 9%,19% 0,81% 0,95% 9%,100% 22%,93% 43%,80% 68%,50% 100%,20% 68%,7% 43%,0 22%);background:#fa7155;display:flex;flex-direction:column;align-items:center;padding-top:20%;transform:rotate(-7deg);filter:drop-shadow(6px 6px 0 #111719)}.lime .fallback-object{background:#c8ff00}.fallback-object strong{font:900 clamp(28px,4vw,62px)/1 Arial,sans-serif;letter-spacing:-.045em}.fallback-object>span{font:700 50px/1 Arial,sans-serif;margin-top:14px}.pick-controls{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-top:16px}.color-controls{display:flex;gap:8px}.color-controls button,.explore-button,.close-button,.angle-controls button{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:44px;padding:10px 14px;font-size:14px;font-weight:650;background:transparent;color:#111719;border:1px solid #111719}.color-controls button.selected{background:#111719;color:#f4eeda}.swatch{width:15px;height:15px;border:1px solid #111719;display:block}.swatch.coral{background:#fa7155}.swatch.lime{background:#c8ff00}.explore-button{background:#111719;color:#f4eeda}.explore-button:disabled{opacity:.5;cursor:default}.explore-button>span,.close-button>span{font-size:24px;line-height:1}.angle-controls{margin-top:14px;border-top:1px solid #9c9d86;padding-top:14px}.angle-controls>div:first-child{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.zoom-control{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:14px}.zoom-control label{font-size:14px;font-weight:600}.zoom-control input{accent-color:#111719;min-height:44px;width:100%;flex:1;min-width:100px}.zoom-control button{width:100%;margin-top:2px}.pick-status{font-size:14px;line-height:1.55;margin-top:15px;min-height:44px;max-width:550px}.ikari-pick :focus-visible{outline:3px solid #111719;outline-offset:5px}.pick-stage canvas:focus-visible{outline-offset:-6px}
@media(max-width:1023px){.ikari-pick{grid-template-columns:minmax(0,1fr) minmax(0,1fr);padding:30px;gap:25px}.pick-copy h2{font-size:clamp(40px,5.5vw,60px)}.pick-copy>p{margin-top:22px}.pick-controls{gap:12px}.explore-button,.close-button{width:100%}.color-controls{width:100%}.color-controls>button{flex:1}.angle-controls button{padding-inline:8px}.pick-stage-label{left:12px;bottom:12px}}
@media(max-width:640px){.ikari-pick{grid-template-columns:minmax(0,1fr);padding:28px 18px;margin-block:24px 35px;gap:25px}.pick-chapter{margin-bottom:20px}.pick-copy h2{font-size:clamp(43px,11vw,62px)}.pick-copy>p{max-width:460px}.pick-copy .pick-identity{margin-top:24px;padding-top:16px}.pick-stage{max-width:430px}.fallback-object strong{font-size:clamp(36px,12vw,57px)}.pick-controls{gap:12px}.explore-button,.close-button{width:auto;flex:1}.color-controls{width:auto}.angle-controls>div:first-child{gap:8px}.angle-controls button{font-size:14px}.pick-status{font-size:14px}}
</style>

