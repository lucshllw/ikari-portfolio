import {test,expect} from '@playwright/test';
import Database from 'better-sqlite3';
import {join} from 'node:path';

test('one finite claquette covers initial, reload and route changes but not filters or anchors',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('.chapter-opening')).toHaveCount(1);await expect(page.locator('.opening,.ikari-route-curtain,.skip-scene')).toHaveCount(0);await expect(page.locator('.chapter-opening.active')).toHaveCount(0,{timeout:4000});
 await page.reload();await expect(page.locator('.chapter-opening.active')).toHaveCount(0,{timeout:4000});
 // Capture coverage through DOM mutations instead of timing a screenshot by chance.
 await page.evaluate(()=>{(window as any).__openings=[];new MutationObserver(()=>{const n=document.querySelector('.chapter-opening.active');if(n)(window as any).__openings.push(n.querySelector('.opening-destination')?.textContent);}).observe(document.querySelector('.chapter-opening')!,{attributes:true,subtree:true,childList:true});});
 await page.locator('.hud-index').click();await expect(page).toHaveURL(/\/indice$/);await expect(page.locator('.chapter-opening.active')).toHaveCount(0);expect(await page.evaluate(()=>(window as any).__openings.includes('Índice'))).toBe(true);
 await page.evaluate(()=>(window as any).__openings=[]);await page.locator('.archive-filters a').filter({hasText:'Direção visual'}).click();await expect(page.locator('.row-link')).toHaveCount(4);expect(await page.evaluate(()=>(window as any).__openings.length)).toBe(0);
 for(const path of ['/sobre','/contato','/']){await page.locator(path==='/'?'.studio-brand':`.studio-nav a:visible[href="${path}"]`).click();await expect(page).toHaveURL(new RegExp(path==='/'?'/$':path+'$'));await expect(page.locator('.chapter-opening.active')).toHaveCount(0);await expect(page.locator('#conteudo')).not.toHaveAttribute('inert','');}
 await page.goBack();await expect(page).toHaveURL(/\/contato$/);await expect(page.locator('.chapter-opening.active')).toHaveCount(0);await page.goForward();await expect(page).toHaveURL(/\/$/);await expect(page.locator('.chapter-opening.active')).toHaveCount(0);
 // Repeated user clicks and skip cannot strand the curtain or content focus.
 await page.locator('.hud-index').dblclick();await expect(page).toHaveURL(/\/indice$/);await expect(page.locator('.chapter-opening.active')).toHaveCount(0);expect(errors).toEqual([]);
});

test('hero reversible mask holds mural to coral with separate typography and ambient ownership',async({page})=>{
 await page.goto('/');await expect(page.locator('.chapter-opening.active')).toHaveCount(0);const hero=page.locator('.ikari-hero');await expect(hero).toHaveAttribute('data-motion-active','true');
 const fonts=await page.locator('.hero-intention h1>span').evaluateAll(nodes=>nodes.map(n=>({font:getComputedStyle(n).fontFamily,style:getComputedStyle(n).fontStyle})));expect(fonts[0]).toEqual(fonts[1]);expect(fonts[0].style).toBe('normal');
 await expect(page.locator('.art-scene')).toHaveAttribute('data-ambient-active','true');
 const geometry=await hero.evaluate(n=>({top:n.getBoundingClientRect().top+scrollY,range:n.clientHeight-n.querySelector<HTMLElement>('.fanzine-stage')!.offsetHeight}));
 for(const progress of [.25,.5,.75,1,.5,0]){await page.evaluate(({top,range,p})=>scrollTo(0,top+range*p),{...geometry,p:progress});await expect.poll(async()=>Number(await hero.getAttribute('data-scroll-progress'))).toBeCloseTo(progress*100,0);const transform=await page.locator('.fanzine-stage').evaluate(n=>getComputedStyle(n).transform);expect(transform).toBe('none');}
 await page.evaluate(({top,range})=>scrollTo(0,top+range+300),geometry);await expect(page.locator('.art-scene')).toHaveAttribute('data-ambient-active','false');const gap=await page.evaluate(()=>document.querySelector('.ikari-chapters')!.getBoundingClientRect().top-document.querySelector('.ikari-hero')!.getBoundingClientRect().bottom);expect(gap).toBeLessThanOrEqual(1);expect(gap).toBeGreaterThanOrEqual(-20);
 await page.evaluate(()=>scrollTo(0,0));await expect(page.locator('.art-scene')).toHaveAttribute('data-ambient-active','true');await page.emulateMedia({reducedMotion:'reduce'});await expect(hero).toHaveAttribute('data-motion','static');await expect(page.locator('.art-scene')).toHaveAttribute('data-ambient-active','false');
});

