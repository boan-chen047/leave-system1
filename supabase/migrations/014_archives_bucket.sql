-- 014_archives_bucket.sql —— 年報封存用的私有 Storage bucket
-- 對應 docs/spec.md §6.3 §6.4。年報 CSV 存這裡，保留 5 年。
-- 私有 bucket：一般前端讀不到；後台 API 一律走 service role（繞過 RLS）存取。

insert into storage.buckets (id, name, public)
values ('archives', 'archives', false)
on conflict (id) do nothing;
