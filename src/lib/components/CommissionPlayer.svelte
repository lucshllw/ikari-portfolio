<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { beforeNavigate } from '$app/navigation';
  import Icon from './Icon.svelte';

  export let src: string;
  export let poster: string;
  export let title: string;
  export let credit = '';
  export let sourceUrl = '';

  type InlineVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };
  let host: HTMLElement;
  let stage: HTMLDivElement;
  let video: InlineVideo;
  let enhanced = false;
  let requested = false;
  let playing = false;
  let loading = false;
  let hasFrame = false;
  let muted = false;
  let volume = 1;
  let currentTime = 0;
  let duration = 0;
  let error = '';
  let notice = '';
  let fullscreen = false;
  let fullscreenAvailable = false;
  let visible = true;
  let disposed = false;
  let requestVersion = 0;
  let previousSource = src;

  $: if (src !== previousSource) {
    pause();
    previousSource = src;
    requested = false;
    hasFrame = false;
    error = '';
    notice = '';
    currentTime = duration = 0;
  }

  function formatTime(value: number) {
    const seconds = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours ? `${hours}:` : ''}${hours ? String(minutes).padStart(2, '0') : minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function pause() {
    requestVersion++;
    video?.pause();
    playing = false;
    loading = false;
  }

  async function togglePlayback() {
    if (!enhanced || !video || !src) return;
    if (playing || loading) { pause(); return; }
    const version = ++requestVersion;
    error = '';
    loading = true;
    if (!requested) {
      requested = true;
      await tick();
      if (disposed || version !== requestVersion) return;
      video.load();
    } else if (video.error) {
      video.load();
    }
    try {
      await video.play();
      if (disposed || version !== requestVersion || !visible || document.hidden) video.pause();
    } catch (cause) {
      if (disposed || version !== requestVersion) return;
      const name = cause instanceof Error ? cause.name : '';
      if (name !== 'AbortError' && !video.error) {
        error = name === 'NotAllowedError'
          ? 'O navegador bloqueou a reprodução. Tente novamente ou abra o trecho.'
          : 'Não foi possível reproduzir este trecho. Tente novamente ou abra a fonte.';
      }
    } finally {
      if (!disposed && version === requestVersion) loading = false;
    }
  }

  function updateTime() {
    if (!video) return;
    currentTime = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    duration = Number.isFinite(video.duration) ? video.duration : 0;
  }

  function seek(event: Event) {
    if (!video || !duration) return;
    video.currentTime = Math.min(duration, Math.max(0, Number((event.target as HTMLInputElement).value)));
    updateTime();
  }

  function setVolume(event: Event) {
    if (!video) return;
    volume = Number((event.target as HTMLInputElement).value);
    video.volume = volume;
    video.muted = volume === 0;
    muted = video.muted;
  }

  function toggleMute() {
    if (!video) return;
    if (muted && video.volume === 0) video.volume = volume = 1;
    video.muted = !video.muted;
    muted = video.muted;
  }

  function updateVolume() {
    volume = video.volume;
    muted = video.muted;
  }

  function playbackStarted() {
    if (!visible || document.hidden) { pause(); return; }
    playing = true;
  }

  function mediaError() {
    pause();
    hasFrame = false;
    error = 'Este trecho está indisponível no player. Você pode tentar novamente ou consultar a fonte.';
  }

  async function toggleFullscreen() {
    if (!host || !video) return;
    try {
      if (document.fullscreenElement === host) await document.exitFullscreen();
      else if (typeof host.requestFullscreen === 'function') await host.requestFullscreen();
      else video.webkitEnterFullscreen?.();
    } catch {
      notice = 'A tela cheia não está disponível neste navegador.';
    }
  }

  beforeNavigate(() => pause());

  onMount(() => {
    enhanced = true;
    fullscreenAvailable = Boolean(document.fullscreenEnabled || video.webkitEnterFullscreen);
    const visibilityChanged = () => { if (document.hidden) pause(); };
    const fullscreenChanged = () => { fullscreen = document.fullscreenElement === host; };
    const inlineFullscreenStarted = () => { fullscreen = true; };
    const inlineFullscreenEnded = () => { fullscreen = false; };
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (!visible) pause();
    }, { threshold: 0 }) : null;
    observer?.observe(stage);
    document.addEventListener('visibilitychange', visibilityChanged);
    document.addEventListener('fullscreenchange', fullscreenChanged);
    video.addEventListener('webkitbeginfullscreen', inlineFullscreenStarted);
    video.addEventListener('webkitendfullscreen', inlineFullscreenEnded);
    return () => {
      disposed = true;
      pause();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibilityChanged);
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      video.removeEventListener('webkitbeginfullscreen', inlineFullscreenStarted);
      video.removeEventListener('webkitendfullscreen', inlineFullscreenEnded);
      video.removeAttribute('src');
      video.load();
    };
  });
