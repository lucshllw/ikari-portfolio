type Connection = EventTarget & { saveData?: boolean };
/** Paused scroll choreography: no background requestAnimationFrame loop. */
export function ikariEnvironment(node: HTMLElement) {
  if (typeof window === 'undefined') return { destroy() {} };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer:fine)');
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  let disposed = false, visible = false, frame = 0, version = 0;
  let context: ReturnType<typeof import('gsap').gsap.context> | undefined;
  let timeline: ReturnType<typeof import('gsap').gsap.timeline> | undefined;
  let gsap: typeof import('gsap').gsap | undefined;
  let tether: SVGPathElement | null = null;
  let tetherTween: ReturnType<typeof import('gsap').gsap.to> | undefined;
  let splits: {revert():void}[] = [];
  const allowed = () => !disposed && visible && !document.hidden && !reduce.matches && !connection?.saveData && !document.documentElement.dataset.ikariTransition;
  function draw() {
    frame = 0;
    if (!allowed() || !timeline) return;
    const rect = node.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)));
    timeline.progress(p);
    node.dataset.environmentProgress = String(Math.round(p * 100));
  }
  function schedule() { if (!frame && allowed()) frame = requestAnimationFrame(draw); }
  function pointer(event: PointerEvent) {
    if (!allowed() || !fine.matches || event.pointerType === 'touch') return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--light-x', `${(event.clientX-rect.left)/rect.width*100}%`);
    node.style.setProperty('--light-y', `${(event.clientY-rect.top)/rect.height*100}%`);
  }
  function stringBend(event: PointerEvent) {
    if (!allowed() || !fine.matches || !gsap || !tether) return;
    const rect = tether.ownerSVGElement!.getBoundingClientRect();
    const x = Math.max(80, Math.min(1120, (event.clientX - rect.left) / rect.width * 1200));
    const y = Math.max(100, Math.min(470, (event.clientY - rect.top) / rect.height * 600));
    tetherTween?.kill();
    tetherTween = gsap.to(tether, { morphSVG: `M40,60 Q${x},${y} 420,200 T820,300 T1160,460`, duration:.25, ease:'power2.out' });
  }
  function stringRelease() {
    if (!gsap || !tether) return;
    tetherTween?.kill();
    tetherTween = gsap.to(tether, { morphSVG:'M40,60 Q240,330 420,200 T820,300 T1160,460', duration:.7, ease:'elastic.out(1,.3)' });
  }
  function stop() {
    version++; cancelAnimationFrame(frame); frame = 0;
    window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
    node.removeEventListener('pointermove',pointer);
    tether?.removeEventListener('pointermove',stringBend); tether?.removeEventListener('pointerleave',stringRelease);
    tetherTween?.kill(); context?.revert(); context=undefined; timeline=undefined;
    splits.forEach(split=>split.revert());splits=[];
    node.removeAttribute('data-environment');
  }
  async function start() {
    const v=++version;
    try {
      const modules=await Promise.all([import('gsap'),import('gsap/DrawSVGPlugin'),import('gsap/MorphSVGPlugin'),import('gsap/SplitText')]);
      if (v!==version || !allowed()) return;
      gsap=modules[0].gsap; gsap.registerPlugin(modules[1].DrawSVGPlugin,modules[2].MorphSVGPlugin,modules[3].SplitText);
      context=gsap.context(()=>{
        timeline=gsap!.timeline({paused:true,defaults:{ease:'none',force3D:false}});
        timeline.to({clock:0},{clock:1,duration:1},0);
        for(const heading of node.querySelectorAll<HTMLElement>('[data-environment-heading]')){
          const split=modules[3].SplitText.create(heading,{type:'chars',aria:'auto',charsClass:'ink-letter'});splits.push(split);
          timeline.fromTo(split.chars,{y:35,rotation:8,opacity:.2},{y:0,rotation:0,opacity:1,duration:.18,stagger:.003,ease:'back.out(1.4)'},.08);
        }
        const backgrounds=node.querySelectorAll('[data-environment-layer]');
        if(backgrounds.length) timeline.fromTo(backgrounds,{y:60,rotation:-3},{y:-70,rotation:3,duration:1},0);
        const tapes=node.querySelectorAll('[data-environment-tape]');
        if(tapes.length) timeline.fromTo(tapes,{xPercent:(i:number)=>i%2?-12:0},{xPercent:(i:number)=>i%2?0:-12,duration:1},0);
        const lines=node.querySelectorAll('[data-environment-draw]');
        if(lines.length) timeline.fromTo(lines,{drawSVG:'0%'},{drawSVG:'100%',duration:.5},.05);
        const pops=node.querySelectorAll('[data-environment-pop]');
        if(pops.length) timeline.fromTo(pops,{y:60,rotation:(i:number)=>i%2?-5:5,opacity:.35},{y:0,rotation:(i:number)=>i%2?2:-2,opacity:1,duration:.28,stagger:.04,ease:'back.out(1.4)'},.12);
        const particles=node.querySelectorAll('[data-environment-spark]');
        if(particles.length) timeline.fromTo(particles,{y:90,scale:.3,opacity:.1},{y:-130,scale:1.1,opacity:.65,rotation:55,duration:1},0);
        const entrance=node.querySelector('[data-environment-entrance]');
        if(entrance) timeline.fromTo(entrance,{clipPath:'polygon(0 0,100% 0,100% 100%,0 100%)'},{clipPath:'polygon(0 0,100% 0,100% 0,0 12%)',duration:.16,ease:'power2.inOut'},.04);
      },node);
      node.dataset.environment='active';
      tether=node.querySelector<SVGPathElement>('[data-elastic-string]');
      tether?.addEventListener('pointermove',stringBend); tether?.addEventListener('pointerleave',stringRelease);
      window.addEventListener('scroll',schedule,{passive:true}); window.addEventListener('resize',schedule);
      node.addEventListener('pointermove',pointer,{passive:true}); draw();
    } catch { if(v===version) stop(); }
  }
  function reconcile() { stop(); if(allowed()) void start(); }
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;reconcile();},{threshold:0});
  observer.observe(node); reduce.addEventListener('change',reconcile); connection?.addEventListener('change',reconcile); document.addEventListener('visibilitychange',reconcile);
  window.addEventListener('ikari:scene-ready',reconcile);
  return {destroy(){disposed=true;stop();observer.disconnect();reduce.removeEventListener('change',reconcile);connection?.removeEventListener('change',reconcile);document.removeEventListener('visibilitychange',reconcile);window.removeEventListener('ikari:scene-ready',reconcile);}};
}

