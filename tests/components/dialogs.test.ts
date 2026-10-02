import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import NameDialog from '~/components/dialogs/NameDialog.vue';
import RefundDialog from '~/components/dialogs/RefundDialog.vue';
import Dialog from '~/components/ui/Dialog.vue';
import Button from '~/components/ui/Button.vue';
import Input from '~/components/ui/Input.vue';
import ErrorText from '~/components/ui/ErrorText.vue';
import CheckRow from '~/components/ui/CheckRow.vue';
import type { Me } from '#shared/types';

// 元件在 Nuxt 裡靠自動匯入使用 useMe 與 <UiXxx>；單獨測試時用全域假的 useMe ＋ 手動註冊元件
const me = ref<Me | null>(null);
vi.stubGlobal('useMe', () => ({ me }));
const components = { UiDialog: Dialog, UiButton: Button, UiInput: Input, UiErrorText: ErrorText, UiCheckRow: CheckRow };

const baseMe: Me = {
  id: 'u1',
  displayName: '小豪LINE',
  pictureUrl: null,
  realName: null,
  role: 'member',
  isActive: true,
  termsVersion: null,
  refundLinePay: false,
  refundBank: false,
  bankCode: null,
  bankAccount: null,
};

/** 假的後端：記錄每次請求的 method 與 body，回傳指定結果 */
function mockApi(status = 200, body: unknown = { ok: true }) {
  const calls: { url: string; method?: string; body?: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return new Response(JSON.stringify(body), { status });
    }),
  );
  return calls;
}

const clickByText = async (w: ReturnType<typeof mount>, text: string) => {
  const btn = w.findAll('button').find((b) => b.text() === text);
  if (!btn) throw new Error(`找不到按鈕：${text}`);
  await btn.trigger('click');
  await flushPromises();
};

beforeEach(() => {
  me.value = { ...baseMe };
});

describe('NameDialog（名字）', () => {
  const mountName = (mode: 'first' | 'edit' = 'first') =>
    mount(NameDialog, { props: { open: true, mode }, global: { components } });

  it('首次設定預填 LINE 名稱；編輯時預填目前名字', () => {
    expect((mountName().find('input').element as HTMLInputElement).value).toBe('小豪LINE');
    me.value = { ...baseMe, realName: '豪哥' };
    expect((mountName('edit').find('input').element as HTMLInputElement).value).toBe('豪哥');
  });

  it('空白不送出，顯示「請填寫名字」', async () => {
    const calls = mockApi();
    const w = mountName();
    await w.find('input').setValue('   ');
    await clickByText(w, '下一步');
    expect(w.text()).toContain('請填寫名字');
    expect(calls).toHaveLength(0);
  });

  it('送出去頭尾空白的名字，成功後通知外層', async () => {
    const calls = mockApi();
    const w = mountName();
    await w.find('input').setValue('  豪哥 ');
    await clickByText(w, '下一步');
    expect(calls).toEqual([{ url: '/api/me', method: 'PATCH', body: { realName: '豪哥' } }]);
    expect(w.emitted('saved')).toHaveLength(1);
  });

  it('後端錯誤訊息顯示在畫面上，不通知外層', async () => {
    mockApi(400, { error: '名字請控制在 20 字以內' });
    const w = mountName();
    await clickByText(w, '下一步');
    expect(w.text()).toContain('名字請控制在 20 字以內');
    expect(w.emitted('saved')).toBeUndefined();
  });

  it('首次設定沒有「取消」；編輯模式才有', () => {
    expect(mountName().findAll('button').some((b) => b.text() === '取消')).toBe(false);
    expect(mountName('edit').findAll('button').some((b) => b.text() === '取消')).toBe(true);
  });
});

describe('RefundDialog（退費途徑）', () => {
  const mountRefund = () => mount(RefundDialog, { props: { open: true, mode: 'first' }, global: { components } });

  it('兩個都沒勾 → 擋下', async () => {
    const calls = mockApi();
    const w = mountRefund();
    await clickByText(w, '完成，開始使用');
    expect(w.text()).toContain('請至少選一種退費途徑');
    expect(calls).toHaveLength(0);
  });

  it('只選 LINE PAY → 不用填銀行資料即可送出', async () => {
    const calls = mockApi();
    const w = mountRefund();
    await clickByText(w, 'LINE PAY');
    expect(w.find('input[aria-label="銀行代號"]').exists()).toBe(false);
    await clickByText(w, '完成，開始使用');
    expect(calls[0]!.body).toEqual({ refundLinePay: true, refundBank: false, bankCode: '', bankAccount: '' });
    expect(w.emitted('saved')).toHaveLength(1);
  });

  it('選銀行轉帳：代號格式錯誤擋下（與後端同一份規則）', async () => {
    const calls = mockApi();
    const w = mountRefund();
    await clickByText(w, '銀行轉帳');
    await w.find('input[aria-label="銀行代號"]').setValue('82');
    await w.find('input[aria-label="銀行帳號"]').setValue('123456789');
    await clickByText(w, '完成，開始使用');
    expect(w.text()).toContain('銀行代號應為 3～7 位數字');
    expect(calls).toHaveLength(0);
  });

  it('選銀行轉帳：送出前帳號去掉空白與連字號', async () => {
    const calls = mockApi();
    const w = mountRefund();
    await clickByText(w, '銀行轉帳');
    await w.find('input[aria-label="銀行代號"]').setValue(' 822 ');
    await w.find('input[aria-label="銀行帳號"]').setValue('1234-5678 9012');
    await clickByText(w, '完成，開始使用');
    expect(calls[0]!.body).toEqual({ refundLinePay: false, refundBank: true, bankCode: '822', bankAccount: '123456789012' });
  });

  it('銀行代號下拉清單有常用銀行（含 822 中國信託）', async () => {
    const w = mountRefund();
    await clickByText(w, '銀行轉帳');
    const options = w.findAll('datalist option').map((o) => o.attributes('value'));
    expect(options).toContain('822');
    expect(options.length).toBeGreaterThan(20);
  });
});
