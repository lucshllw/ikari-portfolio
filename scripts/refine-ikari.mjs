import {join,resolve} from 'node:path';import {homedir} from 'node:os';import {execFileSync} from 'node:child_process';
const env={...process.env,DATA_DIR:process.env.DATA_DIR||join(process.env.LOCALAPPDATA||join(homedir(),'.local','share'),'Frame','ikari-preview'),FRAME_THEME:'ikari'};
if(process.argv[2])env.IKARI_EXCERPT_SOURCE_DIR=resolve(process.argv[2]);
execFileSync(process.execPath,['--import','tsx','scripts/ikari-refine.ts'],{env,stdio:'inherit'});
