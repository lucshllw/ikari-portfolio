/** Crossfade four ink layers: no animated filters, shadows, or color repaints. */
export function chromaticLetters(node:HTMLElement){
  const targets=[...node.querySelectorAll<HTMLElement>('[data-hero-wave],[data-finale-touch]')];
  const colors=['#B8FF01','#FF6B4A','#00F0FF','#FFE600'];
  const layers:HTMLElement[][]=[];
  let disposed=false,visible=false;
  let timeline:ReturnType<typeof import('gsap').gsap.timeline>|undefined;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  targets.forEach((target,index)=>{
    target.style.color=colors[index%4];target.style.position='relative';
    const text=target.textContent;
    layers.push(colors.map((color,i)=>{const span=document.createElement('span');span.textContent=text;span.ariaHidden='true';Object.assign(span.style,{position:'absolute',inset:'0',color,opacity:'0',pointerEvents:'none'});target.append(span);return span;}));
  });
  const reconcile=()=>{timeline?.paused(!visible||document.hidden||reduced.matches||!!document.documentElement.dataset.ikariTransition);node.dataset.colorLoop=visible&&!reduced.matches?'active':'paused';};
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;reconcile();},{rootMargin:'0px 0px -5% 0px'});observer.observe(node);
  void import('gsap').then(({gsap})=>{if(disposed)return;timeline=gsap.timeline({paused:true,repeat:-1});layers.forEach((group,index)=>{for(let step=0;step<5;step++){const layer=group[step%4];timeline!.to(layer,{opacity:1,duration:.45,ease:'sine.inOut'},step*1.2+index*.12).to(layer,{opacity:0,duration:.45},(step+1)*1.2+index*.12);}});reconcile();}).catch(()=>{});
  document.addEventListener('visibilitychange',reconcile);reduced.addEventListener('change',reconcile);window.addEventListener('ikari:scene-ready',reconcile);window.addEventListener('ikari:scene-cover',reconcile);
  return{destroy(){disposed=true;observer.disconnect();timeline?.kill();layers.flat().forEach(layer=>layer.remove());targets.forEach(target=>{target.style.removeProperty('color');target.style.removeProperty('position');});document.removeEventListener('visibilitychange',reconcile);reduced.removeEventListener('change',reconcile);window.removeEventListener('ikari:scene-ready',reconcile);window.removeEventListener('ikari:scene-cover',reconcile);}};
}
