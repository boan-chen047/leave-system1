-- 030_fix_self_activation_guards.sql —— 修 R01/R02/R03（自助停用／重啟的資格與競爭）
--
-- R02：reactivate_self 對「已啟用」帳號也會把既有開放期間 started_on 挪到下一季，抹掉過去
--      出席／請假。改為先鎖列、驗證「目前為自助停用」才動；已啟用直接擋。
-- R03：deactivate_self 沒有「最後一位一級管理員」保護，最後一位一級可自助停用把後台鎖死。
--      比照 delete_self 加保護；並鎖列避免兩人同時操作的競爭。
-- （R01 在 API 端修：自助停用者要用 sessionUser 才進得來重啟入口。）

create or replace function deactivate_self(p_user uuid)
returns void language plpgsql as $$
declare v record;
begin
  select is_active, role into v from users where id = p_user for update;  -- 鎖列，擋併發
  if not found then raise exception '找不到成員' using errcode = 'P0002'; end if;
  if not v.is_active then raise exception '帳號已停用' using errcode = '22023'; end if;
  -- 最後一位「有效」一級管理員不可自助停用（否則配合 R01 會沒有任何可用管理員）
  if v.role = 'admin1'
     and (select count(*) from users where role = 'admin1' and is_active and id <> p_user) < 1 then
    raise exception '你是最後一位一級管理員，請先指派其他人' using errcode = '23514';
  end if;
  -- deactivated_at 設為下一季首日午夜（台北）；觸發器把 open 期間 ended_on 設成該台北日期，
  -- 當季仍計、下一季起不計。self_deactivated=true 供登入端區分自助停用（可重登重啟）。
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
declare v record;
begin
  select is_active, self_deactivated into v from users where id = p_user for update;  -- 鎖列，擋併發
  if not found then raise exception '找不到成員' using errcode = 'P0002'; end if;
  if v.is_active then raise exception '帳號已是啟用狀態' using errcode = '22023'; end if;  -- 已啟用不動（R02）
  if not v.self_deactivated then
    raise exception '此帳號需由管理員啟用' using errcode = '42501';  -- 管理員停用者不能自助解鎖
  end if;
  update users set is_active = true, self_deactivated = false, deactivated_at = null, updated_at = now()
  where id = p_user;
  -- 觸發器剛插入一段 started_on=今天 的 open 期間（此時只會有這一段 open）；挪到下一季首日（非當季）
  update membership_periods set started_on = next_quarter_start()
  where user_id = p_user and ended_on is null;
end $$;
alter function reactivate_self(uuid) set search_path = public;
revoke execute on function reactivate_self(uuid) from public, authenticated, anon;
