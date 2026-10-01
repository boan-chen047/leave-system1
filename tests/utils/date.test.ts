import { describe, it, expect } from 'vitest';
import {
  formatSessionDate,
  formatTimeRange,
  rangeThisMonth,
  rangeLastThreeMonths,
  rangeThisYear,
  sessionHasStarted,
  leaveDeadline,
  pastLeaveDeadline,
  taipeiMonth,
  effectiveLeaveDeadline,
  pastEffectiveLeaveDeadline,
  rangeWholeMonth,
} from '~/utils/date';

describe('rangeWholeMonth（台北本月 1 日～月底）', () => {
  it('9 月 → 9/01～9/30（到月底，不是到今天）', () => {
    expect(rangeWholeMonth(new Date('2026-09-24T12:00:00+08:00'))).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });
  it('大月 31 日、閏年 2 月 29 日', () => {
    expect(rangeWholeMonth(new Date('2026-10-05T12:00:00+08:00')).to).toBe('2026-10-31');
    expect(rangeWholeMonth(new Date('2028-02-10T12:00:00+08:00')).to).toBe('2028-02-29');
    expect(rangeWholeMonth(new Date('2026-02-10T12:00:00+08:00')).to).toBe('2026-02-28');
  });
  it('跨月邊界以台北為準：UTC 9/30 16:30＝台北 10/1 → 10 月', () => {
    expect(rangeWholeMonth(new Date('2026-09-30T16:30:00Z'))).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });
});

// 週四 10/1 19:30 的場次：週二規則的截止是 9/29 23:59
describe('effectiveLeaveDeadline（臨時公告的場次放寬到開打前）', () => {
  const TUE = new Date('2026-09-29T23:59:00+08:00');
  const START = new Date('2026-10-01T19:30:00+08:00');

  it('週二截止前就公告的場次（一般情況）→ 維持週二 23:59', () => {
    expect(effectiveLeaveDeadline('2026-10-01', '19:30:00', '2026-09-10T00:00:00Z')).toEqual(TUE);
  });

  it('週三才加開（公告時已過週二截止）→ 放寬到開打前', () => {
    expect(effectiveLeaveDeadline('2026-10-01', '19:30:00', '2026-09-30T02:00:00Z')).toEqual(START);
  });

  it('沒提供公告時間 → 沿用週二規則（與舊行為相同）', () => {
    expect(effectiveLeaveDeadline('2026-10-01', '19:30:00')).toEqual(TUE);
    expect(effectiveLeaveDeadline('2026-10-01', '19:30:00', null)).toEqual(TUE);
  });

  it('週三加開的場：週三、週四開打前都能請假；開打後不能', () => {
    const announced = '2026-09-30T02:00:00Z'; // 台北 9/30（三）10:00
    const at = (s: string) => new Date(s);
    expect(pastEffectiveLeaveDeadline('2026-10-01', '19:30', announced, at('2026-09-30T12:00:00+08:00'))).toBe(false);
    expect(pastEffectiveLeaveDeadline('2026-10-01', '19:30', announced, at('2026-10-01T19:29:00+08:00'))).toBe(false);
    expect(pastEffectiveLeaveDeadline('2026-10-01', '19:30', announced, at('2026-10-01T19:30:00+08:00'))).toBe(true);
  });
});

describe('taipeiMonth（台北月份，與裝置時區無關）', () => {
  it('跨月邊界：UTC 還是 9/30 16:30，台北已是 10/1 00:30 → 10 月', () => {
    expect(taipeiMonth(new Date('2026-09-30T16:30:00Z'))).toBe(10);
  });
  it('台北 9/30 23:59 仍是 9 月', () => {
    expect(taipeiMonth(new Date('2026-09-30T23:59:00+08:00'))).toBe(9);
  });
  it('與 rangeThisMonth 的月份一致', () => {
    const d = new Date('2026-12-31T20:00:00Z'); // 台北已是 2027-01-01
    expect(taipeiMonth(d)).toBe(Number(rangeThisMonth(d).from.slice(5, 7)));
    expect(taipeiMonth(d)).toBe(1);
  });
});

