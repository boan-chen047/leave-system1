-- 036_leave_actions_audit.sql —— 管理員請假／銷假的獨立稽核表（append-only）
-- 委託人 2026-09-11：記錄不能放在 leave_requests 同一列，否則「銷假後又請假」會覆蓋、查不到過往。
-- 改成獨立的 leave_actions：每次管理員代填請假或手動銷假都「新增一列」，永不覆蓋，
-- 完整保留誰（管理員）、對誰（成員）、哪一場、做什麼（request/cancel）、何時（年月日時分秒）。
--
-- 035 加在 leave_requests 上的兩欄改放這裡，先移除。

alter table leave_requests drop column if exists created_by_admin;
alter table leave_requests drop column if exists cancelled_by_admin;

-- 稽核表：刻意不設外鍵（存純 uuid），成員／管理員日後被刪，這些歷史紀錄仍原封不動可查。
create table if not exists leave_actions (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id    uuid not null,                 -- 被請假／銷假的成員
  action     text not null check (action in ('request', 'cancel')),
  admin_id   uuid not null,                 -- 執行的管理員
  at         timestamptz not null default now()
);
create index if not exists leave_actions_session_idx on leave_actions (session_id);
create index if not exists leave_actions_user_idx    on leave_actions (user_id);
create index if not exists leave_actions_admin_idx   on leave_actions (admin_id);
alter table leave_actions enable row level security;
revoke all on leave_actions from authenticated, anon;
create policy leave_actions_no_access on leave_actions for all using (false) with check (false);

-- 代填請假＋寫稽核，同一交易（原子）。唯一違反（已請）→ 23505 傳回給 API。
create or replace function admin_file_leave(p_session uuid, p_user uuid, p_admin uuid)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into leave_requests (session_id, user_id) values (p_session, p_user) returning id into v_id;
  insert into leave_actions (session_id, user_id, action, admin_id)
    values (p_session, p_user, 'request', p_admin);
  return v_id;
end $$;
alter function admin_file_leave(uuid, uuid, uuid) set search_path = public;
revoke execute on function admin_file_leave(uuid, uuid, uuid) from public, authenticated, anon;

-- 手動銷假＋寫稽核，同一交易。找不到 active 請假回 null。
create or replace function admin_cancel_leave(p_leave uuid, p_admin uuid)
returns uuid language plpgsql as $$
declare v_sess uuid; v_user uuid;
begin
  update leave_requests set status = 'cancelled', cancelled_at = now()
  where id = p_leave and status = 'active'
  returning session_id, user_id into v_sess, v_user;
  if not found then return null; end if;
  insert into leave_actions (session_id, user_id, action, admin_id)
    values (v_sess, v_user, 'cancel', p_admin);
  return p_leave;
end $$;
alter function admin_cancel_leave(uuid, uuid) set search_path = public;
revoke execute on function admin_cancel_leave(uuid, uuid) from public, authenticated, anon;
