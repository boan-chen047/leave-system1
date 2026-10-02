-- 029_retain_current_quarter_on_delete.sql
-- 委託人 2026-09-10：刪除帳號（自助或後台）時，若此人「本季」有資料（出席或請假），
-- 要把本季那筆留存下來，之後的季報／退費 CSV 仍看得到他（含銀行資料供退費），
-- 不因刪除而消失。做法：刪除前把「本季至今」的一列快照存進 retained_refunds；
-- 報表產生（archivePeriod 季末封存、archiveLiveCurrentQuarter 每日即時）都會併入這些留存列。

-- ── 留存表（僅 service role；前端無權）──────────────────────
create table if not exists retained_refunds (
  id              uuid primary key default gen_random_uuid(),
  period_key      text not null,               -- 季，如 '2026-Q3'
  real_name       text,
  display_name    text,
  bank_code       text,
  bank_account    text,
  refund_line_pay boolean not null default false,
  sessions_count  int not null,
  attend_count    int not null,
  leave_count     int not null,
  retained_at     timestamptz not null default now()
);
create index if not exists retained_refunds_period_idx on retained_refunds (period_key);
alter table retained_refunds enable row level security;
revoke all on retained_refunds from authenticated, anon;
create policy retained_refunds_no_access on retained_refunds for all using (false) with check (false);

-- ── 刪除前快照：本季至今（含）的出席/請假，期間感知；沒有本季資料就不留 ──
create or replace function snapshot_retained_refund(p_user uuid)
returns void language plpgsql as $$
declare
  qs    date := date_trunc('quarter', (now() at time zone 'Asia/Taipei'))::date;
  today date := (now() at time zone 'Asia/Taipei')::date;
  qkey  text := to_char(qs, 'YYYY') || '-Q' || to_char(qs, 'Q');
  sc int; lc int; u record;
begin
  select * into u from users where id = p_user;
  if not found then return; end if;

  select count(*) into sc from sessions s
    where s.session_date between qs and today and not s.is_cancelled
      and exists (select 1 from membership_periods mp where mp.user_id = p_user
                    and mp.started_on <= s.session_date
                    and (mp.ended_on is null or mp.ended_on > s.session_date));

  select count(*) into lc from leave_requests lr join sessions s2 on s2.id = lr.session_id
    where lr.user_id = p_user and lr.status = 'active' and not s2.is_cancelled
      and s2.session_date between qs and today
      and exists (select 1 from membership_periods mp where mp.user_id = p_user
                    and mp.started_on <= s2.session_date
                    and (mp.ended_on is null or mp.ended_on > s2.session_date));

  if sc = 0 and lc = 0 then return; end if;  -- 本季完全沒資料就不留

  insert into retained_refunds
    (period_key, real_name, display_name, bank_code, bank_account, refund_line_pay,
     sessions_count, attend_count, leave_count)
  values
    (qkey, coalesce(u.real_name, u.display_name), u.display_name, u.bank_code, u.bank_account,
     u.refund_line_pay, sc, sc - lc, lc);
end $$;
alter function snapshot_retained_refund(uuid) set search_path = public;
revoke execute on function snapshot_retained_refund(uuid) from public, authenticated, anon;

-- ── 兩個刪除函式：刪前先留存本季 ────────────────────────────
create or replace function delete_self(p_user uuid)
returns void language plpgsql as $$
begin
  if exists (select 1 from users where id = p_user and role = 'admin1')
     and (select count(*) from users where role='admin1' and is_active and id <> p_user) < 1 then
    raise exception '你是最後一位一級管理員，請先指派其他人' using errcode = '23514';
  end if;
  perform snapshot_retained_refund(p_user);   -- 本季有資料就留存
  delete from users where id = p_user;  -- cascade：請假／統計快照／在隊期間；歷史 CSV 與留存列不受影響
end $$;
alter function delete_self(uuid) set search_path = public;
revoke execute on function delete_self(uuid) from public, authenticated, anon;

create or replace function delete_user_by_admin(p_target uuid, p_actor uuid)
returns void language plpgsql as $$
begin
  if p_target = p_actor then
    raise exception '不能刪除自己（請到個人頁自助刪除）' using errcode = '22023';
  end if;
  if exists (select 1 from users where id = p_target and role = 'admin1') then
    raise exception '不能處置一級管理員' using errcode = '42501';
  end if;
  perform snapshot_retained_refund(p_target);   -- 本季有資料就留存
  delete from users where id = p_target;  -- cascade；歷史 CSV 與留存列不受影響
  if not found then raise exception '找不到成員' using errcode = 'P0002'; end if;
end $$;
alter function delete_user_by_admin(uuid, uuid) set search_path = public;
revoke execute on function delete_user_by_admin(uuid, uuid) from public, authenticated, anon;
