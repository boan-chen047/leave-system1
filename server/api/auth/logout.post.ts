/**
 * 登出：清掉登入 cookie。
 * Next.js 版沒有這支（LINE 內一直保持登入）；Nuxt 版本機開發要切換測試帳號會用到，正式環境也無害。
 */
export default defineEventHandler((event) => {
  clearSessionCookie(event);
  return { ok: true };
});
