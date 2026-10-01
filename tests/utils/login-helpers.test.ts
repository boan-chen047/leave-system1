import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '~/utils/api';
import { idTokenExp, isIdTokenExpired, loginRedirect } from '~/utils/liff';
import { setupStage, isSetupComplete } from '#shared/utils/setup';
import { CURRENT_TERMS_VERSION } from '#shared/utils/terms';
import { isFlagOn } from '#shared/utils/flags';

describe('isFlagOn（環境變數開關）', () => {
  it('Nuxt 會把 NUXT_DEV_LOGIN=1 轉成數字 1：數字、字串、布林都要認得', () => {
    for (const v of [1, '1', true, 'true']) expect(isFlagOn(v)).toBe(true);
  });
  it('其餘一律視為關（含空字串、0、未設定）', () => {
    for (const v of ['', 0, '0', false, 'false', undefined, null, 'yes']) expect(isFlagOn(v)).toBe(false);
  });
});
import type { Me } from '#shared/types';

// 做一顆假的 JWT（只有 payload 有意義；前端只解 exp，不驗簽）
const fakeJwt = (payload: object) =>
  `h.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.s`;

describe('LINE idToken 過期判斷', () => {
  it('解出 exp', () => {
    expect(idTokenExp(fakeJwt({ exp: 1790000000 }))).toBe(1790000000);
  });
  it('解不出就回 0（交給後端判，避免誤判狂重新登入）', () => {
    expect(idTokenExp('not-a-jwt')).toBe(0);
    expect(idTokenExp(fakeJwt({ sub: 'x' }))).toBe(0);
    expect(isIdTokenExpired('not-a-jwt')).toBe(false);
  });
  it('已過期或 30 秒內到期 → 過期；還很久 → 沒過期', () => {
    const now = 1_790_000_000_000;
    expect(isIdTokenExpired(fakeJwt({ exp: now / 1000 - 1 }), now)).toBe(true);
    expect(isIdTokenExpired(fakeJwt({ exp: now / 1000 + 20 }), now)).toBe(true); // 30 秒緩衝內
    expect(isIdTokenExpired(fakeJwt({ exp: now / 1000 + 3600 }), now)).toBe(false);
  });
  it('登入後一律導回首頁（子頁網址對不上 LINE 註冊的 Callback URL）', () => {
    expect(loginRedirect('https://example.vercel.app')).toBe('https://example.vercel.app/');
  });
});

describe('api()（前端呼叫 API 的共用函式）', () => {
  beforeEach(() => vi.unstubAllGlobals());
  const respond = (body: unknown, status = 200) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

  it('成功回 { ok, data }；有 body 時送 JSON', async () => {
    respond({ id: 'u1' });
    expect(await api('/api/me', { method: 'PATCH', body: { realName: 'x' } })).toEqual({ ok: true, data: { id: 'u1' } });
    const init = vi.mocked(fetch).mock.calls[0]![1]!;
    expect(init.method).toBe('PATCH');
    expect(init.body).toBe('{"realName":"x"}');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('失敗時優先用後端的 error 訊息', async () => {
    respond({ error: '姓名不可空白' }, 400);
    expect(await api('/api/me', {}, '儲存失敗')).toEqual({ ok: false, status: 400, error: '姓名不可空白' });
  });

  it('伺服器拋出的系統錯誤（createError 格式，error 是 true 不是字串）用 statusMessage', async () => {
    respond({ error: true, statusCode: 500, statusMessage: '缺少 Supabase 環境變數' }, 500);
    expect(await api('/api/auth/dev-login', {}, '測試登入失敗')).toEqual({
      ok: false,
      status: 500,
      error: '缺少 Supabase 環境變數',
    });
  });

  it('後端沒給訊息（或不是 JSON）時用 fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Internal Error', { status: 500 })));
    expect(await api('/api/me', {}, '儲存失敗')).toEqual({ ok: false, status: 500, error: '儲存失敗' });
  });

  it('斷線時回 status 0 與連線失敗訊息，不拋錯', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect(await api('/api/me')).toEqual({ ok: false, status: 0, error: '連線失敗，請稍後再試' });
  });
});

describe('首次設定三關（setupStage）', () => {
  const done: Me = {
    id: 'u',
    displayName: 'LINE',
    pictureUrl: null,
    realName: '暱稱',
    role: 'member',
    isActive: true,
    termsVersion: CURRENT_TERMS_VERSION,
    refundLinePay: true,
    refundBank: false,
    bankCode: null,
    bankAccount: null,
  };

  it('依序：暱稱 → 條款 → 退費途徑 → 完成', () => {
    expect(setupStage({ ...done, realName: null, termsVersion: null, refundLinePay: false })).toBe('name');
    expect(setupStage({ ...done, termsVersion: null, refundLinePay: false })).toBe('terms');
    expect(setupStage({ ...done, termsVersion: '2000-01-01' })).toBe('terms'); // 條款升版要重新同意
    expect(setupStage({ ...done, refundLinePay: false })).toBe('refund');
    expect(setupStage(done)).toBeNull();
  });

  it('退費途徑 LINE PAY 或銀行任一即可', () => {
    expect(setupStage({ ...done, refundLinePay: false, refundBank: true })).toBeNull();
  });

  it('isSetupComplete：未登入視為未完成', () => {
    expect(isSetupComplete(null)).toBe(false);
    expect(isSetupComplete(done)).toBe(true);
    expect(isSetupComplete({ ...done, realName: null })).toBe(false);
  });
});
