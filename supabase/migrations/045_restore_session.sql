-- 045_restore_session.sql —— 已取消的場次可以恢復
-- 委託人 2026-09-24：取消場次後原本沒有介面可改回，誤按只能進資料庫手改
-- （9/11、9/18 若為誤取消就救不回來）。新增「恢復場次」，並寫入操作紀錄。
--
-- 注意：恢復「已過去」的場次，會讓那場重新列入出席與退費統計（取消的場次不計，見 §6.4）。
-- 前端恢復前的確認訊息會提醒這點。

alter table leave_actions drop constraint if exists leave_actions_action_check;
alter table leave_actions add constraint leave_actions_action_check
  check (action in (
    'request', 'cancel', 'refund_lookup',
    'session_extra', 'session_reschedule', 'session_cancel', 'session_restore'
  ));

-- 恢復＋寫稽核，同一交易。只在原本是「已取消」時才動作與記錄；
-- 回傳是否真的有恢復（false＝不存在或本來就沒取消）。
create or replace function restore_session(p_id uuid, p_actor uuid)
returns boolean language plpgsql set search_path = public as $$
begin
  update sessions set is_cancelled = false
  where id = p_id and is_cancelled = true;
  if not found then
    return false;
  end if;
  perform log_session_action(p_id, 'session_restore', p_actor);
  return true;
end $$;
revoke execute on function restore_session(uuid, uuid) from public, authenticated, anon;
