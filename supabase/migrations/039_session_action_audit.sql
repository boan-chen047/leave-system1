-- 039_session_action_audit.sql —— 場次操作（加開／改期／取消）納入操作紀錄稽核
-- 委託人 2026-09-23：先前查不到「9/11、9/18 是誰取消的」，因為取消場次沒進 LOG。
-- 補上：加開場次、改期/編輯場次、取消場次都寫一筆稽核到 leave_actions（沿用同一份操作紀錄）。
-- 場次操作沒有「對象成員」，故 target 相關欄位放空 → target_id 改為可 NULL。

alter table leave_actions alter column target_id drop not null;

alter table leave_actions drop constraint if exists leave_actions_action_check;
alter table leave_actions add constraint leave_actions_action_check
  check (action in (
    'request', 'cancel', 'refund_lookup',
    'session_extra', 'session_reschedule', 'session_cancel'
  ));

-- 通用場次操作稽核：actor=操作的管理員，快照 actor 暱稱/LINE 名稱與場次日期，target 留空。
create or replace function log_session_action(p_session uuid, p_action text, p_actor uuid)
returns void language plpgsql as $$
declare a record; sd date;
begin
  select real_name, display_name into a from users where id = p_actor;
  select session_date into sd from sessions where id = p_session;
  insert into leave_actions
    (session_id, session_date, action, actor_id, actor_name, actor_line, target_id, target_name, target_line)
  values
    (p_session, sd, p_action, p_actor, coalesce(a.real_name, a.display_name), a.display_name,
     null, null, null);
end $$;
alter function log_session_action(uuid, text, uuid) set search_path = public;
revoke execute on function log_session_action(uuid, text, uuid) from public, authenticated, anon;

-- 取消場次＋寫稽核，同一交易（原子）。只在原本未取消時才動作與記錄，
-- 避免重複取消灌出重複稽核。回傳是否真的有取消（false＝不存在或早已取消）。
create or replace function cancel_session(p_id uuid, p_actor uuid)
returns boolean language plpgsql as $$
begin
  update sessions set is_cancelled = true
  where id = p_id and is_cancelled = false;
  if not found then
    return false;
  end if;
  perform log_session_action(p_id, 'session_cancel', p_actor);
  return true;
end $$;
alter function cancel_session(uuid, uuid) set search_path = public;
revoke execute on function cancel_session(uuid, uuid) from public, authenticated, anon;

-- 改期/編輯場次：在原本的 reschedule_session 上加 p_actor，並在交易內寫稽核。
-- 先移除舊的 6 參數版本，改成 7 參數（避免多載歧義）。
drop function if exists reschedule_session(uuid, date, time, time, text, text);

create or replace function reschedule_session(
  p_id uuid, p_date date, p_start time, p_end time, p_location text, p_description text, p_actor uuid
) returns void language plpgsql as $$
declare cur record;
begin
  select source_rule_id, session_date into cur from sessions where id = p_id for update;
  if not found then raise exception '找不到場次' using errcode = 'P0002'; end if;

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

  perform log_session_action(p_id, 'session_reschedule', p_actor);
end $$;
alter function reschedule_session(uuid, date, time, time, text, text, uuid) set search_path = public;
revoke execute on function reschedule_session(uuid, date, time, time, text, text, uuid) from public, authenticated, anon;
