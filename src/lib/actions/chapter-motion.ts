/** Finite intros begin after the shared claquette delivers the page. SSR stays readable. */
export function chapterMotion(node: HTMLElement, enabled: boolean|string = true) {
  if (typeof window === 'undefined' || !enabled) return { destroy() {} };
  let disposed = false, played = false, preparing = false;
  let context: ReturnType<typeof import('gsap').gsap.context> | undefined;
  let timeline: ReturnType<typeof import('gsap').gsap.timeline> | undefined;
  let textSplit: {revert():void} | undefined;
  node.dataset.chapterOwner='true';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  async function start() {
    const rect=node.getBoundingClientRect();
    if (disposed || played || document.hidden || rect.top >= innerHeight || rect.bottom<=0) return;
    if (reduced.matches || connection?.saveData) return;
    if(timeline){if(!document.documentElement.dataset.ikariTransition){played=true;timeline.play();}return;}
    if(preparing)return;
    preparing=true;
    try {
      const [{ gsap },{SplitText}] = await Promise.all([import('gsap'),import('gsap/SplitText')]);
      if (disposed || reduced.matches) return;
      gsap.registerPlugin(SplitText);
      context = gsap.context(() => {
        const own=(selector:string)=>[...node.querySelectorAll(selector)].filter(n=>n.closest('[data-chapter-owner]')===node);
        const title = own('[data-chapter-title]');
        // Split words as units so Japanese/Latin title masks never break every
        // letter into a new line. Original accessible text is restored on exit.
        const split = title.length ? SplitText.create(title,{type:'words,chars',wordsClass:'chapter-word',charsClass:'chapter-char',aria:'auto'}) : undefined;
        textSplit=split;
        const pieces = own('[data-chapter-piece]');
        const line = own('[data-chapter-line]');
        const tl = timeline=gsap.timeline({ paused:true,defaults: { ease: 'power3.out' } });
        if (split?.chars.length) tl.fromTo(split.chars,{ yPercent:75,opacity:0 },{ yPercent:0,opacity:1,duration:.6,stagger:{each:.025,amount:.32} },0);
        if (line.length) tl.fromTo(line,{scaleX:0},{scaleX:1,transformOrigin:'left',duration:.55},.1);
        if (pieces.length) tl.fromTo(pieces,{y:18,opacity:.45},{y:0,opacity:1,duration:.6,stagger:.07},.16);
        if(!document.documentElement.dataset.ikariTransition){played=true;tl.play();}
      },node);
    } catch { context?.revert();textSplit?.revert(); } finally {preparing=false;}
  }
  const io = new IntersectionObserver(([entry]) => { if(entry.isIntersecting) void start(); },{threshold:.08});
  io.observe(node); window.addEventListener('ikari:scene-ready',start);window.addEventListener('ikari:scene-prepare',start);
  const frame = requestAnimationFrame(() => void start());
  function preference(){if(reduced.matches){context?.revert();textSplit?.revert();}}
  reduced.addEventListener('change',preference);
  return {update(next:boolean|string){if(next===enabled)return;enabled=next;played=false;context?.revert();textSplit?.revert();timeline=undefined;void start();},destroy(){disposed=true;io.disconnect();cancelAnimationFrame(frame);context?.revert();textSplit?.revert();delete node.dataset.chapterOwner;window.removeEventListener('ikari:scene-ready',start);window.removeEventListener('ikari:scene-prepare',start);reduced.removeEventListener('change',preference);}};
}

/** Nested wrappers keep entrance, scroll and ambient transforms independent. */
export function suspendedArtwork(node: HTMLElement) {
  let disposed=false, visible=false, running=false;
  let context: ReturnType<typeof import('gsap').gsap.context>|undefined;
  let float: ReturnType<typeof import('gsap').gsap.to>|undefined;
  let toX: ReturnType<typeof import('gsap').gsap.quickTo>|undefined;
  let toY: ReturnType<typeof import('gsap').gsap.quickTo>|undefined;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  const connection=(navigator as Navigator & {connection?:{saveData?:boolean}}).connection;
  const move=node.querySelector<HTMLElement>('[data-art-pointer]');
  const paper=node.querySelector<HTMLElement>('[data-art-float]');
  function reconcile(){const covered=Number(node.closest('.ikari-hero')?.getAttribute('data-scroll-progress')||0)>=55;const run=visible&&!covered&&!document.hidden&&!reduced.matches&&!connection?.saveData&&!document.documentElement.dataset.ikariTransition;float?.paused(!run);node.dataset.ambientActive=String(run&&!!float);if(!run&&running){toX?.(0);toY?.(0);}running=run;if(reduced.matches){float?.progress(0);if(paper)paper.style.transform='none';}}
  const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;reconcile();},{threshold:.1});io.observe(node);
  void import('gsap').then(({gsap})=>{if(disposed||!paper||!move||connection?.saveData)return;context=gsap.context(()=>{float=gsap.fromTo(paper,{y:-3,rotation:-.35},{y:3,rotation:.35,duration:2,repeat:-1,yoyo:true,ease:'sine.inOut',paused:true});toX=gsap.quickTo(move,'x',{duration:.55,ease:'power3.out'});toY=gsap.quickTo(move,'y',{duration:.55,ease:'power3.out'});},node);reconcile();}).catch(()=>{});
  function pointer(e:PointerEvent){if(!fine.matches||!running||reduced.matches)return;const r=node.getBoundingClientRect();toX?.(((e.clientX-r.left)/r.width-.5)*8);toY?.(((e.clientY-r.top)/r.height-.5)*5);}
  function leave(){toX?.(0);toY?.(0);}
  node.addEventListener('pointermove',pointer);node.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',reconcile);reduced.addEventListener('change',reconcile);window.addEventListener('ikari:scene-ready',reconcile);window.addEventListener('ikari:scene-cover',reconcile);window.addEventListener('scroll',reconcile,{passive:true});
  return {destroy(){disposed=true;io.disconnect();context?.revert();toX?.tween.kill();toY?.tween.kill();node.removeEventListener('pointermove',pointer);node.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',reconcile);reduced.removeEventListener('change',reconcile);window.removeEventListener('ikari:scene-ready',reconcile);window.removeEventListener('ikari:scene-cover',reconcile);window.removeEventListener('scroll',reconcile);}};
}
