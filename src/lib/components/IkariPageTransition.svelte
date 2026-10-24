<script lang="ts">
  import { beforeNavigate, onNavigate } from '$app/navigation';
  import { onMount, onDestroy, tick } from 'svelte';
  let surface: HTMLDivElement;
  let label = 'Início', accent = '#b8ff01';
  let active = false, initial = true, disposed = false, generation = 0;
  let watchdog: ReturnType<typeof setTimeout>;
  let animation: Animation | undefined;
  const shellControls = '.v04-nav,.v04-footer,.studio-nav,.studio-finale,.hud-index,.v04-skip';
  let cover: Promise<void> = Promise.resolve();
  const full = 'polygon(0 0,100% 0,100% 100%,0 100%)';
  const closed = 'polygon(0 0,100% 0,100% 0,0 0)';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function destination(path: string) {
    label = path.startsWith('/admin') || path === '/estudio' ? 'Estúdio' : path === '/' ? 'Início' : path === '/sobre' ? 'Sobre' : path === '/contato' ? 'Produção' : path === '/links' ? 'Conexões' : path.startsWith('/trabalhos/') ? 'Em cena' : 'Índice';
    accent = path === '/contato' ? '#49d8cd' : path === '/sobre' ? '#f8f3e8' : path.startsWith('/trabalhos/') ? '#fa7155' : '#b8ff01';
  }
  function release() {
    clearTimeout(watchdog); animation?.cancel(); animation = undefined; active = false;
    delete document.documentElement.dataset.ikariTransition;
    const main = document.getElementById('conteudo');
    if (main) { main.inert = false; main.removeAttribute('aria-busy'); }
    document.querySelectorAll<HTMLElement>(shellControls).forEach(node => node.inert = false);
    window.dispatchEvent(new Event('ikari:scene-ready'));
  }
  function hold() {
    document.documentElement.dataset.ikariTransition = 'active';
    window.dispatchEvent(new Event('ikari:scene-cover'));
    const main = document.getElementById('conteudo');
    if (main) { main.inert = true; main.setAttribute('aria-busy', 'true'); }
    document.querySelectorAll<HTMLElement>(shellControls).forEach(node => node.inert = true);
    clearTimeout(watchdog);
    watchdog = setTimeout(() => { ++generation; release(); }, 2200);
  }
  async function animate(frames: Keyframe[], duration: number) {
    animation?.cancel();
    try {
      animation = surface.animate(frames, { duration, easing: 'cubic-bezier(.87,0,.13,1)', fill: 'forwards' });
      await animation.finished;
    } catch { /* animation failure must not block SvelteKit navigation */ }
  }
  async function reveal(version: number) {
    await tick();
    if (disposed || version !== generation || !active) return;
    window.dispatchEvent(new Event('ikari:scene-prepare'));
    await animate([{ clipPath: full }, { clipPath: 'polygon(0 -25%,100% -25%,100% -25%,0 0)' }], reduced() ? 80 : 430);
    if (disposed || version !== generation) return;
    release();
    if (document.activeElement?.closest('.chapter-opening') || (!initial && document.activeElement === document.body)) {
      const anchor = location.hash ? document.getElementById(location.hash.slice(1)) : null;
      (anchor?.querySelector<HTMLElement>('a') || document.getElementById('conteudo'))?.focus({ preventScroll: true });
    }
  }
  function skip() { ++generation; release(); document.getElementById('conteudo')?.focus({ preventScroll: true }); }
  beforeNavigate(({ from, to, willUnload }) => {
    if (willUnload || !to || from?.url.pathname === to.url.pathname) return;
    const version = ++generation;
    initial = false; destination(to.url.pathname); active = true; hold();
    cover = tick().then(async () => {
      if (disposed || version !== generation) return;
      await animate([{ clipPath: closed }, { clipPath: full }], reduced() ? 50 : 220);
    });
  });
  onNavigate(({ from, to }) => {
    if (!to || from?.url.pathname === to.url.pathname) return;
    const version = generation;
    return cover.then(() => () => { void reveal(version); });
  });
  onMount(() => {
    const version = ++generation;
    destination(location.pathname); active = true; hold();
    void tick().then(async () => {
      if (disposed || version !== generation) return;
      await animate([{ clipPath: full, opacity: 1 }, { clipPath: full, opacity: 1 }], reduced() ? 40 : 780);
      if (version === generation) void reveal(version);
    });
  });
  onDestroy(() => { disposed = true; ++generation; if (typeof document !== 'undefined') release(); });
