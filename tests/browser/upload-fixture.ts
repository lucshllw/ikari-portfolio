import {copyFileSync, mkdtempSync, unlinkSync, rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const pending: {directory: string; file: string}[] = [];
export function webpUploadPath() {
  // WebKit for Windows can attach an empty File when its path contains accented
  // characters. Keep the real path upload and browser MIME detection, using the
  // same approved image bytes from an ASCII-only temporary directory.
  const directory = mkdtempSync(join(tmpdir(), 'frame-browser-upload-'));
  const file = join(directory, 'entre-planos-small.webp');
  copyFileSync('static/demo/entre-planos-small.webp', file);
  pending.push({directory, file});
  return file;
}
export function cleanUploadFixtures() {
  for (const {directory, file} of pending.splice(0)) {
    unlinkSync(file);
    rmdirSync(directory);
  }
}
