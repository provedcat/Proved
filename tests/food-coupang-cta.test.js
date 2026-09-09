const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'js/food-list.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'css/food-list.css'), 'utf8');

assert.match(script, /'needs_calorie_review', '쿠팡_링크', 'brand_id'/, 'detail SELECT must include the stored Coupang link');
assert.match(script, /coupangLink\.trim\(\)/, 'null, empty, and whitespace-only values must not render the CTA');
assert.match(script, /href="\$\{escapeHtml\(coupangLink\)\}"/, 'CTA must use the database value rather than construct a URL');
assert.match(script, /target="_blank" rel="noopener noreferrer sponsored"/, 'affiliate link must open safely in a new tab');
assert.match(script, /aria-label="\$\{escapeHtml\(product\.primary\)\} 쿠팡에서 구매하기\(새 탭\)"/, 'affiliate link must describe its destination');
assert.match(script, /파트너스 링크/, 'CTA must use the approved supporting label');
assert.match(script, /이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다\./, 'required affiliate disclosure must be present');
assert.doesNotMatch(script, /공식 구매 링크|공식 판매처|공식몰/, 'CTA must not imply an official sales relationship');

const sourceSectionIndex = script.indexOf('aria-labelledby="foodSourceHeading"');
const ctaRenderIndex = script.indexOf('${coupangCta}', sourceSectionIndex);
assert.ok(sourceSectionIndex >= 0 && ctaRenderIndex > sourceSectionIndex, 'CTA must render after the information-status section');

assert.match(styles, /\.food-coupang-cta\s*\{[^}]*width:\s*min\(100%, 430px\)/s, 'desktop CTA must remain compact');
assert.match(styles, /\.food-coupang-cta__row\s*\{[^}]*display:\s*grid/s, 'Option C controls must stay in one row');
assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.food-coupang-cta\s*\{[^}]*width:\s*100%/s, 'mobile CTA may use the content width');
assert.doesNotMatch(styles, /\.food-coupang-cta[^}]*position:\s*(fixed|sticky)/s, 'CTA must remain in normal document flow');

console.log('food Coupang CTA tests passed');
