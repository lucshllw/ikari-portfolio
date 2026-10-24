<script lang="ts">import type { PageData } from './$types'; export let data: PageData;</script>
<svelte:head><title>Link de acesso — Ikari</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<main class="callback-page"><a href="/" class="wordmark">Ikari</a><h1>Confira seu link de acesso.</h1><p role="alert">{data.error}</p><a class="btn accent" href="/admin/recuperar">Solicitar um novo link</a><a href="/admin/entrar">Voltar para entrar</a></main>
<style>.callback-page{min-height:85svh;max-width:640px;margin:auto;padding:clamp(30px,8vw,90px) 24px;display:flex;align-items:flex-start;justify-content:center;flex-direction:column;gap:24px}.callback-page h1{font-size:clamp(32px,7vw,54px);line-height:1.1}.callback-page p{line-height:1.7}</style>
