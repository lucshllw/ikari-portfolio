<script lang="ts">
  import { onMount } from 'svelte';
  import {coverSources} from '$lib/images';
  import { contrastText } from '../colors';

  let { accent = '#344CCD', title = 'O corte muda a leitura.', photo='/demo/studio.webp', photoAlt='Estação de edição com monitor de referência e maquete de cenário. Imagem demonstrativa gerada.', disclosure='Imagem demonstrativa gerada.' }: { accent?: string; title?: string; photo?:string; photoAlt?:string; disclosure?:string } = $props();
  let photoSources=$derived(coverSources(photo));
  const uid = $props.id();
  let host: HTMLDivElement;
  let stage: HTMLDivElement;
  let foreground: HTMLImageElement;
  let animateChoice = (_ratio: '16:9' | '4:3' | '1:1') => {};

  onMount(() => {
    let disposed = false;
    let loading = false;
    let failed = false;
    let inView = false;
    let initialized = false;
    let lastClip = getComputedStyle(foreground).clipPath;
    let engine: typeof import('gsap').gsap | undefined;
    let context: ReturnType<typeof import('gsap').gsap.context> | undefined;
    let selection: ReturnType<typeof import('gsap').gsap.timeline> | undefined;
    let selectionGuide: SVGGElement | undefined;
    let drawing: ReturnType<typeof import('gsap').gsap.fromTo> | undefined;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const eligible = () => !preference.matches && !connection?.saveData;

    const finishSelection = () => {
      selection?.progress(1);
      selection?.kill();
      selection = undefined;
      selectionGuide?.style.removeProperty('opacity');
      selectionGuide = undefined;
      foreground.style.removeProperty('clip-path');
      lastClip = getComputedStyle(foreground).clipPath;
    };
    const stop = () => {
      finishSelection();
      drawing?.kill();
      drawing = undefined;
      context?.revert();
      context = undefined;
      initialized = false;
    };
    const initialize = () => {
      if (disposed || loading || failed || initialized || !inView || document.hidden || !eligible()) return;
      loading = true;
      void import('gsap').then(({ gsap }) => {
        loading = false;
        if (disposed || !inView || document.hidden || !eligible()) return;
        engine = gsap;
        context = gsap.context(() => {}, host);
        initialized = true;
        context.add(() => {
          drawing = gsap.fromTo(host.querySelectorAll('.study-guide-path'), { strokeDashoffset: 1 }, {
            strokeDashoffset: 0,
            duration: 0.7,
            ease: 'power2.out'
          });
        });
      }).catch(() => { loading = false; failed = true; stop(); });
    };
    animateChoice = (ratio) => {
      if (!eligible() || !engine || !context || document.hidden || !inView) { finishSelection(); return; }
      const previous = foreground.style.clipPath ? getComputedStyle(foreground).clipPath : lastClip;
      selection?.kill();
      selectionGuide?.style.removeProperty('opacity');
      foreground.style.removeProperty('clip-path');
      const next = getComputedStyle(foreground).clipPath;
      lastClip = next;
      const guide = host.querySelector<SVGGElement>(`[data-guide="${ratio}"]`);
      selectionGuide = guide ?? undefined;
      // Selection has independent ownership; completed timelines never accumulate in the draw context.
      selection = engine.timeline({ onComplete: () => {
        foreground.style.removeProperty('clip-path');
        guide?.style.removeProperty('opacity');
        selectionGuide = undefined;
        selection = undefined;
      } });
      selection.fromTo(foreground, { clipPath: previous }, { clipPath: next, duration: 0.28, ease: 'power2.out' });
      if (guide) selection.fromTo(guide, { opacity: 0.45 }, { opacity: 1, duration: 0.28, ease: 'power2.out' }, 0);
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) initialize();
      else {
        finishSelection();
        if (drawing) drawing.progress(1);
      }
    }, { threshold: 0, rootMargin: '0px 0px -15% 0px' });
    observer.observe(stage);
    const visibility = () => {
      if (document.hidden) { finishSelection(); drawing?.progress(1); }
      else initialize();
    };
    const change = () => { if (!eligible()) stop(); else initialize(); };
    document.addEventListener('visibilitychange', visibility);
    preference.addEventListener('change', change);
    connection?.addEventListener('change', change);
    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      preference.removeEventListener('change', change);
      connection?.removeEventListener('change', change);
      animateChoice = () => {};
    };
  });
