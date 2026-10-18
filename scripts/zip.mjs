// Packs the extension (with vendor/) into a versioned ZIP for local sharing
// or for copying to another machine. Uses system zip or Windows' built-in tar.
import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';

const runtime=['transformers.bundle.js','ocr/ocr.bundle.js','ocr/worker.min.js','ocr/eng.traineddata.gz',...['','simd-','relaxedsimd-'].map(kind=>'ocr/tesseract-core-'+kind+'lstm.wasm.js')];
if (!runtime.every(file=>existsSync('vendor/'+file))) {
  console.error('Run "pnpm run setup" first so vendor/ exists.');
  process.exit(1);
}
const items = ['samples', 'manifest.json', 'background.js', 'content', 'capture', 'lib', 'offscreen', 'options', 'popup', 'styles', 'icons', 'vendor', 'licenses', 'README.md', 'INSTALL.md', 'docs', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'CONTRIBUTING.md', 'scripts', 'tests'];
const archive = `weblapse-v${JSON.parse(readFileSync('manifest.json','utf8')).version}.zip`;
if (existsSync(archive)) unlinkSync(archive);
if (process.platform === 'win32') {
  execFileSync('tar.exe', ['-a', '-cf', archive, ...items], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-qr', archive, ...items], { stdio: 'inherit' });
}
console.log(`✓ ${archive}`);
