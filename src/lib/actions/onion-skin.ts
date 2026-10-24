/** Two image ghosts during scrolling only; no canvas or permanent frame loop. */
export function onionSkin(node:HTMLElement){
  const source=node.querySelector('img');if(!source)return;
  const originalPosition=node.style.position;
  if(getComputedStyle(node).position==='static')node.style.position='relative';
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  let visible=false,frame=0,previous=scrollY,timer:ReturnType<typeof setTimeout>;
  const ghosts=[-1,1].map(direction=>{const ghost=source.cloneNode() as HTMLImageElement;ghost.alt='';ghost.ariaHidden='true';ghost.removeAttribute('id');ghost.dataset.onionGhost=String(direction);Object.assign(ghost.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:getComputedStyle(source).objectFit,opacity:'0',pointerEvents:'none',transition:'opacity 120ms linear',zIndex:'2'});node.append(ghost);return ghost;});
  function stop(){ghosts.forEach(ghost=>ghost.style.opacity='0');cancelAnimationFrame(frame);frame=0;}
  function draw(){frame=0;if(!visible||reduced.matches||document.hidden)return;const shift=Math.max(-10,Math.min(10,(scrollY-previous)*.18));previous=scrollY;ghosts.forEach((ghost,index)=>{ghost.style.transform=`translate3d(${(index?1:-1)*3}px,${(index?1:-1)*shift}px,0)`;ghost.style.opacity='.13';});clearTimeout(timer);timer=setTimeout(stop,130);}
  function scroll(){if(!frame&&visible&&!reduced.matches&&!document.hidden)frame=requestAnimationFrame(draw);}
  const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;previous=scrollY;if(!visible)stop();});observer.observe(node);
  window.addEventListener('scroll',scroll,{passive:true});document.addEventListener('visibilitychange',stop);reduced.addEventListener('change',stop);
  return{destroy(){stop();clearTimeout(timer);observer.disconnect();ghosts.forEach(ghost=>ghost.remove());node.style.position=originalPosition;window.removeEventListener('scroll',scroll);document.removeEventListener('visibilitychange',stop);reduced.removeEventListener('change',stop);}};
}