</script>

<figure bind:this={host} class="commission-player" data-commission-player aria-label={`Trecho de ${title}`}>
  <div bind:this={stage} class="stage" data-player-stage>
    <!-- svelte-ignore a11y_media_has_caption (A fonte fornece o trecho audiovisual; não há transcrição autorizada para criar legendas.) -->
    <video bind:this={video} data-player-video src={requested ? src : undefined} {poster}
      preload={requested ? 'metadata' : 'none'} playsinline aria-label={`Trecho de ${title}`}
      onplay={playbackStarted} onplaying={() => { loading = false; }}
      onpause={() => { playing = false; }} onended={() => { playing = false; loading = false; updateTime(); }}
      onwaiting={() => { if (playing) loading = true; }} oncanplay={() => { loading = false; }}
      onloadeddata={() => { hasFrame = true; }} onloadedmetadata={updateTime}
      ondurationchange={updateTime} ontimeupdate={updateTime} onvolumechange={updateVolume} onerror={mediaError}>
      Seu navegador não suporta reprodução de MP4.
    </video>
    {#if !hasFrame || error}
      <img class="poster" src={poster} alt={`Prévia do trecho de ${title}`} width="1200" height="675" decoding="async" />
    {/if}
    {#if !playing && !loading && !error}
      <button class="start" type="button" disabled={!enhanced || !src} onclick={togglePlayback} aria-label={`Reproduzir trecho de ${title}`}>
        <span aria-hidden="true">▶</span><span>Assistir trecho</span>
      </button>
    {/if}
    {#if loading}<div class="loading" role="status">Carregando trecho…</div>{/if}
  </div>
  {#if error}
    <div class="error" role="status"><p>{error}</p><button type="button" onclick={togglePlayback}>Tentar novamente</button><a href={sourceUrl || src} target="_blank" rel="noopener noreferrer">{sourceUrl ? 'Consultar publicação original' : 'Abrir trecho MP4'}</a></div>
  {/if}
  <div class="controls" role="group" aria-label={`Controles do trecho de ${title}`}>
    <div class="timeline">
      <input type="range" class="seek" aria-label="Posição do trecho" aria-valuetext={`${formatTime(currentTime)} de ${formatTime(duration)}`}
        min="0" max={duration || 1} step="0.1" value={currentTime} disabled={!enhanced || !duration} oninput={seek} />
      <span class="time" aria-hidden="true">{formatTime(currentTime)} / {formatTime(duration)}</span>
    </div>
    <div class="buttons">
      <button class="play" type="button" disabled={!enhanced || !src} onclick={togglePlayback} aria-label={playing || loading ? 'Pausar trecho' : 'Reproduzir trecho'}>{playing || loading ? 'Pausar' : 'Reproduzir'}</button>
      <div class="sound">
        <button type="button" disabled={!enhanced} onclick={toggleMute} aria-label={muted ? 'Ativar som' : 'Silenciar trecho'} aria-pressed={muted}>{muted ? 'Sem som' : 'Som'}</button>
        <input type="range" class="volume" aria-label="Volume" min="0" max="1" step="0.05" value={muted ? 0 : volume} disabled={!enhanced} oninput={setVolume} />
      </div>
      {#if fullscreenAvailable}<button class="fullscreen" type="button" onclick={toggleFullscreen} aria-label={fullscreen ? 'Sair da tela cheia' : 'Abrir tela cheia'}>{fullscreen ? 'Sair' : 'Tela cheia'}</button>{/if}
    </div>
  </div>
  {#if notice}<p class="notice" role="status">{notice}</p>{/if}
  <figcaption><div><span class="label">Trecho publicado</span>{#if credit}<span class="credit">{credit}</span>{/if}</div><a href={src} target="_blank" rel="noopener noreferrer">Abrir trecho MP4 <Icon name="diagonal" size={18}/></a></figcaption>
</figure>

<style>
  .commission-player { margin: 0; overflow: hidden; background: #191b18; color: #f2f0e6; border: 1px solid #f2f0e629; border-radius: 16px; font-size: 14px; }
  .stage { position: relative; aspect-ratio: 16 / 9; background: #111310; }
  video, .poster { display: block; width: 100%; height: 100%; object-fit: contain; }
  .poster { position: absolute; inset: 0; pointer-events: none; }
  button, a, input { touch-action: manipulation; }
  button { min-height: 44px; min-width: 44px; padding: 0 12px; border: 1px solid #f2f0e638; border-radius: 8px; background: transparent; color: inherit; font: inherit; font-weight: 600; cursor: pointer; }
  button:hover { background: #f2f0e617; }
  button:disabled, input:disabled { opacity: .45; cursor: default; }
  button:focus-visible, a:focus-visible, input:focus-visible { outline: 3px solid #c9fa67; outline-offset: 3px; }
  .start { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 0 20px; border-color: #c9fa67; background: #c9fa67; color: #171a14; white-space: nowrap; }
  .start:hover { background: #d8ff8c; }
  .start > span:first-child { font-size: 18px; }
  .loading { position: absolute; inset: auto 16px 16px; width: fit-content; border-radius: 8px; padding: 12px 16px; background: #111310eb; }
  .error { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 12px; padding: 20px; background: #111310; text-align: center; }
  .error p { width: 100%; max-width: 520px; margin: 0; line-height: 1.5; }
  .error a { padding: 12px; }
  .notice { margin: 0; padding: 12px 16px; font-size: 14px; }
  .controls { position: relative; padding: 8px 16px 16px; background: #191b18; }
  .timeline { display: flex; align-items: center; gap: 16px; }
  input[type="range"] { margin: 0; accent-color: #c9fa67; cursor: pointer; height: 44px; min-width: 0; }
  .seek { width: 100%; flex: 1; }
  .time { font-variant-numeric: tabular-nums; white-space: nowrap; font-size: 14px; }
  .buttons { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .play { color: #c9fa67; border-color: #c9fa6770; min-width: 104px; }
  .sound { display: flex; align-items: center; gap: 8px; }
  .volume { width: 88px; }
  .fullscreen { margin-left: auto; }
  figcaption { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 20px; padding: 12px 16px; border-top: 1px solid #f2f0e629; background: #151713; }
  figcaption > div { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .label { font-size: 14px; font-weight: 600; }
  .credit { font-size: 12px; line-height: 1.5; color: #f2f0e6bd; overflow-wrap: anywhere; }
  a { color: #c9fa67; text-underline-offset: 4px; font-size: 14px; }
  figcaption a { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }
  .commission-player:fullscreen { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; border: 0; border-radius: 0; background: #111310; }
  .commission-player:fullscreen .stage { flex: 1; min-height: 0; aspect-ratio: auto; }
  @media (max-width: 768px) {
    .controls { padding: 4px 12px 12px; }
    .timeline { gap: 10px; }
    .buttons { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; align-items:start; }
    .buttons button { width:100%; min-width:0; padding-inline:6px; white-space:nowrap; font-size:13px; }
    .play { grid-column:1; }
    .sound { display: grid; grid-template-columns:minmax(0,1fr); gap:0; min-width:0; grid-column:2; }
    .volume { width:100%; max-width:100%; }
    .fullscreen { margin: 0; grid-column:3; }
    .error { padding: 12px; gap: 6px; }
    .error p { font-size: 14px; }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { transition: none; animation: none; }
  }
</style>
