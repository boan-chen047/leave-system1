-- 034_rule_description.sql —— 規則（訓練日）也能加備注，生成的場次自動帶上
-- 委託人 2026-09-10：活動規則設定裡面也要可以備注。
--
-- recurring_rules 加 description 欄；generate_sessions 把規則的 description 複製到每一場；
-- 規則的新增／編輯（add_rule_with_weeks／edit_rule_with_weeks，表單實際走的兩支）收 p_description。
-- 編輯規則時會清掉「生效日起、未被請假」的未來場次再重生成，所以改備注會套用到那些場次；
-- 已請假的場次沿用規則變更不追溯（不動）。

-- ① 欄位
alter table recurring_rules add column if not exists description text;

-- ② 生成場次時帶上規則備注
create or replace function generate_sessions()
returns int language plpgsql as $$
declare
  r        record;
  target   date;
  horizon  int;
  created  int := 0;
begin
  select generate_weeks_ahead into horizon from app_config where id;
  for r in select * from recurring_rules where is_active loop
    target := greatest(current_date, r.effective_from);
    while target <= current_date + (horizon * 7) loop
      if extract(dow from target) = r.weekday
         and not exists (select 1 from rule_skips k where k.source_rule_id = r.id and k.session_date = target)
      then
        insert into sessions (session_date, start_time, end_time, location, description, kind, source_rule_id)
        values (target, r.start_time, r.end_time, r.location, r.description, 'regular', r.id)
        on conflict (source_rule_id, session_date) where source_rule_id is not null
        do nothing;
        if found then created := created + 1; end if;
      end if;
      target := target + 1;
    end loop;
  end loop;
  return created;
end $$;
alter function generate_sessions() set search_path = public;

-- ③ 新增/編輯規則收 p_description（加參數＝新簽章，先 drop 舊的再建，避免多載殘留）
drop function if exists add_rule_with_weeks(int, int, time, time, text, date);
create or replace function add_rule_with_weeks(
  p_weeks int, p_weekday int, p_start_time time, p_end_time time, p_location text,
  p_effective_from date, p_description text
) returns int language plpgsql as $$
begin
  update app_config set generate_weeks_ahead = p_weeks, updated_at = now() where id;
  insert into recurring_rules (weekday, start_time, end_time, location, effective_from, description)
  values (p_weekday, p_start_time, p_end_time, p_location, p_effective_from, p_description);
  perform purge_sessions_beyond_horizon(p_weeks);
  return generate_sessions();
end $$;
alter function add_rule_with_weeks(int, int, time, time, text, date, text) set search_path = public;
revoke execute on function add_rule_with_weeks(int, int, time, time, text, date, text) from public, authenticated, anon;

drop function if exists edit_rule_with_weeks(uuid, int, int, time, time, text, date);
create or replace function edit_rule_with_weeks(
  p_rule_id uuid, p_weeks int, p_weekday int, p_start_time time, p_end_time time,
  p_location text, p_effective_from date, p_description text
) returns int language plpgsql as $$
begin
  update app_config set generate_weeks_ahead = p_weeks, updated_at = now() where id;
  update recurring_rules set
    weekday = p_weekday, start_time = p_start_time, end_time = p_end_time,
    location = p_location, effective_from = p_effective_from, description = p_description, updated_at = now()
  where id = p_rule_id;
  if not found then raise exception '找不到規則 %', p_rule_id using errcode = 'no_data_found'; end if;
  perform purge_regenerable_future_sessions(p_rule_id, p_effective_from);
  perform purge_sessions_beyond_horizon(p_weeks);
  return generate_sessions();
end $$;
alter function edit_rule_with_weeks(uuid, int, int, time, time, text, date, text) set search_path = public;
revoke execute on function edit_rule_with_weeks(uuid, int, int, time, time, text, date, text) from public, authenticated, anon;
