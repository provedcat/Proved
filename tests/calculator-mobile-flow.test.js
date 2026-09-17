const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calculator = fs.readFileSync(path.join(root, 'js/calculator.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');

assert.doesNotMatch(calculator, /pc-mobile-collapsed|mobileStepState/, 'mobile calculator sections must remain expanded');
assert.doesNotMatch(calculator, /pc-mobile-step-next/, 'mobile-only accordion navigation must not be injected');
assert.doesNotMatch(styles, /pc-mobile-collapsed|pc-mobile-step-next/, 'mobile accordion styles must not hide calculator fields');
assert.doesNotMatch(styles, /#ratioStep\s*>\s*\.pc-primary-button\s*\{\s*display\s*:\s*none/, 'the calculate action must remain available on mobile');

for (const relativePath of ['cat-food-calculator/index.html', 'dog-food-calculator/index.html']) {
  const html = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const feeds = html.indexOf('id="feedsStep"');
  const pet = html.indexOf('id="petInfoStep"');
  const ratio = html.indexOf('id="ratioStep"');
  assert.ok(feeds >= 0 && feeds < pet && pet < ratio, `${relativePath} must preserve the continuous feed, pet, ratio input order`);
}

console.log('calculator mobile flow tests passed');
