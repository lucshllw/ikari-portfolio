type Engine = typeof import('gsap').gsap;
type TriggerPlugin = typeof import('gsap/ScrollTrigger').ScrollTrigger;
type OwnedTrigger = InstanceType<TriggerPlugin>;
type Connection = EventTarget & { saveData?: boolean };

// The current application has no other ScrollTrigger consumers. Never assume
// ownership of a plugin registered before this module, or of foreign triggers.
let plugin: TriggerPlugin | undefined;
let pluginLoad: Promise<TriggerPlugin | undefined> | undefined;
let exclusive = false;
let suspended = false;
const ownedTriggers = new Set<OwnedTrigger>();

function foreignConsumers() {
  if (!plugin) return false;
  const foreign = plugin.getAll().some((trigger) => !ownedTriggers.has(trigger)) || !!plugin.normalizeScroll();
  if (foreign) exclusive = false; // Ownership is never reclaimed from another consumer.
  return foreign;
}

function sleepPlugin() {
  if (plugin && exclusive && !foreignConsumers() && plugin.getAll().length === 0 && !suspended) {
    plugin.disable(false, false);
    suspended = true;
  }
}

function loadOwnedPlugin(engine: Engine) {
  // ScrollTrigger 3.15 enable() accumulates internal matchMedia callbacks.
  // Retire our initial registration instead of cycling global enable().
  if (suspended) return Promise.resolve(undefined);
  if (!pluginLoad) {
    const globals = (engine.core as typeof engine.core & { globals(): Record<string, unknown> }).globals();
    const browserPlugin = (window as Window & { ScrollTrigger?: unknown }).ScrollTrigger;
    if (globals.ScrollTrigger || browserPlugin) {
      // A pre-existing plugin may have observers or other consumers that do not
      // appear in getAll(). A paused timeline is safer than global disable().
      pluginLoad = Promise.resolve(undefined);
    } else {
      pluginLoad = import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        engine.registerPlugin(ScrollTrigger);
        plugin = ScrollTrigger;
        exclusive = !foreignConsumers();
        if (!exclusive) return undefined;
        // This desktop-only action doesn't need global config. In GSAP 3.15,
        // config() without syncInterval clears its stored interval handle;
        // disable() could then leave the 250 ms sync callback alive.
        return ScrollTrigger;
      }).catch(() => undefined);
    }
  }
  return pluginLoad;
}

/**
 * Progressive enhancement for a section containing [data-scene-panel] and
 * normalized SVG [data-editorial-line] paths (pathLength="1"). SSR is visible.
 * Optional skip button: node.dispatchEvent(new Event('editorial-motion:finish')).
 */
