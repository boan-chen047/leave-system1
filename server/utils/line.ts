const LINE_VERIFY_ENDPOINT = 'https://api.line.me/oauth2/v2.1/verify';

export type LineProfile = {
  lineUserId: string;
  displayName: string;
  pictureUrl: string | null;
};

/**
 * 向 LINE 平台驗證 LIFF 取得的 idToken。
 *
 * 一定要打這支 API，不可以只用 JWT 解碼相信內容——沒有驗簽的 token
 * 任何人都能偽造。同時必須比對 aud 是否為本站的 channel id，否則
 * 別的 LINE 應用簽出來的合法 token 也會通過。
 */
export async function verifyLineIdToken(idToken: string, channelId: string): Promise<LineProfile> {
  if (!channelId) throw new Error('缺少環境變數 NUXT_LINE_CHANNEL_ID');

  const res = await fetch(LINE_VERIFY_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? 'LINE 驗證失敗');
  }
  if (data.aud !== channelId) {
    throw new Error('audience 不符，這個 token 不是發給本應用的');
  }

  return {
    lineUserId: data.sub,
    displayName: data.name ?? 'LINE 使用者',
    pictureUrl: data.picture ?? null,
  };
}
