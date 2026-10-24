import { migrate, sqlite } from '../src/lib/server/db/index';
try { migrate(); console.log('Banco local atualizado para schema 1.'); }
finally { sqlite.close(); }
