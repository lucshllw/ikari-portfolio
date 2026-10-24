type Engine = typeof import('gsap').gsap;
type Plugin = typeof import('gsap/ScrollTrigger').ScrollTrigger;
type Trigger = InstanceType<Plugin>;
type Connection = EventTarget & { saveData?: boolean };
export type FanzineScene = 'hero' | 'showcase' | 'reveal';

// All new fanzine scenes share this ownership. Existing/foreign registrations
// are left untouched. GSAP 3.15 is retired once rather than globally re-enabled.
let plugin: Plugin | undefined;
let loading: Promise<Plugin | undefined> | undefined;
let exclusive = false;
let suspended = false;
const owned = new Set<Trigger>();
function foreign() {
  if (!plugin) return false;
  const found = plugin.getAll().some(t => !owned.has(t)) || !!plugin.normalizeScroll();
  if (found) exclusive = false;
  return found;
}
function retireGlobal() {
  if (plugin && exclusive && !foreign() && !plugin.getAll().length && !suspended) {
    plugin.disable(false, false);
    suspended = true;
  }
}
function loadPlugin(engine: Engine) {
  if (suspended) return Promise.resolve(undefined);
  if (!loading) {
    const globals = (engine.core as typeof engine.core & { globals(): Record<string, unknown> }).globals();
    if (globals.ScrollTrigger || (window as Window & { ScrollTrigger?: unknown }).ScrollTrigger) {
      loading = Promise.resolve(undefined);
    } else {
      loading = import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        engine.registerPlugin(ScrollTrigger);
        plugin = ScrollTrigger;
        exclusive = !foreign();
        // Do not call config(): installed 3.15 loses its interval handle there.
        // Mobile has native scrolling, no pins, and never loads this plugin.
        return exclusive ? ScrollTrigger : undefined;
      }).catch(() => undefined);
    }
  }
  return loading;
}

