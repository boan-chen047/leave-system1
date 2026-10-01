import type { AppRole } from '#shared/types';

/**
 * 開發用測試登入（本機開發才有，正式環境不存在）。
 *
 * 為什麼需要：LINE LIFF 只接受 https 網址，本機 localhost 無法走 LINE 登入。
 * 這支 API 用固定的三個測試帳號（一般成員／二級／一級管理員）直接發登入 cookie，
 * 讓本機開發能測各種角色的畫面。
 *
 * 安全：兩道鎖，缺一就回 404（假裝這支 API 不存在）——
 *   1. import.meta.dev：Nuxt 正式建置時這個值固定是 false，整段程式在正式版等於不存在
 *   2. NUXT_DEV_LOGIN=1：本機也要明確打開才能用
 * 測試帳號的 line_user_id 以 dev- 開頭，不會跟真實 LINE 使用者（U 開頭）衝突。
 */
const DEV_ACCOUNTS: Record<AppRole, string> = {
  member: '測試成員',
  admin2: '測試二級管理員',
  admin1: '測試一級管理員',
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  if (!import.meta.dev || !isFlagOn(config.devLogin)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const body = await readJson(event);
  const role = body.role as AppRole;
  if (!(role in DEV_ACCOUNTS)) return fail(event, 400, 'role 需為 member／admin2／admin1');

  const db = supabaseAdmin();
  const { data: user, error } = await db
    .from('users')
    .upsert(
      {
        line_user_id: `dev-${role}`,
        display_name: DEV_ACCOUNTS[role],
        picture_url: null,
        updated_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      },
      { onConflict: 'line_user_id' },
    )
    .select('id, role')
    .single();
  if (error || !user) return fail(event, 500, '建立測試帳號失敗');

  // 測試帳號的角色每次都對齊所選角色（正式帳號的角色只能由一級管理員在後台調整）
  if (user.role !== role) {
    const { error: roleErr } = await db.from('users').update({ role }).eq('id', user.id);
    if (roleErr) return fail(event, 500, '設定測試帳號角色失敗');
  }

  setSessionCookie(event, await signSession({ app_user_id: user.id, app_role: role }, config.sessionSecret));
  return { ok: true };
});
