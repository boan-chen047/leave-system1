-- 025_self_account_actions.sql —— 個人頁的自助帳號動作：停用／重啟／刪除
-- 委託人 2026-09-10。
--
-- 停用（自助）：無限期停用，但「下一季起」才退出季報——把在隊期間的 ended_on 設為
--   下一季首日（台北），所以當季仍算他，下一季起不算。self_deactivated=true 供登入端
--   區分「自己停用（可重登重啟）」與「管理員停用（擋在門外）」。
-- 重啟（自助）：重新啟用，但「非當季、下一季起」才回到季報——新開的在隊期間 started_on
--   設為下一季首日。
-- 刪除（自助）：刪除本人與所有關聯個資（cascade）；已產生的歷史報表 CSV 存於 Storage/Drive，
--   不受影響（仍保留）。擋最後一位一級管理員自刪。

alter table users add column if not exists self_deactivated boolean not null default false;

-- 下一季首日（台北日期）
create or replace function next_quarter_start()
returns date language sql stable as $$
  select (date_trunc('quarter', (now() at time zone 'Asia/Taipei')) + interval '3 months')::date;
$$;
alter function next_quarter_start() set search_path = public;

create or replace function deactivate_self(p_user uuid)
returns void language plpgsql as $$
begin
  -- deactivated_at 設為下一季首日午夜（台北）；觸發器 sync_membership_period 會把 open 期間
  -- 的 ended_on 設成這個台北日期＝下一季首日，於是當季仍計、下一季起不計。
  update users set
    is_active = false,
    self_deactivated = true,
    deactivated_at = (next_quarter_start()::timestamp) at time zone 'Asia/Taipei',
    updated_at = now()
  where id = p_user;
end $$;
alter function deactivate_self(uuid) set search_path = public;
revoke execute on function deactivate_self(uuid) from public, authenticated, anon;

create or replace function reactivate_self(p_user uuid)
returns void language plpgsql as $$
begin
  update users set is_active = true, self_deactivated = false, deactivated_at = null, updated_at = now()
  where id = p_user;
  -- 觸發器會插入一段 started_on=今天 的 open 期間；改成下一季首日（非當季）
  update membership_periods set started_on = next_quarter_start()
  where user_id = p_user and ended_on is null;
end $$;
alter function reactivate_self(uuid) set search_path = public;
revoke execute on function reactivate_self(uuid) from public, authenticated, anon;

create or replace function delete_self(p_user uuid)
returns void language plpgsql as $$
begin
  if exists (select 1 from users where id = p_user and role = 'admin1')
     and (select count(*) from users where role='admin1' and is_active and id <> p_user) < 1 then
    raise exception '你是最後一位一級管理員，請先指派其他人' using errcode = '23514';
  end if;
  delete from users where id = p_user;  -- cascade：請假／統計快照／在隊期間；歷史 CSV 不受影響
end $$;
alter function delete_self(uuid) set search_path = public;
revoke execute on function delete_self(uuid) from public, authenticated, anon;
