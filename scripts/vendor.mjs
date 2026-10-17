// Copies Transformers.js and the ONNX Runtime WASM files into vendor/.
// Chrome MV3 extensions can't load code from a CDN, so these must ship inside the extension.
// Run with:  pnpm run setup   (installs packages, then runs this)
import { build } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendor = join(root, 'vendor');
const nm = join(root, 'node_modules');
mkdirSync(vendor, { recursive: true });

// 1. Bundle Transformers.js (with onnxruntime-web) into one browser ES module.
try {
  const result = await build({
    entryPoints: [join(root, 'scripts', 'embedder-entry.js')],
    outfile: join(vendor, 'transformers.bundle.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'chrome116',
    minify: true,
    legalComments: 'none',
    logLevel: 'warning',
    metafile: true,
  });
  const cache = join(nm, '.cache', 'recall');
  mkdirSync(cache, { recursive: true });
  writeFileSync(join(cache, 'build-meta.json'), JSON.stringify(result.metafile, null, 2));
  console.log('✓ bundled vendor/transformers.bundle.js');
} catch (e) {
  // Fallback: the package ships a ready-made browser build.
  const candidates = ['transformers.web.min.js', 'transformers.min.js', 'transformers.web.js', 'transformers.js'];
  const dist = join(nm, '@huggingface', 'transformers', 'dist');
  const found = candidates.map((f) => join(dist, f)).find(existsSync);
  if (!found) throw new Error('Could not bundle or find a browser build of Transformers.js: ' + e.message);
  copyFileSync(found, join(vendor, 'transformers.bundle.js'));
  console.log('✓ copied prebuilt ' + found.replace(root, '.') + ' -> vendor/transformers.bundle.js');
}

// 2. Copy the ONNX Runtime WASM binaries and their loader modules.
const wasmDirs = [
  join(nm, 'onnxruntime-web', 'dist'),
  join(nm, '@huggingface', 'transformers', 'node_modules', 'onnxruntime-web', 'dist'),
  join(nm, '@huggingface', 'transformers', 'dist'),
].filter((d) => existsSync(d));

const bundle = readFileSync(join(vendor, 'transformers.bundle.js'), 'utf8');
const needed = Array.from(new Set(bundle.match(/ort-wasm[a-z0-9.-]*\.(?:wasm|mjs)/g) || []));
if (!needed.some(f => f.endsWith('.wasm')) || !needed.some(f => f.endsWith('.mjs'))) throw new Error('Could not identify the bundled ONNX runtime assets.');
for (const f of needed) {
  const src = wasmDirs.map(dir => join(dir, f)).find(existsSync);
  if (!src) throw new Error('Missing matching ONNX runtime asset: ' + f);
  copyFileSync(src, join(vendor, f));
}
for (const f of readdirSync(vendor)) {
  if (/^ort-wasm[a-z0-9.-]*\.(wasm|mjs)$/.test(f) && !needed.includes(f)) unlinkSync(join(vendor, f));
}
const copied = needed.length;
console.log(`✓ copied ${copied} ONNX Runtime file(s) into vendor/`);
console.log('\nDone. Load this folder in chrome://extensions with "Load unpacked".');
