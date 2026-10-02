-- 023_inactive_user_purge.sql —— 五年未登入自動刪除所有個資（隱私權政策）
-- 委託人 2026-09-10：連續 5 年未登入者，自動刪除其所有資料。
--
-- 追蹤「最後登入」：users 加 last_login_at，LINE 登入時更新（見 /api/auth/line）。
-- 既有使用者預設為 now()，等於從今天起算，至少 5 年後才可能被刪，安全。
-- 刪 users 會 cascade 帶走：leave_requests / attendance_summaries / membership_periods
-- （皆 on delete cascade）；他建立過的加開場次 sessions.created_by 設 null 保留。

alter table users add column if not exists last_login_at timestamptz not null default now();

create or replace function purge_inactive_users()
returns int language plpgsql as $$
declare removed int;
begin
  -- 連續 5 年未登入者，刪除本人與所有關聯個資（cascade）
  delete from users where last_login_at < now() - interval '5 years';
  get diagnostics removed = row_count;
  return removed;
end $$;
alter function purge_inactive_users() set search_path = public;
revoke execute on function purge_inactive_users() from public, authenticated, anon;

-- 每日 04:30 UTC 檢查一次（時間為 UTC，見 §6）
select cron.schedule('purge_inactive_users', '30 4 * * *', $$ select purge_inactive_users() $$);
