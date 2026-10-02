-- 015_archive_period_type.sql —— 封存不再只有年報，月報／季報也上傳
-- 對應 docs/spec.md §6.4（委託人 2026-09-08 決定：月/季/年都封存，順便讓 Drive
-- 的 refresh token 每月有用到、不會因 6 個月閒置而失效）。
--
-- archive_exports 原本只設想年報，靠 period_key 唯一即可。現在要放三種期別，
-- 補一個 period_type 欄位，清理時才能分別套用保留期（月/季 2 年、年 5 年）。
-- period_key 三種格式天生不撞（'2026-08' / '2026-Q3' / '2026'），故 unique 維持不變。

alter table archive_exports
  add column if not exists period_type period_type not null default 'year';
