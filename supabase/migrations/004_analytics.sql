-- 004_analytics.sql —— 結算快照與清理保護（第四期才啟用排程，函式先備好）
-- 對應 docs/spec.md §6.2 §6.3
--
-- 這裡只建立函式，不掛排程；一期＋二期用不到，但先寫好讓 schema 完整、
-- 也方便後台「即時統計」與這裡的離線快照對照（兩者算法必須一致）。

-- ── 結算快照 ────────────────────────────────────────────────
create or replace function build_summary(p_type period_type, p_start date, p_end date, p_key text)
returns int language plpgsql as $$
declare affected int;
begin
  insert into attendance_summaries
    (period_type, period_key, period_start, period_end,
     user_id, real_name, sessions_count, leave_count, attend_count)
  select
    p_type, p_key, p_start, p_end,
    u.id,
    coalesce(u.real_name, u.display_name),
    m.sessions_count,
    m.leave_count,
    m.sessions_count - m.leave_count
  from users u
  -- 先算出每個人在這個區間內的「有效成員期間」窗口，兩個計數共用同一個窗口，
  -- 否則 attend = sessions − leave 會出現一邊算到、一邊沒算到的錯位。
  cross join lateral (
    select
      greatest(p_start, u.created_at::date) as win_start,
      -- 上界必須被停用日截斷。少了這段，月中退出的人，之後的場次
      -- 仍會被算成他的「應出席」→ 出席數虛高。停用當天(含)之後都不算他的。
      case when u.deactivated_at is null then p_end
           else least(p_end, u.deactivated_at::date - 1) end as win_end
  ) w
  cross join lateral (
    select
      -- 應出席場次：只算落在有效成員期間內、未取消的場次。
      (select count(*)
         from sessions s
        where s.session_date between w.win_start and w.win_end
          and not s.is_cancelled) as sessions_count,
      (select count(*)
         from leave_requests lr
         join sessions s2 on s2.id = lr.session_id
        where lr.user_id   = u.id
          and lr.status    = 'active'
          and not s2.is_cancelled
          and s2.session_date between w.win_start and w.win_end) as leave_count
  ) m
  -- 納入「該區間內曾經是成員」的人，而不是「現在還是成員」的人
  where u.created_at::date <= p_end
    and (u.deactivated_at is null or u.deactivated_at::date > p_start)
  on conflict (period_type, period_key, user_id) do update
    set sessions_count = excluded.sessions_count,
        leave_count    = excluded.leave_count,
        attend_count   = excluded.attend_count,
        real_name      = excluded.real_name,
        generated_at   = now();

  get diagnostics affected = row_count;
  return affected;
end $$;

-- ── 清理保護 ────────────────────────────────────────────────
-- 某段期間「應該有幾個成員」——與 build_summary 的成員資格條件完全一致
create or replace function eligible_member_count(p_start date, p_end date)
returns int language sql stable as $$
  select count(*)::int from users u
  where u.created_at::date <= p_end
    and (u.deactivated_at is null or u.deactivated_at::date > p_start);
$$;

-- 涵蓋日期 d 的某類期別快照是否「完整」：存在，且列數 >= 應有成員數
create or replace function snapshot_complete(p_type period_type, d date)
returns boolean language sql stable as $$
  with p as (
    select period_start, period_end, count(*)::int as rows
    from attendance_summaries
    where period_type = p_type
      and period_start <= d and period_end >= d
    group by period_start, period_end
  )
  select coalesce(
    (select rows >= eligible_member_count(period_start, period_end) from p),
    false);
$$;

-- 兩年前明細的清理（第四期由排程呼叫；三種快照都完整才刪）。
-- 刪 sessions 就好：leave_requests 的外鍵是 on delete cascade，會一併帶走。
create or replace function purge_old_details()
returns int language plpgsql as $$
declare removed int;
begin
  delete from sessions s
  where s.session_date < current_date - interval '2 years'
    and snapshot_complete('month',   s.session_date)
    and snapshot_complete('quarter', s.session_date)
    and snapshot_complete('year',    s.session_date);
  get diagnostics removed = row_count;
  return removed;
end $$;
