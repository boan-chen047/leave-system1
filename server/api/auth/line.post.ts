import type { AppRole } from '#shared/types';

/**
 * LINE 登入：LIFF 取得的 idToken → 向 LINE 驗證 → 建立／更新帳號 → 發登入 cookie。
 * （對應 Next.js 版 POST /api/auth/line）
 */
export default defineEventHandler(async (event) => {
  const body = await readJson(event);
  if (typeof body.idToken !== 'string') return fail(event, 400, '缺少 idToken');

  const config = useRuntimeConfig(event);
  let profile;
  try {
    profile = await verifyLineIdToken(body.idToken, config.lineChannelId);
  } catch (e) {
    return fail(event, 401, (e as Error).message);
  }

  // display_name 與 picture_url 每次登入都覆寫，這就是「LINE 暱稱即時同步」的實作方式；
  // real_name 與 role 不在此處異動，避免蓋掉使用者自己填的暱稱。
  const { data: user, error } = await supabaseAdmin()
    .from('users')
    .upsert(
      {
        line_user_id: profile.lineUserId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl,
        updated_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(), // 供「5 年未登入自動刪除」判定
      },
      { onConflict: 'line_user_id' },
    )
    .select(`${ME_COLUMNS}, self_deactivated`)
    .single();

  if (error || !user) return fail(event, 500, '建立帳號失敗');

  // 自己停用的可以登入（進來會跳「重新啟用」彈窗）；管理員停用（非自助）才擋在門外
  if (!user.is_active && !user.self_deactivated) return fail(event, 403, '此帳號已被停用');

  setSessionCookie(
    event,
    await signSession({ app_user_id: user.id, app_role: user.role as AppRole }, config.sessionSecret),
  );
  return { user: toMe(user), needsName: user.real_name === null };
});
