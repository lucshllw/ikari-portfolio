/** Mobile and footer choreography use the native scroll clock already adopted by
 * the project. No second scroll engine or permanent requestAnimationFrame loop. */
type Engine = typeof import('gsap').gsap;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const reducedQuery = '(prefers-reduced-motion: reduce)';

export function mobileHeroMotion(node: HTMLElement) {
  if (typeof window === 'undefined') return { destroy() {} };
  const mobile = matchMedia('(max-width:1023px)'), reduced = matchMedia(reducedQuery);
  let visible = false, disposed = false, version = 0, frame = 0;
  let ctx: ReturnType<Engine['context']> | undefined;
  let gsap: Engine | undefined;
  let introduced = false;
  const letters = [...node.querySelectorAll<HTMLElement>('[data-hero-letter]')];
  const inks = node.querySelectorAll<HTMLElement>('[data-hero-ink]');
  const backdrop = node.querySelectorAll<HTMLElement>('[data-hero-background]');
  const mural = node.querySelector<HTMLElement>('[data-hero-mural]');
  const image = node.querySelector<HTMLElement>('[data-hero-mural-art]');
  const wires = [...node.querySelectorAll<SVGPathElement>('[data-mural-wire]')];
  const wireLengths=new Map(wires.map(wire=>[wire,wire.getTotalLength()]));
  const allowed = () => visible && mobile.matches && !reduced.matches && !document.hidden && !disposed && !document.documentElement.dataset.ikariTransition;
  function draw() {
    frame = 0;
    if (!gsap || !allowed()) return;
    const copy = node.querySelector<HTMLElement>('[data-fanzine-copy]');
    const box = copy?.getBoundingClientRect();
    const rect = node.getBoundingClientRect();
    const bounds = mural?.getBoundingClientRect();
    const p = box ? clamp(-rect.top / Math.max(1, box.height * .9)) : 0;
    gsap.set(letters, {y: (i: number) => p * (i % 2 ? -50 : -24), rotation: (i: number) => p * (i % 2 ? 6 : -5), opacity:1});
    const world = clamp((innerHeight - rect.top) / Math.max(1, rect.height + innerHeight));
    gsap.set(backdrop, { y: (i: number) => (world-.2) * (i%2 ? -110 : 90), x:(i:number)=>(world-.2)*(i%2?28:-28) });
    if (mural && bounds) {
      const reveal = clamp((innerHeight * .92 - bounds.top) / Math.min(innerHeight*.7,bounds.height));
      gsap.set(mural, {clipPath:`polygon(${(1-reveal)*100}% 0%,100% 0%,100% 100%,${(1-reveal)*100-30}% 100%)`});
      if (image) gsap.set(image, {scale:1.12-reveal*.12});
      for(const wire of wires){const length=wireLengths.get(wire)!;wire.style.strokeDasharray=String(length);wire.style.strokeDashoffset=String(length*(1-reveal));}
      node.dataset.mobileMuralProgress=String(Math.round(reveal*100));
    }
    node.dataset.mobileHeroProgress=String(Math.round(p*100));
  }
  function schedule(){if(!frame&&allowed())frame=requestAnimationFrame(draw);}
  function stop(){version++;cancelAnimationFrame(frame);frame=0;ctx?.revert();ctx=undefined;window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);}
  async function start(){
    if(ctx||!allowed())return;const v=++version;
    try {
      const [{gsap:engine},{ScrollTrigger}]=await Promise.all([import('gsap'),import('gsap/ScrollTrigger')]);
      gsap=engine;gsap.registerPlugin(ScrollTrigger);
      if(v!==version||!allowed())return;
      ctx=gsap.context(()=>{
        if(!introduced){introduced=true;gsap!.fromTo(inks,{yPercent:85,rotationX:-45,opacity:0},{yPercent:0,rotationX:0,opacity:1,stagger:.065,duration:.65,ease:'power3.out'});}
        gsap!.timeline({repeat:-1,scrollTrigger:{trigger:node.querySelector('.hero-name'),start:'top 95%',end:'bottom top',toggleActions:'play pause resume pause'}})
          .to(node.querySelectorAll('[data-hero-wave]'),{y:-5,rotation:(i:number)=>i%2?3:-3,stagger:.1,duration:1.2,ease:'sine.inOut'})
          .to(node.querySelectorAll('[data-hero-wave]'),{y:0,rotation:0,stagger:.1,duration:1.2,ease:'sine.inOut'});
      },node);
      window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});draw();
    }catch{stop();}
  }
  function restore(){for(const n of letters){n.style.removeProperty('transform');n.style.removeProperty('opacity');n.style.removeProperty('color');}for(const n of backdrop)n.style.removeProperty('transform');mural?.style.removeProperty('clip-path');image?.style.removeProperty('transform');for(const wire of wires){wire.style.removeProperty('stroke-dasharray');wire.style.removeProperty('stroke-dashoffset');}}
  function reconcile(){if(!allowed()){stop();if(reduced.matches||!mobile.matches)restore();}else void start();}
  const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;reconcile();});io.observe(node);
  mobile.addEventListener('change',reconcile);reduced.addEventListener('change',reconcile);document.addEventListener('visibilitychange',reconcile);window.addEventListener('ikari:scene-ready',reconcile);
  return {destroy(){disposed=true;stop();restore();io.disconnect();mobile.removeEventListener('change',reconcile);reduced.removeEventListener('change',reconcile);document.removeEventListener('visibilitychange',reconcile);window.removeEventListener('ikari:scene-ready',reconcile);delete node.dataset.mobileHeroProgress;delete node.dataset.mobileMuralProgress;}};
}

