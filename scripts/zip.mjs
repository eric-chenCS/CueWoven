// Packs the extension (with vendor/) into recall-v3.1.zip for local sharing
// or for copying to another machine. Uses system zip or Windows' built-in tar.
import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';

const runtime=['transformers.bundle.js','ocr/ocr.bundle.js','ocr/worker.min.js','ocr/eng.traineddata.gz',...['','simd-','relaxedsimd-'].map(kind=>'ocr/tesseract-core-'+kind+'lstm.wasm.js')];
if (!runtime.every(file=>existsSync('vendor/'+file))) {
  console.error('Run "pnpm run setup" first so vendor/ exists.');
  process.exit(1);
}
const items = ['manifest.json', 'background.js', 'content', 'capture', 'lib', 'offscreen', 'options', 'popup', 'styles', 'icons', 'vendor', 'licenses', 'README.md', 'INSTALL.md', 'docs', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'CONTRIBUTING.md', 'scripts', 'tests'];
if (existsSync('recall-v3.1.zip')) unlinkSync('recall-v3.1.zip');
if (process.platform === 'win32') {
  execFileSync('tar.exe', ['-a', '-cf', 'recall-v3.1.zip', ...items], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-qr', 'recall-v3.1.zip', ...items], { stdio: 'inherit' });
}
console.log('✓ recall-v3.1.zip');
