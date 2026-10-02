/**
 * 把異動通知標成已讀（按「知道了」或「去銷假」）。body: { ids: string[] }（1～50 個 uuid）。
 * 只能標自己的；已讀過的不重複更新。
 */
export default defineEventHandler(async (event) => {
  const user = await currentUser(event);
  if (!user) return fail(event, 401, '未登入');

  const { ids } = await readJson(event);
  // 每個 id 都必須是 uuid：非 uuid 丟進查詢會讓 Postgres 回 22P02 變成 500，這裡先回 400
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50 || !ids.every(isUuid)) {
    return fail(event, 400, 'ids 格式錯誤');
  }

  const { error } = await supabaseAdmin()
    .from('leave_change_notices')
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('user_id', user.id) // 只能標自己的
    .in('id', ids)
    .is('acknowledged_at', null);
  if (error) return fail(event, 500, '更新失敗');

  return { ok: true };
});
