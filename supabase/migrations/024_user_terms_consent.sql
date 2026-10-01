-- 024_user_terms_consent.sql —— 同意條款版本
-- 委託人 2026-09-10：首次設定在「確認暱稱」後、「填退費」前，跳彈窗讓使用者同意條款。
-- 用版本字串記錄「同意到哪一版」；政策更新只要升 lib/terms.ts 的 CURRENT_TERMS_VERSION，
-- terms_version 不等於現行版本者會被再次要求同意（重新同意 gate）。既有使用者為 null，下次登入就要同意。

alter table users add column if not exists terms_version text;
