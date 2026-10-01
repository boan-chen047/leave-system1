-- 021_session_description.sql —— 場次敘述欄
-- 委託人 2026-09-08：每場可加敘述（加開/編輯場次填），卡片與後台顯示。

alter table sessions add column if not exists description text;
