const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('global footer links to one PROVED introduction', () => {
  const script = read('js/proved-header.js');
  assert.match(script, /href="\/about\/">PROVED<\/a>/);
  assert.doesNotMatch(script, /href="\/about\/">(?:PROVED 소개|운영자 소개)/);
});
test('introduction and independent policy pages have stable canonical paths', () => {
  const about = read('about/index.html');
  assert.match(about, /https:\/\/proved\.kr\/about\//);
  assert.match(about, /무엇을, 얼마나 먹어야 할까/);
  assert.match(about, /mailto:provedcat@gmail\.com/);
  assert.match(about, /href="\/support\/"/);
  assert.match(about, /href="\/privacy\/"/);
  assert.match(about, /href="\/terms\/"/);
  assert.doesNotMatch(about, /주요 정정기록/);
  assert.match(read('privacy/index.html'), /개인정보처리방침/);
  assert.match(read('terms/index.html'), /이용약관/);
  for (const segment of ['about','privacy','terms']) {
    assert.ok(read('sitemap.xml').includes('https://proved.kr/' + segment + '/'));
  }
});
test('message UI needs auth and uses owner-only support schema', () => {
  const html = read('support/index.html');
  const js = read('js/proved-support.js');
  assert.match(html, /id="supportAuth"/);
  assert.match(html, /id="supportWorkspace" hidden/);
  assert.match(html, /id="supportForm"/);
  assert.match(js, /sb\.auth\.getUser\(/);
  assert.match(js, /from\('support_threads'\)/);
  assert.match(js, /from\('support_messages'\)/);
  assert.match(js, /from\('support_reads'\)/);
  assert.match(js, /from\('support_operators'\)/);
  assert.match(js, /from\('support-attachments'\)/);
  assert.match(js, /createSignedUrl\(/);
  assert.match(js, /\.textContent = item\.body;/);
  assert.doesNotMatch(js, /service_role|SUPABASE_SERVICE_KEY/);
});
test('MY entry tracks unread answers and links to support inbox', () => {
  const my = read('my/index.html');
  const notice = read('js/my-support-notice.js');
  assert.match(my, /href="\/support\/"/);
  assert.match(my, /id="mySupportNotice"/);
  assert.match(notice, /from\('support_reads'\)/);
  assert.match(notice, /from\('support_messages'\)/);
});
