<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';
  export let form: ActionData;
  let sending = false;
</script>
<svelte:head><title>Definir senha — Ikari</title><meta name="robots" content="noindex,nofollow" /></svelte:head>
<div class="login-shell password-shell"><div class="login-form-wrap"><a href="/" class="wordmark login-brand">Ikari</a><div class="login-form">
  <p class="login-caption">Área privada do editor</p><h1 class="display">Uma nova<br />senha.</h1>
  {#if form?.error}<div class="alert" role="alert">{form.error}</div>{/if}
    <p>Este link de recuperação ou convite autoriza uma única alteração por até dez minutos. Escolha uma senha de 12 a 128 caracteres.</p>
    <form method="POST" use:enhance={() => { sending = true; return async ({ update }) => { try { await update(); } finally { sending = false; } }; }}>
      <div class="field"><label for="new-password">Nova senha</label><input id="new-password" name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password" /></div>
      <div class="field"><label for="confirm-password">Repita a nova senha</label><input id="confirm-password" name="confirmation" type="password" required minlength="12" maxlength="128" autocomplete="new-password" /></div>
      <button class="btn accent" disabled={sending}>{sending ? 'Alterando…' : 'Salvar nova senha'}</button>
    </form>
  <a href="/admin/recuperar" class="text-link login-back">Solicitar outro link</a>
</div></div></div>
<style>.password-shell{grid-template-columns:1fr;min-height:85svh}.password-shell .login-form-wrap{width:min(100%,720px);margin:auto}</style>
