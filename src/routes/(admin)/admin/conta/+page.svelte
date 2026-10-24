<script lang="ts">
  import { enhance } from '$app/forms';
  import Icon from '$lib/components/Icon.svelte';
  import { chapterMotion } from '$lib/actions/chapter-motion';
  import type { PageData, ActionData } from './$types';
  export let data: PageData;
  export let form: ActionData;
  let busy = '';
  function send(kind: string) { return () => { busy = kind; return async ({ update }: { update: () => Promise<void> }) => { try { await update(); } finally { busy = ''; } }; }; }
</script>
<svelte:head><title>Conta e acesso — Ikari Studio</title><meta name="robots" content="noindex,nofollow"/></svelte:head>
<section class="studio-account" use:chapterMotion>
  <span class="account-kanji" aria-hidden="true">監督</span>
  <header class="account-heading"><p>CREDENCIAL DE DIREÇÃO // IKARI STUDIO</p><h1 data-chapter-title>Conta<br/>e acesso.</h1><a href="/admin/pedidos">Voltar à mesa <Icon name="arrow" size={20}/></a></header>
  {#if data.passwordChanged}<p role="status" class="account-message">Senha alterada.{#if data.passwordWarning} Não foi possível confirmar o encerramento das outras sessões.{/if}</p>{/if}
  <div class="account-grid">
    <section class="account-sheet" aria-labelledby="password-title"><p class="account-register">01 // SEGURANÇA</p><h2 id="password-title">Uma nova senha.</h2><p>Confirme a senha atual e escolha uma nova credencial. Use de 12 a 128 caracteres.</p>
      {#if form?.kind === 'password'}
        {#if form.error}<p role="alert" class="account-message error">{form.error}</p>{/if}
        {#if form.success}<p role="status" class="account-message">Senha alterada.</p>{/if}
        {#if form.warning}<p role="alert" class="account-message error">{form.warning}</p>{/if}
      {/if}
      <form method="POST" action="?/password" use:enhance={send('password')}>
        <label for="account-current-password">Senha atual<input id="account-current-password" name="currentPassword" type="password" required maxlength="128" autocomplete="current-password"/></label>
        <label for="account-password">Nova senha<input id="account-password" name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password"/></label>
        <label for="account-confirmation">Repita a nova senha<input id="account-confirmation" name="confirmation" type="password" required minlength="12" maxlength="128" autocomplete="new-password"/></label>
        <button disabled={!!busy}>{busy === 'password' ? 'Confirmando alteração…' : 'Salvar nova senha'} <Icon name="arrow" size={20}/></button>
      </form>
      {#if data.cloud}<a href="/admin/recuperar" class="account-link">Esqueci minha senha <Icon name="diagonal" size={18}/></a>{:else}<p class="account-note">Recuperação por e-mail depende da instalação cloud configurada. Esta instalação local permite alterar a senha usando a credencial atual.</p>{/if}
    </section>
    <section class="account-sheet email-sheet" aria-labelledby="email-title"><p class="account-register">02 // IDENTIDADE DE ACESSO</p><h2 id="email-title">Seu e-mail de login.</h2><p class="current-email">{data.loginEmail}</p><p>Este é o endereço usado para entrar e recuperar sua conta. O e-mail público de contato é configurado separadamente.</p>
      {#if data.pendingEmail}<p class="account-message">Alteração aguardando confirmação: {data.pendingEmail}</p>{/if}
      {#if form?.kind === 'email'}
        {#if form.error}<p role="alert" class="account-message error">{form.error}</p>{/if}
        {#if form.requested}<p role="status" class="account-message">Solicitação aceita pelo serviço de autenticação. Confira as mensagens de confirmação no endereço atual e no novo endereço. O recebimento do e-mail depende da configuração de envio.</p>{/if}
      {/if}
      {#if data.cloud}
      <form method="POST" action="?/email" use:enhance={send('email')}>
        <label for="account-email">Novo e-mail de acesso<input id="account-email" name="email" type="email" required maxlength="254" autocomplete="email"/></label>
        <label for="account-email-password">Confirme sua senha atual<input id="account-email-password" name="currentPassword" type="password" required maxlength="128" autocomplete="current-password"/></label>
        <p class="account-note">A alteração depende da confirmação do Supabase. Continue usando o endereço atual até concluir a verificação.</p>
        <button disabled={!!busy}>{busy === 'email' ? 'Solicitando confirmação…' : 'Solicitar alteração do e-mail'} <Icon name="diagonal" size={20}/></button>
      </form>
      {:else}<p class="account-message">Alteração do e-mail de acesso não habilitada nesta instalação local. Na instalação Supabase, o endereço só muda após a confirmação configurada no serviço.</p>{/if}
      <a href="/admin/identidade" class="account-link">Editar e-mail público de contato <Icon name="diagonal" size={18}/></a><p class="account-note">O endereço público não altera o login nem ativa notificações automáticas de novos pedidos. Os pedidos ficam disponíveis na mesa de comissões.</p>
    </section>
  </div>
</section>
<style>
.studio-account{position:relative;isolation:isolate;overflow:clip;min-height:100svh;padding:clamp(24px,5vw,70px);background:#0e1013;color:#f3efe6;background-image:linear-gradient(#f3efe608 1px,transparent 1px),linear-gradient(90deg,#f3efe608 1px,transparent 1px);background-size:70px 70px}.account-kanji{position:absolute;right:-4%;top:6%;z-index:-1;font:900 clamp(140px,30vw,420px)/1 var(--jp,sans-serif);color:transparent;-webkit-text-stroke:1px #b8ff0124;writing-mode:vertical-rl}.account-heading{position:relative;border-bottom:3px solid #e62e2d;padding-bottom:30px;margin-bottom:35px}.account-heading>p,.account-register{font:500 14px/1.6 var(--mono,monospace);color:#b8ff01}.account-heading h1{font:800 clamp(48px,7.5vw,108px)/.98 var(--display,sans-serif);letter-spacing:-.06em;margin:20px 0}.account-heading>a{display:inline-flex;align-items:center;gap:18px;min-height:44px;color:#f3efe6}.account-grid{display:grid;grid-template-columns:1fr 1fr;gap:clamp(20px,4vw,50px);align-items:start}.account-sheet{min-width:0;position:relative;background:#f3efe6;color:#111315;padding:clamp(22px,3vw,40px);border:2px solid #111315;box-shadow:7px 8px 0 #ff6b4a}.email-sheet{box-shadow:7px 8px 0 #b8ff01}.account-register{color:#4d5353;margin:0 0 16px}.account-sheet h2{font:800 clamp(28px,3vw,44px)/1.08 var(--display,sans-serif);letter-spacing:-.04em;margin:0 0 18px}.account-sheet>p{font-size:16px;line-height:1.7;overflow-wrap:anywhere}.account-sheet form{display:grid;gap:18px;margin-top:24px}.account-sheet label{display:grid;gap:8px;font-size:14px;font-weight:650}.account-sheet input{width:100%;min-width:0;min-height:48px;padding:12px;border:2px solid #11131555;background:#fffdf7;color:#111315;font-size:16px;border-radius:0}.account-sheet input:focus-visible{outline:3px solid #ff6b4a;outline-offset:2px;border-color:#111315}.account-sheet button{display:flex;align-items:center;justify-content:space-between;gap:16px;border:2px solid #111315;min-height:48px;padding:13px 16px;background:#111315;color:#b8ff01;text-align:left;font-size:14px;font-weight:750;cursor:pointer}.account-sheet button:disabled{opacity:.65;cursor:wait}.account-sheet a:focus-visible,.account-sheet button:focus-visible{outline:3px solid #e62e2d;outline-offset:4px}.account-link{display:inline-flex;align-items:center;gap:14px;min-height:44px;margin-top:20px;color:#111315;font-size:14px;font-weight:700}.account-sheet .account-note{font-size:14px;line-height:1.6;color:#4f5553;margin-top:14px}.account-message{padding:14px;border-left:4px solid #6a9500;background:#e3edc4;font-size:14px!important;line-height:1.6}.account-message.error{border-color:#b72c26;background:#ffe0d8;color:#751e19}.current-email{font-weight:700;overflow-wrap:anywhere;padding-bottom:12px;border-bottom:1px solid #11131533}
@media(max-width:900px){.account-grid{grid-template-columns:1fr;gap:32px}.studio-account{padding:24px 18px 55px}.account-heading h1{font-size:65px}.account-sheet{padding:24px}.account-heading>p{max-width:26ch}.account-kanji{opacity:.5}}
</style>
