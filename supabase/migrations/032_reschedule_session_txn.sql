-- 032_reschedule_session_txn.sql —— R08：單場改期改為單一交易，避免「寫了 skip 卻沒改到場次」
--
-- 原本 API 先 upsert rule_skips 再 update sessions，兩步分開；第二步失敗會殘留 skip，
-- 之後重生成可能永久跳過原日期。合併成一支 plpgsql 函式（整個 body 同一交易），鎖列、
-- 任一步失敗整筆回滾。sessions 沒有 updated_at 欄位，不要去 set。
create or replace function reschedule_session(
  p_id uuid, p_date date, p_start time, p_end time, p_location text, p_description text
) returns void language plpgsql as $$
declare cur record;
begin
  select source_rule_id, session_date into cur from sessions where id = p_id for update;
  if not found then raise exception '找不到場次' using errcode = 'P0002'; end if;

  -- 固定場次改期：把原日期登記到 rule_skips，generate_sessions 才不會又補生成一場原日期的；
  -- 同時讓這場脫離規則成為一次性場次（沿用原有請假關聯，不另建新場）。
  if cur.source_rule_id is not null and p_date <> cur.session_date then
    insert into rule_skips (source_rule_id, session_date)
    values (cur.source_rule_id, cur.session_date)
    on conflict (source_rule_id, session_date) do nothing;
  end if;

  update sessions set
    session_date = p_date,
    start_time = p_start,
    end_time = p_end,
    location = p_location,
    description = p_description,
    source_rule_id = case
      when cur.source_rule_id is not null and p_date <> cur.session_date then null
      else source_rule_id
    end
  where id = p_id;
end $$;
alter function reschedule_session(uuid, date, time, time, text, text) set search_path = public;
revoke execute on function reschedule_session(uuid, date, time, time, text, text) from public, authenticated, anon;