/** The two shutters share a single scroll-derived pose, including reverse scroll. */
export function clapboardMotion(node: HTMLElement){
  if(typeof window==='undefined')return {destroy(){}};
  let disposed=false,ctx:ReturnType<Engine['context']>|undefined;
  let trigger:import('gsap/ScrollTrigger').ScrollTrigger|undefined;
  const top=node.querySelector<HTMLElement>('[data-clapboard-top]'),bottom=node.querySelector<HTMLElement>('[data-clapboard-bottom]'),image=node.querySelector<HTMLElement>('[data-clapboard-image]');
  const wires=[...node.querySelectorAll<SVGPathElement>('[data-clapboard-wire]')];
  const wireLengths=new Map(wires.map(wire=>[wire,wire.getTotalLength()]));
  const refresh=()=>trigger?.refresh();
  void Promise.all([import('gsap'),import('gsap/ScrollTrigger')]).then(([{gsap},{ScrollTrigger}])=>{
    if(disposed)return;
    gsap.registerPlugin(ScrollTrigger);
    ctx=gsap.context(()=>{
      gsap.matchMedia().add('(prefers-reduced-motion: no-preference)',()=>{
        node.dataset.clapboard='active';
        for(const wire of wires)gsap.set(wire,{strokeDasharray:wireLengths.get(wire),strokeDashoffset:wireLengths.get(wire)});
        const timeline=gsap.timeline({defaults:{duration:1,ease:'none'},scrollTrigger:{trigger:node,start:'top 92%',end:'top 25%',scrub:.3,invalidateOnRefresh:true,onUpdate:self=>{node.dataset.clapboardProgress=String(Math.round(self.progress*100));}}});
        if(top)timeline.fromTo(top,{yPercent:0,rotation:0,xPercent:0},{yPercent:-100,rotation:-8,xPercent:7},0);
        if(bottom)timeline.fromTo(bottom,{yPercent:0,rotation:0,xPercent:0},{yPercent:100,rotation:7,xPercent:-7},0);
        if(image)timeline.fromTo(image,{scale:1.12},{scale:1},0);
        timeline.to(wires,{strokeDashoffset:0},.1);
        trigger=timeline.scrollTrigger;
        return()=>{delete node.dataset.clapboard;delete node.dataset.clapboardProgress;};
      });
    },node);
  }).catch(()=>{ctx?.revert();delete node.dataset.clapboard;});
  window.addEventListener('ikari:scene-ready',refresh);image?.addEventListener('load',refresh);
  return {destroy(){disposed=true;ctx?.revert();window.removeEventListener('ikari:scene-ready',refresh);image?.removeEventListener('load',refresh);delete node.dataset.clapboard;delete node.dataset.clapboardProgress;}};
}

/** The final word has three owners: entrance shell, visible wave and touch state.
 * Bottom-of-document progress is clamped so the entrance never waits offscreen. */