test('archive return restores category and selected row; reference can change without erasing a draft',async({page})=>{
 await page.goto('/indice?categoria=direcao-visual');await expect(page.locator('.row-link')).toHaveCount(4);const row=page.locator('.row-link').last();const href=await row.getAttribute('href');await row.click();await expect(page.locator('.chapter-opening.active')).toHaveCount(0);await expect(page.locator('.work-number')).toBeVisible();await page.getByRole('link',{name:'Voltar ao Índice',exact:true}).click();await expect(page).toHaveURL(/\/indice\?categoria=direcao-visual#cena-/);await expect(page.locator('.row-link')).toHaveCount(4);await page.locator(`.row-link[href="${href}"]`).click();
 await page.getByRole('link',{name:'Iniciar projeto',exact:true}).click();await expect(page).toHaveURL(/\/contato\?referencia=/);await expect(page.locator('.chapter-opening.active')).toHaveCount(0);await expect(page.locator('.reference-card')).toBeVisible();await page.getByLabel('Seu nome',{exact:true}).fill('Rascunho de teste');await page.getByLabel('Conte um pouco do projeto',{exact:true}).fill('Ideia preservada durante a escolha da referência.');
 await page.locator('input[name=referenceId]:not([value=""])').nth(1).check();await expect(page.locator('#name')).toHaveValue('Rascunho de teste');await expect(page.locator('#brief')).toHaveValue('Ideia preservada durante a escolha da referência.');await page.locator('.reference-remove').click();await expect(page.locator('input[name=referenceId]:checked')).toHaveValue('');await expect(page.locator('.reference-card')).toHaveCount(0);await expect(page.locator('#brief')).toHaveValue('Ideia preservada durante a escolha da referência.');
 await page.locator('.studio-nav a:visible[href="/sobre"]').click();await expect(page).toHaveURL(/\/sobre$/);await page.goBack();await expect(page.locator('#name')).toHaveValue('Rascunho de teste');await expect(page.locator('input[name=referenceId]:checked')).toHaveValue('');
});

test('reference validated server-side, failure preserves fields, valid inquiry is persisted once',async({page})=>{
 await page.goto('/contato');await expect(page.locator('.chapter-opening.active')).toHaveCount(0);
 await page.locator('#name').fill('V10 pedido verificado');await page.locator('#email').fill('v10@example.test');await page.getByRole('radio',{name:/Animação 2D/}).check();await page.locator('#brief').fill('Briefing de teste isolado para verificar referência, falha e reenvio.');
 const reference=await page.locator('input[name=referenceId][value]:not([value=""])').first().getAttribute('value');await page.locator(`input[name=referenceId][value="${reference}"]`).check();const key=await page.locator('input[name=requestKey]').inputValue();
 // A transport failure must preserve the client draft and the same idempotency key.
 await page.route('**/contato',async route=>{if(route.request().method()==='POST')await route.abort();else await route.continue();});
 await page.getByRole('button',{name:'Enviar pedido'}).click();await expect(page.getByRole('alert')).toContainText('Seus dados continuam aqui');await expect(page.locator('#brief')).toHaveValue(/Briefing de teste/);await expect(page.locator('input[name=referenceId]:checked')).toHaveValue(reference!);await page.unroute('**/contato');
 await page.getByRole('button',{name:'Enviar pedido'}).click();await expect(page.getByRole('status')).toContainText('Roteiro recebido');
 const db=new Database(join(process.env.FRAME_IKARI_QA_DATA_DIR!,'frame.sqlite'),{readonly:true});try{const rows=db.prepare('SELECT brief FROM inquiries WHERE requestKey=?').all(key) as {brief:string}[];expect(rows).toHaveLength(1);expect(rows[0].brief).toContain('Projeto de referência:');expect(rows[0].brief).toContain(reference!);}finally{db.close();}
});

test('all public chapters keep mobile/noJS access, visible archive control and no overflow',async({browser})=>{
 for(const noJS of [false,true]){const context=await browser.newContext({javaScriptEnabled:!noJS,reducedMotion:'reduce',viewport:{width:320,height:844}});const page=await context.newPage();try{
 for(const path of ['/','/indice','/sobre','/contato','/links']){await page.goto('http://127.0.0.1:4178'+path);await expect(page.locator('.chapter-opening.active')).toHaveCount(0);await expect(page.locator('.hud-index')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('h1')).toBeVisible();}
 await page.goto('http://127.0.0.1:4178/indice');await expect(page.locator('.row-link')).toHaveCount(23);await page.locator('.row-link').last().click();await expect(page.locator('[data-commission-player]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }finally{await context.close();}}
});
