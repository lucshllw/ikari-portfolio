import {provisionOwner} from '../src/lib/server/auth';import {seedDemo} from '../src/lib/server/seed';import {sqlite} from '../src/lib/server/db';
if(!process.env.DATA_DIR?.includes('frame-browser-')||!process.env.FRAME_QA_PASSWORD)throw new Error('Use apenas o ambiente temporário de teste.');
if(!sqlite.prepare('SELECT userId FROM owner WHERE id=1').get())await provisionOwner('editor@example.test',process.env.FRAME_QA_PASSWORD);seedDemo();sqlite.close();console.log('Instalação temporária de testes preparada.');
