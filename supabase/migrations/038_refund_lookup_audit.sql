-- 038_refund_lookup_audit.sql —— 把「查詢退款途徑」納入操作紀錄稽核
-- 委託人 2026-09-12：一級管理員查某成員的退款途徑（含銀行帳號）也要進 LOG，
-- 記錄是誰查了誰、何時。沿用同一張 leave_actions（單一操作紀錄最好稽核），
-- 但查詢沒有「場次」，因此放寬 session_id 可為 NULL，並擴充 action 允許 refund_lookup。

alter table leave_actions alter column session_id drop not null;

alter table leave_actions drop constraint if exists leave_actions_action_check;
alter table leave_actions add constraint leave_actions_action_check
  check (action in ('request', 'cancel', 'refund_lookup'));

-- 寫一筆「查詢退款途徑」稽核：actor=查詢的管理員、target=被查的成員，快照雙方名稱。
-- 沒有場次，session_id/session_date 留 NULL。刻意不設外鍵，日後任一方被刪仍可查。
create or replace function log_refund_lookup(p_actor uuid, p_target uuid)
returns void language plpgsql as $$
declare a record; t record;
begin
  select real_name, display_name into a from users where id = p_actor;
  select real_name, display_name into t from users where id = p_target;
  insert into leave_actions
    (session_id, session_date, action, actor_id, actor_name, actor_line, target_id, target_name, target_line)
  values
    (null, null, 'refund_lookup', p_actor, coalesce(a.real_name, a.display_name), a.display_name,
     p_target, coalesce(t.real_name, t.display_name), t.display_name);
end $$;
alter function log_refund_lookup(uuid, uuid) set search_path = public;
revoke execute on function log_refund_lookup(uuid, uuid) from public, authenticated, anon;
