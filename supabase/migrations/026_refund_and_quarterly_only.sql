-- 026_refund_and_quarterly_only.sql —— 自動報表改「只出季報」＋單場退費金額（可後台調整）
-- 委託人 2026-09-10：
--   1) 自動報表只留季報，不再產出月報／年報 CSV。
--   2) 季報自動計算「應退金額」＝請假場次 × 單場退費金額（預設 234），金額後台可改、同步 CSV 試算。
--   3) 另開雲端硬碟「退費」資料夾（結構同季報，自動建年份子夾），放每季退費明細。
--
-- 重要：季報是「由月報快照彙總（roll up）」而來（見 018 build_summary 的 else 分支），
--   所以「月結快照 snapshot_prev_month」仍必須每月產生——只是不再把月報上傳成 CSV。
--   因此本檔只停用「年報」排程（沒人再用年快照；真要清明細時 backfill_and_purge 會臨時補算），
--   保留 build_summary_month（季報彙總來源）與 build_summary_quarter。

-- ── 1) 單場退費金額（app_config 多一欄，預設 234）─────────────
alter table app_config
  add column if not exists refund_per_session int not null default 234
    check (refund_per_session >= 0);

-- ── 2) 停用年報月結排程（季報不需要年快照；月快照照舊產生供季報彙總）──
select cron.unschedule('build_summary_year');
