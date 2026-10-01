import type { Me } from '../types';
import { CURRENT_TERMS_VERSION } from './terms';

/**
 * 首次設定三關，依序：確認暱稱 → 同意條款 → 退費途徑。回傳「目前卡在哪一關」，都完成回 null。
 *
 * Next.js 版這段判斷直接寫在首頁的三個彈窗 open 條件裡，另外 isSetupComplete 又寫一次；
 * 這裡集中成一個函式，彈窗順序與「是否完成」用同一套規則。
 */
export type SetupStage = 'name' | 'terms' | 'refund';

export function setupStage(me: Me | null | undefined): SetupStage | null {
  if (!me) return null;
  if (me.realName === null) return 'name';
  if (me.termsVersion !== CURRENT_TERMS_VERSION) return 'terms';
  if (!me.refundLinePay && !me.refundBank) return 'refund';
  return null;
}

/** 首次設定是否全部完成（未登入視為未完成）。其他彈窗要等這個成立才跳，避免疊在一起。 */
export function isSetupComplete(me: Me | null | undefined): boolean {
  return !!me && setupStage(me) === null;
}
