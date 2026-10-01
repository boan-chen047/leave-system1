-- 007_summarize_range.sql —— 後台「統計」頁用的即時全員統計
-- 與 build_summary（004）同一套成員期間窗口邏輯，但只回傳、不寫快照，
-- 確保後台即時查到的數字和月結報表一致。對應 docs/spec.md §8.2。

create or replace function summarize_range(p_start date, p_end date)
returns table (user_id uuid, real_name text, sessions_count int, leave_count int, attend_count int)
language sql stable as $$
  select
    u.id,
    coalesce(u.real_name, u.display_name),
    m.sessions_count,
    m.leave_count,
    m.sessions_count - m.leave_count
  from users u
  -- 每人的有效成員期間窗口（與 build_summary 一致）：退出者不算退出後的場次
  cross join lateral (
    select
      greatest(p_start, u.created_at::date) as win_start,
      case when u.deactivated_at is null then p_end
           else least(p_end, u.deactivated_at::date - 1) end as win_end
  ) w
  cross join lateral (
    select
      (select count(*)::int from sessions s
        where s.session_date between w.win_start and w.win_end and not s.is_cancelled) as sessions_count,
      (select count(*)::int from leave_requests lr
         join sessions s2 on s2.id = lr.session_id
        where lr.user_id = u.id and lr.status = 'active' and not s2.is_cancelled
          and s2.session_date between w.win_start and w.win_end) as leave_count
  ) m
  where u.created_at::date <= p_end
    and (u.deactivated_at is null or u.deactivated_at::date > p_start)
  order by coalesce(u.real_name, u.display_name);
$$;

alter function summarize_range(date, date) set search_path = public;
