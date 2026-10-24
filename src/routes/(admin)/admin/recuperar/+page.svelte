<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';
  export let form: ActionData;
  let sending = false;
</script>
<svelte:head><title>Recuperar acesso — Ikari</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<div class="login-shell recovery-shell"><div class="login-form-wrap"><a href="/" class="wordmark login-brand">Ikari</a><div class="login-form">
  <p class="login-caption">Área privada do editor</p><h1 class="display">Recuperar<br />seu acesso.</h1>
  <p>Informe o e-mail da conta para solicitar as instruções de recuperação.</p>
  {#if form?.error}<div class="alert" role="alert">{form.error}</div>{/if}
  {#if form?.requested}<div class="alert" role="status">{form.message}</div>{/if}
  <form method="POST" use:enhance={() => { sending = true; return async ({ update }) => { try { await update(); } finally { sending = false; } }; }}>
    <div class="field"><label for="recovery-email">E-mail da conta</label><input id="recovery-email" name="email" type="email" value={form?.email || ''} required maxlength="254" autocomplete="email" /></div>
    <button class="btn accent" disabled={sending}>{sending ? 'Solicitando…' : 'Solicitar recuperação'}</button>
  </form><a href="/admin/entrar" class="text-link login-back">Voltar para entrar</a>
</div></div></div>
<style>.recovery-shell{grid-template-columns:1fr;min-height:85svh}.recovery-shell .login-form-wrap{width:min(100%,720px);margin:auto}</style>
