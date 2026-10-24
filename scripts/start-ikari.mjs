import {join} from 'node:path';import {homedir} from 'node:os';
process.env.DATA_DIR ||= join(process.env.LOCALAPPDATA||join(homedir(),'.local','share'),'Frame','ikari-preview');
process.env.FRAME_THEME='ikari';
process.env.HOST='127.0.0.1';
process.env.PORT='4177';
process.env.ORIGIN='http://127.0.0.1:4177';
await import('./start.mjs');
