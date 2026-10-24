import {join} from 'node:path';import {homedir} from 'node:os';import {execFileSync} from 'node:child_process';
const env={...process.env,DATA_DIR:process.env.DATA_DIR||join(process.env.LOCALAPPDATA||join(homedir(),'.local','share'),'Frame','ikari-preview'),FRAME_THEME:'ikari'};
execFileSync(process.execPath,['--import','tsx','scripts/ikari-seed.ts'],{env,stdio:'inherit'});
execFileSync(process.execPath,['--import','tsx','scripts/ikari-refine.ts'],{env,stdio:'inherit'});
