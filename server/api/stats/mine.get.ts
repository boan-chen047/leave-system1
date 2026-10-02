/**
 * 我在某段期間的出席／請假統計與請假明細。query: from、to（YYYY-MM-DD，台北日期）。
 * 首頁「N 月出席／已請假」與紀錄頁共用；算法在 server/utils/memberStats.ts。
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default defineEventHandler(async (event) => {
  const user = await currentUser(event);
  if (!user) return fail(event, 401, '未登入');

  const { from, to } = getQuery(event);
  if (typeof from !== 'string' || typeof to !== 'string') return fail(event, 400, '請提供 from 與 to');
  // 格式不對直接擋：丟進資料庫會變成查詢錯誤（500）
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) return fail(event, 400, '日期格式錯誤');

  const stats = await computeMemberStats(supabaseAdmin(), { userId: user.id, from, to });
  if (!stats) return fail(event, 500, '查詢失敗');
  return stats;
});
