-- 033_export_blobs.sql —— LINE 內建瀏覽器下載 CSV 的中繼暫存
--
-- LINE（尤其 iOS WKWebView）內建瀏覽器不支援 blob/<a download> 下載，按了沒反應。
-- 解法：前端把已產好的 CSV POST 到伺服器暫存這裡，換一次性簽章連結，再用外部瀏覽器
-- （openExternalBrowser=1）開該連結下載。暫存列短命，抓完靠 120 秒 token 過期＋每次 POST
-- 時順手清掉 1 小時前的舊列。內含成員名字（無銀行），僅 service role 存取。
create table if not exists export_blobs (
  id         uuid primary key default gen_random_uuid(),
  filename   text not null,
  csv        text not null,
  created_at timestamptz not null default now()
);
alter table export_blobs enable row level security;
revoke all on export_blobs from authenticated, anon;
create policy export_blobs_no_access on export_blobs for all using (false) with check (false);
