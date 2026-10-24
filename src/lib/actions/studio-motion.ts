/** Small pointer gestures own separate decorative wrappers and never affect hit areas. */
export function studioPointer(node:HTMLElement,mode:'tilt'|'magnet'|'letters'='tilt'){
 let disposed=false,visible=false,cleanup=()=>{};
 const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(!visible)reset();});io.observe(node);
 let move=(e:PointerEvent)=>{},reset=()=>{};
 void import('gsap').then(({gsap})=>{if(disposed)return;const mm=gsap.matchMedia();mm.add('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)',()=>{
  const target=node.querySelector<HTMLElement>('[data-pointer-surface]')||node;
  const x=gsap.quickTo(target,mode==='tilt'?'rotationY':'x',{duration:.4,ease:'power3.out'}),y=gsap.quickTo(target,mode==='tilt'?'rotationX':'y',{duration:.45,ease:'power3.out'});
  const letters=[...node.querySelectorAll<HTMLElement>('[data-finale-letter]')];
  move=e=>{if(!visible||document.hidden)return;const r=node.getBoundingClientRect(),dx=(e.clientX-r.left)/r.width-.5,dy=(e.clientY-r.top)/r.height-.5;if(mode==='letters'){letters.forEach((letter,i)=>{const b=letter.getBoundingClientRect(),near=Math.max(0,1-Math.abs(e.clientX-b.left-b.width/2)/180);gsap.to(letter,{y:-near*14,rotation:(i%2?1:-1)*near*6,scale:1+near*.06,color:near>.4?(i%2?'#ff6b4a':'#b8ff01'):'#f3efe6',duration:.22,overwrite:'auto'});});}else{x(dx*(mode==='tilt'?7:6));y(dy*(mode==='tilt'?-6:6));}};
  reset=()=>{x(0);y(0);if(letters.length)gsap.to(letters,{y:0,rotation:0,scale:1,color:'#f3efe6',duration:.3,overwrite:'auto'});};
  node.addEventListener('pointermove',move);node.addEventListener('pointerleave',reset);document.addEventListener('visibilitychange',reset);
  return()=>{node.removeEventListener('pointermove',move);node.removeEventListener('pointerleave',reset);document.removeEventListener('visibilitychange',reset);gsap.killTweensOf(letters);x.tween.kill();y.tween.kill();move=()=>{};reset=()=>{};};
 });cleanup=()=>mm.revert();}).catch(()=>{});
 return{destroy(){disposed=true;io.disconnect();cleanup();}};
}

/** Ambient loop is bounded to visible scenes and shuts down under reduced motion. */
export function studioAmbient(node:HTMLElement){
 let disposed=false,visible=false;let cleanup=()=>{};let reconcile=()=>{};
 const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;reconcile();});io.observe(node);
 void import('gsap').then(({gsap})=>{if(disposed)return;const mm=gsap.matchMedia();mm.add('(prefers-reduced-motion:no-preference)',()=>{
  if((navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData)return;
  const tl=gsap.timeline({paused:true,repeat:-1,yoyo:true,defaults:{ease:'sine.inOut',duration:2.4}});
  const floats=node.querySelectorAll('[data-studio-float]'),turns=node.querySelectorAll('[data-studio-turn]'),glows=node.querySelectorAll('[data-studio-glow]');
  if(floats.length)tl.to(floats,{y:-6,rotation:1,stagger:.15},0);
  if(turns.length)tl.to(turns,{rotation:24,duration:4},0);
  if(glows.length)tl.to(glows,{opacity:.4,scale:1.07,transformOrigin:'center'},0);
  reconcile=()=>{const hero=node.closest('.ikari-hero'),progress=Number(hero?.getAttribute('data-scroll-progress')||0);const run=visible&&!document.hidden&&!document.documentElement.dataset.ikariTransition&&(!hero||progress>=25);tl.paused(!run);node.dataset.studioActive=String(run);};
  document.addEventListener('visibilitychange',reconcile);window.addEventListener('ikari:scene-ready',reconcile);window.addEventListener('ikari:scene-cover',reconcile);window.addEventListener('scroll',reconcile,{passive:true});reconcile();
  return()=>{document.removeEventListener('visibilitychange',reconcile);window.removeEventListener('ikari:scene-ready',reconcile);window.removeEventListener('ikari:scene-cover',reconcile);window.removeEventListener('scroll',reconcile);node.dataset.studioActive='false';tl.kill();reconcile=()=>{};};
 });cleanup=()=>mm.revert();}).catch(()=>{});
 return{destroy(){disposed=true;io.disconnect();cleanup();}};
}

export function elasticWire(node:SVGPathElement){
 let disposed=false,cleanup=()=>{};
 void import('gsap').then(({gsap})=>{if(disposed)return;const mm=gsap.matchMedia();mm.add('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)',()=>{
  const rest=node.getAttribute('d')||'',bend=rest.replace(/Q([\d.-]+) ([\d.-]+)/,(_s,x,y)=>`Q${x} ${Number(y)+32}`);
  const enter=()=>gsap.fromTo(node,{attr:{d:bend}},{attr:{d:rest},duration:.7,ease:'elastic.out(1,.3)',overwrite:true});
  node.addEventListener('pointerenter',enter);return()=>{node.removeEventListener('pointerenter',enter);gsap.killTweensOf(node);node.setAttribute('d',rest);};
 });cleanup=()=>mm.revert();}).catch(()=>{});return{destroy(){disposed=true;cleanup();}};
}

export function studioCurtain(node:HTMLElement){
 let visible=false,frame=0;const reduce=matchMedia('(prefers-reduced-motion:reduce)');
 function draw(){frame=0;if(!visible||document.hidden||reduce.matches){node.style.removeProperty('clip-path');return;}const progress=Math.min(1,Math.max(0,(innerHeight-node.getBoundingClientRect().top)/(innerHeight*.45)));node.style.clipPath=`inset(${(1-progress)*12}% 0% 0% 0%)`;}
 function schedule(){if(!frame&&visible&&!document.hidden&&!reduce.matches)frame=requestAnimationFrame(draw);}
 const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;schedule();});io.observe(node);window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);reduce.addEventListener('change',draw);
 return{destroy(){io.disconnect();cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);reduce.removeEventListener('change',draw);node.style.removeProperty('clip-path');}};
}
