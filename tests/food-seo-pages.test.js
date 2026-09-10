const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const module = await import(pathToFileURL(path.join(root, 'scripts/generate-food-pages.mjs')));
  const feed = { id: '12345678-aaaa-bbbb-cccc-123456789abc', 제조사: 'Farmina', 제품명: 'N&D Ancestral Chicken & Pomegranate' };
  assert.equal(module.buildProductSlug('Royal Canin Medium Adult'), 'royal-canin-medium-adult');
  assert.equal(module.buildProductPath(feed, 'cat'), '/food/cat/n-d-ancestral-chicken-pomegranate--12345678/');
  const html = module.renderProductPage(feed, 'cat');
  assert.match(html, /rel="canonical" href="https:\/\/proved\.kr\/food\/cat\/n-d-ancestral-chicken-pomegranate--12345678\/"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="twitter:card"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /window\.__PROVED_FOOD_PAGE__/);
  assert.match(html, /id="foodBackToList"[^>]+href="\/food\/"/);

  const temp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'proved-food-pages-'));
  const generated = await module.generateFoodPages({ root: temp, feedsBySpecies: { cat: [feed], dog: [{ ...feed, id: 'abcdef12-aaaa-bbbb-cccc-123456789abc', 제품명: 'Dog Food' }] } });
  assert.equal(generated.count, 2);
  const sitemap = await fs.promises.readFile(path.join(temp, 'sitemap-foods.xml'), 'utf8');
  assert.match(sitemap, /\/food\/cat\/n-d-ancestral-chicken-pomegranate--12345678\//);
  assert.match(sitemap, /\/food\/dog\/dog-food--abcdef12\//);
  await fs.promises.rm(temp, { recursive: true, force: true });
  console.log('food SEO page tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
