/**
 * 自助停用／重新啟用帳號。停用＝下一季起退出季報；重啟＝下一季起回到季報（非當季）。
 * body: { active: boolean }
 *
 * 用 sessionUser（不擋停用者），否則自助停用者連「重新啟用」入口都進不來。
 * 啟用資格在這裡＋資料庫 RPC 兩層把關：只有「自助停用」狀態能自己重啟。
 * （停用功能在第 6 步個人頁接上畫面；登入流程的「重新啟用」第 2 步就要用到）
 */
export default defineEventHandler(async (event) => {
  const user = await sessionUser(event);
  if (!user) return fail(event, 401, '未登入');

  const body = await readJson(event);
  if (typeof body.active !== 'boolean') return fail(event, 400, 'active 需為布林值');

  const db = supabaseAdmin();
  if (body.active) {
    // 重啟：只有自助停用者可用（管理員停用者不能自己解鎖；已啟用者不該再按）
    if (user.isActive) return fail(event, 409, '帳號已是啟用狀態');
    if (!user.selfDeactivated) return fail(event, 403, '此帳號需由管理員啟用');
    const { error } = await db.rpc('reactivate_self', { p_user: user.id });
    if (error) return fail(event, 500, '操作失敗');
    return { ok: true };
  }

  // 停用：需目前為啟用狀態；RPC 內另擋「最後一位一級管理員」
  if (!user.isActive) return fail(event, 409, '帳號已停用');
  const { error } = await db.rpc('deactivate_self', { p_user: user.id });
  if (error) {
    if (error.code === '23514') return fail(event, 409, '你是最後一位一級管理員，請先指派其他人');
    return fail(event, 500, '操作失敗');
  }
  return { ok: true };
});
