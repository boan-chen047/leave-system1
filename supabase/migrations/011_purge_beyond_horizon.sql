-- 011_purge_beyond_horizon.sql —— 調低生成週數時，清掉超出新範圍的遠期固定場次
-- 例如 12 週調成 8 週，8~12 週之間、還沒人請假的固定場次要清掉，否則會殘留。
-- 一樣只清「固定場次（有 source_rule_id）、未來、未被請假」的；已請假的不動。

create or replace function purge_sessions_beyond_horizon(p_weeks int)
returns int language plpgsql as $$
declare removed int;
begin
  delete from sessions s
  where s.source_rule_id is not null
    and s.session_date > current_date + (p_weeks * 7)
    and not exists (
      select 1 from leave_requests lr where lr.session_id = s.id and lr.status = 'active'
    );
  get diagnostics removed = row_count;
  return removed;
end $$;

alter function purge_sessions_beyond_horizon(int) set search_path = public;