export function editorialMotion(node: HTMLElement) {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return { destroy() {} };

  const panels = [...node.querySelectorAll<HTMLElement>('[data-scene-panel]')];
  const lines = [...node.querySelectorAll<SVGElement>('[data-editorial-line]')];
  if (!panels.length && !lines.length) return { destroy() {} };

  const desktop = matchMedia('(min-width: 1024px) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const connection = (navigator as Navigator & { connection?: Connection }).connection;
  let engine: Engine | undefined;
  let introContext: ReturnType<Engine['context']> | undefined;
  let scrollContext: ReturnType<Engine['context']> | undefined;
  let scrollTimeline: ReturnType<Engine['timeline']> | undefined;
  let trigger: OwnedTrigger | undefined;
  let retiredPlugin = false;
  let visible = false;
  let destroyed = false;
  let introPlayed = false;
  let running = false;
  let currentDesktop = desktop.matches;
  let generation = 0;
  let frame = 0;
  let idleTimer = 0;

  const eligible = () => !destroyed && visible && !document.hidden && !reduced.matches && !connection?.saveData;
  const valid = (version: number) => eligible() && version === generation;
  const direction = (index: number) => index % 2 === 0 ? 1 : -1;

  function removeFallback() {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function removeIdleRetirement() {
    window.clearTimeout(idleTimer);
    idleTimer = 0;
    window.removeEventListener('scroll', resetIdleRetirement);
  }

  function resetIdleRetirement() {
    if (!trigger) return;
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(retireIdlePlugin, 500);
  }

  function installFallback(progress?: number) {
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    // Keep the exact rendered progress at handoff. The next native event uses
    // section geometry again; no neutral frame is painted between contexts.
    if (progress === undefined) updateFallback();
    else scrollTimeline?.progress(progress);
  }

  function retireIdlePlugin() {
    removeIdleRetirement();
    if (!trigger) return;
    const progress = scrollTimeline?.progress() ?? trigger.progress;
    retiredPlugin = true;
    trigger.kill();
    ownedTriggers.delete(trigger);
    trigger = undefined;
    scrollContext?.revert();
    scrollContext = undefined;
    scrollTimeline = undefined;
    sleepPlugin();
    if (!eligible() || !desktop.matches) return;
    try {
      buildTimeline();
      installFallback(progress);
    } catch { stop(); }
  }

  function stop() {
    generation++;
    retiredPlugin ||= running;
    running = false;
    removeIdleRetirement();
    removeFallback();
    if (trigger) {
      retiredPlugin = true;
      trigger.kill();
      ownedTriggers.delete(trigger);
      trigger = undefined;
    }
    introContext?.revert();
    scrollContext?.revert();
    introContext = scrollContext = undefined;
    scrollTimeline = undefined;
    sleepPlugin();
  }

  // One frame on native scroll/resize, never a self-rescheduling render loop.
  function updateFallback() {
    frame = 0;
    if (!eligible() || !scrollTimeline) return;
    const bounds = node.getBoundingClientRect();
    const viewport = document.documentElement.clientHeight;
    const progress = Math.max(0, Math.min(1, (viewport - bounds.top) / (viewport + bounds.height)));
    scrollTimeline.progress(progress);
  }

  function schedule() {
    if (!frame && eligible()) frame = requestAnimationFrame(updateFallback);
  }

  function buildTimeline() {
    if (!engine) return;
    scrollContext = engine.context(() => {
      scrollTimeline = engine!.timeline({ paused: true });
      if (panels.length) scrollTimeline.fromTo(panels, {
        y: 0, rotationX: 0, force3D: false
      }, {
        y: (index: number) => direction(index) * 24,
        rotationX: (index: number) => direction(index) * 3,
        duration: 1, ease: 'none', force3D: false
      }, 0);
      if (lines.length) scrollTimeline.fromTo(lines, {
        strokeDasharray: 1, strokeDashoffset: 1
      }, { strokeDashoffset: 0, duration: 1, ease: 'none' }, 0);
    }, node);
  }

  async function attachScroll(version: number) {
    if (!engine || !valid(version) || !desktop.matches) return;
    let ScrollTrigger = retiredPlugin ? undefined : await loadOwnedPlugin(engine);
    if (!valid(version) || !desktop.matches) { sleepPlugin(); return; }
    if (suspended) ScrollTrigger = undefined;

    buildTimeline();
    if (ScrollTrigger && !foreignConsumers() && scrollTimeline) {
      trigger = ScrollTrigger.create({
        trigger: node,
        animation: scrollTimeline,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
        invalidateOnRefresh: true
      });
      ownedTriggers.add(trigger);
      trigger.refresh();
      trigger.update();
      window.addEventListener('scroll', resetIdleRetirement, { passive: true });
      resetIdleRetirement();
    } else {
      installFallback();
      sleepPlugin();
    }
  }

  function completeIntro(version: number) {
    introContext?.revert();
    introContext = undefined;
    if (valid(version)) requestScroll(version);
  }

  function requestScroll(version: number) {
    void attachScroll(version).catch(() => {
      if (version === generation) stop();
    });
  }

  async function start() {
    running = true;
    const version = ++generation;
    try {
      engine = (await import('gsap')).gsap;
      if (!valid(version)) return;
      if (introPlayed || !panels.length) { requestScroll(version); return; }
      introPlayed = true;
      introContext = engine.context(() => {
        engine!.set(panels, { autoAlpha: 1, willChange: 'transform,opacity' });
        engine!.timeline({ onComplete: () => completeIntro(version) }).fromTo(panels, {
          y: desktop.matches ? 30 : 14,
          rotationX: desktop.matches ? 6 : 0,
          rotationZ: desktop.matches ? (index: number) => direction(index) : 0,
          opacity: 0.7,
          force3D: false
        }, {
          y: 0, rotationX: 0, rotationZ: 0, opacity: 1,
          duration: desktop.matches ? 0.9 : 0.55,
          stagger: desktop.matches ? 0.09 : 0.06,
          ease: 'power3.out', force3D: false
        });
      }, node);
    } catch { if (version === generation) stop(); }
  }

  function reconcile() {
    const changed = currentDesktop !== desktop.matches;
    currentDesktop = desktop.matches;
    if (changed || !eligible()) stop();
    if (eligible() && !running) void start();
  }

  function skipIntro() {
    if (!introContext) return;
    introPlayed = true;
    completeIntro(generation);
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    reconcile();
  }, { threshold: 0 });
  observer.observe(node);
  desktop.addEventListener('change', reconcile);
  reduced.addEventListener('change', reconcile);
  connection?.addEventListener('change', reconcile);
  document.addEventListener('visibilitychange', reconcile);
  node.addEventListener('editorial-motion:finish', skipIntro);

  return {
    destroy() {
      destroyed = true;
      stop();
      observer.disconnect();
      desktop.removeEventListener('change', reconcile);
      reduced.removeEventListener('change', reconcile);
      connection?.removeEventListener('change', reconcile);
      document.removeEventListener('visibilitychange', reconcile);
      node.removeEventListener('editorial-motion:finish', skipIntro);
    }
  };
}
