-- 005_function_search_path.sql —— 鎖定函式 search_path（安全最佳實務）
-- Supabase security advisor 會對未設 search_path 的函式發 WARN；
-- 這些函式都引用 public schema 的表，固定 search_path=public 防注入。

alter function public.auth_user_id() set search_path = public;
alter function public.auth_user_role() set search_path = public;
alter function public.is_admin() set search_path = public;
alter function public.generate_sessions(int) set search_path = public;
alter function public.build_summary(period_type, date, date, text) set search_path = public;
alter function public.eligible_member_count(date, date) set search_path = public;
alter function public.snapshot_complete(period_type, date) set search_path = public;
alter function public.purge_old_details() set search_path = public;
