/**
 * LINE 登入流程用到的純計算（抽出來方便單元測試；實際流程在 composables/useMe.ts）。
 */

/** 只自動重新登入一次的旗標，避免「拿到的還是過期 token → 又重登」的無限迴圈 */
export const RELOGIN_FLAG = 'liff_relogin_attempted';

/** 解出 JWT（LINE idToken）payload 的 exp（Unix 秒）；解不出回 0，交給伺服器判定 */
export function idTokenExp(idToken: string): number {
  try {
    const part = idToken.split('.')[1];
    if (!part) return 0;
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch {
    return 0;
  }
}

/**
 * idToken 是否「確定」已過期（含 30 秒緩衝）。解不出 exp 時回 false，交給後端判，
 * 避免誤判而狂重新登入。
 */
export function isIdTokenExpired(idToken: string, now = Date.now()): boolean {
  const exp = idTokenExp(idToken);
  return exp > 0 && exp * 1000 < now + 30_000;
}

/**
 * 外部瀏覽器登入完一律導回站台首頁：liff.login 預設用當前網址，從 /cancel 等子頁登入時
 * redirect_uri 會對不上 LINE Login channel 註冊的 Callback URL 而被擋。不可帶 query。
 */
export function loginRedirect(origin: string): string {
  return origin + '/';
}
