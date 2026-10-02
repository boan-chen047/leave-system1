import type { SessionRow } from '#shared/types';

/**
 * 首頁「接下來的場次」：還沒開打、未取消、我還沒請假的場次，附請假截止與目前請假人數。
 *
 * - 過了請假截止但還沒開打的場次「照樣列出」（leaveClosed=true，按鈕反灰），
 *   否則本週的場次一過週二就從首頁消失，成員看不到這週有練球。
 * - 已開打的不列；我已請假的不列（改列在銷假頁）。
 * - 截止：預設開打前最近的週二 23:59；臨時公告（加開／改期到本週）的場次放寬到開打前。
 */
export default defineEventHandler(async (event) => {
  const user = await currentUser(event);
  if (!user) return fail(event, 401, '未登入');

  const db = supabaseAdmin();
  // 用台灣今天當資料庫下限只是為了少撈幾列；「是否已開打」由 sessionHasStarted 逐場精算
  const [{ data: myLeaves, error: myErr }, { data: sessions, error }] = await Promise.all([
    db.from('leave_requests').select('session_id').eq('user_id', user.id).eq('status', 'active'),
    db
      .from('sessions')
      .select('id, session_date, start_time, end_time, location, kind, description, announced_at')
      .gte('session_date', taipeiToday())
      .eq('is_cancelled', false)
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true }),
  ]);
  // 「我的請假」查失敗不能當成沒請過，否則已請假的場次會又出現在可請假清單
  if (error || myErr) return fail(event, 500, '查詢失敗');

  const taken = new Set((myLeaves ?? []).map((r) => r.session_id));
  const now = new Date();
  const list = (sessions ?? []).filter(
    (s) => !taken.has(s.id) && !sessionHasStarted(s.session_date, s.start_time, now),
  );

  // 每場「目前已請假人數」：只算當天在隊者，與後台「依場次查」同一定義
  let counts: Map<string, number>;
  try {
    counts = await leaveCountsBySession(
      db,
      list.map((s) => ({ id: s.id, date: s.session_date })),
    );
  } catch {
    return fail(event, 500, '查詢失敗');
  }

  return list.map((s): SessionRow => {
    const deadline = effectiveLeaveDeadline(s.session_date, s.start_time, s.announced_at);
    return {
      id: s.id,
      sessionDate: s.session_date,
      startTime: s.start_time,
      endTime: s.end_time,
      location: s.location,
      kind: s.kind,
      description: s.description,
      leaveDeadline: deadline.toISOString(),
      leaveClosed: now.getTime() >= deadline.getTime(),
      leaveCount: counts.get(s.id) ?? 0,
    };
  });
});
