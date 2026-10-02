import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signSession, verifySession } from '#server/utils/session';
import { verifyLineIdToken } from '#server/utils/line';
import { canSignIn } from '#server/utils/me';

// 原 Next.js 版 tests/lib/auth/session.test.ts、line.test.ts 搬來；
// 差異：金鑰與 channel id 改成參數傳入，不再改環境變數。
const SECRET = 'test-secret-at-least-32-characters-long';

describe('登入憑證（session JWT）', () => {
  it('簽出的 token 可以被驗回原本的 claims', async () => {
    const token = await signSession({ app_user_id: 'uuid-1', app_role: 'member' }, SECRET);
    expect(await verifySession(token, SECRET)).toMatchObject({ app_user_id: 'uuid-1', app_role: 'member' });
  });

  it('被竄改的 token 驗證失敗回傳 null', async () => {
    const token = await signSession({ app_user_id: 'uuid-1', app_role: 'member' }, SECRET);
    expect(await verifySession(token.slice(0, -4) + 'AAAA', SECRET)).toBeNull();
  });

  it('格式錯誤的字串回傳 null 而不是拋錯', async () => {
    expect(await verifySession('not-a-jwt', SECRET)).toBeNull();
  });

  it('用別的密鑰簽的 token 驗證失敗', async () => {
    const token = await signSession({ app_user_id: 'uuid-1', app_role: 'admin1' }, SECRET);
    expect(await verifySession(token, 'a-completely-different-secret-key-32')).toBeNull();
  });

  it('金鑰未設定或太短（< 32 字元）時拒絕簽發，避免用弱金鑰上線', async () => {
    await expect(signSession({ app_user_id: 'u', app_role: 'member' }, '')).rejects.toThrow('NUXT_SESSION_SECRET');
    await expect(signSession({ app_user_id: 'u', app_role: 'member' }, 'short')).rejects.toThrow('至少 32 字元');
  });
});

describe('verifyLineIdToken', () => {
  const CHANNEL = '1234567890';
  const mockLine = (body: object, status = 200) =>
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })));

  beforeEach(() => vi.unstubAllGlobals());

  it('驗證成功時回傳 LINE 個人資料，並帶 client_id 給 LINE 比對', async () => {
    mockLine({ sub: 'U1234abcd', aud: CHANNEL, name: '小豪', picture: 'https://profile.line-scdn.net/abc' });
    expect(await verifyLineIdToken('fake-token', CHANNEL)).toEqual({
      lineUserId: 'U1234abcd',
      displayName: '小豪',
      pictureUrl: 'https://profile.line-scdn.net/abc',
    });
    const body = (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as URLSearchParams;
    expect(body.get('client_id')).toBe(CHANNEL);
  });

  it('LINE 回傳錯誤時拋出例外（例：過期）', async () => {
    mockLine({ error: 'invalid_request', error_description: 'IdToken expired.' }, 400);
    await expect(verifyLineIdToken('expired', CHANNEL)).rejects.toThrow('IdToken expired.');
  });

  it('aud 與本站 channel id 不符時拋出例外（別的 LINE 應用的 token 不能用）', async () => {
    mockLine({ sub: 'U1234abcd', aud: '9999999999', name: '別的應用的使用者' });
    await expect(verifyLineIdToken('other-app', CHANNEL)).rejects.toThrow('audience 不符');
  });

  it('沒有大頭貼時 pictureUrl 為 null', async () => {
    mockLine({ sub: 'U1234abcd', aud: CHANNEL, name: '沒照片' });
    expect((await verifyLineIdToken('no-pic', CHANNEL)).pictureUrl).toBeNull();
  });

  it('沒設定 channel id 時直接拒絕，不送去 LINE', async () => {
    mockLine({});
    await expect(verifyLineIdToken('x', '')).rejects.toThrow('NUXT_LINE_CHANNEL_ID');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('canSignIn（誰能進本站）', () => {
  it('啟用中可以進', () => {
    expect(canSignIn({ isActive: true, selfDeactivated: false })).toBe(true);
  });

  it('自己停用的可以進（進來看到重新啟用畫面）', () => {
    expect(canSignIn({ isActive: false, selfDeactivated: true })).toBe(true);
  });

  it('管理員停用的擋在門外', () => {
    expect(canSignIn({ isActive: false, selfDeactivated: false })).toBe(false);
  });
});
