-- 022_user_refund_method.sql —— 使用者退費途徑（首次設定第二步）
-- 委託人 2026-09-09：可多選 LINE PAY／銀行轉帳；選銀行轉帳必填銀行代號與帳號。
-- 銀行帳號屬敏感資料——users 的 select 早已 revoke 給前端角色（見 010），僅 service role 經 API 存取。

alter table users
  add column if not exists refund_line_pay boolean not null default false,
  add column if not exists refund_bank     boolean not null default false,
  add column if not exists bank_code        text,
  add column if not exists bank_account     text;

-- 選了銀行轉帳就一定要有代號與帳號
alter table users drop constraint if exists users_bank_required;
alter table users add constraint users_bank_required
  check (not refund_bank or (bank_code is not null and bank_code <> '' and bank_account is not null and bank_account <> ''));
