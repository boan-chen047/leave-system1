/**
 * 環境變數開關是否為「開」。
 *
 * 陷阱：Nuxt 讀環境變數覆蓋 runtimeConfig 時會自動轉型——NUXT_DEV_LOGIN=1 讀進來是「數字 1」，
 * 不是字串 '1'；寫成 true 則是布林 true。直接用 === '1' 比對會永遠不成立。
 * 這裡把 1、'1'、true、'true' 都視為開。
 */
export function isFlagOn(value: unknown): boolean {
  return value === 1 || value === '1' || value === true || value === 'true';
}
