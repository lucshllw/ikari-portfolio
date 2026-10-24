import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import base from '../../playwright.config';

// Diagnostic probes are deliberately excluded from the default E2E suite.
if (!base.webServer || Array.isArray(base.webServer)) throw new Error('A probe exige um servidor temporário único.');
export default defineConfig({...base, webServer: {...base.webServer, cwd: fileURLToPath(new URL('../../', import.meta.url))}, testDir: fileURLToPath(new URL('.', import.meta.url)), testMatch: '**/*.probe.ts', timeout: 30_000});
