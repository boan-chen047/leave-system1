-- 040_stats_ended_sessions_only.sql —— 出席/請假統計一律只算「已結束」的場次
-- 委託人 2026-09-24：App（首頁/紀錄/依個人查，computeMemberStats）自 2026-09-12 起只算已結束場次，
-- 但後台「統計」頁與每日即時季報走 summarize_range，仍把未來場次算成已出席 → 同一人兩頁數字不同。
-- 統一定義：場次「已結束」（台北 session_date + end_time <= 現在）才納入 sessions/leave/attend 計數。
--
-- 影響範圍：
--   · summarize_range：後台統計頁、每日即時季報（季中「應退金額」改為只算已發生的請假）
--   · build_summary：呼叫者（snapshot_prev_*／backfill_and_purge）都只處理已過去的期間，
--     屆時場次皆已結束 → 已封存的月/季快照數字不變；僅防手動對「進行中期間」補跑時誤計。
--   · snapshot_retained_refund：刪帳號時留存「本季至今」，今天尚未打完的場次不再算成出席。

-- 唯一定義：對應 TS 端 src/lib/date.ts 的 sessionHasEnded（台灣固定 +08:00、無日光節約）。
create or replace function session_ended(p_date date, p_end time)
returns boolean language sql stable set search_path = '' as $$
  select (p_date + p_end) <= (now() at time zone 'Asia/Taipei')
$$;

-- ── summarize_range：即時統計（後台統計頁、每日即時季報）────────────
create or replace function summarize_range(p_start date, p_end date)
returns table(user_id uuid, real_name text, sessions_count integer, leave_count integer, attend_count integer)
language sql stable set search_path = public as $$
  select
    u.id, coalesce(u.real_name, u.display_name),
    c.sessions_count, c.leave_count, c.sessions_count - c.leave_count
  from users u
  cross join lateral (
    select
      (select count(*)::int from sessions s
        where s.session_date between p_start and p_end and not s.is_cancelled
          and session_ended(s.session_date, s.end_time)
          and exists (select 1 from membership_periods mp where mp.user_id = u.id
                        and mp.started_on <= s.session_date
                        and (mp.ended_on is null or mp.ended_on > s.session_date))) as sessions_count,
      (select count(*)::int from leave_requests lr join sessions s2 on s2.id = lr.session_id
        where lr.user_id = u.id and lr.status = 'active' and not s2.is_cancelled
          and s2.session_date between p_start and p_end
          and session_ended(s2.session_date, s2.end_time)
          and exists (select 1 from membership_periods mp where mp.user_id = u.id
                        and mp.started_on <= s2.session_date
                        and (mp.ended_on is null or mp.ended_on > s2.session_date))) as leave_count
  ) c
  where exists (select 1 from membership_periods mp where mp.user_id = u.id
                  and mp.started_on <= p_end and (mp.ended_on is null or mp.ended_on > p_start))
  order by coalesce(u.real_name, u.display_name);
$$;

-- ── build_summary：月結快照（季/年由月快照彙總，else 分支不變）──────
create or replace function build_summary(p_type period_type, p_start date, p_end date, p_key text)
returns integer language plpgsql set search_path = public as $$
declare affected int;
begin
  if p_type = 'month' then
    if p_end < current_date - interval '2 years'
       and exists (select 1 from attendance_summaries a
                    where a.period_type = 'month' and a.period_key = p_key) then
      return 0;
    end if;

    insert into attendance_summaries
      (period_type, period_key, period_start, period_end,
       user_id, real_name, display_name, sessions_count, leave_count, attend_count)
    select
      p_type, p_key, p_start, p_end, u.id,
      coalesce(u.real_name, u.display_name), u.display_name,
      c.sessions_count, c.leave_count, c.sessions_count - c.leave_count
    from users u
    cross join lateral (
      select
        (select count(*) from sessions s
          where s.session_date between p_start and p_end and not s.is_cancelled
            and session_ended(s.session_date, s.end_time)
            and exists (select 1 from membership_periods mp where mp.user_id = u.id
                          and mp.started_on <= s.session_date
                          and (mp.ended_on is null or mp.ended_on > s.session_date))) as sessions_count,
        (select count(*) from leave_requests lr
           join sessions s2 on s2.id = lr.session_id
          where lr.user_id = u.id and lr.status = 'active' and not s2.is_cancelled
            and s2.session_date between p_start and p_end
            and session_ended(s2.session_date, s2.end_time)
            and exists (select 1 from membership_periods mp where mp.user_id = u.id
                          and mp.started_on <= s2.session_date
                          and (mp.ended_on is null or mp.ended_on > s2.session_date))) as leave_count
    ) c
    where exists (select 1 from membership_periods mp where mp.user_id = u.id
                    and mp.started_on <= p_end and (mp.ended_on is null or mp.ended_on > p_start))
    on conflict (period_type, period_key, user_id) do update
      set sessions_count = excluded.sessions_count,
          leave_count    = excluded.leave_count,
          attend_count   = excluded.attend_count,
          real_name      = excluded.real_name,
          display_name   = excluded.display_name,
          generated_at   = now();
    get diagnostics affected = row_count;
    return affected;

  else
    insert into attendance_summaries
      (period_type, period_key, period_start, period_end,
       user_id, real_name, display_name, sessions_count, leave_count, attend_count)
    select
      p_type, p_key, p_start, p_end, a.user_id,
      (array_agg(a.real_name    order by a.period_start desc))[1],
      (array_agg(a.display_name order by a.period_start desc))[1],
      sum(a.sessions_count), sum(a.leave_count), sum(a.attend_count)
    from attendance_summaries a
    where a.period_type = 'month'
      and a.period_start >= p_start and a.period_end <= p_end
    group by a.user_id
    on conflict (period_type, period_key, user_id) do update
      set sessions_count = excluded.sessions_count,
          leave_count    = excluded.leave_count,
          attend_count   = excluded.attend_count,
          real_name      = excluded.real_name,
          display_name   = excluded.display_name,
          generated_at   = now();
    get diagnostics affected = row_count;
    return affected;
  end if;
end $$;

-- ── snapshot_retained_refund：刪帳號前留存「本季至今」──────────────
create or replace function snapshot_retained_refund(p_user uuid)
returns void language plpgsql set search_path = public as $$
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
      and session_ended(s.session_date, s.end_time)
      and exists (select 1 from membership_periods mp where mp.user_id = p_user
                    and mp.started_on <= s.session_date
                    and (mp.ended_on is null or mp.ended_on > s.session_date));

  select count(*) into lc from leave_requests lr join sessions s2 on s2.id = lr.session_id
    where lr.user_id = p_user and lr.status = 'active' and not s2.is_cancelled
      and s2.session_date between qs and today
      and session_ended(s2.session_date, s2.end_time)
      and exists (select 1 from membership_periods mp where mp.user_id = p_user
                    and mp.started_on <= s2.session_date
                    and (mp.ended_on is null or mp.ended_on > s2.session_date));

  if sc = 0 and lc = 0 then return; end if;

  insert into retained_refunds
    (period_key, real_name, display_name, bank_code, bank_account, refund_line_pay,
     sessions_count, attend_count, leave_count)
  values
    (qkey, coalesce(u.real_name, u.display_name), u.display_name, u.bank_code, u.bank_account,
     u.refund_line_pay, sc, sc - lc, lc);
end $$;
