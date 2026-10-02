-- 006_admin_config.sql —— 第三期後台：全站設定 + 規則生效日 + 生成邏輯升級
-- 對應 docs/spec.md §6.5

-- ── 1) 全站設定（只會有一列，id 永遠 true）──────────────────
create table app_config (
  id                    boolean primary key default true check (id),
  generate_weeks_ahead  int not null default 8 check (generate_weeks_ahead between 1 and 52),
  updated_at            timestamptz not null default now()
);
insert into app_config (id) values (true);   -- 種一列初始值

alter table app_config enable row level security;
revoke insert, update, delete on app_config from authenticated, anon;
-- 前端只有管理員讀得到；寫入一律走 service role（後台 API）
create policy app_config_read on app_config for select using (is_admin());

-- ── 2) 規則生效日：這條規則「目前設定」從哪天起適用 ─────────────
-- 這天以前已排的場次一律不動；預設今天，等於「即刻生效、不追溯過去」。
alter table recurring_rules
  add column effective_from date not null default current_date;

-- ── 3) generate_sessions 升級 ───────────────────────────────
-- 不再吃參數：改讀 app_config.generate_weeks_ahead；並尊重 effective_from
-- （從「今天」與「生效日」較晚者開始補場次，生效日之前不生成）。
drop function if exists generate_sessions(int);

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
      if extract(dow from target) = r.weekday then
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

-- ── 4) 每日排程改呼叫無參數版（同 jobname 會覆蓋舊設定）─────────
select cron.schedule('generate_sessions', '0 3 * * *', $$ select generate_sessions() $$);
