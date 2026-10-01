/** 修改自己的暱稱（綽號）。首次設定第一關與個人頁共用。body: { realName } */
export default defineEventHandler(async (event) => {
  const user = await currentUser(event);
  if (!user) return fail(event, 401, '未登入');

  const body = await readJson(event);
  const realName = typeof body.realName === 'string' ? body.realName.trim() : '';
  if (realName.length === 0) return fail(event, 400, '姓名不可空白');
  if (realName.length > 20) return fail(event, 400, '姓名請控制在 20 字以內');

  const { data, error } = await supabaseAdmin()
    .from('users')
    .update({ real_name: realName, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select(ME_COLUMNS)
    .single();
  if (error || !data) return fail(event, 500, '更新失敗');

  return toMe(data);
});
