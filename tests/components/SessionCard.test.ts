import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SessionCard from '~/components/SessionCard.vue';
import Badge from '~/components/ui/Badge.vue';
import type { SessionRow } from '#shared/types';

// SessionCard 在 Nuxt 裡靠自動匯入使用 <UiBadge>；單獨測試時手動註冊
const mountCard = (session: SessionRow, badge: 'attend' | 'extra' | 'leave' = 'attend', slots = {}) =>
  mount(SessionCard, { props: { session, badge }, slots, global: { components: { UiBadge: Badge } } });

const base: SessionRow = {
  id: 's1',
  sessionDate: '2026-10-09',
  startTime: '19:30:00',
  endTime: '22:00:00',
  location: 'NVA',
  kind: 'regular',
};

describe('SessionCard（場次卡）', () => {
  it('顯示日期（含星期）、時間、地點與狀態徽章', () => {
    const text = mountCard(base).text();
    expect(text).toContain('2026/10/09（五）');
    expect(text).toContain('19:30–22:00');
    expect(text).toContain('NVA');
    expect(text).toContain('出席');
  });

  it('有提供請假人數才顯示「目前 N 人請假」（0 人也要顯示）', () => {
    expect(mountCard(base).text()).not.toContain('人請假');
    expect(mountCard({ ...base, leaveCount: 0 }).text()).toContain('目前 0 人請假');
    expect(mountCard({ ...base, leaveCount: 3 }).text()).toContain('目前 3 人請假');
  });

  it('截止時刻以台北時間顯示', () => {
    // 2026-10-06T15:59Z＝台北 10/6（二）23:59
    expect(mountCard({ ...base, leaveDeadline: '2026-10-06T15:59:00.000Z' }).text()).toContain('截止 10/6（週二）23:59');
  });

  it('有備註才顯示「備註：…」', () => {
    expect(mountCard(base).text()).not.toContain('備註');
    expect(mountCard({ ...base, description: '記得帶護膝' }).text()).toContain('備註：記得帶護膝');
  });

  it('已請假／加開用 1px 彩色框；一般場次 0.5px 淡框', () => {
    const border = (w: ReturnType<typeof mountCard>) => {
      const el = w.element as HTMLElement;
      return [el.style.borderWidth, el.style.borderStyle, el.style.borderColor];
    };
    expect(border(mountCard(base, 'leave'))).toEqual(['1px', 'solid', 'var(--border-warning)']);
    expect(border(mountCard({ ...base, kind: 'extra' }, 'extra'))).toEqual(['1px', 'solid', 'var(--border-accent)']);
    expect(border(mountCard(base))).toEqual(['0.5px', 'solid', 'var(--border)']);
  });

  it('有傳 action 插槽才畫按鈕區', () => {
    expect(mountCard(base).find('button').exists()).toBe(false);
    expect(mountCard(base, 'attend', { action: '<button>請假</button>' }).find('button').text()).toBe('請假');
  });
});
