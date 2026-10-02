-- 003_generate_sessions.sql —— 場次自動生成 + 每日排程
-- 對應 docs/spec.md §6.1
-- 一期＋二期需要的排程只有這一支；分析/清理排程在 004（第四期才啟用）。

create extension if not exists pg_cron;

create or replace function generate_sessions(weeks_ahead int default 8)
returns int language plpgsql as $$
declare
  r       record;
  target  date;
  created int := 0;
begin
  for r in select * from recurring_rules where is_active loop
    target := current_date;
    while target <= current_date + (weeks_ahead * 7) loop
      if extract(dow from target) = r.weekday then
        insert into sessions (session_date, start_time, end_time, location, kind, source_rule_id)
        values (target, r.start_time, r.end_time, r.location, 'regular', r.id)
        on conflict (source_rule_id, session_date) where source_rule_id is not null
        do nothing;
        -- on conflict do nothing 沒插入時 FOUND 為 false。少了這個判斷，
        -- 回傳值會把「跳過的重複場次」也算進去，數字會誤導。
        if found then created := created + 1; end if;
      end if;
      target := target + 1;
    end loop;
  end loop;
  return created;
end $$;

-- 每日 03:00 往後補足 8 週場次
select cron.schedule('generate_sessions', '0 3 * * *', $$ select generate_sessions(8) $$);
