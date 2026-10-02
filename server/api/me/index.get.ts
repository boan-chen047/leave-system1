/**
 * 目前登入者的資料。前端每次載入先打這支：登入 cookie 有效就直接放行，不再走 LINE 登入。
 *
 * 用 sessionUser（不擋停用者）＋canSignIn：自己停用的人也讀得到自己的資料（isActive=false），
 * 畫面直接顯示「重新啟用」；否則他每次打開都要重走 LINE 登入，遇到 LINE 還原過期 token
 * 就會卡在「登入資訊已過期」、按不到重新啟用。管理員停用的人視同未登入。
 * 其他 API 一律仍用 currentUser，停用中的人什麼都不能操作。
 */
export default defineEventHandler(async (event) => {
  const user = await sessionUser(event);
  if (!user || !canSignIn(user)) return fail(event, 401, '未登入');

  const { data, error } = await supabaseAdmin().from('users').select(ME_COLUMNS).eq('id', user.id).single();
  if (error || !data) return fail(event, 404, '找不到使用者');

  return toMe(data);
});
