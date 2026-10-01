-- 016_summary_display_name.sql —— 快照多存一欄 LINE 名稱（display_name）
-- 對應 docs/spec.md §6.2。委託人 2026-09-08：封存 Excel 要同時看到「LINE名稱」與「姓名」，
-- 才能對得上人（很多人沒填真名時，光看真名欄是空的）。
--
-- 原本快照只存 real_name = coalesce(真名, LINE名稱) 一欄。這裡加 display_name 欄，
-- build_summary 兩欄都存：real_name 維持原邏輯（有真名用真名、沒填退回 LINE 名），
-- display_name 一律存 LINE 名稱。封存 CSV 兩欄並列。

alter table attendance_summaries
  add column if not exists display_name text not null default '';

create or replace function build_summary(p_type period_type, p_start date, p_end date, p_key text)
returns int language plpgsql as $$
declare affected int;
begin
  insert into attendance_summaries
    (period_type, period_key, period_start, period_end,
     user_id, real_name, display_name, sessions_count, leave_count, attend_count)
  select
    p_type, p_key, p_start, p_end,
    u.id,
    coalesce(u.real_name, u.display_name),  -- 姓名欄：有真名用真名，沒填退回 LINE 名
    u.display_name,                          -- LINE名稱欄：一律 LINE 顯示名
    m.sessions_count,
    m.leave_count,
    m.sessions_count - m.leave_count
  from users u
  cross join lateral (
    select
      greatest(p_start, u.created_at::date) as win_start,
      case when u.deactivated_at is null then p_end
           else least(p_end, u.deactivated_at::date - 1) end as win_end
  ) w
  cross join lateral (
    select
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
end $$;

alter function build_summary(period_type, date, date, text) set search_path = public;
