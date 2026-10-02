-- 012_rule_resync_txn.sql —— 把「改規則／改週數」的多步操作包成單一交易
-- 對應 docs/spec.md §6.5。
--
-- 問題：後台改規則時，API 先 update/insert/delete，再分開呼叫 purge_* 與 generate_sessions，
-- 是兩三個獨立、互不同交易的 RPC。若中間某步失敗（例如 purge 成功、generate 前連線斷），
-- 未來場次已被刪掉卻沒補回，要等隔天 03:00 排程才會修復，這段時間場次會少一截。
--
-- 解法：每個操作各包成一個 plpgsql 函式。PostgREST 對每次 rpc 開一個交易，函式整個
-- body 就跑在同一交易裡，任一步 raise/錯誤都會整體回滾——不會出現「刪了沒補」的中間態。
-- 內部沿用既有 helper（generate_sessions / purge_regenerable_future_sessions /
-- purge_sessions_beyond_horizon），不重寫邏輯，避免兩份規則漂移。

-- ── 1) 新增規則 + 補場次 ──────────────────────────────────
create or replace function add_rule_and_generate(
  p_weekday int, p_start_time time, p_end_time time, p_location text, p_effective_from date
) returns int language plpgsql as $$
begin
  insert into recurring_rules (weekday, start_time, end_time, location, effective_from)
  values (p_weekday, p_start_time, p_end_time, p_location, p_effective_from);
  return generate_sessions();
end $$;
alter function add_rule_and_generate(int, time, time, text, date) set search_path = public;

-- ── 2) 編輯規則 + 重生成（刪掉生效日起、未被請假的未來場次再補回）──────
create or replace function edit_rule_and_resync(
  p_rule_id uuid, p_weekday int, p_start_time time, p_end_time time,
  p_location text, p_effective_from date
) returns int language plpgsql as $$
begin
  update recurring_rules set
    weekday = p_weekday, start_time = p_start_time, end_time = p_end_time,
    location = p_location, effective_from = p_effective_from, updated_at = now()
  where id = p_rule_id;
  if not found then
    raise exception '找不到規則 %', p_rule_id using errcode = 'no_data_found';
  end if;
  perform purge_regenerable_future_sessions(p_rule_id, p_effective_from);
  return generate_sessions();
end $$;
alter function edit_rule_and_resync(uuid, int, time, time, text, date) set search_path = public;

-- ── 3) 刪除規則 + 清未來場次（已請假的因 on delete set null 脫離規則保留）──
create or replace function delete_rule_and_purge(p_rule_id uuid, p_from date)
returns int language plpgsql as $$
declare removed int;
begin
  removed := purge_regenerable_future_sessions(p_rule_id, p_from);
  delete from recurring_rules where id = p_rule_id;
  if not found then
    raise exception '找不到規則 %', p_rule_id using errcode = 'no_data_found';
  end if;
  return removed;
end $$;
alter function delete_rule_and_purge(uuid, date) set search_path = public;

-- ── 4) 設定生成週數 + 重同步（調低清遠期、調高補齊）───────────────
create or replace function set_weeks_and_resync(p_weeks int)
returns int language plpgsql as $$
begin
  update app_config set generate_weeks_ahead = p_weeks, updated_at = now() where id;
  perform purge_sessions_beyond_horizon(p_weeks);
  return generate_sessions();
end $$;
alter function set_weeks_and_resync(int) set search_path = public;

-- service role 走後台 API 呼叫；一般前端角色不需要、也不授權
revoke execute on function add_rule_and_generate(int, time, time, text, date) from authenticated, anon;
revoke execute on function edit_rule_and_resync(uuid, int, time, time, text, date) from authenticated, anon;
revoke execute on function delete_rule_and_purge(uuid, date) from authenticated, anon;
revoke execute on function set_weeks_and_resync(int) from authenticated, anon;
