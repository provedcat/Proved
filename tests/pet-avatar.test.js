const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/pet-avatar-renderer.js'), 'utf8'), context);
const avatar = context.window.ProvedAvatar;
const same = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
assert.equal(Object.keys(avatar.catalog.color).length, 15);
assert.equal(avatar.catalog.color.skyblue.name, '하늘색');
assert.equal(avatar.catalog.color.pure_white.name, '퓨어 화이트');
assert.equal(Object.keys(avatar.catalog.background).length, 5);
assert.equal(avatar.normalize({}, 'cat').background, 'back00');
assert.equal(avatar.normalize({ background: 'back02' }, 'dog').background, 'back02');
assert.equal(avatar.normalize({ color: 'calico' }, 'cat').color, 'calico');
assert.equal(avatar.normalize({ color: 'pure_white' }, 'cat').color, 'pure_white');

for (const [group, options] of Object.entries(avatar.catalog)) {
  for (const [key, item] of Object.entries(options)) {
    for (const src of [item.src, item.mask, item.shadow, item.light].filter(Boolean)) {
      assert.ok(fs.existsSync(path.join(root, src.split('?')[0])), group + '/' + key + ': ' + src);
    }
    if (['eyeColor','eyePattern','blush','nose'].includes(group)) {
      assert.ok(fs.existsSync(path.join(root, 'images/pet-avatar/thumbs', item.file + '.webp')));
    }
  }
}
const sources = fs.readdirSync(path.join(root, 'images/pet-avatar/assets'), { withFileTypes: true });
let originalCount = 0;
for (const folder of sources.filter(item => item.isDirectory())) {
  for (const filename of fs.readdirSync(path.join(root, 'images/pet-avatar/assets', folder.name)).filter(name => name.endsWith('.png'))) {
    const data = fs.readFileSync(path.join(root, 'images/pet-avatar/assets', folder.name, filename));
    assert.equal(data.toString('ascii', 1, 4), 'PNG');
    const size = folder.name === '08_back' ? 1254 : 1024;
    assert.equal(data.readUInt32BE(16), size, filename + ' width');
    assert.equal(data.readUInt32BE(20), size, filename + ' height');
    originalCount++;
  }
}
assert.equal(originalCount, 77);
same(avatar.normalize({
  shape: '02_08', color: 'blue', patternCentral: 'muzzle',
  patternEar: 'long_ear', patternOuter: 'raccoon', eyeColor: 'emerald',
  eyePattern: 'cat_eye', blush: 'pink', nose: 'brown'
}, 'dog'), {
  shape: '02_08', color: 'blue', background: 'back00', patternCentral: 'muzzle',
  patternEar: 'long_ear', patternOuter: 'raccoon', eyeColor: 'emerald',
  eyePattern: 'cat_eye', blush: 'pink', nose: 'brown'
});
assert.equal(avatar.normalize({ shape: '02_08', patternCentral: 'raccoon' }, 'cat').shape, '02_08');
assert.equal(avatar.normalize({ shape: '02_01' }, 'dog').shape, '02_01');
assert.equal(avatar.normalize({ patternCentral: 'raccoon' }, 'cat').patternCentral, null);
assert.equal(avatar.normalize({ patternCentral: 'sold' }, 'cat').patternCentral, 'sold');
assert.equal(avatar.catalog.patternCentral.sold.name, '눈');
assert.equal(avatar.catalog.patternCentral.muzzle.name, '입');

context.Image = class {
  set src(value) { this.value = value; queueMicrotask(() => this.onload()); }
};
const clippedContext = { clearRect() {}, drawImage() {}, globalCompositeOperation: 'source-over', globalAlpha: 1 };
context.document = { createElement: () => ({ getContext: () => clippedContext }) };
const draws = [];
const mainContext = {
  clearRect() {}, fillRect() {}, globalCompositeOperation: 'source-over', globalAlpha: 1,
  drawImage(image, x, y, width, height) { draws.push({ mode: this.globalCompositeOperation, alpha: this.globalAlpha, src: image.value, width, height }); }
};
avatar.render({ width: 1024, height: 1024, getContext: () => mainContext }, {
  color: 'black', patternCentral: 'sold', patternEar: 'long_ear'
}, 'cat').then(async () => {
  assert.match(draws[0].src, /08_back00\.png/);
  assert.equal(draws[0].width, 1024);
  assert.deepEqual({ mode: draws[4].mode, alpha: draws[4].alpha }, { mode: 'overlay', alpha: 1 });
  assert.deepEqual({ mode: draws[5].mode, alpha: draws[5].alpha }, { mode: 'color-burn', alpha: .6 });
  draws.length = 0;
  await avatar.render({ width: 1024, height: 1024, getContext: () => mainContext }, {
    color: 'soft_gray', background: 'back02', patternCentral: 'sold', patternEar: 'long_ear'
  }, 'cat');
  assert.match(draws[0].src, /08_back02\.png/);
  assert.deepEqual({ mode: draws[4].mode, alpha: draws[4].alpha }, { mode: 'overlay', alpha: .6 });
  assert.deepEqual({ mode: draws[5].mode, alpha: draws[5].alpha }, { mode: 'color-burn', alpha: .6 });
  draws.length = 0;
  await avatar.render({ width: 1024, height: 1024, getContext: () => mainContext }, {
    color: 'pure_white', patternCentral: 'muzzle'
  }, 'cat');
  assert.deepEqual({ mode: draws[4].mode, alpha: draws[4].alpha }, { mode: 'color-burn', alpha: 1 });
  console.log('Pet avatar asset, settings, and blend checks passed.');
}).catch(error => { console.error(error); process.exitCode = 1; });
