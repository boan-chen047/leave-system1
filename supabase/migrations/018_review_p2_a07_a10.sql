-- 018_review_p2_a07_a10.sql —— 審查 P2：A07（規則交易）、A08（台北日期）、A10（多段會員期間）
--
-- A07：新增/編輯規則時，前端分兩個獨立請求（週數 + 規則），可能只存一半、無效週數也不擋規則。
--      合併成單一交易 RPC，週數違反 1–52 約束會整筆回滾。
-- A08：created_at/deactivated_at 直接 ::date 取的是 UTC 日期，台灣凌晨會差一天。統一 AT TIME ZONE 'Asia/Taipei'。
-- A10：重新啟用清空 deactivated_at 會抹掉停用期間。改用 membership_periods 記錄「多段在隊期間」，
--      由觸發器自動維護（加入建一段、停用關閉、重新啟用新開一段），統計一律以期間判定有效性。
--      期間端點存台北日期，順帶解掉 A08。

-- ── A07：週數 + 規則 合併交易 ────────────────────────────────
create or replace function add_rule_with_weeks(
  p_weeks int, p_weekday int, p_start_time time, p_end_time time, p_location text, p_effective_from date
) returns int language plpgsql as $$
begin
  update app_config set generate_weeks_ahead = p_weeks, updated_at = now() where id;  -- 違反 1–52 約束會整筆回滾
  insert into recurring_rules (weekday, start_time, end_time, location, effective_from)
  values (p_weekday, p_start_time, p_end_time, p_location, p_effective_from);
  return generate_sessions();
end $$;
alter function add_rule_with_weeks(int, int, time, time, text, date) set search_path = public;
revoke execute on function add_rule_with_weeks(int, int, time, time, text, date) from public, authenticated, anon;

create or replace function edit_rule_with_weeks(
  p_rule_id uuid, p_weeks int, p_weekday int, p_start_time time, p_end_time time,
  p_location text, p_effective_from date
) returns int language plpgsql as $$
begin
  update app_config set generate_weeks_ahead = p_weeks, updated_at = now() where id;
  update recurring_rules set
    weekday = p_weekday, start_time = p_start_time, end_time = p_end_time,
    location = p_location, effective_from = p_effective_from, updated_at = now()
  where id = p_rule_id;
  if not found then raise exception '找不到規則 %', p_rule_id using errcode = 'no_data_found'; end if;
  perform purge_regenerable_future_sessions(p_rule_id, p_effective_from);
  return generate_sessions();
end $$;
alter function edit_rule_with_weeks(uuid, int, int, time, time, text, date) set search_path = public;
revoke execute on function edit_rule_with_weeks(uuid, int, int, time, time, text, date) from public, authenticated, anon;

-- ── A10 + A08：多段會員期間 ─────────────────────────────────
create table if not exists membership_periods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  started_on date not null,   -- 台北日期
  ended_on   date             -- null = 仍在隊；否則為「離隊當天」，當天(含)之後不算在隊
);
create index if not exists membership_periods_user_idx on membership_periods (user_id);
alter table membership_periods enable row level security;
revoke all on membership_periods from authenticated, anon;

-- 觸發器：讓期間永遠跟 users 的加入/停用/啟用同步（不管走哪條程式路徑都一致）
create or replace function sync_membership_period() returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    insert into membership_periods (user_id, started_on)
    values (NEW.id, (NEW.created_at at time zone 'Asia/Taipei')::date);
  elsif TG_OP = 'UPDATE' and NEW.is_active is distinct from OLD.is_active then
    if NEW.is_active = false then
      update membership_periods
        set ended_on = (coalesce(NEW.deactivated_at, now()) at time zone 'Asia/Taipei')::date
        where user_id = NEW.id and ended_on is null;
    else
      insert into membership_periods (user_id, started_on)
      values (NEW.id, (now() at time zone 'Asia/Taipei')::date);
    end if;
  end if;
  return NEW;
end $$;
alter function sync_membership_period() set search_path = public;

