<script lang="ts">
  export let name = '';
  export let service = '';
  export let brief = '';
  export let sending = false;
  export let received = false;
  export let protocol = '';
  $: excerpt = brief.trim().slice(0, 150);
</script>

<section class="production-slate" class:is-received={received} class:is-sending={sending} aria-label="Prévia da claquete do seu projeto">
  <div class="slate-hinge" aria-hidden="true"><span></span></div>
  <div class="slate-body">
    <div class="slate-topline"><span>IKARI / 制作</span><span>PRODUCTION NOTES</span></div>
    <div class="slate-take"><p>SCENE <strong>01</strong></p><p>TAKE <strong>01</strong></p><p><strong>24</strong> FPS</p></div>
    <dl>
      <div><dt>PROJETO DE</dt><dd>{name.trim() || 'Seu nome entra em cena'}</dd></div>
      <div><dt>DIREÇÃO</dt><dd>{service || 'Uma ideia, muitas possibilidades'}</dd></div>
      <div class="slate-idea"><dt>ROTEIRO / PRIMEIRO PLANO</dt><dd>{excerpt || 'O próximo frame começa com a sua ideia.'}{brief.trim().length > 150 ? '…' : ''}</dd></div>
    </dl>
    <p class="slate-footnote">{sending ? 'SALVANDO O SEU ROTEIRO…' : received ? protocol || 'ROTEIRO CONFIRMADO' : 'RASCUNHO / PRONTO PARA CRIAR'}</p>
  </div>
  {#if received}<div class="slate-received">Roteiro recebido<br/>em 24 FPS!</div>{/if}
</section>

<style>
  .production-slate{position:relative;color:#f3efe6;background:#191c20;border:2px solid #f3efe6;box-shadow:10px 12px 0 #08090b;transform:rotate(2deg);margin:35px 0 14px;font-family:var(--mono);min-width:0}
  .slate-hinge{position:relative;height:44px;background:repeating-linear-gradient(130deg,#f3efe6 0 32px,#191c20 33px 64px);border-bottom:3px solid #f3efe6;transform-origin:14px 100%}
  .slate-hinge:before{content:'';position:absolute;left:7px;bottom:-8px;width:12px;height:12px;border:2px solid #f3efe6;border-radius:50%;background:#ff6b4a;z-index:1}
  .slate-body{padding:20px}.slate-topline{display:flex;justify-content:space-between;gap:12px;font-size:14px;line-height:1.5}.slate-topline span:last-child{color:#b8ff01;text-align:right}
  .slate-take{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-block:1px solid #f3efe675;margin:18px 0}.slate-take p{font-size:14px;padding:12px 8px;line-height:1.7}.slate-take p+p{border-left:1px solid #f3efe675}.slate-take strong{font-size:24px;display:block;font-weight:500}
  dl{margin:0}dl>div{padding:12px 0;border-bottom:1px solid #f3efe64a}dt{font-size:14px;color:#c2c1ba;margin-bottom:8px}dd{margin:0;font:600 21px/1.35 var(--display);overflow-wrap:anywhere}.slate-idea dd{font:400 16px/1.6 var(--font);min-height:76px}.slate-footnote{margin:18px 0 0;font-size:14px;line-height:1.5;color:#b8ff01}
  .slate-footnote{overflow-wrap:anywhere}.slate-received{position:absolute;right:-6px;bottom:65px;max-width:95%;border:4px solid #ff6b4a;color:#ff6b4a;background:#111315f5;padding:12px 18px;transform:rotate(-12deg);font:700 clamp(20px,3vw,30px)/1.1 var(--display);text-transform:uppercase;animation:slate-stamp .25s steps(6,end) .375s both}
  .is-received .slate-hinge{animation:slate-clap .5s steps(12,end) both}.is-sending{border-color:#b8ff01}
  @keyframes slate-clap{0%{transform:rotate(-13deg)}65%{transform:rotate(-13deg)}85%{transform:rotate(0)}92%{transform:rotate(-2deg)}100%{transform:rotate(0)}}
  @keyframes slate-stamp{from{opacity:0;transform:rotate(-12deg) scale(1.2)}to{opacity:1;transform:rotate(-12deg) scale(1)}}
  @media(max-width:480px){.production-slate{transform:none;box-shadow:6px 7px 0 #08090b}.slate-body{padding:15px}.slate-topline{flex-wrap:wrap}.slate-take p{padding-inline:6px}.slate-received{right:0;padding:12px;font-size:23px}}
  @media(prefers-reduced-motion:reduce){.is-received .slate-hinge,.slate-received{animation:none}.production-slate{transform:none}}
</style>