</script>
<div bind:this={surface} class="chapter-opening" class:active class:initial style={`--destination:${accent}`} aria-hidden={!active}>
  <div class="film-sprockets" aria-hidden="true"></div>
  <div class="opening-frame" aria-hidden="true"><span>IKARI / ANIMAÇÃO 2D</span><span>24 FRAMES</span></div>
  <div class="clap-signature" aria-hidden="true">IKARI<span class="opening-thread"></span></div>
  <div class="opening-poses" aria-hidden="true"><img src="/ikari/avatar.webp" alt=""/><img src="/ikari/hero-aya-small-v09.webp" alt=""/><img src="/ikari/banner-mural-small-v09.webp" alt=""/></div>
  <p class="opening-destination" role="status">{label}</p>
  <button class="opening-skip" tabindex={active ? 0 : -1} onclick={skip}>Pular abertura</button>
</div>
<style>
.film-sprockets{position:absolute;inset:0;pointer-events:none;border-inline:17px solid #0a0b0d}.film-sprockets:before,.film-sprockets:after{content:'';position:absolute;top:0;bottom:0;width:8px;background:repeating-linear-gradient(to bottom,transparent 0 12px,#f3efe6 12px 23px,transparent 23px 36px)}.film-sprockets:before{left:-13px}.film-sprockets:after{right:-13px}

.chapter-opening{display:none;position:fixed;inset:0;z-index:120;background:#101d30;color:#f8f3e8;overflow:hidden;isolation:isolate}.chapter-opening.active{display:grid;place-content:center;pointer-events:auto}.opening-frame{position:absolute;inset:26px;border:1px solid #f8f3e840;display:flex;justify-content:space-between;padding:18px;font:13px var(--mono)}.opening-frame:before,.opening-frame:after{content:'';position:absolute;width:30px;height:30px;border:3px solid var(--destination)}.opening-frame:before{left:-2px;top:-2px;border-right:0;border-bottom:0}.opening-frame:after{bottom:-2px;right:-2px;border-left:0;border-top:0}.clap-signature{position:relative;font:400 clamp(90px,23vw,280px)/1 'Anton',sans-serif;letter-spacing:-.02em}.opening-thread{position:absolute;left:-35vw;right:-35vw;top:52%;height:5px;background:#e62e2d;transform:rotate(-12deg);transform-origin:left}.active .opening-thread{animation:thread .45s ease-out both}.opening-destination{justify-self:start;margin-top:25px;padding:9px 22px;color:#101d30;background:var(--destination);font:700 clamp(18px,3vw,28px) var(--display);transform:rotate(-3deg)}.opening-skip{position:absolute;right:46px;bottom:46px;background:transparent;border:1px solid #f8f3e8;color:#f8f3e8;min-height:44px;padding:10px 18px}.opening-poses{position:absolute;right:18%;top:30%;width:100px;aspect-ratio:1;transform:rotate(8deg)}.opening-poses img{position:absolute;width:100%;height:100%;object-fit:cover;border:5px solid #f8f3e8;opacity:0}.active.initial .opening-poses img{animation:pose .25s steps(1) both}.opening-poses img:nth-child(2){animation-delay:.25s!important}.opening-poses img:nth-child(3){animation-delay:.5s!important}@keyframes pose{0%,99%{opacity:1}100%{opacity:0}}@keyframes thread{from{scale:0 1}to{scale:1 1}}@media(max-width:760px){.opening-frame{inset:12px;padding:12px;font-size:11px}.opening-poses{right:12%;top:23%;width:75px}.opening-skip{bottom:28px;right:28px}}@media(prefers-reduced-motion:reduce){.opening-thread,.opening-poses img{animation:none!important}.opening-poses{display:none}}
</style>
