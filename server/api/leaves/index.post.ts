/**
 * 成員自己請假。body: { sessionId }
 * 已取消、或已過請假截止（含已開打）的場次不能請；請假與操作紀錄（leave_actions）在
 * 資料庫函式 self_file_leave 內同一交易寫入。成功回 201 { id }。
 */
export default defineEventHandler(async (event) => {
  const user = await currentUser(event);
  if (!user) return fail(event, 401, '未登入');

  const body = await readJson(event);
  if (typeof body.sessionId !== 'string') return fail(event, 400, '缺少 sessionId');
  if (!isUuid(body.sessionId)) return fail(event, 400, 'sessionId 格式錯誤');
  const sessionId = body.sessionId;

  const db = supabaseAdmin();
  const { data: session } = await db
    .from('sessions')
    .select('id, session_date, start_time, is_cancelled, announced_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) return fail(event, 404, '找不到場次');
  if (session.is_cancelled) return fail(event, 409, '這場已取消');
  // 截止：預設週二 23:59；臨時公告的場次放寬到開打前（開打後一律不行）
  if (pastEffectiveLeaveDeadline(session.session_date, session.start_time, session.announced_at)) {
    return fail(event, 409, '已過這場的請假截止時間');
  }

  const { data, error } = await db.rpc('self_file_leave', { p_session: sessionId, p_user: user.id });
  // 23505 = 違反唯一限制：這場已經請過了
  if (error?.code === '23505') return fail(event, 409, '你已經請過這場的假了');
  if (error) return fail(event, 500, '請假失敗');

  setResponseStatus(event, 201);
  return { id: data as string };
});
