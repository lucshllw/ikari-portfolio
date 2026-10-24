<script lang="ts">
  import { page } from '$app/stores';
  import { afterNavigate } from '$app/navigation';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';

  import IkariFinale from '$lib/components/IkariFinale.svelte';
  import IkariPageTransition from '$lib/components/IkariPageTransition.svelte';
  import '@fontsource-variable/syne/wght.css';
  import '@fontsource-variable/jetbrains-mono/wght.css';
  import '@fontsource-variable/plus-jakarta-sans/wght.css';
  import '@fontsource/anton/latin-400.css';
  import '../../../admin.css';
  import type { LayoutData } from './$types';
  export let data: LayoutData;
  $: ikari = data.settings.brandName.toLowerCase().includes('ikari');
  let menuOpen = false;
  let enhanced = false;
  onMount(() => { enhanced = true; });
  let menuButton: HTMLButtonElement;
  const links = [
    { href: '/admin', name: 'Visão geral', icon: 'grid' },
    { href: '/admin/trabalhos', name: 'Trabalhos', icon: 'film' },
    { href: '/admin/pedidos', name: 'Pedidos', icon: 'message' },
    { href: '/admin/midia', name: 'Biblioteca', icon: 'image' },
    { href: '/admin/categorias', name: 'Categorias', icon: 'layers' },
    { href: '/admin/identidade', name: 'Identidade', icon: 'settings' },
    { href: '/admin/conta', name: 'Conta e acesso', icon: 'settings' }
  ];
  const isActive = (href: string, pathname: string) => href === '/admin' ? pathname === href : pathname.startsWith(href);
  afterNavigate(() => { menuOpen = false; });
  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === 'Escape' && menuOpen) { menuOpen = false; menuButton?.focus(); }
  }
