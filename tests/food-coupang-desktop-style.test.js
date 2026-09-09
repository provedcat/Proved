const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'food/index.html'), 'utf8');
const desktopStyles = fs.readFileSync(path.join(root, 'css/food-coupang-cta-desktop.css'), 'utf8');

assert.match(page, /food-coupang-cta-desktop\.css\?v=20260909-desktop-link-v1/, 'desktop CTA refinement stylesheet must be loaded');
assert.match(desktopStyles, /@media \(min-width: 721px\)/, 'desktop treatment must not override the mobile Option C layout');
assert.match(desktopStyles, /\.food-coupang-cta__button\s*\{[\s\S]*background:\s*transparent;/, 'desktop purchase action must render as a link rather than a filled button');
assert.match(desktopStyles, /\.food-coupang-cta__button\s*\{[\s\S]*color:\s*var\(--food-blue\);/, 'desktop purchase link must use Proved blue like the official-homepage link');
assert.match(desktopStyles, /\.food-coupang-cta__label,[\s\S]*\.food-coupang-cta__button\s*\{[\s\S]*border:\s*0;/, 'desktop affiliate row must not use boxed controls');
assert.doesNotMatch(desktopStyles, /position:\s*(fixed|sticky)/, 'desktop CTA must remain in normal document flow');

console.log('food Coupang desktop style tests passed');
