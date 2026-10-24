import { existsSync, readFileSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
const root = resolve('.svelte-kit/output/server');
const paths = [];
function walk(dir) { for(const name of readdirSync(dir)) { const path=join(dir,name); const stat=statSync(path); if(stat.isDirectory())walk(path);else paths.push(path); } }
walk(root);
// Unreferenced local chunks may be emitted by the compiler. They must not enter
// the traced cloud function, where no local credentials or SQLite belong.
const functionRoot=resolve('.vercel/output/functions');
let bundleFiles=0,violations=[];
if(existsSync(functionRoot)){
  const pending=[functionRoot],seen=new Set();
  while(pending.length){const dir=pending.pop(),real=realpathSync(dir);if(seen.has(real))continue;seen.add(real);for(const name of readdirSync(dir)){const path=join(dir,name),rel=relative(functionRoot,path).replaceAll('\\','/');const stat=statSync(path);if(stat.isDirectory()){if(/(?:^|\/)(?:\.local|\.ssh|\.aws|\.codex|\.git|AppData|OneDrive)(?:\/|$)/i.test(rel))violations.push(rel);else pending.push(path);}else{bundleFiles++;if(/(?:auth-secret|\.sqlite(?:-|$)|\.env(?:\.|$)|\.pem$|auth\.json$)/i.test(name))violations.push(rel);if(/\.(?:js|mjs)$/.test(name)&&/auth-secret|from ["']better-sqlite3["']|require\(["']better-sqlite3["']\)/.test(readFileSync(path,'utf8')))violations.push(rel);}}}
}
if(violations.length){console.error('Pacote cloud contém adaptadores/arquivos locais não permitidos.',violations.slice(0,20));process.exitCode=1;}
console.info(JSON.stringify({serverFiles:paths.length,bundleFiles,violations:violations.length}));
