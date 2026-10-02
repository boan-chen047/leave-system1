import { computed } from 'vue';
import type { Me } from '#shared/types';
import { api } from '~/utils/api';
import { RELOGIN_FLAG, isIdTokenExpired, loginRedirect } from '~/utils/liff';
import { isFlagOn } from '#shared/utils/flags';

/**
 * 目前登入者與登入流程（對應 Next.js 版的 LiffProvider / useMe）。
 * 狀態用 Nuxt 的 useState：同一個 key 在整個 app 內是同一份，任何元件呼叫 useMe() 都拿到同一個。
 *
 * 登入流程（init）：
 *   1. 先打 /api/me 認我們自己的 30 天登入 cookie。有效就直接放行，不再驗 LINE 的 idToken——
 *      LINE 那顆壽命很短，且 LINE 常把舊 webview 連同過期 token 一起還原，硬驗會被擋在門外。
 *   2. 沒有有效登入：本機開發且開了測試登入 → 顯示測試登入畫面；否則走 LINE LIFF 登入。
 *   3. idToken 過期：LINE 內建瀏覽器請使用者關掉重開；外部瀏覽器自動重新登入（只試一次）。
 */
export function useMe() {
  const me = useState<Me | null>('me', () => null);
  const loading = useState<boolean>('me-loading', () => true);
  const fatal = useState<string>('me-fatal', () => '');
  const needsDevLogin = useState<boolean>('me-dev-login', () => false);
  const started = useState<boolean>('me-started', () => false);

  const isAdmin = computed(() => me.value?.role === 'admin1' || me.value?.role === 'admin2');

  /** 重新讀取自己的資料（改暱稱、同意條款等之後呼叫）。回傳是否讀取成功。 */
  async function refresh(): Promise<boolean> {
    const r = await api<Me>('/api/me');
    if (r.ok) me.value = r.data;
    return r.ok;
  }

  /** 只登出本站（清 cookie），不會登出 LINE。開發切換測試帳號用。 */
  async function logout(): Promise<void> {
    await api('/api/auth/logout', { method: 'POST' });
    me.value = null;
  }

  async function init(): Promise<void> {
    if (started.value) return; // 整個 app 只跑一次
    started.value = true;
    loading.value = true;
    try {
      // 1) 先認自己的登入 cookie
      const res = await api<Me>('/api/me');
      if (res.ok) {
        me.value = res.data;
        sessionStorage.removeItem(RELOGIN_FLAG);
        return;
      }

      // 2a) 本機開發的測試登入（正式建置時 import.meta.dev 固定為 false，這段不會執行）
      const config = useRuntimeConfig();
      if (import.meta.dev && isFlagOn(config.public.devLogin)) {
        needsDevLogin.value = true;
        return;
      }

      // 2b) LINE LIFF 登入（動態載入，只有真的要登入時才下載 LIFF SDK）
      if (!config.public.liffId) throw new Error('尚未設定 LIFF ID（環境變數 NUXT_PUBLIC_LIFF_ID）');
      const liff = (await import('@line/liff')).default;
      await liff.init({ liffId: config.public.liffId });

      if (!liff.isLoggedIn()) {
        // 外部瀏覽器開啟時會走到這裡；LINE 內建瀏覽器已登入不會進來
        liff.login({ redirectUri: loginRedirect(window.location.origin) });
        return;
      }

      const idToken = liff.getIDToken();
      if (!idToken) throw new Error('取不到 idToken');
      if (isIdTokenExpired(idToken) && recoverExpired(liff)) return;

      const login = await api<{ user: Me }>('/api/auth/line', { method: 'POST', body: { idToken } }, '登入失敗');
      if (!login.ok) {
        // 後端仍判過期（多半是手機時鐘誤差）：比照上面依環境恢復
        if (/expired/i.test(login.error) && recoverExpired(liff)) return;
        throw new Error(login.error);
      }
      sessionStorage.removeItem(RELOGIN_FLAG);
      me.value = login.data.user;
    } catch (e) {
      // 帳號被停用（403）等狀況必須顯示在畫面上，只 console.error 的話使用者只看到一片空白
      console.error('[登入]', e);
      fatal.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }

  /** 開發用：以測試帳號登入（member／admin2／admin1）。回傳錯誤訊息，成功回 null。 */
  async function devLogin(role: Me['role']): Promise<string | null> {
    const r = await api('/api/auth/dev-login', { method: 'POST', body: { role } }, '測試登入失敗');
    if (!r.ok) return r.error;
    // 讀不到自己的資料就留在測試登入畫面並顯示原因，不要切走後變成一片空白
    if (!(await refresh())) return '登入成功但讀不到帳號資料';
    needsDevLogin.value = false;
    return null;
  }

  /** 開發用：登出並回到測試登入畫面（切換角色） */
  async function devSwitch(): Promise<void> {
    await logout();
    needsDevLogin.value = true;
  }

  return { me, loading, fatal, needsDevLogin, isAdmin, init, refresh, logout, devLogin, devSwitch };
}

/**
 * idToken 過期時的恢復：
 * - LINE 內建瀏覽器：liff.login() 不會刷新 token（官方不支援，硬呼叫可能空白或迴圈），
 *   改丟出可讀訊息請使用者關閉後從選單重開。
 * - 外部瀏覽器：重新登入一次；同一個分頁已重登過還是過期，就不再迴圈，回 false 當成真正的錯誤。
 * 回傳 true＝已觸發重新登入（頁面即將導走，呼叫端應 return）。
 */
function recoverExpired(liff: {
  isInClient: () => boolean;
  login: (config?: { redirectUri?: string }) => void;
}): boolean {
  if (liff.isInClient()) throw new Error('登入資訊已過期，請關閉本頁後，從 LINE 選單重新開啟');
  if (sessionStorage.getItem(RELOGIN_FLAG)) return false;
  sessionStorage.setItem(RELOGIN_FLAG, '1');
  liff.login({ redirectUri: loginRedirect(window.location.origin) });
  return true;
}
