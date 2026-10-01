-- 044_leave_change_notices.sql —— 已請假的場次被改日期/時間時，通知請假的人
-- 委託人 2026-09-24：場次改期（單場改期、或改規則造成）後，原本的請假會跟著新日期；
-- 請假的人未必知道（週五不能來、改到週六也許能來）。改為：場次日期或時間變動時，
-- 替該場每位「有效請假」者記一則通知，他下次打開 App 跳彈窗提醒（按「知道了」後不再跳）。
--
-- 規則：
--   · 由 sessions 的 AFTER UPDATE trigger 產生 → 單場改期與改規則（043 就地更新）都涵蓋
--   · 同一筆請假若已有「未讀」通知：只更新新日期/時間，保留最原本的舊值（連改兩次只顯示「最原本 → 最新」）
--   · 改回原本的日期時間 → 未讀通知自動撤掉
--   · 只改地點/備註不通知（不影響能不能來）

create table if not exists leave_change_notices (
  id              uuid primary key default gen_random_uuid(),
  leave_id        uuid not null references leave_requests(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  session_id      uuid not null references sessions(id) on delete cascade,
  old_date        date not null,
  old_start       time not null,
  old_end         time not null,
  new_date        date not null,
  new_start       time not null,
  new_end         time not null,
  created_at      timestamptz not null default now(),
  acknowledged_at timestamptz                -- 按「知道了」的時間；NULL＝未讀
);
-- 每筆請假最多一則未讀通知
create unique index if not exists leave_change_notices_pending_uniq
  on leave_change_notices (leave_id) where acknowledged_at is null;
create index if not exists leave_change_notices_user_pending_idx
  on leave_change_notices (user_id) where acknowledged_at is null;
create index if not exists leave_change_notices_session_idx on leave_change_notices (session_id);

alter table leave_change_notices enable row level security;
revoke all on leave_change_notices from authenticated, anon;
create policy leave_change_notices_no_access on leave_change_notices
  for all using (false) with check (false);

create or replace function notify_leave_session_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if (NEW.session_date, NEW.start_time, NEW.end_time)
     is not distinct from (OLD.session_date, OLD.start_time, OLD.end_time) then
    return null;
  end if;

  -- 已有未讀通知：只更新「新」的部分，保留最原本的舊值
  update leave_change_notices n
    set new_date = NEW.session_date, new_start = NEW.start_time, new_end = NEW.end_time, created_at = now()
    from leave_requests lr
   where n.leave_id = lr.id and lr.session_id = NEW.id and lr.status = 'active'
     and n.acknowledged_at is null;

  -- 其餘有效請假：新增通知
  insert into leave_change_notices
    (leave_id, user_id, session_id, old_date, old_start, old_end, new_date, new_start, new_end)
  select lr.id, lr.user_id, NEW.id,
         OLD.session_date, OLD.start_time, OLD.end_time,
         NEW.session_date, NEW.start_time, NEW.end_time
    from leave_requests lr
   where lr.session_id = NEW.id and lr.status = 'active'
     and not exists (select 1 from leave_change_notices n
                      where n.leave_id = lr.id and n.acknowledged_at is null);

  -- 改回原本的日期時間：未讀通知已無意義，撤掉
  delete from leave_change_notices n
   where n.session_id = NEW.id and n.acknowledged_at is null
     and n.old_date = n.new_date and n.old_start = n.new_start and n.old_end = n.new_end;

  return null;
end $$;

drop trigger if exists sessions_notify_leave_change on sessions;
create trigger sessions_notify_leave_change
  after update of session_date, start_time, end_time on sessions
  for each row execute function notify_leave_session_change();