/** SSR-visible, native-scroll fanzine choreography. No render loop at rest. */
export function fanzineMotion(node: HTMLElement, scene: FanzineScene = 'hero') {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return { destroy() {} };
  const desktop = matchMedia('(min-width: 1024px) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  const introTargets = [...node.querySelectorAll<HTMLElement>('[data-fanzine-intro]')];
  const panels = [...node.querySelectorAll<HTMLElement>('[data-showcase-panel]')];
  const chapters = [...node.querySelectorAll<HTMLAnchorElement>('[data-showcase-chapter]')];
  const anchors = [...node.querySelectorAll<HTMLElement>('[data-showcase-anchor]')];
  let activePanel = -1;
  let motionFailed = false;
  let engine: Engine | undefined;
  let ctx: ReturnType<Engine['context']> | undefined;
  let intro: ReturnType<Engine['context']> | undefined;
  let timeline: ReturnType<Engine['timeline']> | undefined;
  let trigger: Trigger | undefined;
  let visible = false;
  let disposed = false;
  let running = false;
  let introduced = true;
  let retired = false;
  let version = 0;
  let frame = 0;
  let idle = 0;
  let wasDesktop = desktop.matches;
  const eligible = () => !document.documentElement.dataset.ikariTransition && visible && !disposed && !document.hidden && !reduced.matches && !connection?.saveData && (scene !== 'hero' || desktop.matches);
  const valid = (v: number) => v === version && eligible();

  function showPanel(index: number) {
    if (scene !== 'showcase' || !panels.length || node.dataset.showcaseEnhanced !== 'true') return;
    index = Math.max(0, Math.min(panels.length - 1, index));
    if (index === activePanel) return;
    activePanel = index;
    node.dataset.showcaseActive = String(index);
    panels.forEach((panel, i) => {
      const selected = i === index;
      // Only the current scene can be focused or announced. Background wipes
      // and paper objects remain separate from these stable content panels.
      panel.inert = !selected;
      panel.setAttribute('aria-hidden', String(!selected));
      panel.style.visibility = selected ? 'visible' : 'hidden';
      panel.style.opacity = selected ? '1' : '0';
      if (selected) { chapters[i]?.setAttribute('aria-current', 'step'); const rail = chapters[i]?.parentElement; if (rail && !desktop.matches) rail.scrollTo({left: Math.max(0, chapters[i].offsetLeft - rail.offsetLeft - 8), behavior: 'smooth'}); }
      else chapters[i]?.removeAttribute('aria-current');
    });
  }
  function configureShowcase() {
    if (scene !== 'showcase') return;
    const enhanced = !motionFailed && !reduced.matches && !connection?.saveData && panels.length > 1;
    const wasEnhanced = node.dataset.showcaseEnhanced === 'true';
    if (wasEnhanced === enhanced) return;
    activePanel = -1;
    if (enhanced) {
      panels.forEach((panel, i) => { panel.removeAttribute('id'); anchors[i]?.setAttribute('id', anchors[i].dataset.showcaseAnchor || `faixa${i+1}`); });
      node.dataset.showcaseEnhanced = 'true';
      showPanel(0);
    } else {
      delete node.dataset.showcaseEnhanced;
      delete node.dataset.showcaseActive;
      panels.forEach((panel, i) => { panel.inert = false; panel.removeAttribute('aria-hidden'); panel.style.removeProperty('visibility'); panel.style.removeProperty('opacity'); panel.id = anchors[i]?.dataset.showcaseAnchor || `faixa${i+1}`; anchors[i]?.removeAttribute('id'); });
      chapters.forEach(chapter => chapter.removeAttribute('aria-current'));
    }
  }

  function selectChapter(index: number) {
    if (node.dataset.showcaseEnhanced !== 'true' || !panels.length) return;
    const target = Math.max(0, Math.min(panels.length - 1, index));
    const rect = node.getBoundingClientRect();
    const stage = node.querySelector<HTMLElement>('[data-showcase-stage]');
    const range = Math.max(1, rect.height - (stage?.offsetHeight || innerHeight));
    const position = (target + .12) / panels.length;
    window.scrollTo({ top: scrollY + rect.top + range * position, behavior: 'instant' });
    timeline?.progress(position);
  }
  function chapterClick(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || node.dataset.showcaseEnhanced !== 'true') return;
    const link = (event.target as Element).closest<HTMLAnchorElement>('[data-showcase-chapter]');
    if (!link) return;
    event.preventDefault(); selectChapter(Number(link.dataset.showcaseChapter));
  }
  let touchOrigin: { x: number; y: number } | undefined;
  function touchStart(event: TouchEvent) { const point = event.touches[0]; if (point) touchOrigin = { x: point.clientX, y: point.clientY }; }
  function touchEnd(event: TouchEvent) {
    const point = event.changedTouches[0], origin = touchOrigin; touchOrigin = undefined;
    if (!point || !origin || node.dataset.showcaseEnhanced !== 'true') return;
    const dx = point.clientX - origin.x, dy = point.clientY - origin.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) selectChapter(activePanel + (dx < 0 ? 1 : -1));
  }
  if (scene === 'showcase') {
    node.addEventListener('click', chapterClick);
    node.addEventListener('touchstart', touchStart, { passive: true });
    node.addEventListener('touchend', touchEnd, { passive: true });
  }
  function progress() {
    const rect = node.getBoundingClientRect();
    const viewport = document.documentElement.clientHeight;
    if (scene === 'showcase' || (scene === 'hero' && desktop.matches)) {
      const stage = node.querySelector<HTMLElement>(scene === 'hero' ? '[data-fanzine-stage]' : '[data-showcase-stage]');
      return Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height - (stage?.offsetHeight ?? viewport))));
    }
    return Math.max(0, Math.min(1, (viewport - rect.top) / (viewport + rect.height)));
  }
  function render() {
    frame = 0;
    if (!eligible() || !timeline) return;
    timeline.progress(progress());
  }
  function schedule() { if (!frame && eligible()) frame = requestAnimationFrame(render); }
  function removeNative() {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function installNative(p?: number) {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    if (p === undefined) render(); else timeline?.progress(p);
    node.dataset.motionEngine = 'native';
  }
  function removeIdle() {
    clearTimeout(idle);
    idle = 0;
    window.removeEventListener('scroll', resetIdle);
  }
  function resetIdle() { clearTimeout(idle); idle = window.setTimeout(handoff, 500); }
  function handoff() {
    removeIdle();
    if (!trigger) return;
    const p = timeline?.progress() ?? trigger.progress;
    trigger.kill();
    owned.delete(trigger);
    trigger = undefined;
    retired = true;
    ctx?.revert(); ctx = undefined; timeline = undefined;
    retireGlobal();
    if (!eligible()) return;
    build(); installNative(p);
  }
  function stop() {
    version++;
    running = false;
    removeNative(); removeIdle();
    if (trigger) { trigger.kill(); owned.delete(trigger); trigger = undefined; retired = true; }
    intro?.revert(); ctx?.revert();
    intro = ctx = undefined; timeline = undefined;
    if(scene==='hero'){
      const copy=node.querySelector<HTMLElement>('[data-fanzine-copy]');
      if(copy){copy.inert=false;copy.removeAttribute('aria-hidden');}
    }
    retireGlobal();
    node.dataset.motionActive = 'false';
    node.dataset.motionEngine = 'static';
  }
  function indicators() {
    if (!timeline) return;
    const p = timeline.progress();
    node.dataset.scrollProgress = String(Math.round(p * 100));
    if(scene==='hero'){
      const copy=node.querySelector<HTMLElement>('[data-fanzine-copy]');
      if(copy){copy.inert=p>=.6; if(p>=.6)copy.setAttribute('aria-hidden','true');else copy.removeAttribute('aria-hidden');}
    }
    const counter = node.querySelector<HTMLElement>('[data-fanzine-count]');
    if (counter) {
      const total = Math.max(1, Number(node.dataset.fanzineTotal || 4));
      const current = Math.min(total, Math.floor(p * total) + 1);
      counter.textContent = String(current).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
      if (scene === 'showcase') showPanel(current - 1);
    }
  }
  function build() {
    if (!engine) return;
    ctx = engine.context(() => {
      timeline = engine!.timeline({ paused: true, onUpdate: indicators, defaults: { duration: 1, ease: 'none', force3D: false } });
      if (scene === 'hero') {

        const letters = node.querySelectorAll('[data-hero-letter]');
        const backdrops = node.querySelectorAll('[data-hero-background]');
        const mural = node.querySelector('[data-hero-mural]');
        const muralArt = node.querySelector('[data-hero-mural-art]');
        const thread = node.querySelector('[data-hero-thread]');
        const copy = node.querySelector('[data-fanzine-copy]');
        const wires = node.querySelectorAll('[data-mural-wire]');
        const tags = node.querySelectorAll('[data-mural-tag]');
        timeline.to({clock:0},{clock:1,duration:1},0);
        // Separate owners: copy exits, individual letters scatter, artwork floats.
        if(copy)timeline.fromTo(copy,{xPercent:0,autoAlpha:1,skewX:0},{xPercent:-45,autoAlpha:0,skewX:-8,duration:.24,ease:'power3.in'},.02);
        if (letters.length) timeline.fromTo(letters, { x: 0, y: 0, rotation: 0, autoAlpha: 1 }, {
          x: (i: number) => (i % 2 ? 1 : -1) * (desktop.matches ? 45 : 8),
          y: (i: number) => (i % 2 ? -1 : 1) * (desktop.matches ? 160 : 45),
          rotation: (i: number) => (i % 2 ? -1 : 1) * (desktop.matches ? 18 : 6),
          autoAlpha: 0, duration: .22, stagger:.009, ease: 'power2.in'
        }, 0);
        if (backdrops.length) timeline.fromTo(backdrops, { y: 0, x: 0, rotation: 0 }, {
          y: (i: number) => (i % 2 ? 1 : -1) * (desktop.matches ? 80 : 16),
          x: (i: number) => (i % 2 ? -1 : 1) * (desktop.matches ? 28 : 5),
          rotation: (i: number) => (i % 2 ? -1 : 1) * (desktop.matches ? 14 : 4)
        }, 0);
        if (thread) timeline.fromTo(thread,{drawSVG:'0%'},{drawSVG:'100%',duration:.5,ease:'none'},.08);
        // Matching units at all vertices prevents discrete string interpolation.
        if (mural) timeline.fromTo(mural,{clipPath:'polygon(100% 0%,100% 0%,140% 100%,140% 100%)'},{clipPath:'polygon(0% 0%,100% 0%,100% 100%,0% 100%)',duration:.48,ease:'none'},.12);
        if (muralArt) timeline.fromTo(muralArt,{scale:1.14},{scale:1,duration:.55,ease:'power2.out'},.12);
        if(wires.length)timeline.fromTo(wires,{drawSVG:'0%'},{drawSVG:'100%',duration:.48,stagger:.05,ease:'none'},.28);
        if(tags.length)timeline.fromTo(tags,{autoAlpha:0,y:12},{autoAlpha:1,y:0,duration:.1,stagger:.07,ease:'power3.out'},.4);
        // Keep the mural filling the sticky slot. Native flow hands the viewport to coral.
      } else if (scene === 'showcase') {
        const wipes = [...node.querySelectorAll<HTMLElement>('[data-showcase-wipe]')];
        const covers = node.querySelectorAll('[data-showcase-cover]');
        const objects = node.querySelectorAll('[data-showcase-object]');
        const ink = node.querySelectorAll('[data-showcase-ink]');
        const exit = node.querySelector('[data-showcase-exit]');
        const exitStars = node.querySelectorAll('[data-showcase-exit-star]');
        // A one-unit clock keeps the four chapter positions invariant. Only
        // background papers wipe; music titles and CTAs keep their position.
        timeline.to({ clock: 0 }, { clock: 1, duration: 1 }, 0);
        const portal=node.querySelector('.showcase-wipes');
        if(portal) timeline.fromTo(portal,{clipPath:'circle(8% at 70% 50%)'},{clipPath:'circle(110% at 70% 50%)',duration:.1,ease:'power2.out'},0);
        if (wipes.length) {
          // CSS begins later papers below the stage. Reset the pixel component
          // on every build/handoff; otherwise its cached matrix can add a full
          // stage-height offset to yPercent and expose only a narrow color edge.
          engine!.set(wipes, { y: 0 });
          engine!.set(wipes[0], { y: 0, yPercent: 0 });
          wipes.slice(1).forEach((wipe, i) => timeline!.fromTo(wipe, { y: 0, yPercent: 100, rotation: 3, scale: 1.06 }, { y: 0, yPercent: 0, rotation: 0, scale: 1.06, duration: .12, ease: 'power2.inOut' }, (i + 1) / wipes.length - .06));
        }
        if (covers.length) covers.forEach((cover,i)=>timeline!.fromTo(cover,{y:50,rotation:i%2?-6:5},{y:0,rotation:i%2?2:-2,duration:.1,ease:'back.out(1.3)'},Math.max(0,i/covers.length-.04)));
        const vinyl = node.querySelector('[data-showcase-vinyl]');
        if (vinyl) timeline.fromTo(vinyl,{rotation:0},{rotation:540,duration:1},0);
        const waves=node.querySelectorAll('[data-showcase-wave]');
        if(waves.length) timeline.fromTo(waves,{scaleY:(i:number)=>i%2?.3:1},{scaleY:(i:number)=>i%2?1:.3,duration:.25,repeat:3,yoyo:true,transformOrigin:'center'},0);
        if (objects.length) timeline.fromTo(objects, { y: (i: number) => i % 2 ? -45 : 45, x: 0, rotation: (i: number) => i % 2 ? -12 : 10 }, { y: (i: number) => i % 2 ? 80 : -90, x: (i: number) => i % 2 ? -35 : 35, rotation: (i: number) => i % 2 ? 20 : -22 }, 0);
        if (ink.length) timeline.fromTo(ink, { y: 50, scale: .65, opacity: .25 }, { y: -35, scale: 1.2, opacity: .7, duration: .8 }, 0);
        if (exit) timeline.fromTo(exit, { y: 0, yPercent: 115, rotation: -3 }, { y: 0, yPercent: 0, rotation: 0, duration: .1, ease: 'power2.inOut' }, .9);
        if (exitStars.length) timeline.fromTo(exitStars, { y: 85, scale: .05, rotation: -25, opacity: 0 }, { y: 0, scale: 1, rotation: 8, opacity: 1, duration: .1, ease: 'power2.out' }, .9);
        const rail = node.querySelector('[data-fanzine-color]');
        if (rail) timeline.fromTo(rail, { scaleX: 0, backgroundColor: '#c8ff00' }, { scaleX: 1, backgroundColor: '#fa7155' }, 0);
      } else {
        const reveal = node.querySelectorAll('[data-motion-reveal]');
        if (reveal.length) timeline.fromTo(reveal, { y: 18, opacity: .75 }, { y: 0, opacity: 1, duration: .55, stagger: .08, ease: 'power2.out' }, 0);
      }
    }, node);
  }
  async function attach(v: number) {
    if (!engine || !valid(v)) return;
    // /sobre and the other ordinary pages use only finite paused GSAP/native
    // reveals. ScrollTrigger navigation is reserved for the home scenes.
    let candidate = scene !== 'reveal' && desktop.matches && !retired ? await loadPlugin(engine) : undefined;
    if (!valid(v)) { retireGlobal(); return; }
    if (suspended) candidate = undefined;
    build();
    if (candidate && !foreign() && timeline) {
      trigger = candidate.create({
        trigger: node, animation: timeline,
        start: scene === 'hero' || scene === 'showcase' ? 'top top' : 'top bottom',
        end: scene === 'hero' || scene === 'showcase' ? () => `+=${Math.max(1, node.offsetHeight - (node.querySelector<HTMLElement>(scene === 'hero' ? '[data-fanzine-stage]' : '[data-showcase-stage]')?.offsetHeight ?? innerHeight))}` : 'bottom top',
        scrub: true, invalidateOnRefresh: true
      });
      owned.add(trigger); trigger.refresh(); trigger.update();
      node.dataset.motionEngine = 'scrolltrigger';
      window.addEventListener('scroll', resetIdle, { passive: true }); resetIdle();
    } else { installNative(); retireGlobal(); }
    node.dataset.motionActive = 'true';
  }
  function finishIntro(v = version) {
    intro?.revert(); intro = undefined;
    node.dispatchEvent(new Event('fanzine-motion:introduced'));
    if (valid(v)) void attach(v).catch(stop);
  }
  function skip() { if (intro) finishIntro(); }
  async function start() {
    running = true;
    const v = ++version;
    try {
      const [{gsap},{DrawSVGPlugin}] = await Promise.all([import('gsap'),import('gsap/DrawSVGPlugin')]);
      engine = gsap; engine.registerPlugin(DrawSVGPlugin);
      if (!valid(v)) return;
      if (introduced || !introTargets.length) { void attach(v).catch(stop); return; }
      introduced = true;
      intro = engine.context(() => {
        engine!.set(introTargets, { autoAlpha: 1 });
        engine!.timeline({ onComplete: () => finishIntro(v) }).fromTo(introTargets,
          { y: desktop.matches ? 22 : 12, opacity: .7 },
          { y: 0, opacity: 1, duration: .65, stagger: .07, ease: 'power3.out', force3D: false });
      }, node);
    } catch {
      if (v === version) {
        stop();
        motionFailed = true;
        configureShowcase();
      }
    }
  }
  function reconcile() {
    const changed = wasDesktop !== desktop.matches;
    wasDesktop = desktop.matches;
    configureShowcase();
    node.dataset.motion = reduced.matches || connection?.saveData || (scene === 'hero' && !desktop.matches) ? 'static' : 'enhanced';
    if (changed || !eligible()) stop();
    if (eligible() && !running) void start();
  }
  const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; reconcile(); }, { threshold: 0 });
  configureShowcase();
  observer.observe(node);
  desktop.addEventListener('change', reconcile);
  reduced.addEventListener('change', reconcile);
  connection?.addEventListener('change', reconcile);
  document.addEventListener('visibilitychange', reconcile);
  window.addEventListener('ikari:scene-ready', reconcile);
  node.addEventListener('fanzine-motion:finish', skip);
  return { destroy() {
    disposed = true; stop(); observer.disconnect();
    if (scene === 'showcase') {
      node.removeEventListener('click', chapterClick); node.removeEventListener('touchstart', touchStart); node.removeEventListener('touchend', touchEnd);
      delete node.dataset.showcaseEnhanced; delete node.dataset.showcaseActive;
      panels.forEach((panel,i) => { panel.inert=false; panel.removeAttribute('aria-hidden'); panel.style.removeProperty('visibility'); panel.style.removeProperty('opacity'); panel.id=anchors[i]?.dataset.showcaseAnchor || `faixa${i+1}`; anchors[i]?.removeAttribute('id'); });
    }
    desktop.removeEventListener('change', reconcile);
    reduced.removeEventListener('change', reconcile);
    connection?.removeEventListener('change', reconcile);
    document.removeEventListener('visibilitychange', reconcile);
    window.removeEventListener('ikari:scene-ready', reconcile);
    node.removeEventListener('fanzine-motion:finish', skip);
  } };
}