</script>

<div bind:this={host} class="frame-study" data-frame-study style={`--study-accent:${accent};--study-on-accent:${contrastText(accent)}`}>
  <div class="study-copy">
    <span class="study-eyebrow">Estudo de enquadramento</span>
    <h3>{title}</h3>
    <p>A mesma imagem pode destacar o ambiente, aproximar o gesto ou concentrar a atenção. Escolha um enquadramento para comparar.</p>
  </div>
  <fieldset class="study-workbench">
    <legend class="study-sr-only">Escolha um enquadramento</legend>
    <input class="study-radio" data-frame-format="16:9" type="radio" name={`${uid}-ratio`} id={`${uid}-wide`} value="16:9" checked onchange={() => animateChoice('16:9')}/>
    <input class="study-radio" data-frame-format="4:3" type="radio" name={`${uid}-ratio`} id={`${uid}-gesture`} value="4:3" onchange={() => animateChoice('4:3')}/>
    <input class="study-radio" data-frame-format="1:1" type="radio" name={`${uid}-ratio`} id={`${uid}-detail`} value="1:1" onchange={() => animateChoice('1:1')}/>
    <div class="study-options">
      <label class="choice-wide" for={`${uid}-wide`}>16:9 <span aria-hidden="true">·</span> Ambiente</label>
      <label class="choice-gesture" for={`${uid}-gesture`}>4:3 <span aria-hidden="true">·</span> Gesto</label>
      <label class="choice-detail" for={`${uid}-detail`}>1:1 <span aria-hidden="true">·</span> Detalhe</label>
    </div>
    <figure class="study-preview">
      <div bind:this={stage} class="study-stage" data-frame-stage>
        <img class="study-image study-image-base" src={photo} srcset={photoSources} sizes="(max-width:760px) 90vw, 55vw" alt={photoAlt} width="1536" height="864" loading="lazy" decoding="async"/>
        <div class="study-dim" aria-hidden="true"></div>
        <img bind:this={foreground} class="study-image study-image-crop" data-frame-crop src={photo} srcset={photoSources} sizes="(max-width:760px) 90vw, 55vw" alt="" width="1536" height="864" loading="lazy" decoding="async" aria-hidden="true"/>
        <svg class="study-guides" viewBox="0 0 1600 900" fill="none" aria-hidden="true" focusable="false">
          <g class="guide-wide" data-guide="16:9" data-frame-guide="16:9"><rect class="study-guide-path guide-outline" x="80" y="45" width="1440" height="810" pathLength="1"/><path class="study-guide-path" pathLength="1" d="M100 89V65H124 M1476 65H1500V89 M100 811V835H124 M1476 835H1500V811"/></g>
          <g class="guide-gesture" data-guide="4:3" data-frame-guide="4:3"><rect class="study-guide-path guide-outline" x="260" y="45" width="1080" height="810" pathLength="1"/><path class="study-guide-path" pathLength="1" d="M280 89V65H304 M1296 65H1320V89 M280 811V835H304 M1296 835H1320V811"/></g>
          <g class="guide-detail" data-guide="1:1" data-frame-guide="1:1"><rect class="study-guide-path guide-outline" x="395" y="45" width="810" height="810" pathLength="1"/><path class="study-guide-path" pathLength="1" d="M415 89V65H439 M1161 65H1185V89 M415 811V835H439 M1161 835H1185V811"/></g>
        </svg>
      </div>
      <figcaption><span>Estudo de enquadramento. A seleção altera apenas esta prévia.</span><span>{disclosure}</span></figcaption>
    </figure>
  </fieldset>
</div>

