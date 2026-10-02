/** 記錄使用者同意到現行條款版本（首次設定第二關）。版本值在 shared/utils/terms.ts。 */
export default defineEventHandler(async (event) => {
  const user = await currentUser(event);
  if (!user) return fail(event, 401, '未登入');

  const { error } = await supabaseAdmin()
    .from('users')
    .update({ terms_version: CURRENT_TERMS_VERSION, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) return fail(event, 500, '儲存失敗');

  return { ok: true, version: CURRENT_TERMS_VERSION };
});
