<script lang="ts">
import { onMount, tick } from 'svelte';
import { page } from '$app/stores';
import { contrastText } from '$lib/colors';
import Icon from '$lib/components/Icon.svelte';
import IkariPageTransition from '$lib/components/IkariPageTransition.svelte';
import IkariNavigation from '$lib/components/IkariNavigation.svelte';
import IkariFinale from '$lib/components/IkariFinale.svelte';

import IkariCoverPreloader from '$lib/components/IkariCoverPreloader.svelte';
import IkariAccents from '$lib/components/IkariAccents.svelte';
import IkariHud from '$lib/components/IkariHud.svelte';
import '@fontsource-variable/syne/wght.css';
import '@fontsource/anton/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import type { LayoutData } from './$types';
import '../../public.css';
import '../../ikari-chapters.css';
$: chapter = $page.url.pathname === '/contato' ? 'contact' : $page.url.pathname === '/sobre' ? 'about' : $page.url.pathname.startsWith('/trabalhos/') ? 'work' : $page.url.pathname === '/indice' ? 'index' : $page.url.pathname === '/links' ? 'links' : 'home';
export let data: LayoutData;
let enhanced = false;
let menuOpen = false;
let menu: HTMLDialogElement;
let menuTrigger: HTMLButtonElement;
onMount(() => { enhanced = true; });
async function openMenu() { menuOpen = true; menu.showModal(); await tick(); menu.querySelector<HTMLAnchorElement>('a')?.focus(); }
function closeMenu() { menu?.close(); menuOpen = false; menuTrigger?.focus(); }
</script>
<svelte:head><meta name="description" content={data.settings.subheadline}/><meta name="theme-color" content={data.presentation.theme === 'ikari' ? '#C8FF00' : '#F1EFE7'}/><link rel="icon" type={data.presentation.theme === 'ikari' ? 'image/png' : 'image/svg+xml'} href={data.presentation.theme === 'ikari' ? '/ikari/favicon-v07.png?v=7' : '/favicon.svg'}/>{#if data.presentation.theme === 'ikari'}<link rel="apple-touch-icon" href="/ikari/apple-touch-icon.png?v=7"/>{/if}</svelte:head>
<div data-chapter={chapter} class="v04-public" class:v04-enhanced={enhanced} class:ikari-theme={data.presentation.theme==='ikari'} style={`--accent:${data.settings.accentColor};--on-accent:${contrastText(data.settings.accentColor)}`}>
  {#if data.presentation.theme==='ikari'}<IkariPageTransition/><IkariHud/><IkariCoverPreloader covers={data.covers}/><IkariAccents/>{/if}
  <a class="v04-skip" href="#conteudo">Ir para o conteúdo</a>
  {#if data.presentation.theme==='ikari'}<IkariNavigation count={data.publicCount}/>{:else}<div class="v04-wrap"><header class="v04-nav">
    <a class="v04-brand" href="/" aria-label={`${data.settings.brandName} — início`}>{data.settings.brandName}</a>
    <nav class="v04-desktop-nav" aria-label="Navegação principal">{#if data.presentation.theme!=='ikari'}<a class:active={$page.url.pathname.startsWith('/trabalhos')} aria-current={$page.url.pathname.startsWith('/trabalhos') ? 'page' : undefined} href="/trabalhos">Trabalhos</a>{/if}{#if data.presentation.theme==='ikari'}<a class:active={$page.url.pathname==='/sobre'} aria-current={$page.url.pathname==='/sobre'?'page':undefined} href="/sobre">Sobre</a>{:else}<a class:active={$page.url.hash === '#processo'} href="/#processo">Processo</a>{/if}<a class:active={$page.url.pathname === '/contato'} aria-current={$page.url.pathname === '/contato' ? 'page' : undefined} href="/contato">Contato</a></nav>
    <span class="v04-nav-note">{data.presentation.theme==='ikari'?'Proposta de portfólio':'Modelo demonstrativo'}</span>
    <button bind:this={menuTrigger} class="v04-menu-trigger" aria-expanded={menuOpen} aria-controls="menu-publico" aria-haspopup="dialog" onclick={openMenu}>Menu <span aria-hidden="true"><i></i><i></i></span></button>
  </header><p class="v04-mobile-note">{data.presentation.theme==='ikari'?'Proposta de portfólio':'Modelo demonstrativo'}</p></div>
  <dialog bind:this={menu} id="menu-publico" class="v04-menu" aria-labelledby="menu-heading" oncancel={(event) => { event.preventDefault(); closeMenu(); }} onclose={() => { menuOpen = false; }}>
    <div class="v04-menu-top"><span id="menu-heading" class="v04-brand">{data.settings.brandName}</span><button class="v04-close-menu" onclick={closeMenu} aria-label="Fechar menu"><Icon name="close" size={25}/></button></div>
    <nav aria-label="Navegação móvel">{#if data.presentation.theme!=='ikari'}<a href="/trabalhos" onclick={closeMenu}>Trabalhos <Icon name="diagonal" size={28}/></a>{/if}{#if data.presentation.theme==='ikari'}<a href="/sobre" onclick={closeMenu}>Sobre <Icon name="diagonal" size={28}/></a>{:else}<a href="/#processo" onclick={closeMenu}>Processo <Icon name="diagonal" size={28}/></a>{/if}<a href="/contato" onclick={closeMenu}>Contato <Icon name="diagonal" size={28}/></a></nav>
    <div class="v04-menu-bottom"><span class="v04-meta">Imagens em movimento.</span><a href="/admin" onclick={closeMenu}>Área do editor <Icon name="diagonal" size={14}/></a></div>
  </dialog>{/if}
  <main id="conteudo" tabindex="-1"><slot/></main>
  {#if data.presentation.theme==='ikari'}<IkariFinale/>{:else}<div class="v04-wrap"><footer class="v04-footer">
    <div class="v04-footer-main"><a class="v04-brand" href="/">{data.settings.brandName}</a><span class="v04-meta">{data.settings.servicesText.split('\n').filter(Boolean).slice(0,3).join(' · ')}</span><a href="/contato" class="v04-footer-contact">Vamos conversar <Icon name="diagonal" size={20}/></a></div>
    <div class="v04-footer-bottom"><span>{data.presentation.theme === 'ikari' ? 'Proposta local de portfólio' : 'Modelo demonstrativo'} · {new Date().getFullYear()}</span><div>{#if data.settings.email}<a href={`mailto:${data.settings.email}`}>{data.settings.email}</a>{/if}{#if data.settings.instagramUrl}<a href={data.settings.instagramUrl} target="_blank" rel="noopener noreferrer">Link profissional <Icon name="diagonal" size={12}/></a>{/if}<a href="/creditos">Créditos</a><a href="/admin">Área do editor <Icon name="diagonal" size={12}/></a></div></div>
  </footer></div>{/if}
</div>
<style>
  /* Four routes must remain usable before hydration and with JavaScript off. */
  @media(max-width:760px){:global(.ikari-theme) .v04-desktop-nav{gap:clamp(12px,4vw,25px);flex-wrap:wrap;font-size:14px}}
  :global(.ikari-theme) .v04-menu{height:100svh;max-height:100svh}
  :global(.ikari-theme) .v04-desktop-nav a:hover,:global(.ikari-theme) .v04-desktop-nav a:focus-visible{color:#111719;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:6px}
</style>
