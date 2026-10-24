<script lang="ts">
import { announceCommissionChange } from '$lib/commission-sync';
import { enhance, applyAction } from '$app/forms';
import {onMount,tick} from 'svelte';
import {chapterMotion} from '$lib/actions/chapter-motion';
import {releaseTitle} from '$lib/commissions';
import type {Snapshot} from '@sveltejs/kit';
import type { PageData, ActionData } from './$types';
import Icon from '$lib/components/Icon.svelte';
import IkariProductionSlate from '$lib/components/IkariProductionSlate.svelte';
export let data: PageData;
export let form: ActionData;
let sending = false;
let networkError = '';
// Own field state instead of reapplying empty ActionData values when a network
// error or sending flag rerenders the form. SSR failures still initialize it.
let name = form?.values?.name || '';
let email = form?.values?.email || '';
let service = form?.values?.service || '';
let brief = form?.values?.brief || '';
let referenceId=form?.referenceId ?? data.referenceId;
let mobileReferences=false;
let failedCovers=new Set<string>();
const coverFailed=(id:string)=>{failedCovers=new Set(failedCovers).add(id);};
onMount(()=>{
  const media=window.matchMedia('(max-width: 768px)');
  const update=()=>{mobileReferences=media.matches;};
  update();media.addEventListener('change',update);
  return ()=>media.removeEventListener('change',update);
});
$: reference=data.references.find(project=>project.id===referenceId);
const services = ['Animação 2D', 'Edição / AMV Geek', 'Direção visual', 'Visualizer / Lyric', 'Edição de vídeo', 'Conteúdo para redes', 'Quero explorar uma ideia'];
$: referenceGroups = Array.from({length:Math.ceil(Math.max(0,data.references.length-3)/6)},(_,index)=>data.references.slice(3+index*6,9+index*6));
let submittedDraft: {name:string;service:string;brief:string}|null = null;
type Draft={name:string;email:string;service:string;brief:string;referenceId:string};
export const snapshot:Snapshot<Draft>={capture:()=>({name,email,service,brief,referenceId}),restore:(value)=>{({name,email,service,brief,referenceId}=value);}};
let previousReference=data.referenceId;
$: if(data.referenceId!==previousReference){referenceId=data.referenceId;previousReference=data.referenceId;}
const submit:import('@sveltejs/kit').SubmitFunction = ({cancel,formData}) => {
  cancel();if(sending)return;sending=true;networkError='';submittedDraft={name,service,brief};
  void(async()=>{try{
    const response=await fetch('/api/commissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(formData))});
    const result=await response.json();
    await applyAction({type:response.ok?'success':'failure',status:response.status,data:result});
    if(response.ok&&result.success)announceCommissionChange();await tick();document.querySelector<HTMLElement>('[aria-invalid="true"],[data-invalid="true"]')?.focus();
  }catch{networkError='Não foi possível confirmar o recebimento. Seus dados continuam aqui. Tente novamente para confirmar o mesmo pedido.';}finally{sending=false;}})();
};
</script>
{#snippet referenceChoice(project:PageData['references'][number],eager=false)}
  <label class="reference-choice"><input type="radio" name="referenceId" value={project.id} bind:group={referenceId}/><span class="reference-choice-art">{#if failedCovers.has(project.id)}<span class="reference-cover-unavailable"><Icon name="image" size={22}/><span>Capa indisponível</span></span>{:else}<img src={project.coverUrl} alt="" width="160" height="160" loading={eager?'eager':'lazy'} fetchpriority={eager?'high':'auto'} decoding="async" onerror={()=>coverFailed(project.id)}/>{/if}<span class="reference-choice-mark" aria-hidden="true">✓</span></span><span class="reference-choice-title">{releaseTitle(project.title).track}</span><span class="reference-choice-artist">{releaseTitle(project.title).artist}</span></label>
{/snippet}
<svelte:head><title>Começar um projeto — {data.settings.brandName}</title></svelte:head>
<div class="v04-wrap" class:ikari-contact={data.presentation.theme === 'ikari'} use:chapterMotion={data.presentation.theme==='ikari'}>
  {#if data.presentation.theme==='ikari'}<div class="production-atmosphere" aria-hidden="true"><span class="production-kanji">制作</span><span class="production-thread"></span><span class="production-cross">+</span></div>{/if}
  <div class="v04-contact-layout">
    <section class="v04-contact-form" aria-labelledby="contact-heading">
      <header class="v04-contact-heading"><span class="v04-meta">{data.presentation.theme === 'ikari' ? '制作 / Mesa de produção' : 'Modelo demonstrativo'}</span><h1 id="contact-heading"><span data-chapter-title>Vamos dar forma </span><span data-chapter-title>à sua ideia.</span></h1><p>Conte um pouco do que você tem em mente. Objetivo, formato, referências e prazo ajudam a encontrar a direção do projeto.</p></header>
      {#if form?.success}<div class="v04-alert v04-alert-success" role="status"><strong>{data.presentation.theme==='ikari'?'Roteiro recebido em 24 FPS!':'Pedido recebido.'}</strong><p>{data.presentation.theme==='ikari'?'Seu briefing está na mesa privada de direção da Ikari. Guarde o protocolo para identificar seu pedido.':'Seu contexto foi salvo e está disponível para o editor nesta instalação.'}</p><p class="commission-protocol">{form.protocol}</p></div><a href={data.presentation.theme==='ikari'?'/indice':'/trabalhos'} class="v04-inline-link">Continuar explorando <Icon size={16}/></a>
      {:else}
        {#if networkError}<div class="v04-alert" role="alert">{networkError}</div>{/if}{#if form?.error}<div class="v04-alert" role="alert">{form.error}</div>{/if}
        <form method="POST" use:enhance={submit} data-chapter-piece aria-busy={sending} aria-label="Enviar pedido de projeto">
          <input type="hidden" name="requestKey" value={data.requestKey}/>
          <div class="v04-honeypot" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"/></label></div>
          {#if data.presentation.theme==='ikari'}
          <div class="production-form-head"><span>BRIEFING / 01</span><span>O próximo frame é seu.</span></div>
          <div class="brief-reference">
           {#if data.referenceUnavailable}<p class="reference-unavailable">A referência desse link não está disponível. Você pode escolher outra ou enviar uma ideia sem referência.</p>{/if}
           <fieldset class="reference-options" tabindex="-1" data-invalid={form?.fieldErrors?.referenceId?true:undefined} aria-describedby={form?.fieldErrors?.referenceId?'reference-help reference-error':'reference-help'}>
             <legend>Projeto de referência <span>(opcional)</span></legend>
             <label class="reference-none" for="reference-none"><input id="reference-none" type="radio" name="referenceId" value="" bind:group={referenceId}/><span>Minha ideia não precisa de uma obra de referência</span></label>
             {#if mobileReferences}
             <p class="reference-swipe-hint">Deslize para explorar as {data.references.length} obras.</p>
             <div class="reference-picks reference-carousel" aria-label="Obras de referência">
               {#each data.references as project,index (project.id)}{@render referenceChoice(project,index<4)}{/each}
             </div>
             {:else}
             <div class="reference-picks">
               {#each data.references.slice(0,3) as project}
                 {@render referenceChoice(project,true)}
               {/each}
             </div>
             {#if data.references.length>3}<details class="reference-library"><summary>Ver todas as {data.references.length} obras <span aria-hidden="true">+</span></summary>
               {#each referenceGroups as projects,index}<details class="reference-group"><summary>Obras {String(4+index*6).padStart(2,'0')} — {String(Math.min(9+index*6,data.references.length)).padStart(2,'0')}</summary><div class="reference-picks">
                 {#each projects as project}{@render referenceChoice(project)}{/each}
               </div></details>{/each}
             </details>{/if}
             {/if}
           </fieldset>
           <small id="reference-help">Uma obra para conversar sobre linguagem visual. A escolha não define o serviço.</small>
           {#if form?.fieldErrors?.referenceId}<p class="field-error" id="reference-error">{form.fieldErrors.referenceId}</p>{/if}
           <div aria-live="polite">{#if reference}{#key reference.id}<div class="reference-card"><img src={reference.coverUrl} alt={reference.coverAlt||reference.title} width="76" height="76"/><div><span>Referência para o briefing</span><strong>{releaseTitle(reference.title).track}</strong><p>{releaseTitle(reference.title).artist}</p><label class="reference-remove" for="reference-none">Remover referência</label></div></div>{/key}{/if}</div>
          </div>{/if}
          <div class="v04-form-fields">
            <div class="v04-field"><label for="name">Seu nome</label><input id="name" name="name" aria-invalid={form?.fieldErrors?.name?true:undefined} aria-describedby={form?.fieldErrors?.name?'name-error':undefined} required minlength="2" maxlength="100" autocomplete="name" bind:value={name} placeholder="Seu nome"/>{#if form?.fieldErrors?.name}<p id="name-error" class="field-error">{form.fieldErrors.name}</p>{/if}</div>
            <div class="v04-field"><label for="email">Seu e-mail</label><input id="email" name="email" aria-invalid={form?.fieldErrors?.email?true:undefined} aria-describedby={form?.fieldErrors?.email?'email-error':undefined} type="email" required maxlength="254" autocomplete="email" bind:value={email} placeholder="seu@email.com"/>{#if form?.fieldErrors?.email}<p id="email-error" class="field-error">{form.fieldErrors.email}</p>{/if}</div>
            {#if data.presentation.theme==='ikari'}
              <fieldset class="service-options" tabindex="-1" data-invalid={form?.fieldErrors?.service?true:undefined} aria-describedby={form?.fieldErrors?.service?'service-help service-error':'service-help'}><legend>O que você quer criar?</legend><p id="service-help">Escolha uma direção para o primeiro plano.</p><div class="service-stickers">{#each services as option,index}<label class="service-sticker"><input type="radio" name="service" value={option} required bind:group={service} aria-describedby={form?.fieldErrors?.service?'service-error':undefined}/><span><span class="service-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>{option}<span class="service-check" aria-hidden="true">✓</span></span></label>{/each}</div>{#if form?.fieldErrors?.service}<p id="service-error" class="field-error">{form.fieldErrors.service}</p>{/if}</fieldset>
            {:else}<div class="v04-field"><label for="service">O que você quer criar? <small>Tipo de serviço</small></label><select id="service" name="service" aria-invalid={form?.fieldErrors?.service?true:undefined} aria-describedby={form?.fieldErrors?.service?'service-error':undefined} required bind:value={service}><option value="">Selecione uma direção</option><option>Edição de vídeo</option><option>Motion design</option><option>Conteúdo para redes</option><option>Quero explorar uma ideia</option></select>{#if form?.fieldErrors?.service}<p id="service-error" class="field-error">{form.fieldErrors.service}</p>{/if}</div>{/if}
            <div class="v04-field"><label for="brief">Conte um pouco do projeto</label><textarea id="brief" name="brief" aria-invalid={form?.fieldErrors?.brief?true:undefined} aria-describedby={form?.fieldErrors?.brief?'brief-error':undefined} required minlength="10" maxlength="4000" rows="5" placeholder="Descreva sua ideia, referências, formatos e prazos." bind:value={brief}></textarea>{#if form?.fieldErrors?.brief}<p id="brief-error" class="field-error">{form.fieldErrors.brief}</p>{/if}<small>Seu nome, e-mail e briefing ficam disponíveis apenas na área privada do editor.</small></div>
          </div>
          <button class="v04-button v04-submit" disabled={sending}>{sending ? 'Enviando…' : 'Enviar pedido'} <Icon size={18}/></button>
          <p class="v04-form-note">{data.presentation.theme==='ikari'?'Seus dados e briefing são enviados diretamente para a mesa de direção da Ikari. Retorno em até 24h–48h úteis. Ao enviar, você autoriza o uso desses dados para avaliar e responder ao pedido.':'Ao enviar, você autoriza o editor a usar esses dados para avaliar e responder ao pedido. Nesta demonstração, o pedido é salvo localmente; não há envio automático de e-mail.'}</p>
        </form>
      {/if}
      <div class="v04-contact-availability"><span class="v04-meta">Vamos conversar</span><p>{data.settings.availability}</p></div>
    </section>
    <aside class="v04-contact-photo" class:ikari-contact-identity={data.presentation.theme === 'ikari'}>{#if data.presentation.theme === 'ikari'}<div class="ikari-contact-profile" data-chapter-piece><div class="production-polaroid"><div class="ikari-contact-avatar"><img src="/ikari/avatar.webp" alt="Avatar ilustrado usado por Ikari, com cabelo coral e fundo verde" width="400" height="400" loading="eager"/></div><div class="ikari-contact-signature"><strong>Ikari</strong><span>Vamos criar<br/>juntos.</span></div></div><IkariProductionSlate name={form?.success&&submittedDraft?submittedDraft.name:name} service={form?.success&&submittedDraft?submittedDraft.service:service} brief={form?.success&&submittedDraft?submittedDraft.brief:brief} {sending} received={form?.success===true} protocol={form?.success?form.protocol:''}/><p class="production-local-note">A claquete acompanha seu rascunho. O protocolo de recebimento aparece após a confirmação do envio.</p></div>{:else if data.contactCover}<img src={data.contactCover.coverUrl} alt={data.contactCover.coverAlt} width="1200" height="800" loading="eager"/><span class="v04-meta">Animação 2D<br/>Edição<br/>Direção visual</span>{:else}<img src="/demo/studio.webp" alt="Estudo demonstrativo de uma sala de montagem audiovisual" width="1200" height="800" loading="eager"/><span class="v04-meta">Ideias<br/>Imagens<br/>Pessoas<br/>Resultados</span>{/if}</aside>
  </div>
</div>
<style>
  .commission-protocol{font:500 13px/1.6 var(--mono);overflow-wrap:anywhere}
  .ikari-contact{position:relative;isolation:isolate;overflow:clip;max-width:none;--ink:#111315;--muted:#555b59;--accent:#111315;--line:#f3efe644;background-color:#111315;background-image:linear-gradient(#f3efe60b 1px,transparent 1px),linear-gradient(90deg,#f3efe60b 1px,transparent 1px);background-size:48px 48px;color:#f3efe6;padding:45px clamp(20px,5vw,80px) 70px}
  .production-atmosphere{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden}.production-kanji{position:absolute;right:-40px;top:20px;font:400 clamp(200px,30vw,500px)/1 var(--jp);writing-mode:vertical-rl;color:transparent;-webkit-text-stroke:1px #f3efe628}.production-thread{position:absolute;top:280px;right:-100px;width:650px;height:580px;border:2px solid #e62e2d;border-radius:50%;transform:rotate(-25deg)}.production-thread:before{content:'';position:absolute;left:0;top:0;width:14px;height:14px;border-radius:50%;background:#e62e2d}.production-cross{position:absolute;right:5%;top:55px;font:400 70px/1 var(--mono);color:#b8ff01}
  .ikari-contact .v04-contact-layout{position:relative;grid-template-columns:minmax(0,1.25fr) minmax(270px,.75fr);gap:clamp(35px,6vw,100px);align-items:start;padding-block:15px 30px;max-width:1380px;margin:auto}
  .ikari-contact .v04-meta{font:500 14px/1.5 var(--mono);letter-spacing:.03em;text-transform:uppercase;color:#b8ff01}.ikari-contact .v04-contact-heading h1{font:650 clamp(44px,5.4vw,84px)/1.04 var(--display);letter-spacing:-.055em;color:#f3efe6}.ikari-contact .v04-contact-heading h1>span{display:block}.ikari-contact .v04-contact-heading h1>span:last-child{color:#ff6b4a}.ikari-contact .v04-contact-heading p{color:#d2d0c9;font-size:16px;line-height:1.75;max-width:52ch}
  .ikari-contact form{--ink:#111315;--line:#11131545;position:relative;color:#111315;background:#f3efe6;border:0;border-top:7px solid #ff6b4a;padding:clamp(20px,3vw,38px);box-shadow:9px 10px 0 #08090b;margin-block:32px;isolation:isolate}.ikari-contact form:before{position:absolute;top:-17px;right:24px;width:80px;height:29px;margin:0;background:#b8ff01c9;transform:rotate(7deg);z-index:1}.production-form-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:21px;margin-bottom:25px;border-bottom:1px solid #11131555;font:500 14px/1.5 var(--mono)}
  .ikari-contact .v04-field label,.ikari-contact .v04-field small,.ikari-contact .v04-form-note{font-size:14px}.ikari-contact .v04-field label{font-weight:650}.ikari-contact .v04-field input,.ikari-contact .v04-field textarea{font-size:16px;background:#fffdf7;border:1px solid #777b75;color:#111315;padding:13px;min-height:48px;border-radius:0}.ikari-contact .v04-field textarea{min-height:175px}.ikari-contact .v04-field small{color:#555b59}.ikari-contact .v04-field:focus-within label{color:#111315}.ikari-contact .v04-field :is(input,textarea):focus{outline:2px solid #111315;outline-offset:3px;border-color:#111315;box-shadow:4px 4px 0 #b8ff01}
  .ikari-contact .v04-form-note{color:#555b59;line-height:1.65}.ikari-contact .v04-submit{font-size:16px;background:#111315;color:#b8ff01;border-color:#111315;min-height:58px}.ikari-contact .v04-submit:hover,.ikari-contact .v04-submit:focus-visible{background:#303638;color:#f3efe6}.ikari-contact .v04-submit:disabled{opacity:.75;cursor:wait;transform:none}.ikari-contact .v04-alert{background:#f3efe6;color:#111315;border:2px solid #ff6b4a}.ikari-contact .v04-alert-success{border-color:#b8ff01;border-left:8px solid #b8ff01}.ikari-contact .v04-inline-link{color:#b8ff01}.ikari-contact .field-error{color:#9d2726;font-size:14px;line-height:1.5}.ikari-contact .v04-contact-availability p{color:#d2d0c9}
  .reference-options,.service-options{border:0;padding:0;margin:0;min-width:0}.reference-options legend,.service-options legend{font:650 16px/1.5 var(--font);padding:0;margin-bottom:12px}.reference-options legend span{font-weight:400}.brief-reference{border-bottom:1px solid #11131545;padding-bottom:25px;margin-bottom:25px}.brief-reference small{font-size:14px;line-height:1.6;color:#555b59}.reference-none{display:flex;align-items:flex-start;gap:10px;cursor:pointer;line-height:1.5;font-size:14px;padding-block:8px 18px}.reference-none input{accent-color:#111315;width:20px;height:20px;flex:0 0 auto;margin:1px 0}.reference-none input:focus-visible{outline:2px solid #111315;outline-offset:3px}
  .reference-picks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.reference-choice{position:relative;min-width:0;cursor:pointer;padding:6px;background:#fffdf7;border:1px solid #999b92}.reference-choice>input{position:absolute;top:12px;left:12px;width:21px;height:21px;accent-color:#111315;margin:0;z-index:1}.reference-choice-art{display:block;position:relative;aspect-ratio:1;background:#111315}.reference-choice-art img{display:block;width:100%;height:100%;object-fit:contain}.reference-choice-mark{position:absolute;right:5px;bottom:5px;display:grid;place-items:center;width:27px;height:27px;background:#b8ff01;color:#111315;font-size:19px;opacity:0}.reference-choice:has(input:checked){border:2px solid #111315;padding:5px;background:#b8ff01}.reference-choice:has(input:checked) .reference-choice-mark{opacity:1}.reference-choice:has(input:focus-visible){outline:3px solid #111315;outline-offset:3px}.reference-choice-title{display:block;font:650 14px/1.35 var(--font);margin-top:9px;overflow-wrap:anywhere}.reference-choice-artist{display:block;font-size:14px;line-height:1.4;margin-top:4px;overflow-wrap:anywhere;color:#444b43}
  .reference-library{margin-top:17px;border-top:1px solid #11131555}.reference-library summary{padding:14px 0;min-height:48px;font-size:14px;cursor:pointer;line-height:1.5;font-weight:600}.reference-library>summary>span{float:right;font-size:22px;line-height:1}.reference-library summary:focus-visible{outline:2px solid #111315;outline-offset:3px}.reference-group{border-top:1px solid #11131533}.reference-group>.reference-picks{padding-bottom:16px}.reference-card{background:#111315;color:#f3efe6;padding:14px;margin-top:18px;align-items:flex-start;gap:14px}.reference-card>div{min-width:0}.reference-card span{font-size:14px;color:#b8ff01}.reference-card strong{font-size:18px;overflow-wrap:anywhere}.reference-card p{font-size:14px;line-height:1.5;overflow-wrap:anywhere}.reference-card img{width:65px;height:65px;flex-shrink:0;object-fit:contain}.reference-remove{display:flex;align-items:center;min-height:44px;margin-top:7px;font-size:14px;cursor:pointer;text-decoration:underline;text-underline-offset:4px}.reference-unavailable{color:#111315;font-size:14px;line-height:1.6}
  .service-options>p{font-size:14px;color:#555b59;line-height:1.5;margin:0 0 16px}.service-stickers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.service-sticker{position:relative;min-width:0;cursor:pointer}.service-sticker:last-child{grid-column:1/-1}.service-sticker>input{position:absolute;top:14px;left:12px;width:20px;height:20px;accent-color:#111315;margin:0;z-index:1}.service-sticker>span{display:flex;align-items:center;gap:8px;min-height:72px;padding:12px 12px 12px 41px;border:1.5px solid #111315;background:#fffdf7;font-size:14px;font-weight:650;line-height:1.4;transition:background .18s,box-shadow .18s;overflow-wrap:anywhere}.service-number{font:500 14px/1 var(--mono);color:#555b59}.service-check{display:none;margin-left:auto;font-size:20px}.service-sticker:nth-child(3n+1)>span{transform:rotate(-1deg)}.service-sticker:nth-child(3n+2)>span{transform:rotate(1deg)}.service-sticker>input:checked+span{background:#b8ff01;box-shadow:3px 3px 0 #111315}.service-sticker>input:checked+span>.service-check{display:block}.service-sticker>input:focus-visible+span{outline:3px solid #111315;outline-offset:4px}.service-options[data-invalid=true] .service-sticker>span{border-color:#9d2726}
  .ikari-contact .v04-contact-photo.ikari-contact-identity{height:auto;min-height:0;background:none;border:0;overflow:visible;padding:36px 0 10px;color:#f3efe6;position:sticky;top:100px;margin:0;width:100%}.ikari-contact-identity:after{display:none}.ikari-contact-profile{min-width:0}.production-polaroid{padding:12px 12px 22px;background:#f3efe6;color:#111315;max-width:330px;margin:0 auto 45px;transform:rotate(-5deg);box-shadow:9px 10px 0 #08090b;position:relative}.production-polaroid:before{content:'';position:absolute;top:-13px;left:35%;width:95px;height:29px;background:#ff6b4ad9;transform:rotate(9deg)}.ikari-contact .ikari-contact-avatar{margin:0 0 19px;max-width:none;background:#b8ff01;border:0;box-shadow:none;transform:none}.ikari-contact-avatar img{display:block;width:100%;height:auto;aspect-ratio:1;object-fit:cover;object-position:center}.ikari-contact-signature{display:flex;align-items:end;justify-content:space-between;gap:15px;padding-inline:8px}.ikari-contact-signature strong{font:700 52px/1 var(--display);letter-spacing:-.06em}.ikari-contact-signature span{font-size:16px;line-height:1.4}.production-local-note{font-size:14px;line-height:1.6;color:#d2d0c9;margin-top:25px}
  @media(max-width:1023px){.ikari-contact .v04-contact-layout{grid-template-columns:minmax(0,1fr);gap:30px;max-width:740px}.ikari-contact .v04-contact-photo.ikari-contact-identity{position:relative;top:auto;order:0;padding:25px 0;max-width:480px;margin:0 auto}.ikari-contact .ikari-contact-avatar{max-width:none}.production-polaroid{max-width:270px}.ikari-contact .v04-contact-heading h1{font-size:clamp(44px,8vw,76px)}.production-thread{top:150px}.production-cross{top:10px}}
  @media(max-width:480px){.ikari-contact{padding:30px 20px 45px}.ikari-contact form{padding:20px 16px;box-shadow:5px 6px 0 #08090b}.production-form-head{gap:6px}.production-form-head>span:last-child{font-size:14px}.ikari-contact .v04-contact-heading h1{font-size:clamp(38px,10vw,48px)}.reference-picks{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.reference-library .reference-picks{grid-template-columns:repeat(2,minmax(0,1fr))}.service-stickers{gap:10px}.service-sticker>span{padding:39px 9px 12px;min-height:105px;display:block}.service-sticker>input{left:10px;top:11px}.service-number{display:none}.service-check{position:absolute;top:7px;right:10px}.service-sticker:last-child>span{min-height:68px;padding:14px 14px 14px 42px;display:flex}.service-sticker:last-child .service-check{position:static}.production-kanji{right:-70px;font-size:300px}.production-polaroid{max-width:230px}.ikari-contact .v04-contact-photo.ikari-contact-identity{padding-inline:4px}.ikari-contact-signature strong{font-size:48px}}
  .reference-cover-unavailable{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:100%;padding:8px;text-align:center;font-size:12px;line-height:1.35;background:#e4e0d5;color:#111315}
  .reference-choice-art img{opacity:1}
  .reference-swipe-hint{font-size:13px;line-height:1.5;margin:0 0 10px;color:#555b59}
  @media(max-width:768px){
    .reference-picks.reference-carousel{display:flex;gap:10px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;scroll-padding:4px;padding:4px 4px 14px;margin:0 -4px 8px;max-width:calc(100% + 8px);touch-action:pan-x pan-y;scrollbar-width:thin;scrollbar-color:#111315 #ddd8cb}
    .reference-carousel .reference-choice{flex:0 0 124px;scroll-snap-align:start;align-self:stretch}
    .reference-carousel .reference-choice-art{aspect-ratio:1}
    .reference-carousel .reference-choice-title{font-size:14px;line-height:1.35;overflow-wrap:break-word;word-break:normal}
    .reference-carousel .reference-choice-artist{font-size:12px;overflow-wrap:break-word}
    .service-stickers{grid-template-columns:minmax(0,1fr);gap:9px}
    .service-sticker:last-child{grid-column:auto}
    .service-sticker>input{left:12px;top:50%;transform:translateY(-50%);accent-color:#b8ff01}
    .service-sticker>span,.service-sticker:last-child>span{display:flex;align-items:center;min-height:50px;padding:11px 12px 11px 42px;background:#111315;color:#f3efe6;border:1.5px solid #111315;transform:none;overflow-wrap:break-word}
    .service-sticker:nth-child(n)>span{transform:none}
    .service-number{display:none}
    .service-check,.service-sticker:last-child .service-check{position:static;margin-left:auto;flex-shrink:0;font-size:18px}
    .service-sticker>input:checked+span{color:#111315;background:#b8ff01;box-shadow:3px 3px 0 #111315}
    .service-sticker>input:checked{accent-color:#111315}
  }
  @media(prefers-reduced-motion:reduce){.service-sticker>span,.reference-card{transition:none;animation:none}.production-polaroid,.service-sticker:nth-child(n)>span{transform:none}}
</style>

