import { resolve } from 'node:path';
import { configuredDataDir, createBackup } from './operations';

try {
  const args = process.argv.slice(2), destinations = args.filter((arg) => !arg.startsWith('--'));
  if (destinations.length > 1 || args.some((arg) => arg.startsWith('--') && arg !== '--server-stopped')) {
    throw new Error('Uso: npm run backup -- --server-stopped [diretório-novo-de-destino]');
  }
  const result = await createBackup({
    dataDir: configuredDataDir(), serverStopped: args.includes('--server-stopped'),
    destination: destinations[0] ? resolve(destinations[0]) : undefined
  });
  console.log(JSON.stringify({ status: 'verified', ...result }, null, 2));
} catch (error) {
  console.error(`Backup recusado: ${error instanceof Error ? error.message : 'Falha de operação.'}`);
  process.exitCode = 1;
}
