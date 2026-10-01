/** 目前登入者的資料。前端每次載入先打這支：登入 cookie 有效就直接放行，不再走 LINE 登入。 */
export default defineEventHandler(async (event) => {
  const user = await currentUser(event);
  if (!user) return fail(event, 401, '未登入');

  const { data, error } = await supabaseAdmin().from('users').select(ME_COLUMNS).eq('id', user.id).single();
  if (error || !data) return fail(event, 404, '找不到使用者');

  return toMe(data);
});
