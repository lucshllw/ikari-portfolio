<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import Icon from '$lib/components/Icon.svelte';
  import { onMount } from 'svelte';
  export let form: ActionData;
  export let data: PageData;
  let sending = false;
  let root: HTMLDivElement;
  $: ikari = data.settings.brandName.toLowerCase().includes('ikari');
  onMount(()=>{let cancelled=false,context:{revert:()=>void}|undefined;void import('gsap').then(({gsap})=>{if(cancelled||!ikari||matchMedia('(prefers-reduced-motion:reduce)').matches)return;context=gsap.context(()=>{const line=root.querySelector<SVGPathElement>('.credential-thread path');const length=line?.getTotalLength()||1000;if(line)gsap.fromTo(line,{strokeDasharray:length,strokeDashoffset:length},{strokeDashoffset:0,duration:.85,ease:'power3.out'});gsap.from('.login-form>h1,.login-form>p,.login-form form',{y:20,opacity:0,duration:.6,stagger:.07,ease:'power3.out'});gsap.from('.login-art img',{scale:1.04,opacity:0,duration:.8,ease:'power3.out'});},root);}).catch(()=>{});return()=>{cancelled=true;context?.revert();};});
</script>
<svelte:head><title>Entrar — {data.settings.brandName}</title></svelte:head>
<div class="login-shell" class:ikari-credential={ikari} bind:this={root}>
  {#if ikari}<span class="credential-kanji" aria-hidden="true">監督</span><svg class="credential-thread" viewBox="0 0 1400 900" preserveAspectRatio="none" aria-hidden="true"><path d="M0 100H80L80 820L700 820L700 160L1360 160V880" fill="none" stroke="#e62e2d" stroke-width="2"/></svg>{/if}
  <div class="login-form-wrap">
    <a href="/" class="wordmark login-brand">{data.settings.brandName}<span class="admin-brand-cut" aria-hidden="true"></span></a>
    <div class="login-form">
      <p class="login-caption">{ikari ? 'CREDENCIAL DE DIREÇÃO // 24 FPS' : 'Área privada do editor'}</p>
      <h1 class="display">{#if ikari}Toda cena<br/>tem <span>direção.</span>{:else}Seu espaço<br />de criação.{/if}</h1>
      <p>{ikari ? 'Entre com seu login e senha. Por segurança, a mesa solicita uma nova autenticação a cada 30 minutos.' : 'Entre para organizar seus trabalhos e dar forma à sua identidade.'}</p>
      {#if form?.error}<div class="alert" role="alert">{form.error}</div>{/if}
      <form method="POST" use:enhance={() => { sending = true; return async ({ update }) => { try { await update(); } finally { sending = false; } }; }}>
        <div class="field"><label for="email">{ikari ? 'Login' : 'E-mail'}</label><input id="email" name="email" type={ikari ? 'text' : 'email'} required autocomplete="username" autocapitalize="none" spellcheck={false} /></div>
        <div class="field"><label for="password">Senha</label><input id="password" name="password" type="password" required minlength="12" autocomplete="current-password" /></div>
        <button class="btn accent" disabled={sending}>{sending ? 'Abrindo mesa…' : ikari ? 'Abrir mesa de comissões' : 'Entrar no meu espaço'}<Icon name="diagonal" size={18} /></button>
      </form>
      {#if data.cloud && !ikari}<a class="text-link login-back" href="/admin/recuperar">Esqueci minha senha</a>{/if}
      <a href="/" class="text-link login-back">Voltar ao portfólio <Icon name="diagonal" size={15} /></a>
      <p class="fineprint">{ikari ? 'Acesso reservado à direção. Pedidos e notas internas permanecem nesta área privada.' : 'Acesso reservado ao proprietário desta instalação. O primeiro acesso é configurado durante a instalação do modelo.'}</p>
    </div>
  </div>
  <aside class="login-art" aria-label="Sala de montagem">
    <div class="login-art-note"><span>Edição que conecta<br />ideias e pessoas.</span><i aria-hidden="true"></i></div>
    <img src={ikari ? '/ikari/banner-mural-v09.webp' : '/demo/studio.webp'} alt={ikari ? 'Ilustração aprovada de Ikari junto ao mural de investigação e suas cenas' : 'Estúdio de edição audiovisual'} width="1200" height="1600" />
    <div class="login-art-note"><i aria-hidden="true"></i><span>Mesmo processo.<br />Mais histórias.</span></div>
  </aside>
</div>
<style>
.ikari-credential{--paper:#0e1013;--ink:#f3efe6;--accent:#b8ff01;--on-accent:#111315;background:#0e1013;color:#f3efe6;position:relative;isolation:isolate;min-height:100svh;overflow:clip;background-image:linear-gradient(#f3efe608 1px,transparent 1px),linear-gradient(90deg,#f3efe608 1px,transparent 1px);background-size:52px 52px;font-family:'Plus Jakarta Sans Variable',sans-serif}.credential-kanji{position:absolute;inset:70px auto auto 3%;font-size:clamp(180px,30vw,420px);color:transparent;-webkit-text-stroke:1px #f3efe612;writing-mode:vertical-rl;z-index:-1;pointer-events:none}.credential-thread{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}.ikari-credential .login-form-wrap{padding:clamp(28px,6vw,90px);background:transparent}.ikari-credential .login-brand{font-family:'Syne Variable',sans-serif;color:#f3efe6;font-weight:800}.ikari-credential .admin-brand-cut{background:#b8ff01}.ikari-credential .login-form{border:2px solid #b8ff01;background:#101820ef;box-shadow:9px 9px 0 #e62e2d;padding:clamp(25px,3.4vw,48px);position:relative;max-width:550px;margin:55px 0}.ikari-credential .login-form:before{content:'';position:absolute;top:-14px;left:24px;width:78px;height:26px;transform:rotate(-4deg);background:repeating-linear-gradient(135deg,#f3efe6 0 14px,#111315 14px 28px);border:1px solid #111315}.ikari-credential .login-caption{color:#b8ff01;font:10px/1.7 'JetBrains Mono Variable',monospace;letter-spacing:.06em}.ikari-credential h1{font:800 clamp(38px,4.6vw,66px)/1.02 'Syne Variable',sans-serif;letter-spacing:-.06em;margin:22px 0}.ikari-credential h1 span{color:#b8ff01}.ikari-credential .login-form>p:not(.login-caption){color:#c9cdca;font-size:13px;line-height:1.8}.ikari-credential .field label{color:#f3efe6}.ikari-credential .field input{color-scheme:dark;background:#0d141b;color:#f3efe6;border:1px solid #f3efe666;font-size:16px;min-height:48px}.ikari-credential .field input:focus{outline:2px solid #00e5f5;outline-offset:3px}.ikari-credential .btn.accent{background:#b8ff01;color:#111315;border:1px solid #b8ff01;font-size:12px;font-weight:700;min-height:50px}.ikari-credential .login-back{color:#b8ff01;font-size:12px;min-height:44px}.ikari-credential .fineprint{font-size:10px!important}.ikari-credential .login-art{background:#111b28;position:relative;align-self:stretch;border-left:1px solid #f3efe633;overflow:hidden}.ikari-credential .login-art>img{width:100%;height:100%;object-fit:cover;object-position:32% center;max-height:none}.ikari-credential .login-art-note{position:absolute;inset:28px 25px auto;z-index:2;color:#f3efe6;padding:16px;border:1px solid #b8ff0177;background:#0e1013dd;font:12px/1.6 'JetBrains Mono Variable',monospace}.ikari-credential .login-art-note:last-child{inset:auto 25px 30px;color:#b8ff01}.ikari-credential .login-art-note i{background:#b8ff01}.ikari-credential .alert{background:#381b18;color:#ffd6cd;border:1px solid #ff6b4a}
@media(max-width:760px){.ikari-credential{display:block}.ikari-credential .login-form-wrap{padding:28px 22px 45px}.ikari-credential .login-form{margin:40px 0 10px;padding:30px 22px;max-width:none}.ikari-credential .login-brand{font-size:30px}.ikari-credential h1{font-size:43px}.ikari-credential .login-art{display:none}.credential-kanji{font-size:220px;opacity:.6}.ikari-credential .login-form>p:not(.login-caption){font-size:12px}}
</style>
