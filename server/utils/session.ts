import { SignJWT, jwtVerify } from 'jose';
import type { AppRole } from '#shared/types';

export type SessionClaims = { app_user_id: string; app_role: AppRole };

/** 登入憑證 cookie 名稱（沿用 Next.js 版） */
export const SESSION_COOKIE = 'leave_session';
const SESSION_TTL = '30d';
/** cookie 壽命（秒），與 JWT 的 30 天一致 */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function key(secret: string): Uint8Array {
  if (!secret || secret.length < 32) throw new Error('NUXT_SESSION_SECRET 未設定或太短（至少 32 字元）');
  return new TextEncoder().encode(secret);
}

/**
 * 簽發登入憑證（JWT，HS256，30 天）。
 *
 * 與 Next.js 版的差異：金鑰改用自己的 NUXT_SESSION_SECRET，不再借用 Supabase 的 JWT secret。
 * 原因：前端從不直接連資料庫（所有存取都經伺服器、用 service role 金鑰），
 * 這顆憑證只在本程式內部使用，不需要跟 Supabase 綁在一起。
 * claim 名稱（app_user_id / app_role）沿用原版，保持資料相容。
 */
export async function signSession(claims: SessionClaims, secret: string): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(key(secret));
}

/** 驗證失敗一律回 null，呼叫端只要判斷有沒有值，不用包 try/catch。 */
export async function verifySession(token: string, secret: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret));
    const app_user_id = payload.app_user_id;
    const app_role = payload.app_role;
    if (typeof app_user_id !== 'string') return null;
    if (app_role !== 'member' && app_role !== 'admin2' && app_role !== 'admin1') return null;
    return { app_user_id, app_role };
  } catch {
    return null;
  }
}
