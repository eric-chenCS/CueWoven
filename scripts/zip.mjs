// Packs the extension (with vendor/) into recall-v2.2.zip for local sharing
// or for copying to another machine. Uses system zip or Windows' built-in tar.
import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';

if (!existsSync('vendor/transformers.bundle.js')) {
  console.error('Run "pnpm run setup" first so vendor/ exists.');
  process.exit(1);
}
const items = ['manifest.json', 'background.js', 'content', 'lib', 'offscreen', 'options', 'popup', 'styles', 'icons', 'vendor', 'licenses', 'README.md', 'INSTALL.md', 'TEST-REPORT.md', 'UPDATE-2.1.md', 'UPDATE-2.2.md', 'REVIEW.md', 'LIVE-TEST-RESULTS.json', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'CONTRIBUTING.md', 'scripts', 'tests'];
if (existsSync('recall-v2.2.zip')) unlinkSync('recall-v2.2.zip');
if (process.platform === 'win32') {
  execFileSync('tar.exe', ['-a', '-cf', 'recall-v2.2.zip', ...items], { stdio: 'inherit' });
} else {
  execFileSync('zip', ['-qr', 'recall-v2.2.zip', ...items], { stdio: 'inherit' });
}
console.log('✓ recall-v2.2.zip');
