const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => readFile(path.join(root, file), 'utf8');

test('제조 태그는 소프트·반습식과 화식을 맨 앞에 둔다', async () => {
  const sql = await read('supabase/migrations/20260921180500_expand_processing_and_protein_tags.sql');
  assert.match(sql, /'soft_semi_moist','소프트·반습식'.*?,1,true/s);
  assert.match(sql, /'fresh_cooked','화식'.*?,2,true/s);
});

test('단백질원은 일반 → 해산물 → 특수 그룹 순서를 유지한다', async () => {
  const sql = await read('supabase/migrations/20260921180500_expand_processing_and_protein_tags.sql');
  for (const slug of ['goose','bonito','hoki','shrimp','krill','squid','octopus','mussel','shellfish','wallaby']) {
    assert.ok(sql.includes(`'${slug}'`), `${slug} taxonomy가 필요합니다.`);
  }
  const specialOrder = [
    ["'insect',400", '곤충'],
    ["'horse',410", '말'],
    ["'wild_boar',420", '멧돼지'],
    ["'quail',430", '메추리'],
    ["'bison',440", '바이슨'],
    ["'venison',450", '사슴'],
    ["'goat',460", '염소'],
    ["'wallaby','왈라비'", '왈라비'],
    ["'kangaroo',480", '캥거루'],
    ["'rabbit',490", '토끼']
  ];
  specialOrder.forEach(([needle]) => assert.ok(sql.includes(needle), `${needle} 순서값이 필요합니다.`));
});

test('확장 단백질원은 신규·수정 사료와 기존 사료 모두에 동기화된다', async () => {
  const sql = await read('supabase/migrations/20260921180500_expand_processing_and_protein_tags.sql');
  assert.match(sql, /create trigger zz_sync_extended_protein_tags_feed/);
  assert.match(sql, /create trigger zz_sync_extended_protein_tags_dog_feed/);
  assert.match(sql, /select public\.sync_extended_protein_tags_for_product\('cat'/);
  assert.match(sql, /select public\.sync_extended_protein_tags_for_product\('dog'/);
});
