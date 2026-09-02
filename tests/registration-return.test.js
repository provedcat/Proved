const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const calculatorSession = fs.readFileSync(path.join(root, 'js/calculator-session.js'), 'utf8');
const registrationScript = fs.readFileSync(path.join(root, 'js/feed-registration.js'), 'utf8');
const registrationPage = fs.readFileSync(path.join(root, 'feed-registration/index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

for (const relativePath of ['index.html', 'cat-food-calculator/index.html', 'dog-food-calculator/index.html']) {
  const html = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const registrationLink = html.match(/<a class="pc-feed-registration-link"[^>]*data-feed-registration-link[^>]*>/)?.[0] || '';
  assert.ok(registrationLink, `${relativePath} must include the calculator registration link`);
  assert.doesNotMatch(registrationLink, /target="_blank"/, `${relativePath} must keep registration in the PWA window`);
}

assert.match(calculatorSession, /return_to:\s*getCalculatorReturnPath\(\)/, 'calculator return path must be passed to registration');
assert.match(calculatorSession, /saveCalculatorDraft\(\)/, 'calculator state must be saved before registration');
assert.match(calculatorSession, /restorePendingRegisteredFeed/, 'registered feed must be restored after returning');
assert.match(registrationScript, /등록이 완료되었습니다\. 3초 후 계산기 화면으로 돌아갑니다\./, 'completion copy must explain the automatic return');
assert.match(registrationScript, /window\.setTimeout\(returnToCalculator, 3000\)/, 'automatic return must wait three seconds');
assert.match(registrationScript, /window\.location\.replace\(destination\)/, 'registration must be removed from browser history when returning');
assert.match(registrationScript, /CALCULATOR_PATHS/, 'return destinations must be restricted to calculator paths');
assert.doesNotMatch(registrationPage, /window\.close\(\)/, 'registration must not rely on closing a separate browser tab');
assert.match(serviceWorker, /proved-pwa-20260902-registration-return-v1/, 'PWA cache must be refreshed for the new navigation flow');

console.log('registration return flow tests passed');
