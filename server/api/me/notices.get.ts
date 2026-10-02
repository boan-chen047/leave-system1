import type { LeaveChangeNotice } from '#shared/types';

type Row = {
  id: string;
  old_date: string;
  old_start: string;
  old_end: string;
  new_date: string;
  new_start: string;
  new_end: string;
  sessions: { session_date: string; start_time: string } | null;
};

/**
 * 「我請假的場次被改了日期／時間」的未讀通知（資料庫 migration 044 的觸發器產生）。
 * 只回仍有意義的：請假仍有效、場次未取消、還沒開打。打開 App 時據此跳彈窗。
 */
export default defineEventHandler(async (event) => {
  const user = await currentUser(event);
  if (!user) return fail(event, 401, '未登入');

  const { data, error } = await supabaseAdmin()
    .from('leave_change_notices')
    .select(
      'id, old_date, old_start, old_end, new_date, new_start, new_end, leave_requests!inner(status), sessions!inner(session_date, start_time, is_cancelled)',
    )
    .eq('user_id', user.id)
    .is('acknowledged_at', null)
    .eq('leave_requests.status', 'active')
    .eq('sessions.is_cancelled', false)
    .order('created_at', { ascending: true });
  if (error) return fail(event, 500, '查詢失敗');

  return ((data ?? []) as unknown as Row[])
    .filter((n) => n.sessions && !sessionHasStarted(n.sessions.session_date, n.sessions.start_time))
    .map(
      (n): LeaveChangeNotice => ({
        id: n.id,
        from: { date: n.old_date, start: n.old_start, end: n.old_end },
        to: { date: n.new_date, start: n.new_start, end: n.new_end },
      }),
    );
});
