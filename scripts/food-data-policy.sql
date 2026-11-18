-- User-agreed PROVED calculation policy, 2026-11-18.
-- Pure derivation only: never overwrite raw nutrient values, source records or approval.
create or replace function public.proved_food_numeric_policy(f jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $$
declare
 p numeric := (f->>'조단백')::numeric;
 fat numeric := (f->>'조지방')::numeric;
 ash numeric := (f->>'조회분')::numeric;
 fibre numeric := (f->>'조섬유')::numeric;
 moisture numeric := (f->>'수분')::numeric;
 ca numeric := (f->>'칼슘')::numeric;
 phosphorus numeric := (f->>'인')::numeric;
 nfe numeric; base numeric; me numeric; corrected numeric; factor numeric := 1;
 dm numeric; source text := f->>'cal_source'; patch jsonb; pair text[]; value numeric;
 official numeric := (f->>'official_me')::numeric;
 stored numeric := (f->>'final_me')::numeric;
begin
 if p between 0 and 100 and fat between 0 and 100 and ash between 0 and 100
 and fibre between 0 and 100 and moisture >= 0 and moisture < 100 then
   nfe := round(greatest(0,100-p-fat-ash-fibre-moisture),2);
   base := round((3.5*p+8.5*fat+3.5*nfe)*10,1);
 end if;
 if moisture >= 0 and moisture < 100 then dm := 100/(100-moisture); end if;
 if official > 0 or (stored > 0 and coalesce(source,'') not in ('estimated','estimated_corrected','manual_review')) then
   me := case when stored > 0 and coalesce(source,'') not in ('estimated','estimated_corrected','manual_review') then stored else official end;
   if official > 0 and source in ('estimated','estimated_corrected','manual_review') then source := 'official'; end if;
 elsif base > 0 then
   if f->>'type'='wet' and f->>'완전식여부'='주식' then
     factor := case when moisture >=85 then case when fat<=2 then 1.82 else 1.26 end
                    when moisture >=82 then case when fat<=2 then 1.41 else 1.22 end
                    else case when fat<=2 then 1.33 else 1.28 end end;
     corrected := round(base*factor,1);
     me := corrected;
     source := 'estimated_corrected';
   else me := base; source := 'estimated'; end if;
 else source := 'manual_review'; end if;
 patch := jsonb_build_object('nfe',nfe,'ca_p_ratio',case when ca>=0 and phosphorus>0 then round(ca/phosphorus,2) else null end,
 'base_estimated_me',base,'corrected_me',corrected,'final_me',me,'cal_source',source,'needs_calorie_review',me is null);
 foreach pair slice 1 in array array[['조단백','dm_단백'],['조지방','dm_지방'],['조회분','dm_회분'],['조섬유','dm_섬유'],['칼슘','dm_칼슘'],['인','dm_인']] loop
   value := (f->>pair[1])::numeric;
   patch := patch || jsonb_build_object(pair[2],case when dm is not null and value is not null then round(value*dm,case when pair[1] in ('칼슘','인') then 3 else 2 end) else null end);
 end loop;
 foreach pair slice 1 in array array[['조단백','eb_단백'],['조지방','eb_지방'],['nfe','eb_탄수화물'],['칼슘','eb_칼슘'],['인','eb_인']] loop
   value := case when pair[1]='nfe' then nfe else (f->>pair[1])::numeric end;
   patch := patch || jsonb_build_object(pair[2],case when me>0 and value is not null then round(value*10000/me,2) else null end);
 end loop;
 return patch;
end;
$$;

create or replace function public.proved_apply_food_numeric_policy()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 new := jsonb_populate_record(new,public.proved_food_numeric_policy(to_jsonb(new)));
 return new;
end;
$$;

create trigger aa_apply_food_numeric_policy
before insert or update of "조단백","조지방","조회분","조섬유","수분","칼슘","인","type","완전식여부",final_me,official_me,cal_source
on public.feeds for each row execute function public.proved_apply_food_numeric_policy();
create trigger aa_apply_food_numeric_policy
before insert or update of "조단백","조지방","조회분","조섬유","수분","칼슘","인","type","완전식여부",final_me,official_me,cal_source
on public.dog_feeds for each row execute function public.proved_apply_food_numeric_policy();
