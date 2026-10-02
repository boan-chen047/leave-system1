-- 008_purge_regenerable.sql —— 編輯/刪除規則時，清掉「可以安全重生成」的未來場次
-- 對應 docs/spec.md §6.5。條件：屬於該規則、日期 >= 指定生效日、且「還沒有人請假」。
-- 已經有人請假的場次一律不刪（沿用規則變更不追溯的原則），改由管理員個別處理。

create or replace function purge_regenerable_future_sessions(p_rule_id uuid, p_from date)
returns int language plpgsql as $$
declare removed int;
begin
  delete from sessions s
  where s.source_rule_id = p_rule_id
    -- 防禦：永遠不刪早於今天的場次，就算呼叫端把生效日誤設成過去也一樣
    and s.session_date >= greatest(current_date, p_from)
    and not exists (
      select 1 from leave_requests lr where lr.session_id = s.id and lr.status = 'active'
    );
  get diagnostics removed = row_count;
  return removed;
end $$;

alter function purge_regenerable_future_sessions(uuid, date) set search_path = public;
