import {refreshDemoTheme} from '../src/lib/server/demo-theme';
import {sqlite} from '../src/lib/server/db';
try{console.log('Exemplos de fábrica atualizados:',refreshDemoTheme());}finally{sqlite.close();}
