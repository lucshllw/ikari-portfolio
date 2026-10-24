import {sqlite,recordAudit} from './db';

const oldDescription='EXEMPLO DEMONSTRATIVO — Projeto fictício para apresentar as possibilidades deste modelo. A imagem é um estudo visual original. Substitua este conteúdo pelos seus próprios trabalhos e créditos.';
const works=[
  ['intervalo-demo','Intervalo','Ritmo, pausa e contraste em um estudo de montagem.','ritmo','Entre planos','Um exercício de montagem sobre ritmo, pausa e ponto de vista.','Pessoa de costas diante de uma janela ao entardecer'],
  ['materia-demo','Matéria em movimento','Forma e tipografia exploram o tempo em um estudo de motion.','orbita','Cena em construção','Bastidores de um filme independente: imagem, intenção e processo.','Operador de câmera em um set de curta-metragem'],
  ['sinal-demo','Sinal','Um laboratório visual de luz, textura e interferência.','fragmentos','Luz de ensaio','Um estudo de atmosfera e narrativa em luz prática.','Retrato cinematográfico em uma rua à noite'],
  ['entrelinhas-demo','Entrelinhas','Um exercício editorial de sequência, composição e narrativa.','entre-planos','Fora de quadro','Detalhes e materiais de um cenário construído à mão.','Mãos trabalhando em uma maquete de cenário']
];
// Explicit local CLI migration only. Exact factory matches prevent overwriting
// client projects, edited fixtures, deleted examples or custom identity fields.
export function refreshDemoTheme():{projects:number;settings:number}{
  return sqlite.transaction(()=>{
    let projects=0,settings=0;
    for(const [slug,title,summary,cover,nextTitle,nextSummary,alt] of works){
      const result=sqlite.prepare('UPDATE projects SET title=?,summary=?,coverAlt=?,updatedAt=? WHERE slug=? AND title=? AND summary=? AND description=? AND coverUrl=? AND coverAlt=? AND videoUrl=? AND coverMediaId IS NULL').run(nextTitle,nextSummary,`${alt}, imagem gerada demonstrativa`,new Date().toISOString(),slug,title,summary,oldDescription,`/demo/${cover}.webp`,`Estudo visual abstrato para ${title}, exemplo demonstrativo`,'');
      projects+=result.changes;
    }
    const row=sqlite.prepare('SELECT value FROM site_settings WHERE id=1').get() as {value:string}|undefined;
    if(row){
      const value=JSON.parse(row.value);
      const pairs:Record<string,[string,string]>={
        headline:['Seu olhar.\nOutro ritmo.','Cada corte,\numa intenção.'],
        subheadline:['Edição e motion design para transformar boas ideias em imagens que ficam.','Histórias ganham outra vida quando encontram o olhar certo. Edição, motion e narrativa para ideias que permanecem.'],
        accentColor:['#d14421','#344ccd'],
        servicesText:['Edição de vídeo\nMotion design\nConteúdo digital','Edição\nMotion\nNarrativa']
      };
      for(const [key,[old,next]] of Object.entries(pairs))if(value[key]===old){value[key]=next;settings++;}
      if(settings)sqlite.prepare('UPDATE site_settings SET value=? WHERE id=1').run(JSON.stringify(value));
    }
    if(projects||settings)recordAudit('system:demo','demo.theme.v04','factory-examples');
    return {projects,settings};
  }).immediate();
}
