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
same(avatar.normalize({
  shape: '02_08', color: 'blue', patternCentral: 'muzzle',
  patternEar: 'long_ear', patternOuter: 'raccoon', eyeColor: 'emerald',
  eyePattern: 'cat_eye', blush: 'pink', nose: 'brown'
}, 'dog'), {
  shape: '02_08', color: 'blue', patternCentral: 'muzzle',
  patternEar: 'long_ear', patternOuter: 'raccoon', eyeColor: 'emerald',
  eyePattern: 'cat_eye', blush: 'pink', nose: 'brown'
});
assert.equal(avatar.normalize({ shape: '02_08', patternCentral: 'raccoon' }, 'cat').shape, '02_08');
assert.equal(avatar.normalize({ shape: '02_01' }, 'dog').shape, '02_01');
assert.equal(avatar.normalize({ patternCentral: 'raccoon' }, 'cat').patternCentral, null);
assert.equal(avatar.normalize({ patternCentral: 'sold' }, 'cat').patternCentral, 'sold');

context.Image = class {
  set src(value) { this.value = value; queueMicrotask(() => this.onload()); }
};
const clippedContext = { clearRect() {}, drawImage() {}, globalCompositeOperation: 'source-over', globalAlpha: 1 };
context.document = { createElement: () => ({ getContext: () => clippedContext }) };
const draws = [];
const mainContext = {
  clearRect() {}, fillRect() {}, globalCompositeOperation: 'source-over', globalAlpha: 1,
  drawImage() { draws.push({ mode: this.globalCompositeOperation, alpha: this.globalAlpha }); }
};
avatar.render({ width: 256, height: 256, getContext: () => mainContext }, {
  color: 'black', patternCentral: 'sold', patternEar: 'long_ear'
}, 'cat').then(async () => {
  assert.deepEqual(draws[3], { mode: 'overlay', alpha: 1 });
  assert.deepEqual(draws[4], { mode: 'color-burn', alpha: .6 });
  draws.length = 0;
  await avatar.render({ width: 256, height: 256, getContext: () => mainContext }, {
    color: 'soft_gray', patternCentral: 'sold', patternEar: 'long_ear'
  }, 'cat');
  assert.deepEqual(draws[3], { mode: 'overlay', alpha: .6 });
  assert.deepEqual(draws[4], { mode: 'color-burn', alpha: .6 });
  draws.length = 0;
  await avatar.render({ width: 256, height: 256, getContext: () => mainContext }, {
    color: 'pure_white', patternCentral: 'muzzle'
  }, 'cat');
  assert.deepEqual(draws[3], { mode: 'color-burn', alpha: 1 });
  console.log('Pet avatar asset, settings, and blend checks passed.');
}).catch(error => { console.error(error); process.exitCode = 1; });
