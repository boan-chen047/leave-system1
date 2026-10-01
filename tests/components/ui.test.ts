import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Badge from '~/components/ui/Badge.vue';
import Button from '~/components/ui/Button.vue';
import StatCard from '~/components/ui/StatCard.vue';
import Dialog from '~/components/ui/Dialog.vue';

describe('UiBadge（場次狀態徽章）', () => {
  it.each([
    ['leave', '已請假'],
    ['extra', '加開'],
    ['attend', '出席'],
    ['ended', '已結束'],
  ] as const)('%s → 顯示「%s」', (status, text) => {
    expect(mount(Badge, { props: { status } }).text()).toBe(text);
  });

  it('「已請假」用實心金底＋粗字（唯一代表使用者做過事的狀態，要一眼掃到）', () => {
    const style = mount(Badge, { props: { status: 'leave' } }).attributes('style');
    expect(style).toContain('background: var(--fill-warning)');
    expect(style).toContain('font-weight: 500');
  });
});

describe('UiButton', () => {
  it('預設 secondary：48px、透明底，type=button（不會意外送出表單）', () => {
    const b = mount(Button, { slots: { default: '請假' } });
    expect(b.text()).toBe('請假');
    expect(b.attributes('type')).toBe('button');
    expect(b.attributes('style')).toContain('height: 48px');
  });

  it('主要／危險動作 52px，其餘 48px', () => {
    expect(mount(Button, { props: { variant: 'primary' } }).attributes('style')).toContain('height: 52px');
    expect(mount(Button, { props: { variant: 'danger' } }).attributes('style')).toContain('height: 52px');
    expect(mount(Button, { props: { variant: 'pink' } }).attributes('style')).toContain('height: 48px');
  });

  it('disabled：按鈕停用、半透明', () => {
    const b = mount(Button, { props: { disabled: true } });
    expect(b.attributes('disabled')).toBeDefined();
    expect(b.attributes('style')).toContain('opacity: 0.55');
  });

  it('外部傳入的 onClick 與 style 會透傳到按鈕上', async () => {
    let clicked = 0;
    const b = mount(Button, { attrs: { onClick: () => clicked++, style: 'margin-bottom: 12px' } });
    await b.trigger('click');
    expect(clicked).toBe(1);
    expect(b.attributes('style')).toContain('margin-bottom: 12px');
  });
});

describe('UiStatCard', () => {
  it('顯示標籤與數值', () => {
    const c = mount(StatCard, { props: { label: '10 月出席', value: '3 場' } });
    expect(c.text()).toContain('10 月出席');
    expect(c.text()).toContain('3 場');
  });
});

describe('UiDialog（共用彈窗殼）', () => {
  it('open=false 時什麼都不畫', () => {
    expect(mount(Dialog, { props: { open: false, title: 'x' } }).html()).toBe('<!--v-if-->');
  });

  it('open=true：標題、內容、底部按鈕都在，且是無障礙的 modal 對話框', () => {
    const d = mount(Dialog, {
      props: { open: true, title: '確定要請這場的假？' },
      slots: { default: '<p>內容</p>', footer: '<button>確定</button>' },
    });
    expect(d.attributes('role')).toBe('dialog');
    expect(d.attributes('aria-modal')).toBe('true');
    expect(d.text()).toContain('確定要請這場的假？');
    expect(d.text()).toContain('內容');
    expect(d.find('button').text()).toBe('確定');
  });
});
