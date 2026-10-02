import { api, type ApiResult } from './api';

/**
 * 成員端資料的短暫快取：短時間內切分頁（請假↔銷假↔紀錄）不必每次重打 API。
 *
 * - 只快取成功結果；失敗照樣回 { ok: false }，呼叫端可分辨「真的沒資料」與「載入失敗」，
 *   顯示重試按鈕、並保留畫面上的舊資料（不把故障誤顯示成「沒有場次」）。
 * - 資料一變（請假、銷假成功）或換帳號（登出），呼叫 clearMemberCache() 清掉，下次重抓。
 */
const store = new Map<string, { at: number; data: unknown }>();
const TTL = 20_000; // 20 秒內視為新鮮

export async function cachedApi<T>(url: string, fallback = '讀取失敗'): Promise<ApiResult<T>> {
  const hit = store.get(url);
  if (hit && Date.now() - hit.at < TTL) return { ok: true, data: hit.data as T };
  const r = await api<T>(url, {}, fallback);
  if (r.ok) store.set(url, { at: Date.now(), data: r.data });
  return r;
}

export function clearMemberCache(): void {
  store.clear();
}
