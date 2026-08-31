const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const layout = fs.readFileSync(path.join(root, 'css/proved-layout.css'), 'utf8');
const header = fs.readFileSync(path.join(root, 'js/proved-header.js'), 'utf8');

const pages = [
  'feed-registration/index.html',
  'food/index.html',
  'food/conditions/index.html',
  'guide/calculation-method/index.html',
  'guide/feed-reading/index.html',
  'editorial/index.html'
];

assert.match(header, /data-proved-layout/, 'shared header must load the layout contract');

for (const token of [
  '--proved-hero-block-start',
  '--proved-hero-block-end',
  '--proved-title-size',
  '--proved-title-leading',
  '--proved-title-tracking',
  '--proved-copy-size',
  '--proved-copy-leading'
]) {
  assert.ok(layout.includes(token), `missing shared layout token: ${token}`);
}

for (const selector of [
  '.registration-hero h1',
  '.food-list-hero h1',
  '.condition-hero h1',
  '.guide-hero h1',
  '.fr-intro h1',
  '.ed-index-hero h1'
]) {
  assert.ok(layout.includes(selector), `page title is outside the shared hierarchy: ${selector}`);
}

for (const relativePath of pages) {
  const html = fs.readFileSync(path.join(root, relativePath), 'utf8');
  assert.match(html, /\/js\/proved-header\.js/, `${relativePath} must load the shared header/layout entrypoint`);
  assert.match(html, /SUIT-Variable\.css/, `${relativePath} must load the shared SUIT Variable font file`);
}

console.log('layout contract tests passed');
