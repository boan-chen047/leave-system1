/**
 * 呼叫本站 API 的共用函式。
 *
 * Next.js 版每個對話框都各寫一遍：fetch → 判斷 res.ok → 取 .error → try/catch 斷線訊息。
 * 這裡統一處理，呼叫端只要看 result.ok：
 *   成功 → { ok: true, data }
 *   失敗 → { ok: false, status, error }（error 優先用後端回的訊息，沒有就用 fallback）
 *   斷線 → { ok: false, status: 0, error: '連線失敗，請稍後再試' }
 * 同網域請求會自動帶登入 cookie，不需額外設定。
 */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export async function api<T = unknown>(
  url: string,
  opts: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown } = {},
  fallback = '操作失敗',
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: opts.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      // 自訂錯誤是 { error: '訊息' }；伺服器拋出的錯誤（createError）把原因放在 message。
      // message 與 statusMessage 相同代表是框架預設的英文（Not Found、Server Error），改用呼叫端的中文 fallback。
      const msg =
        json && typeof json.error === 'string'
          ? json.error
          : json && typeof json.message === 'string' && json.message && json.message !== json.statusMessage
            ? json.message
            : fallback;
      return { ok: false, status: res.status, error: msg };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: '連線失敗，請稍後再試' };
  }
}
