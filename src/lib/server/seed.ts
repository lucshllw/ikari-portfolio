import { assertOwner } from './auth';
import { randomUUID } from 'node:crypto';
import { sqlite, recordAudit } from './db';
import { getPublicSettings } from './settings';
// Local CLI only: fixed demonstration fixtures, never user-supplied project data.
// HTTP services keep assertOwner and must not call this function from routes.
export function seedDemo(actorId?: string): number {
  if (actorId) assertOwner(actorId);
  const auditActor = actorId || 'system:demo';
  return sqlite.transaction(() => {
    if (!sqlite.prepare('SELECT id FROM site_settings WHERE id=1').get()) sqlite.prepare('INSERT INTO site_settings VALUES (1,?)').run(JSON.stringify(getPublicSettings()));
    const categories = [
      { name: 'Montagem', slug: 'montagem', sortOrder: 0 },
      { name: 'Motion', slug: 'motion', sortOrder: 1 },
      { name: 'Experimentos', slug: 'experimentos', sortOrder: 2 }
    ];
    for (const category of categories) if (!sqlite.prepare('SELECT id FROM categories WHERE slug=?').get(category.slug)) sqlite.prepare('INSERT INTO categories VALUES (?,?,?,?)').run(randomUUID(), category.name, category.slug, category.sortOrder);
    const works = [
      { slug: 'intervalo-demo', title: 'Entre planos', category: 'montagem', summary: 'Um exercício de montagem sobre ritmo, pausa e ponto de vista.', cover: 'ritmo', alt:'Pessoa de costas diante de uma janela ao entardecer' },
      { slug: 'materia-demo', title: 'Cena em construção', category: 'motion', summary: 'Bastidores de um filme independente: imagem, intenção e processo.', cover: 'orbita',alt:'Operador de câmera em um set de curta-metragem' },
      { slug: 'sinal-demo', title: 'Luz de ensaio', category: 'experimentos', summary: 'Um estudo de atmosfera e narrativa em luz prática.', cover: 'fragmentos',alt:'Retrato cinematográfico em uma rua à noite' },
      { slug: 'entrelinhas-demo', title: 'Fora de quadro', category: 'montagem', summary: 'Detalhes e materiais de um cenário construído à mão.', cover: 'entre-planos',alt:'Mãos trabalhando em uma maquete de cenário' }
    ];
    let added = 0;
    for (const [index, work] of works.entries()) {
      if (sqlite.prepare('SELECT key FROM demo_seed WHERE key=?').get(work.slug)) continue;
      const existing = sqlite.prepare('SELECT id FROM projects WHERE slug=?').get(work.slug) as { id: string } | undefined;
      if (existing) { sqlite.prepare('INSERT INTO demo_seed VALUES (?,?)').run(work.slug, existing.id); continue; }
      const category = sqlite.prepare('SELECT id FROM categories WHERE slug=?').get(work.category) as { id: string };
      const id = randomUUID(), now = new Date().toISOString();
      sqlite.prepare('INSERT INTO projects (id,slug,title,summary,description,categoryId,coverMediaId,coverUrl,coverAlt,videoUrl,featured,sortOrder,status,createdAt,updatedAt) VALUES (?,?,?,?,?,?,NULL,?,?,?, ?,?,?,?,?)').run(id, work.slug, work.title, work.summary, 'EXEMPLO DEMONSTRATIVO — Projeto fictício para apresentar as possibilidades deste modelo. A imagem é um estudo visual original. Substitua este conteúdo pelos seus próprios trabalhos e créditos.', category.id, `/demo/${work.cover}.webp`, `${work.alt}, imagem gerada demonstrativa`, '', Number(index === 0), index, 'published', now, now);
      sqlite.prepare('INSERT INTO demo_seed VALUES (?,?)').run(work.slug, id);
      recordAudit(auditActor, 'demo.seed', id);
      added++;
    }
    return added;
  }).immediate();
}