drop trigger if exists users_membership_sync on users;
create trigger users_membership_sync
  after insert or update on users
  for each row execute function sync_membership_period();

-- 回填既有使用者（各一段：加入日 → 停用日／null），台北日期
insert into membership_periods (user_id, started_on, ended_on)
select id,
  (created_at at time zone 'Asia/Taipei')::date,
  case when deactivated_at is null then null
       else (deactivated_at at time zone 'Asia/Taipei')::date end
from users u
where not exists (select 1 from membership_periods mp where mp.user_id = u.id);

-- 「某段期間是否為在隊成員」= 有任一段期間與 [p_start, p_end] 重疊
create or replace function eligible_member_count(p_start date, p_end date)
returns int language sql stable as $$
  select count(distinct mp.user_id)::int
  from membership_periods mp
  where mp.started_on <= p_end
    and (mp.ended_on is null or mp.ended_on > p_start);
$$;
alter function eligible_member_count(date, date) set search_path = public;

-- ── build_summary：月報改以期間判定「該場是否算他的」（多段安全），季/年仍彙總月報 ──
create or replace function build_summary(p_type period_type, p_start date, p_end date, p_key text)
returns int language plpgsql as $$
declare affected int;
begin
  if p_type = 'month' then
    if p_end < current_date - interval '2 years'
       and exists (select 1 from attendance_summaries a
                    where a.period_type = 'month' and a.period_key = p_key) then
      return 0;  -- 舊期凍結（A04）
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
        -- 應到：落在此人任一在隊期間內、未取消的場次
        (select count(*) from sessions s
          where s.session_date between p_start and p_end and not s.is_cancelled
            and exists (select 1 from membership_periods mp where mp.user_id = u.id
                          and mp.started_on <= s.session_date
                          and (mp.ended_on is null or mp.ended_on > s.session_date))) as sessions_count,
        (select count(*) from leave_requests lr
           join sessions s2 on s2.id = lr.session_id
          where lr.user_id = u.id and lr.status = 'active' and not s2.is_cancelled
            and s2.session_date between p_start and p_end
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
alter function build_summary(period_type, date, date, text) set search_path = public;

-- summarize_range（統計頁）同步改期間感知，與 build_summary / 依個人查一致（A09/A10）
create or replace function summarize_range(p_start date, p_end date)
returns table(user_id uuid, real_name text, sessions_count int, leave_count int, attend_count int)
language sql stable as $$
  select
    u.id, coalesce(u.real_name, u.display_name),
    c.sessions_count, c.leave_count, c.sessions_count - c.leave_count
  from users u
  cross join lateral (
    select
      (select count(*)::int from sessions s
        where s.session_date between p_start and p_end and not s.is_cancelled
          and exists (select 1 from membership_periods mp where mp.user_id = u.id
                        and mp.started_on <= s.session_date
                        and (mp.ended_on is null or mp.ended_on > s.session_date))) as sessions_count,
      (select count(*)::int from leave_requests lr join sessions s2 on s2.id = lr.session_id
        where lr.user_id = u.id and lr.status = 'active' and not s2.is_cancelled
          and s2.session_date between p_start and p_end
          and exists (select 1 from membership_periods mp where mp.user_id = u.id
                        and mp.started_on <= s2.session_date
                        and (mp.ended_on is null or mp.ended_on > s2.session_date))) as leave_count
  ) c
  where exists (select 1 from membership_periods mp where mp.user_id = u.id
                  and mp.started_on <= p_end and (mp.ended_on is null or mp.ended_on > p_start))
  order by coalesce(u.real_name, u.display_name);
$$;
alter function summarize_range(date, date) set search_path = public;

-- 這兩張表只由後台 service role 存取；明確 deny-all policy（清 rls_enabled_no_policy 提示，service role 仍繞過）
create policy membership_periods_no_access on membership_periods for all using (false) with check (false);
create policy rule_skips_no_access on rule_skips for all using (false) with check (false);
