-- 037_operation_log.sql —— 操作紀錄擴充：涵蓋「自己」的請假/銷假、快照操作者與對象名稱
-- 委託人 2026-09-11：Drive 要每日更新的操作 log，需含自己請假/銷假、管理員代他人操作，
-- 並記「是誰操作」（暱稱＋LINE 名稱）。因此稽核擴充成通用：actor=操作者、target=對象。
-- leave_actions 目前為空，直接改欄位＋快照名稱（不設外鍵，日後成員/管理員被刪仍可查）。

alter table leave_actions rename column user_id  to target_id;   -- 對象（被請假/銷假的成員）
alter table leave_actions rename column admin_id to actor_id;    -- 操作者（自己或管理員）
alter table leave_actions
  add column if not exists session_date date,
  add column if not exists actor_name  text,   -- 操作者暱稱（快照）
  add column if not exists actor_line  text,   -- 操作者 LINE 名稱（快照）
  add column if not exists target_name text,   -- 對象暱稱（快照）
  add column if not exists target_line text;   -- 對象 LINE 名稱（快照）

-- 寫一筆操作紀錄：快照操作者/對象的暱稱與 LINE 名稱、場次日期。
create or replace function log_leave_action(p_session uuid, p_action text, p_actor uuid, p_target uuid)
returns void language plpgsql as $$
declare a record; t record; sd date;
begin
  select real_name, display_name into a from users where id = p_actor;
  select real_name, display_name into t from users where id = p_target;
  select session_date into sd from sessions where id = p_session;
  insert into leave_actions
    (session_id, session_date, action, actor_id, actor_name, actor_line, target_id, target_name, target_line)
  values
    (p_session, sd, p_action, p_actor, coalesce(a.real_name, a.display_name), a.display_name,
     p_target, coalesce(t.real_name, t.display_name), t.display_name);
end $$;
alter function log_leave_action(uuid, text, uuid, uuid) set search_path = public;
revoke execute on function log_leave_action(uuid, text, uuid, uuid) from public, authenticated, anon;

-- ── 管理員代填／銷假（重寫成含名稱快照的稽核）──────────────────
create or replace function admin_file_leave(p_session uuid, p_user uuid, p_admin uuid)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into leave_requests (session_id, user_id) values (p_session, p_user) returning id into v_id;
  perform log_leave_action(p_session, 'request', p_admin, p_user);
  return v_id;
end $$;
alter function admin_file_leave(uuid, uuid, uuid) set search_path = public;
revoke execute on function admin_file_leave(uuid, uuid, uuid) from public, authenticated, anon;

create or replace function admin_cancel_leave(p_leave uuid, p_admin uuid)
returns uuid language plpgsql as $$
declare v_sess uuid; v_user uuid;
begin
  update leave_requests set status = 'cancelled', cancelled_at = now()
  where id = p_leave and status = 'active'
  returning session_id, user_id into v_sess, v_user;
  if not found then return null; end if;
  perform log_leave_action(v_sess, 'cancel', p_admin, v_user);
  return p_leave;
end $$;
alter function admin_cancel_leave(uuid, uuid) set search_path = public;
revoke execute on function admin_cancel_leave(uuid, uuid) from public, authenticated, anon;

-- ── 成員自己請假／銷假（也寫稽核，actor=自己）──────────────────
create or replace function self_file_leave(p_session uuid, p_user uuid)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into leave_requests (session_id, user_id) values (p_session, p_user) returning id into v_id;
  perform log_leave_action(p_session, 'request', p_user, p_user);
  return v_id;
end $$;
alter function self_file_leave(uuid, uuid) set search_path = public;
revoke execute on function self_file_leave(uuid, uuid) from public, authenticated, anon;

create or replace function self_cancel_leave(p_leave uuid, p_user uuid)
returns uuid language plpgsql as $$
declare v_sess uuid;
begin
  update leave_requests set status = 'cancelled', cancelled_at = now()
  where id = p_leave and user_id = p_user and status = 'active'
  returning session_id into v_sess;
  if not found then return null; end if;
  perform log_leave_action(v_sess, 'cancel', p_user, p_user);
  return p_leave;
end $$;
alter function self_cancel_leave(uuid, uuid) set search_path = public;
revoke execute on function self_cancel_leave(uuid, uuid) from public, authenticated, anon;
