insert into public.food_tags (slug,label_ko,label_en,category,description,sort_order,is_active)
values ('fish_free','어류 유래 원료 없음','Fish-free','ingredient_condition','공개 전성분에서 어류 유래 원료 및 어류 포함 가능성이 있는 불명확 수산 원료가 확인되지 않은 제품',25,true)
on conflict (slug) do update set
  label_ko=excluded.label_ko,label_en=excluded.label_en,category=excluded.category,
  description=excluded.description,sort_order=excluded.sort_order,is_active=true,updated_at=now();

alter table public.food_tag_review_queue drop constraint if exists food_tag_review_queue_issue_type_check;
alter table public.food_tag_review_queue add constraint food_tag_review_queue_issue_type_check check (issue_type in (
  'unknown_processing_method','unknown_life_stage','ambiguous_veterinary_diet',
  'ambiguous_chicken_free','ambiguous_fish_free','ambiguous_grain_free',
  'unknown_protein_source','conflicting_evidence'
));

do $$
declare fn text;
begin
  select pg_get_functiondef('public.backfill_food_tags()'::regprocedure) into fn;
  fn := replace(fn,
    $old$has_chicken boolean; has_ambiguous_poultry boolean; has_grain boolean;$old$,
    $new$has_chicken boolean; has_ambiguous_poultry boolean; has_fish boolean; has_ambiguous_fish boolean; has_grain boolean;$new$);

  fn := replace(fn,
$old$      has_chicken := ingredients ~ '(chicken|닭|치킨|계육|egg|계란|달걀|난백|전란)';
      has_ambiguous_poultry := ingredients ~ '(poultry|가금(류|육|육분)?|조류|animal fat|animal protein|animal ?by[ -]?products?|animal derivatives|meat and animal derivatives|동물성 ?(지방|단백|부산물)|육류 및 동물성 부산물)';
      if has_ingredients and not has_chicken and not has_ambiguous_poultry then
        execute format('insert into public.%I (%I,tag_id,source,confidence,reason) select $1,id,$2,$3,$4 from food_tags where slug=''chicken_free'' on conflict do nothing',
          case when relation_name='feeds' then 'feed_food_tags' else 'dog_feed_food_tags' end,
          case when relation_name='feeds' then 'feed_id' else 'dog_feed_id' end)
          using r.id, 'ingredient_derived', 'medium', '공개 전성분에 닭·난류 및 출처 불명 가금/동물성 원료가 없음';
      end if;$old$,
$new$      has_chicken := ingredients ~ '(chicken|닭|치킨|계육|egg|계란|달걀|난백|전란)';
      has_ambiguous_poultry := ingredients ~ '(poultry|가금(류|육|육분)?|조류|animal fat|animal protein|animal ?by[ -]?products?|animal derivatives|meat and animal derivatives|동물성 ?(지방|단백|부산물)|육류 및 동물성 부산물)';
      if has_ingredients and not has_chicken and not has_ambiguous_poultry then
        execute format('insert into public.%I (%I,tag_id,source,confidence,reason) select $1,id,$2,$3,$4 from food_tags where slug=''chicken_free'' on conflict do nothing',
          case when relation_name='feeds' then 'feed_food_tags' else 'dog_feed_food_tags' end,
          case when relation_name='feeds' then 'feed_id' else 'dog_feed_id' end)
          using r.id, 'ingredient_derived', 'medium', '공개 전성분에 닭·난류 및 출처 불명 가금/동물성 원료가 없음';
      end if;

      has_fish := ingredients ~ '(fish|어류|생선|연어|salmon|참치|tuna|대구|cod|명태|pollock|청어|herring|고등어|mackerel|정어리|sardine|멸치|anchov|송어|trout|가다랑어|bonito|농어|bass|도미|bream|tilapia|어유|fish oil|어분|fish meal|fish protein|어류 ?단백)';
      has_ambiguous_fish := ingredients ~ '(seafood|해산물|marine protein|marine animal|수산물|어패류|fish derivatives|어류 ?부산물)';
      if has_ingredients and not has_fish and not has_ambiguous_fish then
        execute format('insert into public.%I (%I,tag_id,source,confidence,reason) select $1,id,$2,$3,$4 from food_tags where slug=''fish_free'' on conflict do nothing',
          case when relation_name='feeds' then 'feed_food_tags' else 'dog_feed_food_tags' end,
          case when relation_name='feeds' then 'feed_id' else 'dog_feed_id' end)
          using r.id, 'ingredient_derived', 'medium', '공개 전성분에서 어류 유래 원료 및 불명확 수산 원료가 확인되지 않음';
      end if;$new$);

  fn := replace(fn,
$old$      if has_ambiguous_poultry and not has_chicken then
        insert into food_tag_review_queue(species,product_id,issue_type,reason,evidence) values
          (case when relation_name='feeds' then 'cat' else 'dog' end,r.id,'ambiguous_chicken_free','출처 불명 poultry/animal 성분 때문에 자동 판정 제외',jsonb_build_object('ingredients',ingredients)) on conflict do nothing;
      end if;$old$,
$new$      if has_ambiguous_poultry and not has_chicken then
        insert into food_tag_review_queue(species,product_id,issue_type,reason,evidence) values
          (case when relation_name='feeds' then 'cat' else 'dog' end,r.id,'ambiguous_chicken_free','출처 불명 poultry/animal 성분 때문에 자동 판정 제외',jsonb_build_object('ingredients',ingredients)) on conflict do nothing;
      end if;
      if has_ambiguous_fish and not has_fish then
        insert into food_tag_review_queue(species,product_id,issue_type,reason,evidence) values
          (case when relation_name='feeds' then 'cat' else 'dog' end,r.id,'ambiguous_fish_free','불명확한 수산/해산 원료 때문에 자동 fish_free 판정 제외',jsonb_build_object('ingredients',ingredients)) on conflict do nothing;
      end if;$new$);

  execute fn;
end $$;

select * from public.backfill_food_tags();

insert into public.feed_food_tags(feed_id,tag_id,source,confidence,reason)
select f.id,t.id,'manual','high','제조사 공식 동물병원 전용 질환관리 제품군 및 수의사 상담/처방 급여 안내 확인'
from public.feeds f join public.food_tags t on t.slug='veterinary_diet'
where f.제조사='닥터힐메딕스' and lower(f.제품명) ~ '(유러너리 트랙트|인테스티날|하이포알러제닉 웨이트컨트롤)'
on conflict(feed_id,tag_id) do update set source='manual',confidence='high',reason=excluded.reason,updated_at=now();

insert into public.feed_food_tags(feed_id,tag_id,source,confidence,reason)
select f.id,t.id,'manual','high','닥터힐메딕스 공식 제품 목적에 따른 관리 태그 보정'
from public.feeds f
join public.food_tags t on
  (lower(f.제품명) ~ '유러너리 트랙트' and t.slug='urinary') or
  (lower(f.제품명) ~ '인테스티날' and t.slug='digestive') or
  (lower(f.제품명) ~ '하이포알러제닉 웨이트컨트롤' and t.slug in ('skin_allergy','weight_management'))
where f.제조사='닥터힐메딕스'
on conflict(feed_id,tag_id) do update set source='manual',confidence='high',reason=excluded.reason,updated_at=now();

revoke execute on function public.backfill_food_tags() from public,anon,authenticated;
