import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { provisionOwner } from '../src/lib/server/auth';
import { sqlite } from '../src/lib/server/db/index';

function hiddenQuestion(label: string): Promise<string> {
  if (!stdin.isTTY) throw new Error('Use um terminal interativo local. Senhas não são aceitas em argumentos.');
  stdout.write(label);
  stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    function done() { stdin.removeListener('data', input); stdin.setRawMode(false); stdin.pause(); stdout.write('\n'); }
    function input(chunk: string) {
      for (const character of chunk) {
        if (character === '\u0003') { done(); reject(new Error('Operação cancelada.')); return; }
        if (character === '\r' || character === '\n') { done(); resolve(value); return; }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ' && value.length < 128) value += character;
      }
    }
    stdin.on('data', input);
  });
}
try {
  if (sqlite.prepare('SELECT userId FROM owner WHERE id=1').get()) throw new Error('Esta instalação já possui proprietário.');
  if (!stdin.isTTY) throw new Error('Abra um terminal local interativo para criar o proprietário.');
  const terminal = createInterface({ input: stdin, output: stdout });
  const email = await terminal.question('E-mail do proprietário: '); terminal.close();
  const password = await hiddenQuestion('Senha (mínimo 12 caracteres, entrada oculta): ');
  const confirmation = await hiddenQuestion('Repita a senha: ');
  if (password !== confirmation) throw new Error('As senhas não coincidem.');
  await provisionOwner(email, password);
  console.log('Proprietário criado nesta instalação. Cadastro público permanece fechado.');
} catch (error) { console.error(error instanceof Error ? error.message : 'Não foi possível criar o proprietário.'); process.exitCode = 1; }
finally { sqlite.close(); }
