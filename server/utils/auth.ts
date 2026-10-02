import type { H3Event } from 'h3';
import type { AppRole } from '#shared/types';
import { SESSION_COOKIE, SESSION_MAX_AGE, verifySession } from './session';
import { supabaseAdmin } from './supabase';

export type CurrentUser = { id: string; role: AppRole; createdAt: string };

/**
 * 取得目前使用者。角色與啟用狀態一律以資料庫為準，不採用 JWT 裡的快照。
 *
 * JWT 效期 30 天。若只解 token 就相信內容，會有三個漏洞：
 *   1. 被停用的人可以繼續請假 30 天
 *   2. 被降級的二級管理員，30 天內仍進得去後台
 *   3. 剛被升級的人要等 30 天或重新登入才生效
 * 多一次主鍵查詢的成本，遠低於這三件事出錯的代價。
 */
export async function currentUser(event: H3Event): Promise<CurrentUser | null> {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) return null;

  const claims = await verifySession(token, useRuntimeConfig(event).sessionSecret);
  if (!claims) return null;

  const { data } = await supabaseAdmin()
    .from('users')
    .select('id, role, is_active, created_at')
    .eq('id', claims.app_user_id)
    .single();

  if (!data || !data.is_active) return null;
  return { id: data.id, role: data.role as AppRole, createdAt: data.created_at };
}

/**
 * 只驗身分、不擋停用者。專供「自助重新啟用」入口用：currentUser 會把停用帳號一律擋成 null，
 * 但自助停用者正是要靠有效登入進來重啟自己。啟用資格另由呼叫端＋RPC 判定。
 */
export type SessionUser = { id: string; role: AppRole; isActive: boolean; selfDeactivated: boolean };

export async function sessionUser(event: H3Event): Promise<SessionUser | null> {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) return null;
  const claims = await verifySession(token, useRuntimeConfig(event).sessionSecret);
  if (!claims) return null;
  const { data } = await supabaseAdmin()
    .from('users')
    .select('id, role, is_active, self_deactivated')
    .eq('id', claims.app_user_id)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    role: data.role as AppRole,
    isActive: data.is_active,
    selfDeactivated: data.self_deactivated,
  };
}

export function requireAdmin(user: CurrentUser | null): boolean {
  return user?.role === 'admin1' || user?.role === 'admin2';
}

export function requireLevel1(user: CurrentUser | null): boolean {
  return user?.role === 'admin1';
}

/** 寫入登入 cookie：HttpOnly（前端 JS 讀不到）、正式環境只走 https、30 天 */
export function setSessionCookie(event: H3Event, token: string): void {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * 安全讀取 JSON body：讀失敗、或 body 是 JSON null，都回 {}，不會爆 TypeError。
 * 欄位一律當成 unknown，由各 API 自己檢查型別。
 */
export async function readJson(event: H3Event): Promise<Record<string, unknown>> {
  const body = await readBody(event).catch(() => null);
  return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
}

/** API 錯誤回應：設定狀態碼並回 { error }（沿用 Next.js 版格式，前端統一讀 .error） */
export function fail(event: H3Event, status: number, error: string): { error: string } {
  setResponseStatus(event, status);
  return { error };
}

/** 清除登入 cookie（登出、刪除帳號後） */
export function clearSessionCookie(event: H3Event): void {
  setCookie(event, SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}
