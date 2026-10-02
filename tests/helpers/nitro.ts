// 不啟動 Nuxt，直接執行 server/api 的處理函式做測試。
//
// Nuxt 會把 h3 的函式（defineEventHandler、getQuery…）與 server/utils、shared/utils 的匯出
// 「自動匯入」成每支 API 都能直接用的全域名稱；單獨測試時沒有 Nuxt，這裡改用 vi.stubGlobal 補上：
//   - 自己寫的工具（日期規則、在隊判斷、統計、fail、readJson…）一律用「真的」，邏輯才有被測到
//   - 只換掉三樣：登入者（harness.user）、資料庫（harness.db，用 fakeDb 產生）、h3 的請求物件
//
// 用法：測試檔最上方 import 這個檔，再用 callApi(() => import('#server/api/...'), { body, query })。
// 處理函式要用動態 import 載入，確保全域名稱先補好（API 檔一載入就會呼叫 defineEventHandler）。
import { vi } from 'vitest';
import type { AppRole } from '#shared/types';
import * as date from '#shared/utils/date';
import * as membership from '#server/utils/membership';
import * as memberStats from '#server/utils/memberStats';
import * as uuid from '#server/utils/uuid';
import * as auth from '#server/utils/auth';
import * as me from '#server/utils/me';

export const harness = {
  user: null as null | { id: string; role: AppRole; createdAt: string },
  db: null as unknown,
};

/** 假的請求物件：body（JSON）、query（網址參數），處理後的狀態碼記在 status */
export type FakeEvent = { status: number; body?: unknown; query?: Record<string, string> };

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler);
vi.stubGlobal('setResponseStatus', (e: FakeEvent, status: number) => {
  e.status = status;
});
vi.stubGlobal('readBody', async (e: FakeEvent) => e.body);
vi.stubGlobal('getQuery', (e: FakeEvent) => e.query ?? {});

for (const mod of [date, membership, memberStats, uuid, auth, me]) {
  for (const [name, value] of Object.entries(mod)) vi.stubGlobal(name, value);
}
vi.stubGlobal('currentUser', async () => harness.user);
vi.stubGlobal('supabaseAdmin', () => harness.db);

export function asRole(role: AppRole, id = `${role}-id`): void {
  harness.user = { id, role, createdAt: '2026-09-01T00:00:00Z' };
}

/** 執行一支 API：回傳狀態碼與回應內容 */
export async function callApi(
  load: () => Promise<{ default: unknown }>,
  init: { body?: unknown; query?: Record<string, string> } = {},
): Promise<{ status: number; data: any }> {
  const handler = (await load()).default as (e: FakeEvent) => Promise<unknown>;
  const event: FakeEvent = { status: 200, ...init };
  const data = await handler(event);
  return { status: event.status, data };
}
