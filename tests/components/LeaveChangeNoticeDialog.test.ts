import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import LeaveChangeNoticeDialog from '~/components/dialogs/LeaveChangeNoticeDialog.vue';
import Dialog from '~/components/ui/Dialog.vue';
import Button from '~/components/ui/Button.vue';

// 案例由 Next.js 版 tests/components/LeaveChangeNoticeDialog.test.tsx 搬來。
const navigateTo = vi.fn();
const global = { components: { UiDialog: Dialog, UiButton: Button } };

const NOTICE = {
  id: 'n1',
  from: { date: '2026-10-02', start: '19:30:00', end: '22:00:00' },
  to: { date: '2026-10-03', start: '20:00:00', end: '22:30:00' },
};

function mockFetch(list: unknown[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(init?.method === 'POST' ? { ok: true } : list));
    }),
  );
  return calls;
}

const mountDialog = async (props: { enabled: boolean; onCancelPage?: boolean }) => {
  const w = mount(LeaveChangeNoticeDialog, { props, global });
  await flushPromises();
  return w;
};
const clickByText = async (w: Awaited<ReturnType<typeof mountDialog>>, text: string) => {
  await w.findAll('button').find((b) => b.text() === text)!.trigger('click');
  await flushPromises();
};

describe('LeaveChangeNoticeDialog（請假場次異動彈窗）', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    navigateTo.mockReset();
    vi.stubGlobal('navigateTo', navigateTo);
  });

  it('首次設定未完成（enabled=false）→ 不查、不跳', async () => {
    const calls = mockFetch([NOTICE]);
    const w = await mountDialog({ enabled: false });
    expect(calls).toHaveLength(0);
    expect(w.find('[role="dialog"]').exists()).toBe(false);
  });

  it('沒有未讀通知 → 不跳', async () => {
    mockFetch([]);
    const w = await mountDialog({ enabled: true });
    expect(w.find('[role="dialog"]').exists()).toBe(false);
  });

  it('有通知 → 顯示「原 → 新」與說明', async () => {
    mockFetch([NOTICE]);
    const w = await mountDialog({ enabled: true });
    expect(w.text()).toContain('你請假的場次有異動');
    expect(w.text()).toContain('原 2026/10/02（五） 19:30–22:00');
    expect(w.text()).toContain('新 2026/10/03（六） 20:00–22:30');
    expect(w.text()).toContain('仍視為請假');
  });

  it('按「知道了」→ 標記已讀並關閉，不換頁', async () => {
    const calls = mockFetch([NOTICE]);
    const w = await mountDialog({ enabled: true });
    await clickByText(w, '知道了');
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    const post = calls.find((c) => c.init?.method === 'POST')!;
    expect(JSON.parse(String(post.init!.body))).toEqual({ ids: ['n1'] });
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('按「去銷假」→ 標記已讀並前往銷假頁', async () => {
    mockFetch([NOTICE]);
    const w = await mountDialog({ enabled: true });
    await clickByText(w, '去銷假');
    expect(navigateTo).toHaveBeenCalledWith('/cancel');
  });

  it('已在銷假頁 → 不顯示「去銷假」', async () => {
    mockFetch([NOTICE]);
    const w = await mountDialog({ enabled: true, onCancelPage: true });
    expect(w.text()).toContain('知道了');
    expect(w.text()).not.toContain('去銷假');
  });

  it('首次設定完成（enabled 由 false 變 true）時才去查', async () => {
    const calls = mockFetch([NOTICE]);
    const w = await mountDialog({ enabled: false });
    await w.setProps({ enabled: true });
    await flushPromises();
    expect(calls.map((c) => c.url)).toEqual(['/api/me/notices']);
    expect(w.text()).toContain('你請假的場次有異動');
  });
});