</script>
<svelte:head><meta name="robots" content="noindex,nofollow" />{#if ikari}<meta name="theme-color" content="#0e1013"/><link rel="icon" href="/ikari/favicon-v07.png"/>{/if}</svelte:head>
{#if ikari}<IkariPageTransition/>{/if}
<svelte:window onkeydown={closeOnEscape} />
{#if ['/admin/entrar','/admin/recuperar','/admin/redefinir'].includes($page.url.pathname)}
  <slot />
{:else}
  <a class="skip-link" href="#painel">Ir para o painel</a>
  <div class="admin-shell" class:admin-enhanced={enhanced} class:studio-os={ikari}>
    <aside class="admin-sidebar">
      <div class="sidebar-brand">
        <a href="/admin" class="wordmark" aria-label={`${data.settings.brandName} — visão geral`}>{data.settings.brandName}<span class="admin-brand-cut" aria-hidden="true"></span></a>
        <button class="admin-menu-toggle" bind:this={menuButton} aria-expanded={menuOpen} aria-controls="admin-navigation" onclick={() => { menuOpen = !menuOpen; }}><Icon name={menuOpen ? 'close' : 'grid'} size={18} />{menuOpen ? 'Fechar' : 'Menu'}</button>
      </div>
      <div class="workspace"><strong>{data.settings.brandName}</strong><span>{ikari ? 'STUDIO OS / 24 FPS' : 'Seu espaço editorial'}</span></div>
      <div id="admin-navigation" class="admin-navigation" class:is-open={menuOpen}>
        <nav aria-label="Painel do editor">
          {#each links.filter(link => !ikari || !['/admin/conta','/admin/identidade'].includes(link.href)) as link}
            <a href={link.href} class:active={isActive(link.href, $page.url.pathname)} aria-current={isActive(link.href, $page.url.pathname) ? 'page' : undefined}><Icon name={link.icon} size={18} /><span>{link.name}</span></a>
          {/each}
        </nav>
        <div class="sidebar-bottom">
          {#if data.cloud && !ikari}<a class="text-link" href="/admin/redefinir">Alterar senha</a>{/if}
          <a class="text-link" href="/" target="_blank" rel="noopener">Ver portfólio <Icon name="diagonal" size={14} /></a>
          <form action="/admin/sair" method="POST"><button><Icon name="logout" size={17} /><span>Encerrar sessão</span></button></form>
        </div>
      </div>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar"><span>{ikari ? 'REC / CREDENCIAL DE DIREÇÃO' : 'Painel do estúdio'}</span><span class="private-label"><span class="dot"></span>Área privada do editor</span></header>
      <main id="painel" class="admin-content" tabindex="-1"><slot /></main>
      {#if ikari}<div class="studio-private-finale" style="--mono:'JetBrains Mono Variable',monospace;--jp:'Noto Sans JP','Yu Gothic',sans-serif"><IkariFinale/></div>{/if}
    </div>
  </div>
{/if}
<style>
:global(.admin-shell.studio-os){--paper:#0e1013;--ink:#f3efe6;--muted:#bcc1c2;--line:#f3efe633;--white:#18212b;--accent:#b8ff01;--on-accent:#111315;background:#0e1013;color:#f3efe6;font-family:'Plus Jakarta Sans Variable',sans-serif;min-height:100svh}
:global(.studio-os .admin-sidebar){background:#10151c;border-right:1px solid #f3efe626}:global(.studio-os .wordmark){font-family:'Syne Variable',sans-serif;font-weight:800;color:#f3efe6}:global(.studio-os .admin-brand-cut){background:#b8ff01}:global(.studio-os .workspace){color:#aeb8b9}:global(.studio-os .workspace>span){font-family:'JetBrains Mono Variable',monospace;font-size:9px;color:#b8ff01}:global(.studio-os .admin-sidebar nav a.active){background:#b8ff01;color:#111315}:global(.studio-os .admin-sidebar nav a:hover){background:#273039;color:#f3efe6}:global(.studio-os .admin-topbar){background:#10151c;color:#b8ff01;border-bottom:1px solid #f3efe629;font-family:'JetBrains Mono Variable',monospace;font-size:10px}:global(.studio-os .private-label){color:#d8dbd7}:global(.studio-os .private-label .dot){background:#ff6b4a}:global(.studio-os .admin-content){position:relative;background-color:#0e1013;background-image:linear-gradient(#f3efe605 1px,transparent 1px),linear-gradient(90deg,#f3efe605 1px,transparent 1px);background-size:48px 48px}:global(.studio-os .sidebar-bottom){border-color:#f3efe633}:global(.studio-os .field label){color:#f3efe6}:global(.studio-os .field input),:global(.studio-os .field textarea),:global(.studio-os .field select){background:#151f29;color:#f3efe6;border-color:#f3efe64d}:global(.studio-os .btn.accent){background:#b8ff01;color:#111315}:global(.studio-os .btn.secondary){color:#f3efe6;border-color:#f3efe655}:global(.studio-os .data-table th),:global(.studio-os .data-table td){color:#f3efe6;border-color:#f3efe633}:global(.studio-os .stat){background:#17212b;border-color:#f3efe633}:global(.studio-os .stat>span),:global(.studio-os .stat small){color:#c9d0ce}:global(.studio-os .row-actions a),:global(.studio-os .row-actions button),:global(.studio-os .quick-actions a){color:#b8ff01}:global(.studio-os .admin-heading h1){font-family:'Syne Variable',sans-serif;color:#f3efe6}:global(.studio-os .admin-heading p){color:#c9d0ce}:global(.studio-os :focus-visible){outline:3px solid #00e5f5;outline-offset:4px}
@media(max-width:760px){:global(.studio-os .admin-sidebar){background:#10151c}:global(.studio-os .admin-topbar){font-size:8px;padding-inline:20px}:global(.studio-os .private-label){font-size:9px}:global(.studio-os .admin-content){padding:25px 20px 45px}:global(.studio-os .admin-menu-toggle){color:#f3efe6;border-color:#b8ff0166}}
</style>
