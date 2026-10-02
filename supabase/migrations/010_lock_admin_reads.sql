-- 010_lock_admin_reads.sql —— 收掉前端對敏感表的直接 SELECT
--
-- users_self_read / leaves_admin_read / summaries_read / archives_read 都用 is_admin()
-- 授權，而 is_admin() 讀的是 JWT 裡的 app_role——那是登入當下的 30 天快照。被降級的
-- 管理員在 JWT 過期前，仍能用舊 JWT + 公開 anon key 直打 Supabase REST，讀到全員真名、
-- 請假與統計，繞過 guard.ts 特意「每次從 DB 重驗角色」的保護（DB 層沒擋）。
--
-- 前端本來就全部走後端 service-role API、不直接連 DB，所以直接把這些表的前端 SELECT
-- 權限收掉（service role 繞過 GRANT/RLS，不受影響；API 內用 currentUser 從 DB 重驗角色）。
revoke select on users, leave_requests, attendance_summaries, archive_exports
  from authenticated, anon;
