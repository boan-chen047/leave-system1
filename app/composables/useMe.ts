import type { Me } from '~/types';

/**
 * 目前登入者（全站共用狀態，對應原 Next.js 版的 LiffProvider / useMe）。
 *
 * 第 1 步（初始介面）尚未接登入：me 固定為 null、loading 為 false，
 * 所以分頁列只顯示一般成員的四格、頭像列不顯示。
 * 第 2 步（登入系統）會在這裡接上 LINE LIFF 登入與 /api/me，元件不用改。
 */
export function useMe() {
  // useState：Nuxt 的跨元件共用狀態（同一個 key 在整個 app 內是同一份）
  const me = useState<Me | null>('me', () => null);
  const loading = useState<boolean>('me-loading', () => false);

  const isAdmin = computed(() => me.value?.role === 'admin1' || me.value?.role === 'admin2');

  return { me, loading, isAdmin };
}
