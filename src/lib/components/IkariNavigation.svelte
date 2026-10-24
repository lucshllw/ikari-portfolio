<script lang="ts">
import {page} from '$app/stores';
import {afterNavigate} from '$app/navigation';
import {studioPointer} from '$lib/actions/studio-motion';
export let count=0;
let open=false;
afterNavigate(()=>open=false);
const items=[['Início','/'],['Comissões','/#selecionados'],['Sobre','/sobre'],['Links','/links'],['Contato','/contato']];
$: active=$page.url.pathname==='/'&&$page.url.hash?$page.url.pathname+$page.url.hash:$page.url.pathname;
</script>
<header class="studio-header">
 <nav class="studio-nav" class:open aria-label="Navegação principal">
  <a class="studio-brand" href="/" aria-label="Ikari — início">IKARI<span aria-hidden="true">✦</span></a>
  <div class="studio-items desktop-items">{#each items as [label,href]}<a {href} use:studioPointer={'magnet'} aria-current={active===href?'page':undefined}><span class="text-roll"><span>{label}</span><span aria-hidden="true">{label}</span></span></a>{/each}</div>
  <details class="studio-menu" bind:open><summary>Menu <span aria-hidden="true">＋</span></summary><div class="studio-items">{#each items as [label,href]}<a {href} aria-current={active===href?'page':undefined}>{label}</a>{/each}</div></details>
  <a class="hud-index" class:current={$page.url.pathname==='/indice'} href="/indice" aria-label={`Navegação rápida: índice, ${count} obras`} aria-current={$page.url.pathname==='/indice'?'page':undefined}>Índice <span>[{count}] ↗</span></a>
 </nav>
</header>
<style>
.studio-header{height:110px}.studio-nav{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:80;display:flex;align-items:center;gap:20px;width:max-content;max-width:calc(100vw - 32px);padding:8px 10px 8px 24px;background:#111315ed;color:#f3efe6;border:1px solid #b8ff0159;border-radius:999px;backdrop-filter:blur(16px);box-shadow:0 8px 25px #0002}.studio-brand{font:400 27px/1 'Anton',sans-serif;display:flex;gap:10px;align-items:center;min-height:44px}.studio-brand>span{color:#ff6b4a;font-size:22px}.studio-menu{display:contents}.studio-menu summary{display:none}.studio-items{display:flex;align-items:center;gap:4px}.studio-items a{display:flex;align-items:center;min-height:44px;padding:10px 13px;font:500 14px var(--font);position:relative}.studio-items a[aria-current=page]{color:#b8ff01}.text-roll{display:block;height:1.3em;overflow:hidden}.text-roll>span{display:block;line-height:1.3;transition:transform .2s ease}.studio-items a:hover .text-roll>span,.studio-items a:focus-visible .text-roll>span{transform:translateY(-100%)}.studio-nav .hud-index{position:static;display:flex;align-items:center;gap:13px;min-height:44px;padding:12px 18px;background:#b8ff01;color:#111315;border-radius:99px;font:600 13px var(--mono);white-space:nowrap}.studio-nav .hud-index.current{box-shadow:inset 0 0 0 2px #111315,inset 0 0 0 4px #b8ff01}.studio-nav a:focus-visible,.studio-menu summary:focus-visible{outline:2px solid #ff6b4a;outline-offset:3px;border-radius:20px}
@media(min-width:801px){.studio-menu:not([open])>.studio-items{display:flex}}
@media(max-width:800px){.studio-header{height:100px}.studio-nav{top:12px;padding:6px 8px 6px 16px;gap:14px;width:calc(100% - 24px);max-width:520px;justify-content:space-between}.studio-brand{font-size:24px;gap:7px}.studio-menu{display:block}.studio-menu summary{display:flex;list-style:none;align-items:center;gap:12px;cursor:pointer;min-height:44px;font-size:14px}.studio-menu summary::-webkit-details-marker{display:none}.studio-nav .hud-index{gap:6px;padding:10px 12px;font-size:12px}.studio-items{position:absolute;top:calc(100% + 10px);left:0;right:0;padding:15px 20px;background:#111315;border:1px solid #b8ff0159;border-radius:20px;display:grid;grid-template-columns:1fr 1fr;box-shadow:0 12px 25px #0004}.studio-items a{padding:14px;font-size:17px}.studio-menu:not([open])>.studio-items{display:none}.studio-brand>span{display:none}}
@media(prefers-reduced-motion:reduce){.text-roll>span{transition:none}}

@media(min-width:801px){.studio-menu{display:none}}
@media(max-width:800px){.studio-items.desktop-items{display:none}}
</style>
