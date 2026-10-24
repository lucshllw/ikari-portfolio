import {defineConfig} from '@playwright/test';
import {randomBytes,randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const dataDir=join(tmpdir(),'frame-browser-ikari-studio-v13-'+randomUUID()),password=randomBytes(24).toString('base64url');
process.env.FRAME_QA_PASSWORD=password;process.env.FRAME_IKARI_QA_DATA_DIR=dataDir;
export default defineConfig({testDir:fileURLToPath(new URL('.',import.meta.url)),testMatch:'studio-os-v13.spec.ts',workers:1,timeout:60000,reporter:'list',use:{baseURL:'http://127.0.0.1:4191',viewport:{width:1440,height:1000},trace:'retain-on-failure'},projects:[{name:'chromium',use:{browserName:'chromium'}},{name:'webkit',use:{browserName:'webkit'}}],webServer:{cwd:fileURLToPath(new URL('../../',import.meta.url)),command:'node --import tsx tests/prepare-ikari.ts && npx vite --host 127.0.0.1 --port 4191',url:'http://127.0.0.1:4191',reuseExistingServer:false,timeout:60000,env:{DATA_DIR:dataDir,FRAME_THEME:'ikari',HOST:'127.0.0.1',PORT:'4191',ORIGIN:'http://127.0.0.1:4191',BETTER_AUTH_SECRET:'studio-browser-isolated-secret-at-least-32-characters',FRAME_QA_PASSWORD:password}}});
