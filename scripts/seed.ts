import { sqlite } from '../src/lib/server/db/index';
import { seedDemo } from '../src/lib/server/seed';
try {
  const added = seedDemo();
  console.log(`${added} exemplos demonstrativos adicionados. Trabalhos existentes foram preservados.`);
} catch (error) { console.error(error instanceof Error ? error.message : 'Não foi possível criar os exemplos.'); process.exitCode = 1; }
finally { sqlite.close(); }
