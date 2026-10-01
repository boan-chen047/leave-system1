-- 028_weeks12_and_fk_indexes.sql
-- 委託人 2026-09-10：
--   1) 預設往後生成場次改 8 → 12 週（欄位預設值 + 現有那一列都改；並立即補生成）。
--   2) 補兩個外鍵覆蓋索引（顧問 unindexed_foreign_keys）：刪除使用者的 cascade、
--      以及依建立者查場次會用到。

-- ① 生成週數 8 → 12
alter table app_config alter column generate_weeks_ahead set default 12;
update app_config set generate_weeks_ahead = 12, updated_at = now() where id;
select generate_sessions();   -- 立即把場次補到 12 週

-- ② 外鍵覆蓋索引
create index if not exists attendance_summaries_user_idx on attendance_summaries (user_id);
create index if not exists sessions_created_by_idx on sessions (created_by);