export function finaleMotion(node:HTMLElement){
  if(typeof window==='undefined')return {destroy(){}};
  const reduce=matchMedia(reducedQuery);
  const letters=[...node.querySelectorAll<HTMLElement>('[data-finale-letter]')],inks=[...node.querySelectorAll<HTMLElement>('[data-finale-ink]')];
  let visible=false,disposed=false,entered=false,preparing=false,frame=0,engine:Engine|undefined,ctx:ReturnType<Engine['context']>|undefined;
  let intro:ReturnType<Engine['timeline']>|undefined,wave:ReturnType<Engine['timeline']>|undefined;
  const allowed=()=>visible&&!disposed&&!document.hidden&&!reduce.matches&&!document.documentElement.dataset.ikariTransition;
  function draw(){frame=0;if(!allowed()||!engine||!entered)return;const r=node.getBoundingClientRect();const p=clamp((innerHeight*.95-r.top)/Math.max(1,innerHeight*.95-Math.min(node.offsetHeight,innerHeight)));
    node.dataset.finaleProgress=String(Math.round(p*100));wave?.timeScale(.85+p*.35);
  }
  function schedule(){if(!frame&&allowed())frame=requestAnimationFrame(draw);}
  async function prepare(){
    if(engine||preparing||!allowed())return;
    preparing=true;
    try{const [{gsap},{ScrollTrigger}]=await Promise.all([import('gsap'),import('gsap/ScrollTrigger')]);if(disposed)return;engine=gsap;gsap.registerPlugin(ScrollTrigger);ctx=gsap.context(()=>{
      intro=gsap.timeline({paused:true,onComplete(){node.dataset.finaleEntered='true';}}).fromTo(letters,{yPercent:100,rotationX:-90,scale:.7,opacity:0},{yPercent:0,rotationX:0,scale:1,opacity:1,stagger:.07,duration:.7,ease:'back.out(1.6)'});
      wave=gsap.timeline({paused:true,repeat:-1}).to(inks,{y:-8,skewX:-6,stagger:.12,duration:1.45,ease:'sine.inOut'}).to(inks,{y:0,skewX:0,stagger:.1,duration:1.45,ease:'sine.inOut'});
      const trigger=ScrollTrigger.create({trigger:node.querySelector('.finale-name'),start:'top 95%',end:'bottom top',onToggle:self=>{visible=self.isActive;reconcile();}});
      visible=trigger.isActive;
    },node);reconcile();}catch{ctx?.revert();}finally{preparing=false;}
  }
  function reconcile(){const run=allowed();if(run&&!engine)void prepare();if(run&&!entered&&intro){entered=true;intro.play();}wave?.paused(!run);if(entered&&intro&&intro.progress()<1)intro.paused(!run);if(!run){cancelAnimationFrame(frame);frame=0;}node.dataset.finaleAmbient=String(run&&!!wave);if(reduce.matches){intro?.progress(1).pause();wave?.pause(0);engine?.set(letters,{clearProps:'transform,opacity'});engine?.set(inks,{clearProps:'transform,color'});}if(run)schedule();}
  function touch(event:PointerEvent){if(!allowed()||!engine)return;const target=(event.target as Element).closest<HTMLElement>('[data-finale-touch]');if(!target)return;engine.fromTo(target,{scale:1.08},{scale:1,duration:.38,ease:'power3.out',overwrite:'auto'});}
  function pointer(event:PointerEvent){if(!allowed()||!engine||event.pointerType==='touch'||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;for(const target of node.querySelectorAll<HTMLElement>('[data-finale-touch]')){const r=target.getBoundingClientRect(),near=Math.max(0,1-Math.abs(event.clientX-r.left-r.width/2)/140);engine.to(target,{y:-near*7,rotation:near*4,scale:1+near*.035,duration:.2,overwrite:'auto'});}}
  function resetPointer(){if(engine)engine.to(node.querySelectorAll('[data-finale-touch]'),{y:0,rotation:0,scale:1,duration:.25,overwrite:'auto'});}
  const io=new IntersectionObserver(([e])=>{if(!engine){visible=e.isIntersecting;reconcile();}},{rootMargin:'0px 0px -5% 0px',threshold:0});io.observe(node);
  window.addEventListener('scroll',schedule,{passive:true});node.addEventListener('pointerdown',touch);node.addEventListener('pointermove',pointer);node.addEventListener('pointerleave',resetPointer);document.addEventListener('visibilitychange',reconcile);window.addEventListener('ikari:scene-ready',reconcile);window.addEventListener('ikari:scene-cover',reconcile);reduce.addEventListener('change',reconcile);
  return {destroy(){disposed=true;io.disconnect();cancelAnimationFrame(frame);ctx?.revert();engine?.killTweensOf(node.querySelectorAll('[data-finale-touch]'));window.removeEventListener('scroll',schedule);node.removeEventListener('pointerdown',touch);node.removeEventListener('pointermove',pointer);node.removeEventListener('pointerleave',resetPointer);document.removeEventListener('visibilitychange',reconcile);window.removeEventListener('ikari:scene-ready',reconcile);window.removeEventListener('ikari:scene-cover',reconcile);reduce.removeEventListener('change',reconcile);}};
}
