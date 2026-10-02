import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cachedApi, clearMemberCache } from '~/utils/cache';

/** 假的後端：依序回傳指定的狀態碼，記錄被打了幾次 */
function mockFetch(...statuses: number[]) {
  let i = 0;
  const fn = vi.fn(async () => {
    const status = statuses[Math.min(i++, statuses.length - 1)]!;
    return new Response(JSON.stringify(status === 200 ? { n: i } : { error: '壞了' }), { status });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  clearMemberCache();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T12:00:00+08:00'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('cachedApi（成員端資料短暫快取）', () => {
  it('20 秒內同一網址不重打，直接回上次結果', async () => {
    const fn = mockFetch(200);
    expect(await cachedApi('/api/x')).toEqual({ ok: true, data: { n: 1 } });
    vi.setSystemTime(new Date('2026-10-02T12:00:19+08:00'));
    expect(await cachedApi('/api/x')).toEqual({ ok: true, data: { n: 1 } });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('超過 20 秒重打', async () => {
    const fn = mockFetch(200);
    await cachedApi('/api/x');
    vi.setSystemTime(new Date('2026-10-02T12:00:21+08:00'));
    expect(await cachedApi('/api/x')).toEqual({ ok: true, data: { n: 2 } });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('失敗不快取：回 ok=false 與錯誤訊息，下次照樣重打', async () => {
    const fn = mockFetch(500, 200);
    expect(await cachedApi('/api/x')).toEqual({ ok: false, status: 500, error: '壞了' });
    expect((await cachedApi('/api/x')).ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('clearMemberCache 後重打（請假成功、換帳號時呼叫）', async () => {
    const fn = mockFetch(200);
    await cachedApi('/api/x');
    clearMemberCache();
    await cachedApi('/api/x');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