<style>
  .frame-study{display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);gap:clamp(28px,5vw,76px);align-items:center;color:var(--ink,#202323)}
  .study-copy{min-width:0}.study-eyebrow{font:12px/1.6 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.12em;color:var(--muted,#646661)}
  .study-copy h3{font-family:var(--display,'Bricolage Grotesque Variable',sans-serif);font-size:clamp(34px,4vw,62px);font-weight:650;letter-spacing:-.055em;line-height:1.04;margin:20px 0}
  .study-copy p{font-size:16px;line-height:1.75;max-width:420px;margin:0;color:var(--muted,#646661)}
  .study-workbench{position:relative;min-width:0;margin:0;padding:0;border:0}.study-sr-only,.study-radio{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
  .study-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px}.study-options label{display:flex;align-items:center;justify-content:center;gap:5px;border:1px solid var(--line,#bfc0b9);background:transparent;color:var(--ink,#202323);font-size:12px;line-height:1.4;min-height:46px;padding:10px 8px;cursor:pointer;touch-action:manipulation}
  .study-radio[value="16:9"]:checked~.study-options .choice-wide,.study-radio[value="4:3"]:checked~.study-options .choice-gesture,.study-radio[value="1:1"]:checked~.study-options .choice-detail{background:var(--study-accent);border-color:var(--study-accent);color:var(--study-on-accent)}
  .study-radio[value="16:9"]:focus-visible~.study-options .choice-wide,.study-radio[value="4:3"]:focus-visible~.study-options .choice-gesture,.study-radio[value="1:1"]:focus-visible~.study-options .choice-detail{outline:2px solid var(--ink,#202323);outline-offset:4px}
  .study-preview{margin:0}.study-stage{position:relative;isolation:isolate;aspect-ratio:16/9;width:100%;overflow:hidden;background:#202323;touch-action:pan-y}
  .study-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;display:block}.study-dim{position:absolute;inset:0;background:#202323;opacity:.68;pointer-events:none}.study-image-crop{clip-path:inset(5% 5%);pointer-events:none}
  .study-radio[value="4:3"]:checked~.study-preview .study-image-crop{clip-path:inset(5% 16.25%)}.study-radio[value="1:1"]:checked~.study-preview .study-image-crop{clip-path:inset(5% 24.6875%)}
  .study-guides{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.study-guide-path{stroke:#F1EFE7;stroke-width:1.5;stroke-dasharray:1;stroke-dashoffset:0;vector-effect:non-scaling-stroke}.guide-outline{opacity:.55;stroke-width:1}.guide-gesture,.guide-detail{display:none}
  .study-radio[value="4:3"]:checked~.study-preview .guide-wide,.study-radio[value="1:1"]:checked~.study-preview .guide-wide{display:none}.study-radio[value="4:3"]:checked~.study-preview .guide-gesture,.study-radio[value="1:1"]:checked~.study-preview .guide-detail{display:block}
  figcaption{display:flex;justify-content:space-between;gap:18px;font-size:12px;line-height:1.6;margin-top:12px;color:var(--muted,#646661)}figcaption span:first-child{max-width:340px}figcaption span:last-child{text-align:right;flex-shrink:0}
  @media(max-width:1050px){.frame-study{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:30px}.study-options label{font-size:12px;gap:3px;padding-inline:4px}.study-copy h3{font-size:clamp(34px,4.3vw,48px)}figcaption{flex-direction:column;gap:5px}figcaption span:last-child{text-align:left}}
  @media(max-width:760px){.frame-study{grid-template-columns:minmax(0,1fr);gap:25px}.study-copy h3{font-size:clamp(34px,8vw,48px);margin:15px 0}.study-copy p{font-size:16px;line-height:1.7;max-width:none}.study-options{grid-template-columns:minmax(0,1fr);gap:8px;margin-bottom:20px}.study-options label{font-size:12px;min-height:44px;padding:11px;gap:6px}figcaption{font-size:12px;margin-top:10px}}
  @media(prefers-reduced-motion:reduce){.frame-study *{animation:none!important;transition:none!important}}
</style>
