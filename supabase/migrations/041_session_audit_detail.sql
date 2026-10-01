-- 041_session_audit_detail.sql —— 場次稽核加「詳情」：改期記「原 → 新」
-- 委託人 2026-09-24：039 的改期稽核只記改完後的日期，看不出「從哪天改到哪天」。
-- leave_actions 加通用欄位 detail（文字），場次操作都寫入：
--   · session_reschedule：'原 日期 時間 地點 → 新 日期 時間 地點'
--   · session_extra／session_cancel：該場的 '日期 時間 地點'
-- 請假/銷假/查詢退款途徑不填（NULL）。日後「取消原因」等補充說明也可寫進這欄。

alter table leave_actions add column if not exists detail text;

-- 場次描述：'2026-09-11 19:30–22:00 NVA'（純函式，不查表）
create or replace function session_label(p_date date, p_start time, p_end time, p_location text)
returns text language sql immutable set search_path = '' as $$
  select p_date::text || ' ' || to_char(p_start, 'HH24:MI') || '–' || to_char(p_end, 'HH24:MI')
         || coalesce(' ' || nullif(p_location, ''), '')
$$;

-- log_session_action 加 p_detail（預設 NULL＝自動填該場描述）。
-- 改參數列需先移除舊的 3 參數版本；cancel_session 以 3 個位置參數呼叫，會落到新版的預設值。
drop function if exists log_session_action(uuid, text, uuid);

create or replace function log_session_action(
  p_session uuid, p_action text, p_actor uuid, p_detail text default null
) returns void language plpgsql as $$
declare a record; s record;
begin
  select real_name, display_name into a from users where id = p_actor;
  select session_date, start_time, end_time, location into s from sessions where id = p_session;
  insert into leave_actions
    (session_id, session_date, action, actor_id, actor_name, actor_line,
     target_id, target_name, target_line, detail)
  values
    (p_session, s.session_date, p_action, p_actor, coalesce(a.real_name, a.display_name), a.display_name,
     null, null, null,
     coalesce(p_detail, session_label(s.session_date, s.start_time, s.end_time, s.location)));
end $$;
alter function log_session_action(uuid, text, uuid, text) set search_path = public;
revoke execute on function log_session_action(uuid, text, uuid, text) from public, authenticated, anon;

-- 改期：更新前先記下原本的日期/時間/地點，稽核寫「原 → 新」（同交易）
create or replace function reschedule_session(
  p_id uuid, p_date date, p_start time, p_end time, p_location text, p_description text, p_actor uuid
) returns void language plpgsql set search_path = public as $$
declare cur record; v_detail text;
begin
  select source_rule_id, session_date, start_time, end_time, location into cur
    from sessions where id = p_id for update;
  if not found then raise exception '找不到場次' using errcode = 'P0002'; end if;

  v_detail := session_label(cur.session_date, cur.start_time, cur.end_time, cur.location)
              || ' → ' || session_label(p_date, p_start, p_end, p_location);

  -- 固定場次改期：把原日期登記為 rule_skips 並脫離規則（避免規則再長回原日期）
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

  perform log_session_action(p_id, 'session_reschedule', p_actor, v_detail);
end $$;
