-- 020_review_p3_a20.sql —— 審查 P3：A20 收回函式的 PUBLIC EXECUTE
--
-- 先前多數函式只 revoke authenticated/anon，沒 revoke PUBLIC，等於前端角色仍可經 PUBLIC 執行
-- （雖為 invoker、資料表已鎖，屬深度防禦）。這裡把「資料/管理類」函式的 PUBLIC/authenticated/anon
-- execute 一併收回，只留 service_role（後台 API）與 owner（postgres／pg_cron）。
--
-- 刻意「不動」的三個：is_admin()、auth_user_id()、auth_user_role()——它們被 RLS policy 內部呼叫，
-- 必須讓 authenticated/anon 能執行，否則一般查詢會因無權執行 policy 函式而失敗。

revoke execute on function add_rule_and_generate(integer, time, time, text, date) from public, authenticated, anon;
revoke execute on function backfill_and_purge() from public, authenticated, anon;
revoke execute on function build_summary(period_type, date, date, text) from public, authenticated, anon;
revoke execute on function delete_rule_and_purge(uuid, date) from public, authenticated, anon;
revoke execute on function edit_rule_and_resync(uuid, integer, time, time, text, date) from public, authenticated, anon;
revoke execute on function eligible_member_count(date, date) from public, authenticated, anon;
revoke execute on function generate_sessions() from public, authenticated, anon;
revoke execute on function purge_old_details() from public, authenticated, anon;
revoke execute on function purge_regenerable_future_sessions(uuid, date) from public, authenticated, anon;
revoke execute on function purge_sessions_beyond_horizon(integer) from public, authenticated, anon;
revoke execute on function set_weeks_and_resync(integer) from public, authenticated, anon;
revoke execute on function snapshot_complete(period_type, date) from public, authenticated, anon;
revoke execute on function snapshot_prev_month() from public, authenticated, anon;
revoke execute on function snapshot_prev_quarter() from public, authenticated, anon;
revoke execute on function snapshot_prev_year() from public, authenticated, anon;
revoke execute on function summarize_range(date, date) from public, authenticated, anon;
revoke execute on function sync_membership_period() from public, authenticated, anon;
