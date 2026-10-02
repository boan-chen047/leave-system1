-- 031_rule_weeks_purge_horizon.sql —— R07：規則頁調整週數時，也要清掉超出新範圍的遠期場次
--
-- add_rule_with_weeks／edit_rule_with_weeks（018）會改 generate_weeks_ahead 再 generate_sessions()，
-- 但沒呼叫 purge_sessions_beyond_horizon——從規則頁「縮短」週數時，其他規則 8~12 週之間的遠期
-- 固定場次不會被清掉，與設定 API 的 set_weeks_and_resync 行為不一致。這裡補齊（沿用同一個
-- purge helper，只清「固定場次、未來、未被請假」的，已請假不動）。整段仍在單一交易內。

create or replace function add_rule_with_weeks(
  p_weeks int, p_weekday int, p_start_time time, p_end_time time, p_location text, p_effective_from date
) returns int language plpgsql as $$
begin
  update app_config set generate_weeks_ahead = p_weeks, updated_at = now() where id;  -- 違反 1–52 約束會整筆回滾
  insert into recurring_rules (weekday, start_time, end_time, location, effective_from)
  values (p_weekday, p_start_time, p_end_time, p_location, p_effective_from);
  perform purge_sessions_beyond_horizon(p_weeks);  -- R07：縮短週數時清遠期
  return generate_sessions();
end $$;
alter function add_rule_with_weeks(int, int, time, time, text, date) set search_path = public;
revoke execute on function add_rule_with_weeks(int, int, time, time, text, date) from public, authenticated, anon;

create or replace function edit_rule_with_weeks(
  p_rule_id uuid, p_weeks int, p_weekday int, p_start_time time, p_end_time time,
  p_location text, p_effective_from date
) returns int language plpgsql as $$
begin
  update app_config set generate_weeks_ahead = p_weeks, updated_at = now() where id;
  update recurring_rules set
    weekday = p_weekday, start_time = p_start_time, end_time = p_end_time,
    location = p_location, effective_from = p_effective_from, updated_at = now()
  where id = p_rule_id;
  if not found then raise exception '找不到規則 %', p_rule_id using errcode = 'no_data_found'; end if;
  perform purge_regenerable_future_sessions(p_rule_id, p_effective_from);
  perform purge_sessions_beyond_horizon(p_weeks);  -- R07：縮短週數時清遠期（含其他規則）
  return generate_sessions();
end $$;
alter function edit_rule_with_weeks(uuid, int, int, time, time, text, date) set search_path = public;
revoke execute on function edit_rule_with_weeks(uuid, int, int, time, time, text, date) from public, authenticated, anon;
