-- 027_protect_admin1_and_admin_delete.sql
-- 委託人 2026-09-10：
--   1) 一級管理員沒資格處置「其他一級管理員」——角色變更／停用／刪除，只要目標的
--      現任角色是 admin1 就一律擋（自己也是 admin1，等於連自己也不能在成員頁動；
--      自己另有更明確的訊息）。用 42501（insufficient_privilege）回報，API 對應 403。
--   2) 成員頁新增「刪除帳號」（一級可用，放停用下方）——新增 delete_user_by_admin，
--      cascade 刪除該員與所有關聯個資；已產生的歷史 CSV 在 Storage/Drive 不受影響。

-- ── 角色變更：擋「處置其他一級」──────────────────────────────
create or replace function change_user_role(p_target uuid, p_role user_role, p_actor uuid)
returns void language plpgsql as $$
begin
  if p_target = p_actor then          -- uuid 比較不分大小寫，堵掉大寫繞過
    raise exception '不能變更自己的角色' using errcode = '22023';
  end if;
  if exists (select 1 from users where id = p_target and role = 'admin1') then
    raise exception '不能處置一級管理員' using errcode = '42501';
  end if;
  -- 保留：把某位一級降級時，確保還留至少一位「有效」一級（現在幾乎不會走到，留作防線）
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

-- ── 停用/啟用：擋「處置其他一級」──────────────────────────────
create or replace function set_user_active(p_target uuid, p_active boolean, p_actor uuid)
returns void language plpgsql as $$
begin
  if p_target = p_actor then
    raise exception '不能停用自己' using errcode = '22023';
  end if;
  if exists (select 1 from users where id = p_target and role = 'admin1') then
    raise exception '不能處置一級管理員' using errcode = '42501';
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

-- ── 後台刪除成員（一級用；擋自己與其他一級）──────────────────
create or replace function delete_user_by_admin(p_target uuid, p_actor uuid)
returns void language plpgsql as $$
begin
  if p_target = p_actor then
    raise exception '不能刪除自己（請到個人頁自助刪除）' using errcode = '22023';
  end if;
  if exists (select 1 from users where id = p_target and role = 'admin1') then
    raise exception '不能處置一級管理員' using errcode = '42501';
  end if;
  delete from users where id = p_target;  -- cascade：請假／統計快照／在隊期間；歷史 CSV 不受影響
  if not found then raise exception '找不到成員' using errcode = 'P0002'; end if;
end $$;
alter function delete_user_by_admin(uuid, uuid) set search_path = public;
revoke execute on function delete_user_by_admin(uuid, uuid) from public, authenticated, anon;