export function magnetic(node: HTMLElement) {
  if (typeof window === 'undefined') return {destroy(){}};
  const fine=matchMedia('(pointer:fine) and (hover:hover)'),reduce=matchMedia('(prefers-reduced-motion:reduce)');
  let disposed=false,engine:typeof import('gsap').gsap|undefined, x:ReturnType<typeof import('gsap').gsap.quickTo>|undefined,y:ReturnType<typeof import('gsap').gsap.quickTo>|undefined;
  async function move(event:PointerEvent) {
    if(!fine.matches||reduce.matches||event.pointerType==='touch')return;
    if(!engine){engine=(await import('gsap')).gsap;if(disposed)return;x=engine.quickTo(node,'x',{duration:.3,ease:'power3.out'});y=engine.quickTo(node,'y',{duration:.3,ease:'power3.out'});}
    const r=node.getBoundingClientRect();x?.(Math.max(-20,Math.min(20,(event.clientX-r.left-r.width/2)*.18)));y?.(Math.max(-14,Math.min(14,(event.clientY-r.top-r.height/2)*.18)));
  }
  function reset(){x?.(0);y?.(0);}
  node.addEventListener('pointermove',move);node.addEventListener('pointerleave',reset);node.addEventListener('blur',reset);reduce.addEventListener('change',reset);
  return {destroy(){disposed=true;node.removeEventListener('pointermove',move);node.removeEventListener('pointerleave',reset);node.removeEventListener('blur',reset);reduce.removeEventListener('change',reset);x?.tween.kill();y?.tween.kill();node.style.removeProperty('transform');}};
}
