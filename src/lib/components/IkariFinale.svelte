<script lang="ts">
import {chromaticLetters} from '$lib/actions/chromatic-letters';
import {studioPointer,studioCurtain} from '$lib/actions/studio-motion';
import Icon from './Icon.svelte';
import { finaleMotion } from '$lib/actions/ikari-mobile-motion';
import {chapterMotion} from '$lib/actions/chapter-motion';
function rewind(event:MouseEvent){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});document.getElementById('conteudo')?.focus({preventScroll:true});}
</script>
<footer class="studio-finale" use:chapterMotion use:studioCurtain use:finaleMotion>
 <div class="finale-line" data-chapter-line></div><div class="finale-meta"><span>FIM DESTA CENA / INÍCIO DA PRÓXIMA</span><span>音楽 × 編集 × 作画</span></div>
 <div class="finale-name" use:chromaticLetters aria-label="Ikari"><div aria-hidden="true">{#each Array.from('IKARI') as letter}<span data-finale-letter><span data-finale-ink><span data-finale-touch>{letter}</span></span></span>{/each}<span class="finale-kanji" data-finale-letter><span data-finale-ink><span data-finale-touch>怒り</span></span></span></div></div>
 <div class="finale-bottom"><nav aria-label="Navegação do rodapé">{#each [['Início','/'],['Índice','/indice'],['Links','/links'],['Contato','/contato']] as [label,href]}<a {href} use:studioPointer={'magnet'}>{label} <Icon name="diagonal" size={18}/></a>{/each}</nav><a href="#conteudo" onclick={rewind} class="rewind">Rebobinar para o Frame 01 <Icon name="rewind" size={20}/></a></div>
 <p class="finale-note">Ikari / Animação 2D & edição <span>© {new Date().getFullYear()} IKARI STUDIO — Todos os direitos reservados</span></p>
</footer>
<style>
.studio-finale{position:relative;overflow:clip;background:#0a0b0d;color:#f3efe6;padding:45px clamp(22px,5vw,85px) 30px;isolation:isolate}.studio-finale:before{content:'';position:absolute;inset:0;z-index:-1;background:repeating-linear-gradient(90deg,transparent 0 110px,#f3efe608 111px 112px)}.finale-line{height:3px;background:#e62e2d;transform-origin:left}.finale-meta{display:flex;justify-content:space-between;gap:20px;margin-top:22px;font:12px var(--mono);color:#b8ff01}.finale-name{padding:60px 0 45px;perspective:900px}.finale-name>div{display:flex;align-items:center;justify-content:space-between}.finale-name [data-finale-letter]{display:inline-block;font:400 clamp(80px,22vw,350px)/.85 'Anton',sans-serif;letter-spacing:-.035em}.finale-kanji{font:900 clamp(40px,7vw,110px)/1.1 var(--jp);writing-mode:vertical-rl;color:transparent;-webkit-text-stroke:1px #ff6b4a;transform:rotate(5deg);margin-left:20px}.finale-bottom,.finale-bottom nav{display:flex;gap:clamp(16px,3vw,45px);align-items:center;justify-content:space-between;flex-wrap:wrap}.finale-bottom a{min-height:44px;display:inline-flex;align-items:center;gap:15px;font-size:16px}.rewind{color:#b8ff01;border-bottom:1px solid #b8ff0155}.finale-note{display:flex;gap:20px;justify-content:space-between;flex-wrap:wrap;border-top:1px solid #f3efe62b;margin-top:40px;padding-top:23px;font-size:13px;line-height:1.8;color:#c3c3bf}.studio-finale a:focus-visible{outline:2px solid #ff6b4a;outline-offset:5px}.studio-finale a:hover{color:#b8ff01}@media(max-width:600px){.finale-meta{font-size:12px;line-height:1.6}.finale-meta>span:last-child{display:none}.finale-name{padding:50px 0 40px}.finale-name [data-finale-letter]{font-size:20vw}.finale-kanji{font-size:7vw;margin-left:10px}.finale-bottom{gap:25px}.finale-bottom nav{gap:20px}.finale-bottom a{font-size:14px}.finale-note{margin-top:28px}}

.finale-name [data-finale-touch]{display:inline-block}.finale-name [data-finale-ink]{display:inline-block;transform-origin:center 70%}
.finale-name [data-finale-letter].finale-kanji{font:900 clamp(40px,7vw,110px)/1.1 var(--jp);letter-spacing:0}
@media(max-width:600px){.finale-name [data-finale-letter].finale-kanji{font-size:7vw}}
</style>
