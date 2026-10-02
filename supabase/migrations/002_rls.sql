-- 002_rls.sql —— RLS、欄位級 GRANT
-- 對應 docs/spec.md §4
--
-- 重要認知：API Route 一律用 service role key，service role 會「繞過」RLS 與 GRANT。
-- 所以 RLS/GRANT 保護的是 anon 與 authenticated 這兩把公開金鑰的誤用，
-- 不是 service role 外洩（那把鑰匙的唯一防線是不外洩、只放伺服器端）。

-- 從 JWT claims 取出目前使用者
create or replace function auth_user_id() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'app_user_id', '')::uuid
$$;

create or replace function auth_user_role() returns text
language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::json ->> 'app_role', 'anon')
$$;

create or replace function is_admin() returns boolean
language sql stable as $$
  select auth_user_role() in ('admin1', 'admin2')
$$;

alter table users                enable row level security;
alter table sessions             enable row level security;
alter table leave_requests       enable row level security;
alter table recurring_rules      enable row level security;
alter table attendance_summaries enable row level security;
alter table archive_exports      enable row level security;

-- users：本人可讀自己，管理員可讀全部
create policy users_self_read   on users for select using (id = auth_user_id() or is_admin());
create policy users_self_update on users for update using (id = auth_user_id())
                                              with check (id = auth_user_id());

-- ⚠️ 上面那條 policy 只管「是不是你自己」，管不了「可以改哪些欄位」——
-- RLS 沒有欄位級管制。少了下面這段，任何人都能拿 anon key 加自己的 JWT
-- 直接打 Supabase REST API 把 role 改成 admin1，完全繞過我們的 API。
-- 欄位級權限要用 GRANT/REVOKE 做：
revoke update on users from authenticated, anon;
grant  update (real_name, updated_at) on users to authenticated;

-- 這幾張表的敏感欄位不開放前端直接寫
revoke insert, update, delete on sessions             from authenticated, anon;
revoke insert, update, delete on attendance_summaries from authenticated, anon;
revoke insert, update, delete on archive_exports      from authenticated, anon;
revoke insert, update, delete on recurring_rules      from authenticated, anon;

-- leave_requests 只允許前端新增與改狀態，不允許改 user_id（否則可以幫別人請假）
revoke update on leave_requests from authenticated, anon;
grant  update (status, cancelled_at) on leave_requests to authenticated;

-- sessions：所有登入者可讀（要看得到才能請假），管理員才能寫
create policy sessions_read  on sessions for select using (auth_user_id() is not null);
create policy sessions_write on sessions for all    using (is_admin()) with check (is_admin());

-- leave_requests：本人管自己的，管理員可讀全部
create policy leaves_own_all  on leave_requests for all
  using (user_id = auth_user_id()) with check (user_id = auth_user_id());
create policy leaves_admin_read on leave_requests for select using (is_admin());

-- recurring_rules：所有登入者可讀，只有一級可寫
create policy rules_read  on recurring_rules for select using (auth_user_id() is not null);
create policy rules_write on recurring_rules for all
  using (auth_user_role() = 'admin1') with check (auth_user_role() = 'admin1');

-- 統計與封存：僅管理員
create policy summaries_read on attendance_summaries for select using (is_admin());
create policy archives_read  on archive_exports      for select using (is_admin());
