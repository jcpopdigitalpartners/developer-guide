import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const base = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
const html = readFileSync('out/index.html', 'utf8');
assert.ok(existsSync('out/.nojekyll'), 'Missing .nojekyll');
assert.ok(html.includes(`href="${base}/"`), 'Home link has the wrong repository path');
assert.ok(html.includes(`href="${base}/icon.svg"`), 'Icon has the wrong repository path');
let checked = 0;
for (const [, reference] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (!reference.startsWith('/') || reference.startsWith('//')) continue;
  const pathname = reference.split(/[?#]/)[0];
  assert.ok(!base || pathname.startsWith(`${base}/`), `Asset escaped repository path: ${pathname}`);
  const relative = decodeURIComponent(pathname.slice(base.length)).replace(/^\/+/, '');
  const file = resolve('out', relative || 'index.html');
  assert.ok(existsSync(file), `Export is missing ${reference}`);
  checked += 1;
}
// Verify the same asset helper used by lessons and metadata, for both hosting
// modes and trailing slash normalization. This does not simulate a browser.
const source = readFileSync('lib/paths.ts', 'utf8');
for (const mount of ['', '/', '/developer-playbook', '/another-repository/']) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(code, { exports: module.exports, process: { env: { NEXT_PUBLIC_BASE_PATH: mount } } });
  const expected = mount.replace(/\/+$/, '');
  assert.equal(module.exports.sitePath('/audio/01.mp3'), `${expected}/audio/01.mp3`);
  assert.equal(module.exports.sitePath(''), `${expected}/`);
}
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
for (let i = 1; i <= 7; i += 1) {
  const name = `${String(i).padStart(2, '0')}.mp3`;
  assert.equal(digest(join('out/audio', name)), digest(join('public/audio', name)), `Changed or missing chapter ${name}`);
}
const chunks = readdirSync('out/_next/static/chunks', { recursive: true }).filter(name => name.endsWith('.js'));
assert.ok(chunks.some(name => readFileSync(join('out/_next/static/chunks', name), 'utf8').includes('Choose a point to play from there')), 'Player bundle is missing');
console.log(`Pages export verified: ${base || '/'}; ${checked} local links/assets; all 7 MP3s unchanged; root and repository asset helpers passed.`);
