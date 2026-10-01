-- 017_review_p1_fixes.sql —— 審查 P1（A01–A05）資料完整性修正
--
-- A01：清理刪未來場次會 cascade 掉「銷假軌跡」。改為「有任何請假紀錄（含已取消）就不刪」。
-- A02：清理未保護 is_cancelled，取消的未來場次被刪後又被 generate 復活。改為清理跳過已取消。
-- A03：週期場次改期後原日期會再生成。新增 rule_skips 例外表，generate 跳過被移走的原日期。
-- A04：季/年快照由「殘缺明細」重算會覆寫成偏低。改為季/年一律由「月快照」彙總（月快照永久），
--      且月快照對「兩年前、已存在」的期別凍結不重算。
-- A05：補跑舊封存讀到已清明細→CSV 變 0。與 A04 同解：季/年彙總、舊月凍結，快照不再被洗掉。

-- ── A03：改期跳過例外 ─────────────────────────────────────────
create table if not exists rule_skips (
  source_rule_id uuid not null references recurring_rules(id) on delete cascade,
  session_date   date not null,
  primary key (source_rule_id, session_date)
);
alter table rule_skips enable row level security;
revoke all on rule_skips from authenticated, anon;  -- 只走後台 service role

create or replace function generate_sessions()
returns int language plpgsql as $$
declare
  r        record;
  target   date;
  horizon  int;
  created  int := 0;
begin
  select generate_weeks_ahead into horizon from app_config where id;
  for r in select * from recurring_rules where is_active loop
    target := greatest(current_date, r.effective_from);
    while target <= current_date + (horizon * 7) loop
      if extract(dow from target) = r.weekday
         -- A03：被改期移走的原日期不再重生成
         and not exists (select 1 from rule_skips k where k.source_rule_id = r.id and k.session_date = target)
      then
        insert into sessions (session_date, start_time, end_time, location, kind, source_rule_id)
        values (target, r.start_time, r.end_time, r.location, 'regular', r.id)
        on conflict (source_rule_id, session_date) where source_rule_id is not null
        do nothing;
        if found then created := created + 1; end if;
      end if;
      target := target + 1;
    end loop;
  end loop;
  return created;
end $$;
alter function generate_sessions() set search_path = public;

-- ── A01 + A02：清理保護（有任何請假紀錄、或已取消，一律不刪）────────────
create or replace function purge_regenerable_future_sessions(p_rule_id uuid, p_from date)
returns int language plpgsql as $$
declare removed int;
begin
  delete from sessions s
  where s.source_rule_id = p_rule_id
    and s.session_date >= greatest(current_date, p_from)
    and not s.is_cancelled                                   -- A02：已取消的不刪（否則會復活）
    and not exists (                                          -- A01：有任何請假紀錄（含已取消）就不刪
      select 1 from leave_requests lr where lr.session_id = s.id
    );
  get diagnostics removed = row_count;
  return removed;
end $$;
alter function purge_regenerable_future_sessions(uuid, date) set search_path = public;

create or replace function purge_sessions_beyond_horizon(p_weeks int)
returns int language plpgsql as $$
declare removed int;
begin
  delete from sessions s
  where s.source_rule_id is not null
    and s.session_date > current_date + (p_weeks * 7)
    and not s.is_cancelled                                   -- A02
    and not exists (                                          -- A01
      select 1 from leave_requests lr where lr.session_id = s.id
    );
  get diagnostics removed = row_count;
  return removed;
end $$;
alter function purge_sessions_beyond_horizon(int) set search_path = public;

-- ── A04 + A05：月由明細（舊期凍結）、季/年由月快照彙總 ────────────────
create or replace function build_summary(p_type period_type, p_start date, p_end date, p_key text)
returns int language plpgsql as $$
declare affected int;
begin
  if p_type = 'month' then
    -- 兩年前且已有快照：凍結不重算，避免用「已被清理的殘缺明細」覆寫掉正確快照
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
      m.sessions_count, m.leave_count, m.sessions_count - m.leave_count
    from users u
    cross join lateral (
      select
        greatest(p_start, u.created_at::date) as win_start,
        case when u.deactivated_at is null then p_end
             else least(p_end, u.deactivated_at::date - 1) end as win_end
    ) w
    cross join lateral (
      select
        (select count(*) from sessions s
          where s.session_date between w.win_start and w.win_end
            and not s.is_cancelled) as sessions_count,
        (select count(*) from leave_requests lr
           join sessions s2 on s2.id = lr.session_id
          where lr.user_id = u.id and lr.status = 'active'
            and not s2.is_cancelled
            and s2.session_date between w.win_start and w.win_end) as leave_count
    ) m
    where u.created_at::date <= p_end
      and (u.deactivated_at is null or u.deactivated_at::date > p_start)
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
    -- 季/年：由涵蓋期間內的「月快照」彙總。月快照永久保存，即使明細已清仍算得出，
    -- 也就不會出現 A04「用殘缺明細重算覆寫」的問題。
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
