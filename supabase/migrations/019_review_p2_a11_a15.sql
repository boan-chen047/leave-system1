-- 019_review_p2_a11_a15.sql —— 審查 P2：A11（角色/停用保護）、A15（封存補跑帳本）
--
-- A11：id === user.id 的字串比較大小寫敏感，大寫 UUID 可繞過自我停用/降權；且沒有
--      「至少保留一位一級」保護。改用 RPC 在交易內以 uuid 比較（不分大小寫）並檢查。
-- A15：封存失敗的期別不會下月補跑。新增 archive_jobs 帳本記 pending/completed/failed，
--      每次排程重試未完成者。

-- ── A11：角色變更（交易內檢查）──────────────────────────────
create or replace function change_user_role(p_target uuid, p_role user_role, p_actor uuid)
returns void language plpgsql as $$
begin
  if p_target = p_actor then          -- uuid 比較不分大小寫，堵掉大寫繞過
    raise exception '不能變更自己的角色' using errcode = '22023';
  end if;
  -- 把某位一級降級時，確保還留至少一位「有效（未停用）」一級管理員
  if p_role <> 'admin1'
     and exists (select 1 from users where id = p_target and role = 'admin1')
     and (select count(*) from users where role = 'admin1' and is_active and id <> p_target) < 1 then
    raise exception '至少要保留一位一級管理員' using errcode = '23514';
  end if;
  update users set role = p_role, updated_at = now() where id = p_target;
  if not found then raise exception '找不到成員' using errcode = 'P0002'; end if;
end $$;
alter function change_user_role(uuid, user_role, uuid) set search_path = public;
revoke execute on function change_user_role(uuid, user_role, uuid) from public, authenticated, anon;

-- ── A11：停用/啟用（交易內檢查）────────────────────────────
create or replace function set_user_active(p_target uuid, p_active boolean, p_actor uuid)
returns void language plpgsql as $$
begin
  if p_target = p_actor then
    raise exception '不能停用自己' using errcode = '22023';
  end if;
  if p_active = false
     and exists (select 1 from users where id = p_target and role = 'admin1')
     and (select count(*) from users where role = 'admin1' and is_active and id <> p_target) < 1 then
    raise exception '至少要保留一位一級管理員' using errcode = '23514';
  end if;
  update users set
    is_active = p_active,
    deactivated_at = case when p_active then null else now() end,
    updated_at = now()
  where id = p_target;
  if not found then raise exception '找不到成員' using errcode = 'P0002'; end if;
end $$;
alter function set_user_active(uuid, boolean, uuid) set search_path = public;
revoke execute on function set_user_active(uuid, boolean, uuid) from public, authenticated, anon;

-- ── A15：封存補跑帳本 ───────────────────────────────────────
create table if not exists archive_jobs (
  period_type period_type not null,
  period_key  text        not null,
  status      text        not null default 'pending',   -- pending | completed | failed
  attempts    int         not null default 0,
  last_error  text,
  updated_at  timestamptz not null default now(),
  primary key (period_type, period_key)
);
alter table archive_jobs enable row level security;
revoke all on archive_jobs from authenticated, anon;
create policy archive_jobs_no_access on archive_jobs for all using (false) with check (false);
