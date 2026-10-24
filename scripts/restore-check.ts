import { checkRestore, configuredDataDir } from './operations';

try {
  if (!process.argv[2] || process.argv.length !== 3) throw new Error('Uso: npm run restore:check -- caminho-do-pacote');
  const result = await checkRestore(process.argv[2], { dataDir: configuredDataDir() });
  console.log(JSON.stringify({ status: 'verified', sessionsRevoked: true, ...result }, null, 2));
} catch (error) {
  console.error(`Restauração de verificação recusada: ${error instanceof Error ? error.message : 'Falha de operação.'}`);
  process.exitCode = 1;
}
