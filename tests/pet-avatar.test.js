const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/pet-avatar-renderer.js'), 'utf8'), context);
const avatar = context.window.ProvedAvatar;
const same = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);

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
console.log('Pet avatar asset and settings checks passed.');
