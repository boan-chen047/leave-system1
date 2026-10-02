-- 035_leave_admin_audit.sql —— 後台代填請假／手動銷假的操作稽核
-- 委託人 2026-09-11：管理員代填請假、手動銷假時，DB 要記「哪個管理員」＋「操作時間」。
--
-- 時間已有：created_at（請假建立時刻）、cancelled_at（銷假時刻）——皆 timestamptz（年月日時分秒）。
-- 這裡補「哪個管理員」：
--   created_by_admin：代填此請假的管理員（成員自己請的則為 null）。
--   cancelled_by_admin：手動銷此假的管理員（成員自己銷的則為 null）。
-- on delete set null：日後該管理員被刪，仍保留這筆請假紀錄，只是管理員參照設為 null。
alter table leave_requests
  add column if not exists created_by_admin   uuid references users(id) on delete set null,
  add column if not exists cancelled_by_admin uuid references users(id) on delete set null;