// 基準：2026-09-08 是星期二
describe('leaveDeadline（早於開打、最近的週二 23:59）', () => {
  it('週二的場次 → 上週二 23:59', () => {
    expect(leaveDeadline('2026-09-08', '19:00').toISOString()).toBe('2026-09-01T15:59:00.000Z');
  });
  it('週三的場次 → 當週週二 23:59', () => {
    expect(leaveDeadline('2026-09-09', '19:00').toISOString()).toBe('2026-09-08T15:59:00.000Z');
  });
  it('週六的場次 → 當週週二 23:59', () => {
    expect(leaveDeadline('2026-09-12', '19:00').toISOString()).toBe('2026-09-08T15:59:00.000Z');
  });
  it('週一的場次 → 上週二 23:59', () => {
    expect(leaveDeadline('2026-09-07', '19:00').toISOString()).toBe('2026-09-01T15:59:00.000Z');
  });
});

describe('pastLeaveDeadline', () => {
  it('截止前可操作、截止後不可', () => {
    // 週六 9/12 的場次，截止 = 9/8 23:59(+08:00) = 9/8 15:59Z
    expect(pastLeaveDeadline('2026-09-12', '19:00', new Date('2026-09-08T15:58:00Z'))).toBe(false);
    expect(pastLeaveDeadline('2026-09-12', '19:00', new Date('2026-09-08T16:00:00Z'))).toBe(true);
  });
});

describe('formatSessionDate', () => {
  it('加上完整年月日與星期', () => {
    expect(formatSessionDate('2026-09-08')).toBe('2026/09/08（二）');
  });
  it('週日顯示為（日）', () => {
    expect(formatSessionDate('2026-09-06')).toBe('2026/09/06（日）');
  });
  it('月份與日期補零', () => {
    expect(formatSessionDate('2026-01-05')).toBe('2026/01/05（一）');
  });
});

describe('formatTimeRange', () => {
  it('去掉秒數並用短破折號相連', () => {
    expect(formatTimeRange('19:00:00', '21:00:00')).toBe('19:00–21:00');
  });
  it('已經沒有秒數時也正常', () => {
    expect(formatTimeRange('14:00', '17:00')).toBe('14:00–17:00');
  });
});

describe('區間快捷', () => {
  const today = new Date('2026-09-07T00:00:00+08:00');

  it('本月＝當月 1 日到今天', () => {
    expect(rangeThisMonth(today)).toEqual({ from: '2026-09-01', to: '2026-09-07' });
  });

  it('上三個月＝往前推三個完整月的 1 日到今天', () => {
    expect(rangeLastThreeMonths(today)).toEqual({ from: '2026-06-01', to: '2026-09-07' });
  });

  it('上三個月跨年時正確', () => {
    const jan = new Date('2026-01-15T00:00:00+08:00');
    expect(rangeLastThreeMonths(jan)).toEqual({ from: '2025-10-01', to: '2026-01-15' });
  });

  it('今年＝1/1 到今天', () => {
    expect(rangeThisYear(today)).toEqual({ from: '2026-01-01', to: '2026-09-07' });
  });

  it('區間以台灣日曆計算，不受執行環境時區影響', () => {
    // 這個絕對時刻在 UTC 是 9/6，但在台灣是 9/7。必須以台灣為準。
    const lateNight = new Date('2026-09-07T01:00:00+08:00');
    expect(rangeThisMonth(lateNight).to).toBe('2026-09-07');
  });
});

describe('sessionHasStarted', () => {
  it('開打前回傳 false', () => {
    const now = new Date('2026-09-08T18:59:00+08:00');
    expect(sessionHasStarted('2026-09-08', '19:00:00', now)).toBe(false);
  });

  it('到開打時刻回傳 true', () => {
    const now = new Date('2026-09-08T19:00:00+08:00');
    expect(sessionHasStarted('2026-09-08', '19:00:00', now)).toBe(true);
  });

  it('同一天但場次還沒開打時仍可操作（只比日期會誤判）', () => {
    const now = new Date('2026-09-08T14:00:00+08:00');
    expect(sessionHasStarted('2026-09-08', '19:00:00', now)).toBe(false);
  });

  it('場次已結束的當晚（跨到隔天凌晨、UTC 仍是前一天）判定為已開打', () => {
    // 台灣 9/9 00:30，UTC 是 9/8 16:30。只用 UTC 日期會誤判成「還沒到 9/8」。
    const now = new Date('2026-09-09T00:30:00+08:00');
    expect(sessionHasStarted('2026-09-08', '19:00:00', now)).toBe(true);
  });

  it('接受不含秒數的 HH:MM 開始時間', () => {
    const now = new Date('2026-09-08T19:01:00+08:00');
    expect(sessionHasStarted('2026-09-08', '19:00', now)).toBe(true);
  });
});
