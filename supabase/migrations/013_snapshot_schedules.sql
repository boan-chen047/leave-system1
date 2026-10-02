-- 013_snapshot_schedules.sql —— 第四期（純 DB 部分）：結算快照排程 + 兩年清理排程
-- 對應 docs/spec.md §6 排程表、§6.2 §6.3。
--
-- 004 只備了 build_summary(type,start,end,key) 這種「吃明確區間」的函式，排程無法
-- 直接掛（cron 不會自己算上個月是哪天）。這裡補上「算出上一期區間、再呼叫 build_summary」
-- 的無參數包裝函式，並掛 pg_cron。
-- 年報 CSV 上傳 Storage / Google Drive / 清 5 年舊檔屬「要走 HTTP」的部分，另以
-- Vercel Cron + API Route 處理（見 §6，本檔不含）。

-- ── 上個月月結 ──────────────────────────────────────────────
create or replace function snapshot_prev_month()
returns int language plpgsql as $$
declare
  ps date := date_trunc('month', current_date - interval '1 month')::date;
  pe date := (date_trunc('month', current_date) - interval '1 day')::date;
begin
  return build_summary('month', ps, pe, to_char(ps, 'YYYY-MM'));
end $$;
alter function snapshot_prev_month() set search_path = public;

-- ── 上一季季結 ──────────────────────────────────────────────
create or replace function snapshot_prev_quarter()
returns int language plpgsql as $$
declare
  ps date := date_trunc('quarter', current_date - interval '3 months')::date;
  pe date := (date_trunc('quarter', current_date) - interval '1 day')::date;
begin
  return build_summary('quarter', ps, pe, to_char(ps, 'YYYY') || '-Q' || to_char(ps, 'Q'));
end $$;
alter function snapshot_prev_quarter() set search_path = public;

-- ── 去年年結 ────────────────────────────────────────────────
create or replace function snapshot_prev_year()
returns int language plpgsql as $$
declare
  ps date := date_trunc('year', current_date - interval '1 year')::date;
  pe date := (date_trunc('year', current_date) - interval '1 day')::date;
begin
  return build_summary('year', ps, pe, to_char(ps, 'YYYY'));
end $$;
alter function snapshot_prev_year() set search_path = public;

-- ── 清理前補跑 + 兩年清理 ───────────────────────────────────
-- §6.4：刪明細前必須先補跑月/季/年快照，否則若某期快照曾失敗、清理會一直卡住。
-- 這裡把「兩年前、仍有明細」的每個月/季/年快照補齊（build_summary 冪等，重跑安全），
-- 再交給 purge_old_details()——它自己會再驗三種快照都完整才刪，雙重保險。
create or replace function backfill_and_purge()
returns int language plpgsql as $$
declare r record; removed int;
begin
  for r in
    select distinct date_trunc('month', session_date)::date as ps
    from sessions where session_date < current_date - interval '2 years'
  loop
    perform build_summary('month', r.ps,
      (r.ps + interval '1 month' - interval '1 day')::date, to_char(r.ps, 'YYYY-MM'));
  end loop;

  for r in
    select distinct date_trunc('quarter', session_date)::date as ps
    from sessions where session_date < current_date - interval '2 years'
  loop
    perform build_summary('quarter', r.ps,
      (r.ps + interval '3 months' - interval '1 day')::date,
      to_char(r.ps, 'YYYY') || '-Q' || to_char(r.ps, 'Q'));
  end loop;

  for r in
    select distinct date_trunc('year', session_date)::date as ps
    from sessions where session_date < current_date - interval '2 years'
  loop
    perform build_summary('year', r.ps,
      (r.ps + interval '1 year' - interval '1 day')::date, to_char(r.ps, 'YYYY'));
  end loop;

  removed := purge_old_details();
  return removed;
end $$;
alter function backfill_and_purge() set search_path = public;

-- 都是 service role / 排程呼叫；前端角色不需要也不授權
revoke execute on function snapshot_prev_month()   from authenticated, anon;
revoke execute on function snapshot_prev_quarter() from authenticated, anon;
revoke execute on function snapshot_prev_year()    from authenticated, anon;
revoke execute on function backfill_and_purge()    from authenticated, anon;

-- ── 排程（時間沿用既有 generate_sessions 的 UTC 慣例，同 jobname 會覆蓋舊設定）──
select cron.schedule('build_summary_month',   '10 3 1 * *',        $$ select snapshot_prev_month() $$);
select cron.schedule('build_summary_quarter', '20 3 1 1,4,7,10 *', $$ select snapshot_prev_quarter() $$);
select cron.schedule('build_summary_year',    '30 3 1 1 *',        $$ select snapshot_prev_year() $$);
select cron.schedule('purge_details',         '0 4 1 * *',         $$ select backfill_and_purge() $$);
